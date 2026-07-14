import { useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { supabase } from "@/integrations/supabase/client";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2, Mail, Search } from "lucide-react";
import { SEO } from "@/components/SEO";

type OrderStatus = "paid" | "done" | "processing" | "cancelled" | "paused";

interface Order {
  id: string;
  title: string;
  description: string | null;
  customer_name: string | null;
  customer_email: string | null;
  price: number | null;
  currency: string;
  notes: string | null;
  status: OrderStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  product_size: string | null;
  product_url: string | null;
  phone: string | null;
  notify_preference: string | null;
  is_public_request: boolean | null;
}

const STATUS_LABEL: Record<OrderStatus, string> = {
  paid: "Zaplaceno",
  done: "Vyřízeno",
  processing: "Zpracovává se",
  cancelled: "Zrušeno",
  paused: "Pozastaveno",
};

const STATUS_VARIANT: Record<OrderStatus, "default" | "secondary" | "destructive" | "outline"> = {
  paid: "default",
  done: "default",
  processing: "secondary",
  cancelled: "destructive",
  paused: "outline",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  customer_name: "",
  customer_email: "",
  price: "",
  currency: "CZK",
  notes: "",
  status: "processing" as OrderStatus,
};

export default function Orders() {
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "all">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const canView = can("orders", "access");
  const canManage = can("orders", "manage");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Chyba načítání: " + error.message);
    else setOrders((data ?? []) as Order[]);
    setLoading(false);
  };

  useEffect(() => {
    if (!permsLoading && canView) load();
  }, [permsLoading, canView]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (query) {
        const q = query.toLowerCase();
        return (
          o.title.toLowerCase().includes(q) ||
          (o.customer_name ?? "").toLowerCase().includes(q) ||
          (o.customer_email ?? "").toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [orders, query, statusFilter]);

  const openNew = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (o: Order) => {
    setEditing(o);
    setForm({
      title: o.title,
      description: o.description ?? "",
      customer_name: o.customer_name ?? "",
      customer_email: o.customer_email ?? "",
      price: o.price?.toString() ?? "",
      currency: o.currency,
      notes: o.notes ?? "",
      status: o.status,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast.error("Titulek je povinný");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      customer_name: form.customer_name.trim() || null,
      customer_email: form.customer_email.trim() || null,
      price: form.price ? Number(form.price) : null,
      currency: form.currency || "CZK",
      notes: form.notes.trim() || null,
      status: form.status,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("orders").update(payload).eq("id", editing.id));
    } else {
      ({ error } = await supabase
        .from("orders")
        .insert({ ...payload, created_by: user?.id ?? null }));
    }
    setSaving(false);
    if (error) return toast.error("Chyba: " + error.message);
    toast.success(editing ? "Uloženo" : "Zakázka vytvořena");
    setDialogOpen(false);
    load();
  };

  const changeStatus = async (o: Order, status: OrderStatus) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", o.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Stav změněn na " + STATUS_LABEL[status]);
      setOrders((prev) => prev.map((x) => (x.id === o.id ? { ...x, status } : x)));
    }
  };

  const remove = async (o: Order) => {
    const { error } = await supabase.from("orders").delete().eq("id", o.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Zakázka smazána");
      setOrders((prev) => prev.filter((x) => x.id !== o.id));
    }
  };

  const sendMail = (o: Order, kind: "done" | "custom") => {
    if (!o.customer_email) {
      toast.error("Zákazník nemá e-mail");
      return;
    }
    const subject =
      kind === "done"
        ? `Zakázka „${o.title}" je hotová`
        : `Informace k zakázce „${o.title}"`;
    const body =
      kind === "done"
        ? `Dobrý den${o.customer_name ? " " + o.customer_name : ""},\n\n` +
          `rádi bychom Vás informovali, že Vaše zakázka „${o.title}" je vyřízená a připravena.\n\n` +
          (o.price ? `Cena: ${o.price} ${o.currency}\n\n` : "") +
          `S pozdravem`
        : `Dobrý den${o.customer_name ? " " + o.customer_name : ""},\n\n` +
          `zasíláme informaci k zakázce „${o.title}".\n\nAktuální stav: ${STATUS_LABEL[o.status]}\n\nS pozdravem`;
    const href = `mailto:${encodeURIComponent(o.customer_email)}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
  };

  if (authLoading || permsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!canView) {
    return (
      <>
        <Navbar />
        <main className="container mx-auto py-16 text-center">
          <h1 className="text-2xl font-semibold mb-2">Přístup zamítnut</h1>
          <p className="text-muted-foreground">
            Nemáte oprávnění zobrazit zakázky. Požádejte správce o oprávnění
            <code className="mx-1 px-2 py-0.5 rounded bg-muted">orders : access</code>.
          </p>
        </main>
      </>
    );
  }

  return (
    <>
      <SEO title="Zakázky – správa" description="Interní přehled a správa zakázek" />
      <Navbar />
      <main className="container mx-auto py-8 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold">Zakázky</h1>
            <p className="text-muted-foreground">Přehled a správa zakázek</p>
          </div>
          {canManage && (
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-2" /> Nová zakázka
            </Button>
          )}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Hledat podle titulku, jména nebo e-mailu…"
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | "all")}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Všechny stavy</SelectItem>
                {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>
            ) : filtered.length === 0 ? (
              <p className="text-center py-12 text-muted-foreground">Žádné zakázky.</p>
            ) : (
              <div className="space-y-3">
                {filtered.map((o) => (
                  <div key={o.id} className="border rounded-lg p-4 flex flex-col md:flex-row gap-4 md:items-center">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{o.title}</h3>
                        <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                        {o.is_public_request && <Badge variant="outline">Zákazník</Badge>}
                        {o.product_size && <Badge variant="outline">Velikost {o.product_size}</Badge>}
                      </div>
                      {o.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{o.description}</p>
                      )}
                      <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-4 gap-y-1">
                        {o.customer_name && <span>👤 {o.customer_name}</span>}
                        {o.customer_email && <span>✉ {o.customer_email}</span>}
                        {o.phone && <span>📞 {o.phone}</span>}
                        {o.notify_preference && <span>📣 {o.notify_preference === "email" ? "E-mail" : "Telefon"}</span>}
                        {o.price != null && <span>💰 {o.price} {o.currency}</span>}
                        <span>🕒 {new Date(o.created_at).toLocaleDateString("cs-CZ")}</span>
                        {o.product_url && (
                          <a href={o.product_url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                            🔗 Model
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {canManage && (
                        <Select value={o.status} onValueChange={(v) => changeStatus(o, v as OrderStatus)}>
                          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                              <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      {o.customer_email && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => sendMail(o, "done")} title="Poslat e-mail: hotovo">
                            <Mail className="w-4 h-4 mr-1" /> Hotovo
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => sendMail(o, "custom")} title="Poslat e-mail: info">
                            <Mail className="w-4 h-4" />
                          </Button>
                        </>
                      )}
                      {canManage && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(o)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="ghost" className="text-destructive">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Smazat zakázku?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Zakázka „{o.title}" bude nenávratně smazána.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Zrušit</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove(o)}>Smazat</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Upravit zakázku" : "Nová zakázka"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titulek *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Popis</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Zákazník</Label>
                <Input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div>
                <Label>E-mail zákazníka</Label>
                <Input type="email" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
              </div>
              <div>
                <Label>Cena</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>Měna</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Stav</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as OrderStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Interní poznámky</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button onClick={save} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editing ? "Uložit" : "Vytvořit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

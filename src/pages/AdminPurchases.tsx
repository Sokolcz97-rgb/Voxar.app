import { useCallback, useEffect, useMemo, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { PageHero } from "@/components/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Check, Loader2, Receipt, X } from "lucide-react";

type Purchase = {
  id: string;
  user_id: string | null;
  kind: string;
  title: string;
  amount_czk: number;
  currency: string;
  cosmetic_id: string | null;
  requires_manual: boolean;
  status: string;
  fulfilled: boolean;
  order_id: string | null;
  payment_method: string | null;
  note: string | null;
  created_at: string;
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Čeká na ověření",
  paid: "Zaplaceno",
  cancelled: "Zrušeno",
};

const KIND_LABEL: Record<string, string> = {
  frame: "Rámeček",
  plugin: "Plugin",
  donation: "Dar",
};

export default function AdminPurchases() {
  const [rows, setRows] = useState<Purchase[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "paid" | "donation">("all");

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("shop_purchases")
      .select("*")
      .order("created_at", { ascending: false });
    const list = (data ?? []) as Purchase[];
    setRows(list);

    const ids = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,display_name,username")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (profs ?? []).forEach((p: { user_id: string; display_name: string | null; username: string | null }) => {
        map[p.user_id] = p.display_name || p.username || p.user_id.slice(0, 8);
      });
      setNames(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const approve = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.rpc("shop_approve_purchase", { _id: id });
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Nákup schválen a obsah přidělen.");
    await load();
  };

  const cancel = async (id: string) => {
    setBusy(id);
    const { error } = await supabase.from("shop_purchases").update({ status: "cancelled" }).eq("id", id);
    setBusy(null);
    if (error) {
      toast.error(error.message);
      return;
    }
    await load();
  };

  const filtered = useMemo(() => {
    if (filter === "all") return rows;
    if (filter === "donation") return rows.filter((r) => r.kind === "donation");
    return rows.filter((r) => r.status === filter);
  }, [rows, filter]);

  const totals = useMemo(() => {
    const paid = rows.filter((r) => r.status === "paid");
    return {
      revenue: paid.reduce((s, r) => s + r.amount_czk, 0),
      donations: paid.filter((r) => r.kind === "donation").reduce((s, r) => s + r.amount_czk, 0),
      pending: rows.filter((r) => r.status === "pending").length,
    };
  }, [rows]);

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <SEO title="Nákupy a dary" description="Přehled nákupů a darů v obchodě." />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <PageHero
          eyebrow="Administrace"
          title="Nákupy a dary"
          description="Kdo si co koupil, za kolik a kolik daroval."
          icon={Receipt}
        />

        <div className="grid sm:grid-cols-3 gap-4 mb-6">
          <Card className="glass border-border">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Přijato celkem</p>
              <p className="text-3xl font-display font-black text-primary">{totals.revenue} Kč</p>
            </CardContent>
          </Card>
          <Card className="glass border-border">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Z toho dary</p>
              <p className="text-3xl font-display font-black">{totals.donations} Kč</p>
            </CardContent>
          </Card>
          <Card className="glass border-border">
            <CardContent className="pt-6">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Čeká na ověření</p>
              <p className="text-3xl font-display font-black">{totals.pending}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)} className="mb-4">
          <TabsList>
            <TabsTrigger value="all">Vše</TabsTrigger>
            <TabsTrigger value="pending">Čekající</TabsTrigger>
            <TabsTrigger value="paid">Zaplacené</TabsTrigger>
            <TabsTrigger value="donation">Dary</TabsTrigger>
          </TabsList>
        </Tabs>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-12 text-center text-muted-foreground">Zatím žádné záznamy.</CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Card key={r.id} className="glass border-border">
                <CardContent className="pt-6 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{r.title}</h3>
                      <Badge variant="outline">{KIND_LABEL[r.kind] ?? r.kind}</Badge>
                      <Badge variant={r.status === "paid" ? "default" : r.status === "cancelled" ? "destructive" : "secondary"}>
                        {STATUS_LABEL[r.status] ?? r.status}
                      </Badge>
                      {r.order_id && <Badge variant="outline">Zakázka založena</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-4">
                      <span>👤 {r.user_id ? names[r.user_id] ?? r.user_id.slice(0, 8) : "—"}</span>
                      <span>💰 {r.amount_czk} {r.currency}</span>
                      {r.payment_method && <span>💳 {r.payment_method === "qr" ? "QR platba" : "PayPal"}</span>}
                      <span>🕒 {new Date(r.created_at).toLocaleString("cs-CZ")}</span>
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {r.status !== "paid" && (
                      <Button size="sm" disabled={busy === r.id} onClick={() => approve(r.id)}>
                        <Check className="h-4 w-4 mr-1" /> Potvrdit platbu
                      </Button>
                    )}
                    {r.status === "pending" && (
                      <Button size="sm" variant="outline" disabled={busy === r.id} onClick={() => cancel(r.id)}>
                        <X className="h-4 w-4 mr-1" /> Zrušit
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

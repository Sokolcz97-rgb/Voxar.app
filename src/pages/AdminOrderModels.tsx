import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Pencil, Plus, Trash2, ExternalLink } from "lucide-react";

type Model = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  source_url: string;
  category: string | null;
  license: string;
  is_active: boolean;
};

const EMPTY = {
  name: "", description: "", image_url: "", source_url: "",
  category: "", license: "Public Domain", is_active: true,
};

export default function AdminOrderModels() {
  const { user, loading: authLoading } = useAuth();
  const { can, loading: permsLoading } = usePermissions();
  const [rows, setRows] = useState<Model[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Model | null>(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const canManage = can("orders", "manage");

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("order_models").select("*").order("created_at", { ascending: false });
    setRows((data ?? []) as Model[]);
    setLoading(false);
  };
  useEffect(() => { if (!permsLoading && canManage) load(); }, [permsLoading, canManage]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setDialogOpen(true); };
  const openEdit = (m: Model) => {
    setEditing(m);
    setForm({
      name: m.name, description: m.description ?? "", image_url: m.image_url ?? "",
      source_url: m.source_url, category: m.category ?? "", license: m.license, is_active: m.is_active,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.source_url.trim()) {
      toast.error("Název a odkaz jsou povinné");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      image_url: form.image_url.trim() || null,
      source_url: form.source_url.trim(),
      category: form.category.trim() || null,
      license: form.license.trim() || "Public Domain",
      is_active: form.is_active,
    };
    const { error } = editing
      ? await supabase.from("order_models").update(payload).eq("id", editing.id)
      : await supabase.from("order_models").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Uloženo");
    setDialogOpen(false);
    load();
  };

  const remove = async (m: Model) => {
    if (!confirm(`Smazat model „${m.name}"?`)) return;
    const { error } = await supabase.from("order_models").delete().eq("id", m.id);
    if (error) return toast.error(error.message);
    setRows((prev) => prev.filter((x) => x.id !== m.id));
  };

  if (authLoading || permsLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!canManage) return <><Navbar /><main className="container py-16 text-center"><h1 className="text-2xl font-semibold">Přístup zamítnut</h1></main></>;

  return (
    <>
      <SEO title="Katalog 3D modelů" description="Správa Public Domain katalogu modelů" />
      <Navbar />
      <main className="container mx-auto py-8 space-y-6">
        <div className="flex justify-between items-center flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Katalog 3D modelů</h1>
            <p className="text-muted-foreground">Public Domain modely nabízené zákazníkům pro zakázky</p>
          </div>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-2" />Přidat model</Button>
        </div>

        <Card><CardContent className="pt-6">
          {loading ? <div className="py-12 flex justify-center"><Loader2 className="animate-spin" /></div>
            : rows.length === 0 ? <p className="text-center py-12 text-muted-foreground">Zatím žádné modely.</p>
            : <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {rows.map((m) => (
                <div key={m.id} className="border rounded-lg p-3 flex flex-col gap-2">
                  {m.image_url && <img loading="lazy" decoding="async" src={m.image_url} alt={m.name} className="w-full h-32 object-cover rounded" />}
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-semibold truncate">{m.name}</div>
                      <div className="text-xs text-muted-foreground">{m.category || "—"} · {m.license}</div>
                      {!m.is_active && <div className="text-[10px] uppercase text-destructive">Neaktivní</div>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <a href={m.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary inline-flex items-center gap-1 mr-auto">
                      <ExternalLink className="w-3 h-3" /> Odkaz
                    </a>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(m)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove(m)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
              ))}
            </div>}
        </CardContent></Card>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Upravit model" : "Nový model"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Název *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Kategorie</Label><Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="např. Nože, Figurky…" /></div>
            <div><Label>Popis</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Obrázek (URL)</Label><Input type="url" value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} placeholder="https://…" /></div>
            <div><Label>Odkaz na model *</Label><Input type="url" value={form.source_url} onChange={(e) => setForm({ ...form, source_url: e.target.value })} placeholder="https://makerworld.com/…" /></div>
            <div><Label>Licence</Label><Input value={form.license} onChange={(e) => setForm({ ...form, license: e.target.value })} /></div>
            <div className="flex items-center gap-3"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>Aktivní (nabízet v katalogu)</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Zrušit</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{editing ? "Uložit" : "Vytvořit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

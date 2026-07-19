import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import {
  ArrowLeft, ArrowUp, ArrowDown, Copy, Loader2, Plus, Save, Trash2,
  Type, AlignLeft, ListChecks, CircleDot, ChevronDownSquare, Hash, Mail, Calendar, Star,
} from "lucide-react";

type FieldType = "text" | "textarea" | "radio" | "checkbox" | "select" | "number" | "email" | "date" | "rating";

const TYPE_META: { value: FieldType; label: string; icon: any }[] = [
  { value: "text", label: "Krátká odpověď", icon: Type },
  { value: "textarea", label: "Dlouhá odpověď", icon: AlignLeft },
  { value: "radio", label: "Jedna z voleb", icon: CircleDot },
  { value: "checkbox", label: "Více voleb", icon: ListChecks },
  { value: "select", label: "Rozbalovací seznam", icon: ChevronDownSquare },
  { value: "email", label: "E-mail", icon: Mail },
  { value: "number", label: "Číslo", icon: Hash },
  { value: "date", label: "Datum", icon: Calendar },
  { value: "rating", label: "Hodnocení (1–5)", icon: Star },
];

type Field = {
  id: string;
  form_id: string;
  position: number;
  type: FieldType;
  label: string;
  description: string | null;
  required: boolean;
  options: string[];
};

type FormRow = {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  allow_anonymous: boolean;
  cover_emoji: string | null;
  success_message: string | null;
};

export default function FormEditor() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<FormRow | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [deletedFieldIds, setDeletedFieldIds] = useState<string[]>([]);

  useEffect(() => {
    if (!user || !id) return;
    (async () => {
      const { data: f } = await supabase.from("forms").select("*").eq("id", id).maybeSingle();
      if (!f) { setLoading(false); return; }
      setForm(f as any);
      const { data: fs } = await supabase.from("form_fields").select("*").eq("form_id", id).order("position");
      setFields(((fs ?? []) as any[]).map((x) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })));
      setLoading(false);
    })();
  }, [user, id]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!loading && (!form || form.owner_id !== user.id)) return <Navigate to="/profile/formulare" replace />;

  function updateField(idx: number, patch: Partial<Field>) {
    setFields((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
  }
  function move(idx: number, dir: -1 | 1) {
    setFields((prev) => {
      const arr = [...prev];
      const t = idx + dir;
      if (t < 0 || t >= arr.length) return prev;
      [arr[idx], arr[t]] = [arr[t], arr[idx]];
      return arr.map((f, i) => ({ ...f, position: i }));
    });
  }
  function duplicate(idx: number) {
    setFields((prev) => {
      const src = prev[idx];
      const copy: Field = { ...src, id: `new-${crypto.randomUUID()}`, label: src.label + " (kopie)" };
      const arr = [...prev.slice(0, idx + 1), copy, ...prev.slice(idx + 1)];
      return arr.map((f, i) => ({ ...f, position: i }));
    });
  }
  function removeField(idx: number) {
    setFields((prev) => {
      const arr = [...prev];
      const [gone] = arr.splice(idx, 1);
      if (!gone.id.startsWith("new-")) setDeletedFieldIds((d) => [...d, gone.id]);
      return arr.map((f, i) => ({ ...f, position: i }));
    });
  }
  function addField(type: FieldType = "text") {
    setFields((prev) => [
      ...prev,
      {
        id: `new-${crypto.randomUUID()}`,
        form_id: id!,
        position: prev.length,
        type,
        label: "Otázka",
        description: "",
        required: false,
        options: type === "radio" || type === "checkbox" || type === "select" ? ["Možnost 1"] : [],
      },
    ]);
  }

  async function save() {
    if (!form) return;
    setSaving(true);
    // 1. update form meta
    const { error: fErr } = await supabase.from("forms").update({
      title: form.title, description: form.description, is_published: form.is_published,
      allow_anonymous: form.allow_anonymous, cover_emoji: form.cover_emoji, success_message: form.success_message,
    }).eq("id", form.id);
    if (fErr) { toast({ title: "Uložení selhalo", description: fErr.message, variant: "destructive" }); setSaving(false); return; }

    // 2. delete removed
    if (deletedFieldIds.length) {
      await supabase.from("form_fields").delete().in("id", deletedFieldIds);
    }
    // 3. upsert fields
    const toInsert = fields.filter((f) => f.id.startsWith("new-")).map((f) => ({
      form_id: form.id, position: f.position, type: f.type, label: f.label,
      description: f.description, required: f.required, options: f.options,
    }));
    const toUpdate = fields.filter((f) => !f.id.startsWith("new-"));

    if (toInsert.length) {
      const { error } = await supabase.from("form_fields").insert(toInsert);
      if (error) { toast({ title: "Uložení polí selhalo", description: error.message, variant: "destructive" }); setSaving(false); return; }
    }
    for (const f of toUpdate) {
      const { error } = await supabase.from("form_fields").update({
        position: f.position, type: f.type, label: f.label, description: f.description,
        required: f.required, options: f.options,
      }).eq("id", f.id);
      if (error) { toast({ title: "Uložení pole selhalo", description: error.message, variant: "destructive" }); setSaving(false); return; }
    }
    setDeletedFieldIds([]);
    setSaving(false);
    toast({ title: "Uloženo" });
    // reload to get real ids
    const { data: fs } = await supabase.from("form_fields").select("*").eq("form_id", form.id).order("position");
    setFields(((fs ?? []) as any[]).map((x) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })));
  }

  if (loading || !form) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const publicUrl = `${window.location.origin}/f/${form.slug}`;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <SEO title={`Úprava formuláře: ${form.title}`} />
      <Navbar />
      <main className="container py-8 max-w-5xl animate-fade-in">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <Button variant="ghost" asChild><Link to="/profile/formulare"><ArrowLeft className="w-4 h-4 mr-2" />Zpět</Link></Button>
          <div className="flex items-center gap-2">
            {form.is_published && <Badge>Zveřejněno</Badge>}
            <Button onClick={save} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Uložit
            </Button>
          </div>
        </div>

        <Card className="glass border-border mb-4">
          <CardContent className="pt-6 space-y-4">
            <div className="flex gap-3 items-start">
              <div className="w-16">
                <Label>Emoji</Label>
                <Input value={form.cover_emoji ?? ""} onChange={(e) => setForm({ ...form, cover_emoji: e.target.value })} placeholder="📝" maxLength={2} className="text-center text-2xl" />
              </div>
              <div className="flex-1">
                <Label>Název</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="text-xl font-semibold" />
              </div>
            </div>
            <div>
              <Label>Popis (volitelně)</Label>
              <Textarea value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div>
              <Label>Zpráva po odeslání</Label>
              <Input value={form.success_message ?? ""} onChange={(e) => setForm({ ...form, success_message: e.target.value })} placeholder="Děkujeme za odeslání!" />
            </div>
            <div className="flex flex-col sm:flex-row gap-4 pt-2 border-t border-border">
              <div className="flex items-center gap-3">
                <Switch checked={form.is_published} onCheckedChange={(v) => setForm({ ...form, is_published: v })} />
                <span className="text-sm">Zveřejnit</span>
              </div>
              <div className="flex items-center gap-3">
                <Switch checked={form.allow_anonymous} onCheckedChange={(v) => setForm({ ...form, allow_anonymous: v })} />
                <span className="text-sm">Povolit anonymní odpovědi</span>
              </div>
            </div>
            {form.is_published && (
              <div className="flex items-center gap-2 bg-muted/40 rounded-md px-3 py-2 text-sm">
                <span className="truncate flex-1">{publicUrl}</span>
                <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: "Odkaz zkopírován" }); }}>
                  <Copy className="w-3 h-3 mr-1" />Kopírovat
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="space-y-3">
          {fields.map((f, i) => (
            <Card key={f.id} className="glass border-border">
              <CardContent className="pt-6 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">#{i + 1}</Badge>
                  <Select value={f.type} onValueChange={(v) => updateField(i, { type: v as FieldType, options: ["radio","checkbox","select"].includes(v) && f.options.length === 0 ? ["Možnost 1"] : f.options })}>
                    <SelectTrigger className="w-[220px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TYPE_META.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center gap-2 text-sm"><Switch checked={f.required} onCheckedChange={(v) => updateField(i, { required: v })} /> Povinné</div>
                    <Button size="icon" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => move(i, 1)} disabled={i === fields.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => duplicate(i)}><Copy className="w-4 h-4" /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => removeField(i)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>
                <Input value={f.label} onChange={(e) => updateField(i, { label: e.target.value })} placeholder="Otázka" />
                <Input value={f.description ?? ""} onChange={(e) => updateField(i, { description: e.target.value })} placeholder="Nápověda (volitelně)" />

                {(f.type === "radio" || f.type === "checkbox" || f.type === "select") && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary/30">
                    {f.options.map((opt, oi) => (
                      <div key={oi} className="flex gap-2">
                        <Input value={opt} onChange={(e) => {
                          const arr = [...f.options]; arr[oi] = e.target.value; updateField(i, { options: arr });
                        }} placeholder={`Možnost ${oi + 1}`} />
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => {
                          updateField(i, { options: f.options.filter((_, x) => x !== oi) });
                        }}><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    ))}
                    <Button size="sm" variant="outline" onClick={() => updateField(i, { options: [...f.options, `Možnost ${f.options.length + 1}`] })}>
                      <Plus className="w-3 h-3 mr-1" />Přidat možnost
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="glass border-border mt-4">
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground mb-3">Přidat pole:</div>
            <div className="flex flex-wrap gap-2">
              {TYPE_META.map((t) => {
                const Icon = t.icon;
                return (
                  <Button key={t.value} size="sm" variant="outline" onClick={() => addField(t.value)}>
                    <Icon className="w-3 h-3 mr-1" />{t.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

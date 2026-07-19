import { useEffect, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { ArrowLeft, BarChart3, Download, Loader2, Trash2 } from "lucide-react";

type Field = { id: string; position: number; type: string; label: string; options: string[] };
type Response = { id: string; respondent_id: string | null; answers: Record<string, any>; submitted_at: string };

export default function FormResults() {
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [rows, setRows] = useState<Response[]>([]);

  async function load() {
    if (!id) return;
    setLoading(true);
    const { data: f } = await supabase.from("forms").select("*").eq("id", id).maybeSingle();
    setForm(f);
    const { data: fs } = await supabase.from("form_fields").select("*").eq("form_id", id).order("position");
    setFields(((fs ?? []) as any[]).map((x) => ({ ...x, options: Array.isArray(x.options) ? x.options : [] })));
    const { data: rs } = await supabase.from("form_responses").select("*").eq("form_id", id).order("submitted_at", { ascending: false });
    setRows((rs ?? []) as Response[]);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!loading && (!form || form.owner_id !== user.id)) return <Navigate to="/profile/formulare" replace />;

  async function del(rid: string) {
    if (!confirm("Smazat tuto odpověď?")) return;
    const { error } = await supabase.from("form_responses").delete().eq("id", rid);
    if (error) toast({ title: "Chyba", description: error.message, variant: "destructive" });
    else load();
  }

  function exportCsv() {
    if (!rows.length || !fields.length) return;
    const header = ["submitted_at", ...fields.map((f) => f.label)];
    const lines = [header.join(",")];
    for (const r of rows) {
      const cells = [new Date(r.submitted_at).toISOString()];
      for (const f of fields) {
        const v = r.answers?.[f.id];
        const s = Array.isArray(v) ? v.join("; ") : v == null ? "" : String(v);
        cells.push(`"${s.replace(/"/g, '""')}"`);
      }
      lines.push(cells.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${form.slug}-odpovedi.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !form) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <SEO title={`Odpovědi: ${form.title}`} />
      <Navbar />
      <main className="container py-8 max-w-5xl animate-fade-in">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
          <Button variant="ghost" asChild><Link to="/profile/formulare"><ArrowLeft className="w-4 h-4 mr-2" />Zpět</Link></Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCsv} disabled={!rows.length}><Download className="w-4 h-4 mr-2" />Export CSV</Button>
          </div>
        </div>

        <Card className="glass border-border mb-4">
          <CardContent className="pt-6 flex items-center gap-3 flex-wrap">
            <div className="text-2xl">{form.cover_emoji || "📝"}</div>
            <div className="flex-1">
              <h1 className="text-xl font-semibold">{form.title}</h1>
              <div className="text-sm text-muted-foreground flex gap-3">
                <span className="flex items-center gap-1"><BarChart3 className="w-3 h-3" />{rows.length} odpovědí</span>
                {form.is_published ? <Badge>Zveřejněno</Badge> : <Badge variant="outline">Koncept</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>

        {rows.length === 0 ? (
          <Card className="glass border-border"><CardContent className="py-12 text-center text-muted-foreground">Zatím žádné odpovědi.</CardContent></Card>
        ) : (
          <div className="space-y-3">
            {rows.map((r) => (
              <Card key={r.id} className="glass border-border">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{new Date(r.submitted_at).toLocaleString("cs-CZ")} · {r.respondent_id ? "Přihlášený" : "Anonymní"}</span>
                    <Button size="icon" variant="ghost" className="text-destructive h-7 w-7" onClick={() => del(r.id)}><Trash2 className="w-3 h-3" /></Button>
                  </div>
                  <div className="grid gap-2">
                    {fields.map((f) => {
                      const v = r.answers?.[f.id];
                      const rendered = Array.isArray(v) ? v.join(", ") : v == null || v === "" ? <span className="italic text-muted-foreground">bez odpovědi</span> : String(v);
                      return (
                        <div key={f.id} className="text-sm">
                          <div className="text-xs text-muted-foreground">{f.label}</div>
                          <div>{rendered}</div>
                        </div>
                      );
                    })}
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

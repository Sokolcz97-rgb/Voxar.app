import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { Navbar } from "@/components/Navbar";
import { SEO } from "@/components/SEO";
import { PageHero } from "@/components/PageHero";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { ClipboardList, Copy, Eye, Loader2, Pencil, Plus, Trash2, BarChart3, ExternalLink } from "lucide-react";

type Form = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  is_published: boolean;
  allow_anonymous: boolean;
  cover_emoji: string | null;
  created_at: string;
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
    .slice(0, 40) || "formular";
}

export default function MyForms() {
  const { user, loading: authLoading } = useAuth();
  const nav = useNavigate();
  const [rows, setRows] = useState<Form[]>([]);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  async function load() {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("forms")
      .select("id,title,description,slug,is_published,allow_anonymous,cover_emoji,created_at")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    const forms = (data ?? []) as Form[];
    setRows(forms);
    if (forms.length) {
      const ids = forms.map((f) => f.id);
      const { data: resp } = await supabase
        .from("form_responses")
        .select("form_id")
        .in("form_id", ids);
      const c: Record<string, number> = {};
      (resp ?? []).forEach((r: any) => { c[r.form_id] = (c[r.form_id] ?? 0) + 1; });
      setCounts(c);
    }
    setLoading(false);
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  async function create() {
    if (!user) return;
    const title = newTitle.trim() || "Nový formulář";
    setCreating(true);
    const base = slugify(title);
    const slug = `${base}-${Math.random().toString(36).slice(2, 7)}`;
    const { data, error } = await supabase.from("forms").insert({
      owner_id: user.id, title, slug, description: "",
    }).select("id").maybeSingle();
    setCreating(false);
    if (error || !data) {
      toast({ title: "Nepodařilo se vytvořit", description: error?.message, variant: "destructive" });
      return;
    }
    setNewTitle("");
    nav(`/profile/formulare/${data.id}/edit`);
  }

  async function remove(id: string) {
    if (!confirm("Opravdu smazat formulář a všechny odpovědi?")) return;
    const { error } = await supabase.from("forms").delete().eq("id", id);
    if (error) toast({ title: "Nepodařilo se smazat", description: error.message, variant: "destructive" });
    else { toast({ title: "Smazáno" }); load(); }
  }

  function publicUrl(slug: string) {
    return `${window.location.origin}/f/${slug}`;
  }

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <SEO title="Moje formuláře" description="Vytvářejte a spravujte vlastní formuláře — nábor, průzkumy, zpětná vazba." />
      <Navbar />
      <main className="container py-10 max-w-5xl animate-fade-in">
        <PageHero eyebrow="Aplikace · Formuláře" title="Moje formuláře" description="Vytvořte formulář pro nábor, průzkum nebo zpětnou vazbu — sdílejte odkazem a sbírejte odpovědi." icon={ClipboardList} />

        <Card className="glass border-border mb-6">
          <CardContent className="pt-6 flex gap-2 flex-wrap">
            <Input
              placeholder="Název nového formuláře…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              className="flex-1 min-w-[220px]"
            />
            <Button onClick={create} disabled={creating}>
              {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
              Vytvořit
            </Button>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
        ) : rows.length === 0 ? (
          <Card className="glass border-border">
            <CardContent className="py-12 text-center">
              <ClipboardList className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Zatím nemáte žádné formuláře. Začněte vytvořením nahoře.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {rows.map((f) => (
              <Card key={f.id} className="glass border-border hover:border-primary/40 transition-colors">
                <CardContent className="pt-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{f.cover_emoji || "📝"}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold truncate">{f.title}</h3>
                        {f.is_published
                          ? <Badge variant="default">Zveřejněno</Badge>
                          : <Badge variant="outline">Koncept</Badge>}
                      </div>
                      {f.description && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{f.description}</p>}
                      <div className="text-xs text-muted-foreground mt-2">
                        {counts[f.id] ?? 0} odpovědí · vytvořeno {new Date(f.created_at).toLocaleDateString("cs-CZ")}
                      </div>
                    </div>
                  </div>

                  {f.is_published && (
                    <div className="flex items-center gap-2 bg-muted/40 rounded-md px-2 py-1 text-xs">
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate flex-1">{publicUrl(f.slug)}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
                        onClick={() => { navigator.clipboard.writeText(publicUrl(f.slug)); toast({ title: "Odkaz zkopírován" }); }}>
                        <Copy className="w-3 h-3" />
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 flex-wrap">
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/profile/formulare/${f.id}/edit`}><Pencil className="w-3 h-3 mr-1" />Upravit</Link>
                    </Button>
                    <Button size="sm" variant="outline" asChild>
                      <Link to={`/profile/formulare/${f.id}/vysledky`}><BarChart3 className="w-3 h-3 mr-1" />Odpovědi</Link>
                    </Button>
                    {f.is_published && (
                      <Button size="sm" variant="ghost" asChild>
                        <a href={publicUrl(f.slug)} target="_blank" rel="noopener noreferrer"><Eye className="w-3 h-3 mr-1" />Náhled</a>
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" className="text-destructive ml-auto" onClick={() => remove(f.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
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

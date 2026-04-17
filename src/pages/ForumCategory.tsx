import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pin, Lock, Plus, ChevronLeft, MessageCircle } from "lucide-react";

interface Thread {
  id: string;
  title: string;
  slug: string;
  is_pinned: boolean;
  is_locked: boolean;
  views: number;
  created_at: string;
  user_id: string;
  post_count?: number;
  author?: { display_name: string | null; username: string | null } | null;
}

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);

const ForumCategory = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [category, setCategory] = useState<{ id: string; name: string; description: string | null } | null>(null);
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data: cat } = await supabase
      .from("forum_categories").select("*").eq("slug", slug).maybeSingle();
    if (!cat) { setLoading(false); return; }
    setCategory(cat);

    const { data: ts } = await supabase
      .from("forum_threads").select("*")
      .eq("category_id", cat.id)
      .order("is_pinned", { ascending: false })
      .order("created_at", { ascending: false });

    if (ts) {
      const userIds = [...new Set(ts.map(t => t.user_id))];
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name, username").in("user_id", userIds);
      const profMap = new Map(profs?.map(p => [p.user_id, p]) ?? []);

      const enriched = await Promise.all(ts.map(async (t) => {
        const { count } = await supabase.from("forum_posts")
          .select("*", { count: "exact", head: true }).eq("thread_id", t.id);
        return { ...t, post_count: count ?? 0, author: profMap.get(t.user_id) ?? null };
      }));
      setThreads(enriched);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug]);

  const createThread = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !category) return;
    setSubmitting(true);
    const threadSlug = `${slugify(title)}-${Date.now().toString(36)}`;
    const { data: thread, error: tErr } = await supabase
      .from("forum_threads")
      .insert({ category_id: category.id, user_id: user.id, title, slug: threadSlug })
      .select().single();

    if (tErr || !thread) {
      setSubmitting(false);
      toast({ title: "Chyba", description: tErr?.message, variant: "destructive" });
      return;
    }
    const { error: pErr } = await supabase.from("forum_posts")
      .insert({ thread_id: thread.id, user_id: user.id, content });

    setSubmitting(false);
    if (pErr) {
      toast({ title: "Chyba", description: pErr.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setTitle(""); setContent("");
    navigate(`/forum/${slug}/${thread.slug}`);
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link to="/forum" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Zpět na fórum
        </Link>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !category ? (
          <p className="text-muted-foreground">Kategorie nenalezena.</p>
        ) : (
          <>
            <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
              <div>
                <h1 className="font-display font-black text-3xl md:text-4xl text-glow">{category.name}</h1>
                {category.description && <p className="text-muted-foreground mt-2">{category.description}</p>}
              </div>
              {user && (
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-primary text-primary-foreground hover:bg-primary-glow">
                      <Plus className="h-4 w-4 mr-1" /> Nové vlákno
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass border-border">
                    <DialogHeader><DialogTitle>Nové vlákno</DialogTitle></DialogHeader>
                    <form onSubmit={createThread} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="t-title">Titulek</Label>
                        <Input id="t-title" required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="t-content">Obsah</Label>
                        <Textarea id="t-content" rows={6} required value={content} onChange={(e) => setContent(e.target.value)} />
                      </div>
                      <Button type="submit" disabled={submitting} className="w-full bg-primary text-primary-foreground hover:bg-primary-glow">
                        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publikovat"}
                      </Button>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            <div className="space-y-3">
              {threads.length === 0 && (
                <Card className="glass border-border p-10 text-center text-muted-foreground">
                  Zatím žádná vlákna. Buď první!
                </Card>
              )}
              {threads.map((t) => (
                <Link key={t.id} to={`/forum/${slug}/${t.slug}`}>
                  <Card className="glass border-border p-5 hover:border-primary/60 transition-all flex items-center gap-4 group">
                    <MessageCircle className="h-5 w-5 text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.is_pinned && <Pin className="h-3.5 w-3.5 text-accent" />}
                        {t.is_locked && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                        <h3 className="font-display font-bold group-hover:text-primary transition-colors truncate">{t.title}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {t.author?.display_name || t.author?.username || "Hráč"} · {new Date(t.created_at).toLocaleDateString("cs-CZ")}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-display font-bold text-primary">{t.post_count}</div>
                      <div className="text-xs uppercase tracking-widest text-muted-foreground">odp.</div>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ForumCategory;

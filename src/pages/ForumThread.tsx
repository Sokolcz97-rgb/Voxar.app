import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pin, Lock, ChevronLeft, Send } from "lucide-react";

interface Post {
  id: string;
  content: string;
  user_id: string;
  created_at: string;
  author?: { display_name: string | null; username: string | null; avatar_url: string | null } | null;
}

interface Thread {
  id: string;
  title: string;
  is_pinned: boolean;
  is_locked: boolean;
  created_at: string;
  user_id: string;
}

const ForumThread = () => {
  const { slug, threadSlug } = useParams();
  const { user } = useAuth();
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data: t } = await supabase
      .from("forum_threads").select("*").eq("slug", threadSlug).maybeSingle();
    if (!t) { setLoading(false); return; }
    setThread(t);

    const { data: ps } = await supabase
      .from("forum_posts").select("*").eq("thread_id", t.id).order("created_at");

    if (ps) {
      const userIds = [...new Set(ps.map(p => p.user_id))];
      const { data: profs } = await supabase
        .from("profiles").select("user_id, display_name, username, avatar_url").in("user_id", userIds);
      const profMap = new Map(profs?.map(p => [p.user_id, p]) ?? []);
      setPosts(ps.map(p => ({ ...p, author: profMap.get(p.user_id) ?? null })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [threadSlug]);

  const sendReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !thread) return;
    setSubmitting(true);
    const { error } = await supabase.from("forum_posts")
      .insert({ thread_id: thread.id, user_id: user.id, content: reply });
    setSubmitting(false);
    if (error) {
      toast({ title: "Chyba", description: error.message, variant: "destructive" });
      return;
    }
    setReply("");
    load();
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-4xl animate-fade-in">
        <Link to={`/forum/${slug}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> Zpět do kategorie
        </Link>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !thread ? (
          <p className="text-muted-foreground">Vlákno nenalezeno.</p>
        ) : (
          <>
            <div className="flex items-center gap-2 flex-wrap mb-6">
              {thread.is_pinned && <Pin className="h-4 w-4 text-accent" />}
              {thread.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
              <h1 className="font-display font-black text-2xl md:text-3xl text-glow">{thread.title}</h1>
            </div>

            <div className="space-y-4">
              {posts.map((p, i) => (
                <Card key={p.id} className="glass border-border p-5 animate-fade-in" style={{ animationDelay: `${i * 40}ms` }}>
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/40 flex items-center justify-center shrink-0 text-sm font-display font-bold text-primary">
                      {(p.author?.display_name || p.author?.username || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap mb-2">
                        <span className="font-display font-bold text-primary">
                          {p.author?.display_name || p.author?.username || "Hráč"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString("cs-CZ")}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap break-words text-foreground/90">{p.content}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {user && !thread.is_locked && (
              <form onSubmit={sendReply} className="mt-8 space-y-3">
                <Textarea required rows={4} value={reply} onChange={(e) => setReply(e.target.value)}
                  placeholder="Napiš odpověď…" className="resize-none" />
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />Odeslat</>}
                </Button>
              </form>
            )}
            {!user && (
              <Card className="glass border-border p-6 mt-8 text-center">
                <p className="text-muted-foreground">
                  <Link to="/auth" className="text-primary hover:underline">Přihlas se</Link> pro psaní odpovědí.
                </p>
              </Card>
            )}
            {thread.is_locked && (
              <Card className="glass border-border p-6 mt-8 text-center">
                <Lock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Toto vlákno je zamčeno.</p>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ForumThread;

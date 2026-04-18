import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pin, Lock, ChevronLeft, Send, MessageSquare } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { moderate } from "@/lib/moderate";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    const { data: th } = await supabase
      .from("forum_threads").select("*").eq("slug", threadSlug).maybeSingle();
    if (!th) { setLoading(false); return; }
    setThread(th);

    const { data: ps } = await supabase
      .from("forum_posts").select("*").eq("thread_id", th.id).order("created_at");

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

    const mod = await moderate(reply);
    if (mod.blocked) {
      setSubmitting(false);
      toast({ title: t("moderation.blocked"), description: mod.reason || t("moderation.blockedDesc"), variant: "destructive" });
      return;
    }
    const finalContent = mod.clean || reply;

    const { error } = await supabase.from("forum_posts")
      .insert({ thread_id: thread.id, user_id: user.id, content: finalContent });
    setSubmitting(false);
    if (error) {
      toast({ title: t("common.error"), description: error.message, variant: "destructive" });
      return;
    }
    if (mod.flagged) toast({ title: t("moderation.filtered") });
    setReply("");
    load();
  };

  const startDM = async (otherId: string) => {
    if (!user || otherId === user.id) return;
    const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user: otherId });
    if (error || !data) {
      toast({ title: t("common.error"), description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/messages?c=${data}`);
  };

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "cs-CZ";

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-4xl animate-fade-in">
        <Link to={`/forum/${slug}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4">
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("forum.backToCategory")}
        </Link>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !thread ? (
          <p className="text-muted-foreground">{t("forum.threadNotFound")}</p>
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
                    <UserAvatar
                      url={p.author?.avatar_url}
                      name={p.author?.display_name || p.author?.username}
                      className="h-10 w-10 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap mb-2">
                        <span className="font-display font-bold text-primary">
                          {p.author?.display_name || p.author?.username || t("common.player")}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(p.created_at).toLocaleString(locale)}
                        </span>
                        {user && p.user_id !== user.id && (
                          <button onClick={() => startDM(p.user_id)}
                            className="ml-auto text-xs inline-flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors">
                            <MessageSquare className="h-3 w-3" />DM
                          </button>
                        )}
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
                  placeholder={t("forum.replyPlaceholder")} className="resize-none" />
                <Button type="submit" disabled={submitting} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />{t("forum.send")}</>}
                </Button>
              </form>
            )}
            {!user && (
              <Card className="glass border-border p-6 mt-8 text-center">
                <p className="text-muted-foreground">
                  <Link to="/auth" className="text-primary hover:underline">{t("forum.signInLink")}</Link> {t("forum.loginToReply")}
                </p>
              </Card>
            )}
            {thread.is_locked && (
              <Card className="glass border-border p-6 mt-8 text-center">
                <Lock className="h-5 w-5 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">{t("forum.locked")}</p>
              </Card>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default ForumThread;

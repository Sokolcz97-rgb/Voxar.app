import { useEffect, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RichEditor, type RichEditorHandle } from "@/components/RichEditor";
import { RichContent } from "@/components/RichContent";
import { useAuth } from "@/contexts/AuthContext";
import { BannedNotice } from "@/components/BannedNotice";
import { toast } from "@/hooks/use-toast";
import { Loader2, Pin, Lock, ChevronLeft, Send, MessageSquare, Paperclip } from "lucide-react";
import { UserAvatar } from "@/components/UserAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { moderate } from "@/lib/moderate";
import { PostReactions } from "@/components/PostReactions";
import { TopRankInline } from "@/components/TopRankInline";
import { SEO } from "@/components/SEO";

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
  const { user, isBanned } = useAuth();
  const { t, i18n } = useTranslation();
  const [thread, setThread] = useState<Thread | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const replyEditorRef = useRef<RichEditorHandle>(null);

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

    const mod = await moderate(reply, true, "forum_post");
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

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const firstPost = posts[0];
  const seoDesc = firstPost
    ? stripHtml(firstPost.content).slice(0, 160)
    : thread ? `Diskuze "${thread.title}" na fóru StudioVoxario.` : "";

  return (
    <div className="min-h-screen relative">
      {thread && (
        <SEO
          title={`${thread.title} — Fórum StudioVoxario`}
          description={seoDesc}
          type="article"
          jsonLd={{
            "@context": "https://schema.org",
            "@type": "DiscussionForumPosting",
            headline: thread.title,
            datePublished: thread.created_at,
            dateModified: posts[posts.length - 1]?.created_at || thread.created_at,
            author: {
              "@type": "Person",
              name:
                firstPost?.author?.display_name ||
                firstPost?.author?.username ||
                "StudioVoxario user",
            },
            interactionStatistic: {
              "@type": "InteractionCounter",
              interactionType: "https://schema.org/CommentAction",
              userInteractionCount: Math.max(posts.length - 1, 0),
            },
          }}
        />
      )}
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
                    <Link to={`/profile/${p.user_id}`} className="relative shrink-0 group">
                      <UserAvatar
                        url={p.author?.avatar_url}
                        name={p.author?.display_name || p.author?.username}
                        className="h-10 w-10 group-hover:ring-2 group-hover:ring-primary/50 transition-all"
                      />
                      <PresenceDot userId={p.user_id} className="absolute -bottom-0.5 -right-0.5" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap mb-2">
                        <Link
                          to={`/profile/${p.user_id}`}
                          className="font-display font-bold text-primary hover:underline"
                        >
                          {p.author?.display_name || p.author?.username || t("common.player")}
                        </Link>
                        <TopRankInline userId={p.user_id} />
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
                      <RichContent content={p.content} />
                      <PostReactions postId={p.id} />
                    </div>
                  </div>
                </Card>
              ))}
            </div>

            {user && !thread.is_locked && isBanned && (
              <div className="mt-8"><BannedNotice /></div>
            )}
            {user && !thread.is_locked && !isBanned && (
              <form onSubmit={sendReply} className="mt-8 space-y-3">
                <RichEditor ref={replyEditorRef} value={reply} onChange={setReply} placeholder={t("forum.replyPlaceholder")} minHeight={140} hideUploadButtons />
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => replyEditorRef.current?.openFilePicker()}>
                    <Paperclip className="h-4 w-4 mr-2" />{t("editor.attach")}
                  </Button>
                  <Button type="submit" disabled={submitting || !reply.trim()} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Send className="h-4 w-4 mr-2" />{t("forum.send")}</>}
                  </Button>
                </div>
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

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { usePresence } from "@/contexts/PresenceContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import { Loader2, MessageSquare, ChevronLeft, FileText, MessagesSquare } from "lucide-react";

interface Profile {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  last_seen_at: string | null;
}

const PublicProfile = () => {
  const { userId } = useParams();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const { isOnline } = usePresence();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [counts, setCounts] = useState({ threads: 0, posts: 0 });

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [profRes, threadsRes, postsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id,display_name,username,avatar_url,bio,created_at,last_seen_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase.from("forum_threads").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", userId),
      ]);
      if (cancelled) return;
      setProfile((profRes.data as Profile) ?? null);
      setCounts({ threads: threadsRes.count ?? 0, posts: postsRes.count ?? 0 });
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const startDM = async () => {
    if (!user || !userId) return;
    const { data, error } = await supabase.rpc("get_or_create_conversation", { _other_user: userId });
    if (error || !data) {
      toast({ title: t("common.error"), description: error?.message, variant: "destructive" });
      return;
    }
    navigate(`/messages?c=${data}`);
  };

  const locale = i18n.resolvedLanguage === "en" ? "en-US" : "cs-CZ";
  const fmt = (iso: string) => new Date(iso).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });
  const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(locale, { dateStyle: "long" } as Intl.DateTimeFormatOptions);

  const lastSeenLabel = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return t("publicProfile.justNow");
    if (mins < 60) return t("publicProfile.minutesAgo", { count: mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t("publicProfile.hoursAgo", { count: hours });
    return fmt(iso);
  };

  const online = isOnline(userId);
  const isMe = user?.id === userId;
  const name = profile?.display_name || profile?.username || t("common.player");

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-3xl animate-fade-in">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> {t("common.back")}
        </button>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !profile ? (
          <Card className="glass border-border p-10 text-center">
            <p className="text-muted-foreground">{t("publicProfile.notFound")}</p>
          </Card>
        ) : (
          <>
            <Card className="glass border-border p-8">
              <div className="flex items-start gap-5 flex-wrap">
                <div className="relative">
                  <UserAvatar url={profile.avatar_url} name={name} className="h-24 w-24" />
                  <PresenceDot
                    userId={profile.user_id}
                    showOffline
                    className="absolute bottom-1 right-1 h-4 w-4"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="font-display font-black text-3xl text-glow">{name}</h1>
                    {online && (
                      <span className="text-xs font-bold uppercase tracking-widest text-primary px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10">
                        {t("publicProfile.onlineNow")}
                      </span>
                    )}
                  </div>
                  {profile.username && (
                    <p className="text-muted-foreground">@{profile.username}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {online
                      ? t("publicProfile.activeNow")
                      : profile.last_seen_at
                      ? `${t("publicProfile.lastSeen")}: ${lastSeenLabel(profile.last_seen_at)}`
                      : t("publicProfile.neverSeen")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("publicProfile.joined")}: {fmtDate(profile.created_at)}
                  </p>
                </div>
                {!isMe && user && (
                  <Button onClick={startDM} className="bg-primary text-primary-foreground hover:bg-primary-glow">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    {t("publicProfile.sendDm")}
                  </Button>
                )}
                {isMe && (
                  <Button asChild variant="outline">
                    <Link to="/profile">{t("publicProfile.editProfile")}</Link>
                  </Button>
                )}
              </div>

              {profile.bio && (
                <div className="mt-6 pt-6 border-t border-border">
                  <p className="whitespace-pre-wrap break-words text-foreground/90">{profile.bio}</p>
                </div>
              )}
            </Card>

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              <Card className="glass border-border p-5">
                <FileText className="h-5 w-5 text-primary mb-3" />
                <div className="font-display text-3xl font-bold">{counts.threads}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                  {t("dashboard.stats.threads")}
                </div>
              </Card>
              <Card className="glass border-border p-5">
                <MessagesSquare className="h-5 w-5 text-primary mb-3" />
                <div className="font-display text-3xl font-bold">{counts.posts}</div>
                <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">
                  {t("dashboard.stats.posts")}
                </div>
              </Card>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default PublicProfile;

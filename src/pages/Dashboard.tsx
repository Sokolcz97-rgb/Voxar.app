import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, FileText, Ticket, MessagesSquare, Bot } from "lucide-react";
import { Link } from "react-router-dom";
import { ActivityChart } from "@/components/ActivityChart";
import { RecommendedThreads } from "@/components/RecommendedThreads";
import { OnlineUsers } from "@/components/OnlineUsers";
import { LfgWidget } from "@/components/LfgWidget";

type RecentThread = { id: string; title: string; slug: string; created_at: string; category_id: string };
type RecentDm = {
  conversation_id: string;
  content: string;
  created_at: string;
  sender_id: string;
  other_user_id: string;
  other_name: string | null;
};

const Dashboard = () => {
  const { user, roles } = useAuth();
  const { t, i18n } = useTranslation();
  const [profile, setProfile] = useState<{ display_name: string | null; username: string | null } | null>(null);
  const [counts, setCounts] = useState({ threads: 0, posts: 0, tickets: 0, dms: 0 });
  const [recentThreads, setRecentThreads] = useState<RecentThread[]>([]);
  const [recentDms, setRecentDms] = useState<RecentDm[]>([]);
  const [categories, setCategories] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      const [profileRes, threadsCount, postsCount, ticketsCount, dmsCount, threadsRecent, catsRes, convsRes] =
        await Promise.all([
          supabase.from("profiles").select("display_name, username").eq("user_id", user.id).maybeSingle(),
          supabase.from("forum_threads").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("forum_posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("tickets").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("messages").select("id", { count: "exact", head: true }).eq("sender_id", user.id),
          supabase
            .from("forum_threads")
            .select("id,title,slug,created_at,category_id")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false })
            .limit(5),
          supabase.from("forum_categories").select("id,slug"),
          supabase
            .from("conversations")
            .select("id,user_a,user_b,updated_at")
            .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
            .order("updated_at", { ascending: false })
            .limit(5),
        ]);

      if (cancelled) return;

      setProfile(profileRes.data ?? null);
      setCounts({
        threads: threadsCount.count ?? 0,
        posts: postsCount.count ?? 0,
        tickets: ticketsCount.count ?? 0,
        dms: dmsCount.count ?? 0,
      });
      setRecentThreads((threadsRecent.data as RecentThread[]) ?? []);
      const catMap: Record<string, string> = {};
      (catsRes.data ?? []).forEach((c: { id: string; slug: string }) => (catMap[c.id] = c.slug));
      setCategories(catMap);

      const convs = convsRes.data ?? [];
      if (convs.length === 0) {
        setRecentDms([]);
        return;
      }
      const convIds = convs.map((c) => c.id);
      const otherIds = Array.from(
        new Set(convs.map((c) => (c.user_a === user.id ? c.user_b : c.user_a))),
      );

      const [lastMsgsRes, profilesRes] = await Promise.all([
        supabase
          .from("messages")
          .select("conversation_id,content,created_at,sender_id")
          .in("conversation_id", convIds)
          .order("created_at", { ascending: false }),
        supabase.from("profiles").select("user_id,display_name,username").in("user_id", otherIds),
      ]);

      if (cancelled) return;

      const profileMap: Record<string, string> = {};
      (profilesRes.data ?? []).forEach((p: { user_id: string; display_name: string | null; username: string | null }) => {
        profileMap[p.user_id] = p.display_name || p.username || "—";
      });

      const lastByConv: Record<string, { content: string; created_at: string; sender_id: string }> = {};
      (lastMsgsRes.data ?? []).forEach((m) => {
        if (!lastByConv[m.conversation_id]) lastByConv[m.conversation_id] = m;
      });

      const dms: RecentDm[] = convs
        .map((c) => {
          const other = c.user_a === user.id ? c.user_b : c.user_a;
          const last = lastByConv[c.id];
          if (!last) return null;
          return {
            conversation_id: c.id,
            content: last.content,
            created_at: last.created_at,
            sender_id: last.sender_id,
            other_user_id: other,
            other_name: profileMap[other] ?? null,
          };
        })
        .filter((x): x is RecentDm => x !== null);

      setRecentDms(dms);
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats = [
    { icon: FileText, label: t("dashboard.stats.threads"), value: counts.threads },
    { icon: MessagesSquare, label: t("dashboard.stats.posts"), value: counts.posts },
    { icon: Ticket, label: t("dashboard.stats.tickets"), value: counts.tickets },
    { icon: MessageSquare, label: t("dashboard.stats.dms"), value: counts.dms },
  ];

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString(i18n.language === "cs" ? "cs-CZ" : "en-US", {
      dateStyle: "short",
      timeStyle: "short",
    });

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />

      <main className="container py-10 animate-fade-in">
        <div className="mb-10 relative overflow-hidden rounded-2xl border border-border/60 glass p-8 md:p-10">
          <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-primary/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-20 w-80 h-80 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
          <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="min-w-0">
              <p className="text-xs sm:text-sm uppercase tracking-[0.3em] text-primary text-glow">
                {t("dashboard.welcome")}
              </p>
              <h1 className="font-display font-black text-4xl md:text-5xl mt-2 truncate">
                {profile?.display_name || profile?.username || t("dashboard.fallbackName")}
              </h1>
              <p className="text-muted-foreground mt-2 text-sm">
                {t("dashboard.role")}:{" "}
                <span className="text-foreground/90 font-medium">
                  {roles.length ? roles.join(", ") : "user"}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="hidden sm:flex items-center gap-3 px-3 py-2 rounded-xl border border-primary/30 bg-primary/5">
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Discord</div>
                  <div className="font-display font-bold text-sm">{t("dashboard.botManager")}</div>
                </div>
              </div>
              <Button asChild size="lg" className="shadow-[var(--glow-soft)]">
                <Link to="/dashboard/bot">
                  <Bot className="h-4 w-4 mr-2" />
                  Spravovat bota
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {stats.map((s) => (
            <Card
              key={s.label}
              className="glass border-border p-5 hover:border-primary/60 hover:-translate-y-0.5 transition-all relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary/0 via-primary/0 to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
              <s.icon className="h-5 w-5 text-primary mb-3 relative" />
              <div className="font-display text-3xl font-bold relative">{s.value}</div>
              <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1 relative">{s.label}</div>
            </Card>
          ))}
        </div>

        {user && <LfgWidget />}
        {user && <OnlineUsers currentUserId={user.id} />}
        {user && <ActivityChart userId={user.id} />}
        {user && <RecommendedThreads userId={user.id} />}


        <h2 className="font-display text-2xl font-bold mb-4">{t("dashboard.myActivity")}</h2>
        <div className="grid lg:grid-cols-2 gap-4 mb-10">
          <Card className="glass border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">{t("dashboard.recentThreads")}</h3>
              <Button asChild variant="ghost" size="sm">
                <Link to="/forum">{t("dashboard.viewAll")}</Link>
              </Button>
            </div>
            {recentThreads.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
            ) : (
              <ul className="space-y-3">
                {recentThreads.map((th) => {
                  const catSlug = categories[th.category_id];
                  const href = catSlug ? `/forum/${catSlug}/${th.slug}` : "/forum";
                  return (
                    <li key={th.id} className="border-b border-border/50 pb-2 last:border-0">
                      <Link to={href} className="font-medium hover:text-primary transition-colors line-clamp-1">
                        {th.title}
                      </Link>
                      <div className="text-xs text-muted-foreground mt-0.5">{fmt(th.created_at)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>

          <Card className="glass border-border p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold">{t("dashboard.recentDms")}</h3>
              <Button asChild variant="ghost" size="sm">
                <Link to="/messages">{t("dashboard.viewAll")}</Link>
              </Button>
            </div>
            {recentDms.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("dashboard.noActivity")}</p>
            ) : (
              <ul className="space-y-3">
                {recentDms.map((dm) => (
                  <li key={dm.conversation_id} className="border-b border-border/50 pb-2 last:border-0">
                    <Link
                      to={`/messages?c=${dm.conversation_id}`}
                      className="flex items-start justify-between gap-3 hover:text-primary transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{dm.other_name || t("common.player")}</div>
                        <div className="text-sm text-muted-foreground line-clamp-1">
                          {dm.sender_id === user?.id ? "→ " : ""}
                          {dm.content}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">{fmt(dm.created_at)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card className="glass border-border p-8 text-center">
          <h2 className="font-display text-2xl font-bold mb-2">{t("dashboard.ctaTitle")}</h2>
          <p className="text-muted-foreground max-w-xl mx-auto">{t("dashboard.ctaDesc")}</p>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;

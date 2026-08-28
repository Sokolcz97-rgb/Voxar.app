import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import {
  ArrowLeft,
  Users,
  MessageSquare,
  MessageCircle,
  Ticket,
  Server,
  Newspaper,
  Radio,
  Activity,
  Loader2,
  Eye,
  TrendingUp,
} from "lucide-react";

interface Stats {
  users: number;
  onlineNow: number;
  threads: number;
  posts: number;
  messages: number;
  tickets: number;
  ticketsOpen: number;
  servers: number;
  serversOnline: number;
  liveStreams: number;
  recentSignups: number;
  recentPosts: number;
}

const StatCard = ({
  icon: Icon,
  label,
  value,
  hint,
  tone = "primary",
}: {
  icon: any;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "primary" | "accent" | "destructive" | "muted";
}) => {
  const toneClass =
    tone === "destructive"
      ? "text-destructive border-destructive/30 bg-destructive/10"
      : tone === "accent"
      ? "text-accent border-accent/30 bg-accent/10"
      : tone === "muted"
      ? "text-muted-foreground border-border bg-muted/30"
      : "text-primary border-primary/30 bg-primary/10";
  return (
    <Card className="glass border-border p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-widest text-muted-foreground">
            {label}
          </p>
          <p className="font-display font-black text-3xl mt-2 text-glow">
            {value}
          </p>
          {hint && (
            <p className="text-xs text-muted-foreground mt-1">{hint}</p>
          )}
        </div>
        <div
          className={`w-10 h-10 rounded-lg border flex items-center justify-center shrink-0 ${toneClass}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
};

const AdminStats = () => {
  const { isAdmin, isEditor, loading: authLoading } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAdmin && !isEditor) return;
    (async () => {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const since5m = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const sinceWeek = new Date(
        Date.now() - 7 * 24 * 60 * 60 * 1000
      ).toISOString();
      const now = new Date().toISOString();

      const head = { count: "exact" as const, head: true };

      const [
        users,
        onlineNow,
        threads,
        posts,
        messages,
        tickets,
        ticketsOpen,
        servers,
        serversOnline,
        liveStreams,
        recentSignups,
        recentPosts,
      ] = await Promise.all([
        supabase.from("profiles").select("*", head),
        supabase
          .from("profiles")
          .select("*", head)
          .gte("last_seen_at", since5m),
        supabase.from("forum_threads").select("*", head),
        supabase.from("forum_posts").select("*", head),
        supabase.from("messages").select("*", head),
        supabase.from("tickets").select("*", head),
        supabase.from("tickets").select("*", head).neq("status", "closed"),
        supabase.from("servers").select("*", head).eq("is_approved", true),
        supabase
          .from("servers")
          .select("*", head)
          .eq("is_approved", true)
          .eq("is_online", true),
        supabase.from("live_streams_cache").select("*", head).eq("is_live", true),
        supabase.from("profiles").select("*", head).gte("created_at", sinceWeek),
        supabase
          .from("forum_posts")
          .select("*", head)
          .gte("created_at", since24h),
      ]);

      setStats({
        users: users.count ?? 0,
        onlineNow: onlineNow.count ?? 0,
        threads: threads.count ?? 0,
        posts: posts.count ?? 0,
        messages: messages.count ?? 0,
        tickets: tickets.count ?? 0,
        ticketsOpen: ticketsOpen.count ?? 0,
        servers: servers.count ?? 0,
        serversOnline: serversOnline.count ?? 0,
        liveStreams: liveStreams.count ?? 0,
        recentSignups: recentSignups.count ?? 0,
        recentPosts: recentPosts.count ?? 0,
      });
      setLoading(false);
    })();
  }, [isAdmin, isEditor]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!isAdmin && !isEditor) return <Navigate to="/" replace />;

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <div className="fixed inset-0 -z-10 neon-grid opacity-30" />
      <Navbar />
      <main className="container py-10 animate-fade-in">
        <Link
          to="/admin"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" /> Zpět do administrace
        </Link>

        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.3em] text-primary text-glow">
            Přehled
          </p>
          <h1 className="font-display font-black text-3xl md:text-4xl mt-2">
            Statistiky webu
          </h1>
          <p className="text-muted-foreground mt-2">
            Aktuální stav komunity, obsahu a aktivity.
          </p>
        </div>

        {loading || !stats ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Komunita */}
            <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Komunita
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <StatCard
                icon={Users}
                label="Registrovaní uživatelé"
                value={stats.users}
              />
              <StatCard
                icon={Activity}
                label="Online (5 min)"
                value={stats.onlineNow}
                tone="accent"
                hint="Aktivní právě teď"
              />
              <StatCard
                icon={TrendingUp}
                label="Noví za 7 dní"
                value={stats.recentSignups}
                hint="Týdenní nárůst"
              />
              <StatCard
                icon={Radio}
                label="Live streamy"
                value={stats.liveStreams}
                tone="accent"
                hint="Aktuálně vysílají"
              />
            </div>

            {/* Obsah */}
            <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" /> Obsah & aktivita
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <StatCard
                icon={MessageSquare}
                label="Vlákna fóra"
                value={stats.threads}
              />
              <StatCard
                icon={MessageSquare}
                label="Příspěvky fóra"
                value={stats.posts}
              />
              <StatCard
                icon={Eye}
                label="Příspěvky / 24h"
                value={stats.recentPosts}
                tone="accent"
                hint="Nové za poslední den"
              />
              <StatCard
                icon={MessageCircle}
                label="Soukromé zprávy"
                value={stats.messages}
                tone="muted"
              />
            </div>

            {/* Provoz */}
            <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <Server className="h-5 w-5 text-primary" /> Provoz a podpora
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
              <StatCard
                icon={Server}
                label="Schválené servery"
                value={stats.servers}
              />
              <StatCard
                icon={Server}
                label="Online servery"
                value={stats.serversOnline}
                tone="accent"
                hint={`Z ${stats.servers} celkem`}
              />
              <StatCard
                icon={Ticket}
                label="Otevřené tickety"
                value={stats.ticketsOpen}
                tone={stats.ticketsOpen > 0 ? "destructive" : "primary"}
                hint={`Z ${stats.tickets} celkem`}
              />
            </div>

            {/* Návštěvnost */}
            <h2 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" /> Návštěvnost webu
            </h2>
            <Card className="glass border-border p-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="flex-1 min-w-[260px]">
                  <Badge variant="outline" className="mb-3">
                    Produkční analytika
                  </Badge>
                  <h3 className="font-display font-bold text-lg">
                    Návštěvy, zobrazení stránek a zdroje
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2">
                    Detailní statistiky návštěvnosti (unikátní návštěvníci,
                    page views, zařízení, země, zdroje, top stránky) jsou
                    sbírány automaticky po publikaci webu a jsou k dispozici v
                    panelu <strong>Project Insights</strong>.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Tip: Otevři odkaz níže — uvidíš denní/hodinové grafy
                    návštěvnosti.
                  </p>
                </div>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default AdminStats;

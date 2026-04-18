import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Trophy, MessageSquare, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getTop, getTopAllTime } from "@/lib/leaderboard";

interface Parsed { name: string; params: Record<string, string>; }

const parseShortcode = (raw: string): Parsed | null => {
  const m = raw.trim().match(/^\[([a-z0-9-]+)((?:\s+[a-z0-9-]+=[^\s\]]+)*)\s*\]$/i);
  if (!m) return null;
  const params: Record<string, string> = {};
  (m[2] || "").trim().split(/\s+/).filter(Boolean).forEach((p) => {
    const [k, v] = p.split("=");
    if (k) params[k] = v ?? "";
  });
  return { name: m[1].toLowerCase(), params };
};

function TopPlayersSC({ limit }: { limit: number }) {
  const [items, setItems] = useState<{ user_id: string; display_name: string; score: number }[]>([]);
  useEffect(() => { getTop(limit).then(setItems as any); }, [limit]);
  return (
    <div className="grid sm:grid-cols-3 gap-3">
      {items.map((p, i) => (
        <Card key={p.user_id} className="glass border-border p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/40 flex items-center justify-center font-display font-bold text-primary">
            #{i + 1}
          </div>
          <div className="min-w-0">
            <Link to={`/profile/${p.user_id}`} className="font-bold truncate hover:text-primary">{p.display_name}</Link>
            <p className="text-xs text-muted-foreground">{p.score} bodů</p>
          </div>
        </Card>
      ))}
    </div>
  );
}

function LeaderboardSC({ limit }: { limit: number }) {
  const [items, setItems] = useState<{ user_id: string; display_name: string; score: number }[]>([]);
  useEffect(() => { getTopAllTime(limit).then(setItems as any); }, [limit]);
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      {items.map((p, i) => (
        <div key={p.user_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 last:border-0 bg-card/30 hover:bg-card/60">
          <span className="font-display font-bold text-primary w-8">#{i + 1}</span>
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <Link to={`/profile/${p.user_id}`} className="flex-1 truncate hover:text-primary">{p.display_name}</Link>
          <span className="text-sm font-bold">{p.score}</span>
        </div>
      ))}
    </div>
  );
}

function LatestThreadsSC({ count }: { count: number }) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("forum_threads").select("id,title,slug,created_at,category_id,forum_categories(slug)")
      .order("created_at", { ascending: false }).limit(count)
      .then(({ data }) => setItems(data ?? []));
  }, [count]);
  return (
    <div className="space-y-2">
      {items.map((t) => (
        <Link key={t.id} to={`/forum/${t.forum_categories?.slug}/${t.slug}`}
          className="flex items-center gap-3 p-3 rounded-md border border-border bg-card/30 hover:border-primary hover:bg-primary/5 transition-all">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="flex-1 truncate">{t.title}</span>
        </Link>
      ))}
    </div>
  );
}

function OnlineUsersSC() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60_000).toISOString();
    supabase.from("profiles").select("user_id", { count: "exact", head: true })
      .gt("last_seen_at", fiveMinAgo)
      .then(({ count }) => setCount(count ?? 0));
  }, []);
  return (
    <Card className="glass border-border p-5 flex items-center gap-4 max-w-sm">
      <div className="relative">
        <Users className="h-6 w-6 text-primary" />
        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
      </div>
      <div>
        <p className="font-display font-bold text-2xl">{count}</p>
        <p className="text-xs uppercase tracking-widest text-muted-foreground">online teď</p>
      </div>
    </Card>
  );
}

export function Shortcode({ code }: { code: string }) {
  const parsed = parseShortcode(code);
  if (!parsed) {
    return <div className="p-3 rounded-md border border-destructive/40 bg-destructive/10 text-sm text-destructive">
      Neplatný shortcode: <code>{code}</code>
    </div>;
  }
  const { name, params } = parsed;
  switch (name) {
    case "top-players":   return <TopPlayersSC limit={Number(params.limit) || 3} />;
    case "leaderboard":   return <LeaderboardSC limit={Number(params.limit) || 10} />;
    case "latest-threads":return <LatestThreadsSC count={Number(params.count) || 5} />;
    case "online-users":  return <OnlineUsersSC />;
    default:
      return <div className="p-3 rounded-md border border-border bg-muted/40 text-sm text-muted-foreground">
        Neznámý shortcode: <code>[{name}]</code>
      </div>;
  }
}

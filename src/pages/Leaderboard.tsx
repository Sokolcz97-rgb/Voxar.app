import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Navbar } from "@/components/Navbar";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserAvatar } from "@/components/UserAvatar";
import { PresenceDot } from "@/components/PresenceDot";
import { Trophy, Loader2, Heart } from "lucide-react";

type Range = "all" | "month" | "week";

interface Entry {
  user_id: string;
  total: number;
  byEmoji: Record<string, number>;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const Leaderboard = () => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [range, setRange] = useState<Range>("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      let since: string | null = null;
      if (range === "week" || range === "month") {
        const d = new Date();
        d.setDate(d.getDate() - (range === "week" ? 7 : 30));
        since = d.toISOString();
      }

      let q = supabase.from("post_reactions").select("emoji,post_id,created_at");
      if (since) q = q.gte("created_at", since);
      const { data: reacts } = await q;
      const reactRows = (reacts ?? []) as { emoji: string; post_id: string }[];
      if (reactRows.length === 0) {
        if (!cancelled) {
          setEntries([]);
          setLoading(false);
        }
        return;
      }

      const postIds = Array.from(new Set(reactRows.map((r) => r.post_id)));
      const { data: posts } = await supabase
        .from("forum_posts")
        .select("id,user_id")
        .in("id", postIds);
      const postOwner: Record<string, string> = {};
      (posts ?? []).forEach((p) => (postOwner[p.id] = p.user_id));

      const tally: Record<string, { total: number; byEmoji: Record<string, number> }> = {};
      reactRows.forEach((r) => {
        const owner = postOwner[r.post_id];
        if (!owner) return;
        const t = tally[owner] || (tally[owner] = { total: 0, byEmoji: {} });
        t.total += 1;
        t.byEmoji[r.emoji] = (t.byEmoji[r.emoji] ?? 0) + 1;
      });

      const top = Object.entries(tally)
        .map(([user_id, v]) => ({ user_id, ...v }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      const userIds = top.map((e) => e.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id,display_name,username,avatar_url")
        .in("user_id", userIds);
      const profMap: Record<string, Pick<Entry, "display_name" | "username" | "avatar_url">> = {};
      (profiles ?? []).forEach((p) => {
        profMap[p.user_id] = {
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
        };
      });

      if (cancelled) return;
      setEntries(
        top.map((e) => ({
          ...e,
          display_name: profMap[e.user_id]?.display_name ?? null,
          username: profMap[e.user_id]?.username ?? null,
          avatar_url: profMap[e.user_id]?.avatar_url ?? null,
        })),
      );
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const medal = (rank: number) => {
    if (rank === 0) return "🥇";
    if (rank === 1) return "🥈";
    if (rank === 2) return "🥉";
    return `#${rank + 1}`;
  };

  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10 gradient-hero" />
      <Navbar />
      <main className="container py-10 max-w-3xl animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Trophy className="h-7 w-7 text-primary" />
          <h1 className="font-display font-black text-3xl text-glow">
            {t("leaderboard.title")}
          </h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{t("leaderboard.subtitle")}</p>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : entries.length === 0 ? (
          <Card className="glass border-border p-10 text-center">
            <p className="text-muted-foreground">{t("leaderboard.empty")}</p>
          </Card>
        ) : (
          <ul className="space-y-2">
            {entries.map((e, i) => {
              const name = e.display_name || e.username || t("common.player");
              return (
                <Card key={e.user_id} className="glass border-border p-4 hover:border-primary/40 transition-colors">
                  <Link to={`/profile/${e.user_id}`} className="flex items-center gap-4">
                    <div className="w-10 text-center font-display font-bold text-lg shrink-0">
                      {medal(i)}
                    </div>
                    <div className="relative shrink-0">
                      <UserAvatar url={e.avatar_url} name={name} className="h-10 w-10" />
                      <PresenceDot userId={e.user_id} className="absolute -bottom-0.5 -right-0.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{name}</div>
                      {e.username && (
                        <div className="text-xs text-muted-foreground truncate">@{e.username}</div>
                      )}
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {Object.entries(e.byEmoji)
                          .sort((a, b) => b[1] - a[1])
                          .map(([emoji, n]) => (
                            <span
                              key={emoji}
                              className="inline-flex items-center gap-1 text-xs rounded-full border border-border bg-muted/40 px-1.5 py-0.5"
                            >
                              <span>{emoji}</span>
                              <span className="font-medium">{n}</span>
                            </span>
                          ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="flex items-center gap-1 text-primary">
                        <Heart className="h-4 w-4" />
                        <span className="font-display text-2xl font-bold">{e.total}</span>
                      </div>
                    </div>
                  </Link>
                </Card>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
};

export default Leaderboard;

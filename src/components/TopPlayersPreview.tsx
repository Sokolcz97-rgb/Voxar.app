import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { UserAvatar } from "@/components/UserAvatar";
import { Trophy, Heart, ArrowRight } from "lucide-react";
import { getTop } from "@/lib/leaderboard";

interface TopEntry {
  user_id: string;
  total: number;
  display_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

const medal = (i: number) => (i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉");

export const TopPlayersPreview = () => {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<TopEntry[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const top = await getTop("all", 3);
      if (top.length === 0) {
        if (!cancelled) setEntries([]);
        return;
      }
      const userIds = top.map((e) => e.user_id);
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id,display_name,username,avatar_url")
        .in("user_id", userIds);
      const profMap: Record<string, Pick<TopEntry, "display_name" | "username" | "avatar_url">> = {};
      (profs ?? []).forEach((p) => {
        profMap[p.user_id] = {
          display_name: p.display_name,
          username: p.username,
          avatar_url: p.avatar_url,
        };
      });

      if (cancelled) return;
      setEntries(
        top.map((e) => ({
          user_id: e.user_id,
          total: e.total,
          display_name: profMap[e.user_id]?.display_name ?? null,
          username: profMap[e.user_id]?.username ?? null,
          avatar_url: profMap[e.user_id]?.avatar_url ?? null,
        })),
      );
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!entries || entries.length === 0) return null;

  return (
    <section className="container pb-32">
      <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Trophy className="h-6 w-6 text-gold drop-shadow-[0_0_8px_hsl(var(--gold)/0.7)]" />
          <h2 className="font-display font-black text-2xl md:text-3xl">{t("home.topPlayers.title")}</h2>
        </div>
        <Link
          to="/leaderboard"
          className="text-sm text-primary hover:underline inline-flex items-center gap-1"
        >
          {t("home.topPlayers.viewAll")} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {entries.map((e, i) => {
          const name = e.display_name || e.username || t("common.player");
          const isFirst = i === 0;
          return (
            <Link
              key={e.user_id}
              to={`/profile/${e.user_id}`}
              className={
                isFirst
                  ? "glass rounded-xl p-5 border animate-gold-pulse transition-all"
                  : "glass rounded-xl p-5 border-border hover:border-primary/50 transition-all hover:-translate-y-0.5"
              }
            >
              <div className="flex items-center gap-3">
                <div
                  className={
                    isFirst
                      ? "font-display font-bold text-3xl text-gold drop-shadow-[0_0_8px_hsl(var(--gold)/0.7)]"
                      : "font-display font-bold text-2xl"
                  }
                >
                  {medal(i)}
                </div>
                <UserAvatar url={e.avatar_url} name={name} className="h-12 w-12" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{name}</div>
                  {e.username && (
                    <div className="text-xs text-muted-foreground truncate">@{e.username}</div>
                  )}
                </div>
              </div>
              <div
                className={
                  isFirst
                    ? "mt-3 flex items-center gap-1.5 text-gold"
                    : "mt-3 flex items-center gap-1.5 text-primary"
                }
              >
                <Heart className="h-4 w-4" />
                <span className="font-display text-xl font-bold">{e.total}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  {t("home.topPlayers.reactions")}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

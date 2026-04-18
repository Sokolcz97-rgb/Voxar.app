import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { getUserRankings, type LbRange, type LbRanking } from "@/lib/leaderboard";

interface Props {
  userId: string;
}

const medal = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return `#${rank}`;
};

export const RankBadges = ({ userId }: Props) => {
  const { t } = useTranslation();
  const [data, setData] = useState<Partial<Record<LbRange, LbRanking>> | null>(null);

  useEffect(() => {
    let cancelled = false;
    getUserRankings(userId).then((r) => {
      if (!cancelled) setData(r);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!data) return null;
  const entries = (["all", "month", "week"] as LbRange[])
    .map((r) => [r, data[r]] as const)
    .filter(([, v]) => !!v) as [LbRange, LbRanking][];
  if (entries.length === 0) return null;

  const labelFor = (r: LbRange) =>
    r === "all"
      ? t("leaderboard.rangeAll")
      : r === "month"
      ? t("leaderboard.rangeMonth")
      : t("leaderboard.rangeWeek");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {entries.map(([r, v]) => (
        <Link
          key={r}
          to="/leaderboard"
          className="inline-flex items-center gap-1.5 text-xs rounded-full border border-primary/40 bg-primary/10 text-primary px-2.5 py-1 hover:border-primary transition-colors"
          title={t("rankBadge.tooltip", { rank: v.rank, range: labelFor(r) })}
        >
          <Trophy className="h-3 w-3" />
          <span className="font-bold">{medal(v.rank)}</span>
          <span className="opacity-80">· {labelFor(r)}</span>
        </Link>
      ))}
    </div>
  );
};

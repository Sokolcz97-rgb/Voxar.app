import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy } from "lucide-react";
import { getTopAllTime } from "@/lib/leaderboard";

interface Props {
  userId: string;
}

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉");

// Cache so multiple badges in one page share a single fetch
let cachePromise: Promise<Record<string, number>> | null = null;
const getCachedTop = () => {
  if (!cachePromise) cachePromise = getTopAllTime(3);
  return cachePromise;
};
// Invalidate after 60s so reactions eventually reflect
setInterval(() => {
  cachePromise = null;
}, 60_000);

export const TopRankInline = ({ userId }: Props) => {
  const { t } = useTranslation();
  const [rank, setRank] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    getCachedTop().then((map) => {
      if (cancelled) return;
      setRank(map[userId] ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!rank) return null;

  return (
    <Link
      to="/leaderboard"
      title={t("rankBadge.tooltip", { rank, range: t("leaderboard.rangeAll") })}
      className="inline-flex items-center gap-1 text-[10px] font-bold rounded-full border border-primary/40 bg-primary/10 text-primary px-1.5 py-0.5 hover:border-primary transition-colors"
    >
      <Trophy className="h-2.5 w-2.5" />
      <span>{medal(rank)}</span>
    </Link>
  );
};

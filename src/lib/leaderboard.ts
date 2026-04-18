import { supabase } from "@/integrations/supabase/client";

export type LbRange = "all" | "month" | "week";

export interface LbRanking {
  rank: number; // 1-based
  total: number;
  range: LbRange;
}

const sinceFor = (range: LbRange): string | null => {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === "week" ? 7 : 30));
  return d.toISOString();
};

/**
 * Returns the user's rank for each range based on total reactions received
 * on their forum posts. Only returns ranks in top 10 (else null for that range).
 */
export const getUserRankings = async (userId: string): Promise<Partial<Record<LbRange, LbRanking>>> => {
  const ranges: LbRange[] = ["all", "month", "week"];
  const result: Partial<Record<LbRange, LbRanking>> = {};

  for (const range of ranges) {
    const since = sinceFor(range);
    let q = supabase.from("post_reactions").select("post_id,created_at");
    if (since) q = q.gte("created_at", since);
    const { data: reacts } = await q;
    const rows = (reacts ?? []) as { post_id: string }[];
    if (rows.length === 0) continue;

    const postIds = Array.from(new Set(rows.map((r) => r.post_id)));
    const { data: posts } = await supabase
      .from("forum_posts")
      .select("id,user_id")
      .in("id", postIds);
    const owner: Record<string, string> = {};
    (posts ?? []).forEach((p) => (owner[p.id] = p.user_id));

    const tally: Record<string, number> = {};
    rows.forEach((r) => {
      const o = owner[r.post_id];
      if (!o) return;
      tally[o] = (tally[o] ?? 0) + 1;
    });

    const ordered = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    const idx = ordered.findIndex(([uid]) => uid === userId);
    if (idx >= 0 && idx < 10) {
      result[range] = { rank: idx + 1, total: ordered[idx][1], range };
    }
  }

  return result;
};

import { supabase } from "@/integrations/supabase/client";

export type LbRange = "all" | "month" | "week";

export interface LbEntry {
  user_id: string;
  total: number;
  byEmoji: Record<string, number>;
}

export interface LbRanking {
  rank: number; // 1-based
  total: number;
  range: LbRange;
}

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  expires: number;
  promise: Promise<LbEntry[]>;
}

const cache: Partial<Record<LbRange, CacheEntry>> = {};

const sinceFor = (range: LbRange): string | null => {
  if (range === "all") return null;
  const d = new Date();
  d.setDate(d.getDate() - (range === "week" ? 7 : 30));
  return d.toISOString();
};

const fetchRanking = async (range: LbRange): Promise<LbEntry[]> => {
  const since = sinceFor(range);
  let q = supabase.from("post_reactions").select("emoji,post_id,created_at");
  if (since) q = q.gte("created_at", since);
  const { data: reacts } = await q;
  const rows = (reacts ?? []) as { emoji: string; post_id: string }[];
  if (rows.length === 0) return [];

  const postIds = Array.from(new Set(rows.map((r) => r.post_id)));
  const { data: posts } = await supabase
    .from("forum_posts")
    .select("id,user_id")
    .in("id", postIds);
  const owner: Record<string, string> = {};
  (posts ?? []).forEach((p) => (owner[p.id] = p.user_id));

  const tally: Record<string, LbEntry> = {};
  rows.forEach((r) => {
    const o = owner[r.post_id];
    if (!o) return;
    const t = tally[o] || (tally[o] = { user_id: o, total: 0, byEmoji: {} });
    t.total += 1;
    t.byEmoji[r.emoji] = (t.byEmoji[r.emoji] ?? 0) + 1;
  });

  return Object.values(tally).sort((a, b) => b.total - a.total);
};

/**
 * Returns the full ranking (sorted desc by total reactions) for a range,
 * shared via an in-memory cache to avoid duplicate fetches across components.
 */
export const getRanking = (range: LbRange): Promise<LbEntry[]> => {
  const c = cache[range];
  if (c && c.expires > Date.now()) return c.promise;
  const promise = fetchRanking(range);
  cache[range] = { expires: Date.now() + CACHE_TTL_MS, promise };
  // Drop on failure so next call retries
  promise.catch(() => {
    delete cache[range];
  });
  return promise;
};

/** Force refresh next call. */
export const invalidateRanking = (range?: LbRange) => {
  if (range) delete cache[range];
  else (Object.keys(cache) as LbRange[]).forEach((r) => delete cache[r]);
};

/** Top N entries for a given range. */
export const getTop = async (range: LbRange, limit = 10): Promise<LbEntry[]> => {
  const all = await getRanking(range);
  return all.slice(0, limit);
};

/** Map of userId -> 1-based rank for the top N (all time). */
export const getTopAllTime = async (limit = 3): Promise<Record<string, number>> => {
  const top = await getTop("all", limit);
  const result: Record<string, number> = {};
  top.forEach((e, i) => (result[e.user_id] = i + 1));
  return result;
};

/** A user's rank in each range (only if within top 10). */
export const getUserRankings = async (
  userId: string,
): Promise<Partial<Record<LbRange, LbRanking>>> => {
  const ranges: LbRange[] = ["all", "month", "week"];
  const lists = await Promise.all(ranges.map((r) => getRanking(r)));
  const result: Partial<Record<LbRange, LbRanking>> = {};
  ranges.forEach((range, i) => {
    const idx = lists[i].findIndex((e) => e.user_id === userId);
    if (idx >= 0 && idx < 10) {
      result[range] = { rank: idx + 1, total: lists[i][idx].total, range };
    }
  });
  return result;
};

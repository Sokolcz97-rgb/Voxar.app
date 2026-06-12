// Sync game deals from CheapShark API (https://apidocs.cheapshark.com)
// into the game_releases table. No API key required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const STORES_URL = "https://www.cheapshark.com/api/1.0/stores";
const DEALS_URL = (params: string) => `https://www.cheapshark.com/api/1.0/deals?${params}`;
const REDIRECT_URL = (dealID: string) => `https://www.cheapshark.com/redirect?dealID=${dealID}`;

async function getJson(url: string, attempt = 0): Promise<any> {
  const r = await fetch(url, {
    headers: { "User-Agent": "neonhub-sync/1.0 (+https://studiovoxario.com)" },
  });
  if (r.status === 429 && attempt < 3) {
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
    return getJson(url, attempt + 1);
  }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

type Deal = {
  internalName: string;
  title: string;
  metacriticLink?: string;
  dealID: string;
  storeID: string;
  gameID: string;
  salePrice: string;
  normalPrice: string;
  isOnSale: string;
  savings: string;
  metacriticScore: string;
  steamRatingText: string | null;
  steamRatingPercent: string;
  steamRatingCount: string;
  steamAppID: string | null;
  releaseDate: number; // unix seconds (0 if unknown)
  lastChange: number;
  dealRating: string;
  thumb: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supaUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const pages: number = Math.min(Math.max(Number(body?.pages ?? 3), 1), 10);
    const pageSize: number = 60;
    const sortBy: string = body?.sort_by ?? "DealRating"; // DealRating | Savings | Price | Recent | Release | Reviews
    const onSaleOnly: boolean = body?.on_sale_only !== false;
    const storeIDs: string[] | null = Array.isArray(body?.store_ids) && body.store_ids.length
      ? body.store_ids.map(String)
      : null;

    // Load store catalog so we can label platforms
    console.log("[cs] fetching stores…");
    const storesArr: Array<{ storeID: string; storeName: string; isActive: number }> =
      await getJson(STORES_URL);
    const storeMap = new Map(storesArr.map((s) => [s.storeID, s.storeName]));

    // Pull deals across pages
    const allDeals: Deal[] = [];
    for (let page = 0; page < pages; page++) {
      const qp = new URLSearchParams({
        pageNumber: String(page),
        pageSize: String(pageSize),
        sortBy,
        onSale: onSaleOnly ? "1" : "0",
      });
      if (storeIDs) qp.set("storeID", storeIDs.join(","));
      const url = DEALS_URL(qp.toString());
      console.log("[cs] page", page, url);
      const deals: Deal[] = await getJson(url);
      if (!deals?.length) break;
      allDeals.push(...deals);
      if (deals.length < pageSize) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    console.log("[cs] deals fetched:", allDeals.length);

    // Group by gameID — keep best deal (highest dealRating) per game and
    // collect every store the game appears on.
    const byGame = new Map<string, { best: Deal; stores: Set<string> }>();
    for (const d of allDeals) {
      if (!d.gameID) continue;
      const storeName = storeMap.get(d.storeID) ?? `Store ${d.storeID}`;
      const cur = byGame.get(d.gameID);
      if (!cur) {
        byGame.set(d.gameID, { best: d, stores: new Set([storeName]) });
      } else {
        cur.stores.add(storeName);
        if (Number(d.dealRating) > Number(cur.best.dealRating)) cur.best = d;
      }
    }

    const rows = [...byGame.values()].map(({ best, stores }) => {
      const gid = Number(best.gameID);
      const releaseMs = best.releaseDate ? best.releaseDate * 1000 : null;
      const platforms = [...stores];
      if (best.steamAppID) platforms.unshift("PC");
      const sale = Number(best.salePrice);
      const normal = Number(best.normalPrice);
      const savings = Math.round(Number(best.savings));
      const summaryParts = [
        `$${sale.toFixed(2)} on ${storeMap.get(best.storeID) ?? "store"}`,
        normal > sale ? `(was $${normal.toFixed(2)}, −${savings}%)` : null,
        best.metacriticScore && best.metacriticScore !== "0" ? `Metacritic ${best.metacriticScore}` : null,
        best.steamRatingPercent && best.steamRatingPercent !== "0"
          ? `Steam ${best.steamRatingPercent}% (${best.steamRatingCount})`
          : null,
      ].filter(Boolean);

      return {
        igdb_id: gid, // reuse column: CheapShark gameID
        name: best.title,
        slug: best.internalName?.toLowerCase().slice(0, 80) ?? `game-${gid}`,
        summary: summaryParts.join(" · "),
        cover_url: best.thumb || null,
        release_date: releaseMs ? new Date(releaseMs).toISOString() : null,
        release_human: releaseMs
          ? new Date(releaseMs).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
          : null,
        platforms,
        genres: [
          savings >= 75 ? "Mega Sale" : savings >= 50 ? "Big Sale" : savings >= 25 ? "Sale" : "Deal",
        ],
        hype: Math.round(Number(best.dealRating) * 10), // 0–100
        url: REDIRECT_URL(best.dealID),
        is_released: releaseMs ? releaseMs < Date.now() : true,
        fetched_at: new Date().toISOString(),
      };
    });

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, considered: allDeals.length }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Replace prior catalog
    const { error: delErr } = await supabase.from("game_releases").delete().gte("igdb_id", 0);
    if (delErr) throw delErr;

    let synced = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("game_releases")
        .upsert(chunk, { onConflict: "igdb_id" });
      if (error) throw error;
      synced += chunk.length;
    }

    return new Response(JSON.stringify({
      ok: true,
      source: "cheapshark",
      synced,
      considered: allDeals.length,
      unique_games: byGame.size,
      pages,
      sort_by: sortBy,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cs] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

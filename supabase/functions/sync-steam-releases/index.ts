// Sync upcoming + recently released games from the public Steam Store API
// into the game_releases table. No API key required.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FEATURED_URL = "https://store.steampowered.com/api/featuredcategories?cc=us&l=en";
const APPDETAILS_URL = (id: number) =>
  `https://store.steampowered.com/api/appdetails?appids=${id}&cc=us&l=en`;

type FeaturedItem = { id: number; name?: string; type?: number };

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

function parseSteamDate(human: string | undefined, comingSoon: boolean): string | null {
  if (!human) return null;
  const t = Date.parse(human);
  if (!isNaN(t)) return new Date(t).toISOString();
  // Try "Q3 2025" / "2025" / "Coming soon"
  const yearMatch = human.match(/(\d{4})/);
  if (yearMatch) {
    const y = Number(yearMatch[1]);
    const month = /Q1/i.test(human) ? 2 : /Q2/i.test(human) ? 5 :
                  /Q3/i.test(human) ? 8 : /Q4/i.test(human) ? 11 : 11;
    return new Date(Date.UTC(y, month, 15)).toISOString();
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supaUrl, serviceKey);

    const body = await req.json().catch(() => ({} as any));
    const includeTopSellers = body?.include_top_sellers !== false;
    const includeSpecials = body?.include_specials === true;

    // 1) Pull featured categories
    console.log("[steam] fetching featured…");
    const featured = await getJson(FEATURED_URL);

    const buckets: Record<string, FeaturedItem[]> = {
      coming_soon: featured?.coming_soon?.items ?? [],
      new_releases: featured?.new_releases?.items ?? [],
    };
    if (includeTopSellers) buckets.top_sellers = featured?.top_sellers?.items ?? [];
    if (includeSpecials) buckets.specials = featured?.specials?.items ?? [];

    const idToBuckets = new Map<number, Set<string>>();
    for (const [bucket, items] of Object.entries(buckets)) {
      for (const it of items) {
        if (!it?.id) continue;
        if (!idToBuckets.has(it.id)) idToBuckets.set(it.id, new Set());
        idToBuckets.get(it.id)!.add(bucket);
      }
    }
    const appIds = [...idToBuckets.keys()];
    console.log("[steam] featured app ids:", appIds.length);

    if (appIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, message: "No featured items" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Fetch appdetails (throttled to avoid Steam rate limits)
    const rows: any[] = [];
    let failed = 0;
    for (let i = 0; i < appIds.length; i++) {
      const id = appIds[i];
      try {
        const d = await getJson(APPDETAILS_URL(id));
        const node = d?.[String(id)];
        if (!node?.success || !node?.data) { failed++; continue; }
        const g = node.data;
        if (g.type !== "game") continue;

        const platforms = new Set<string>();
        if (g.platforms?.windows) platforms.add("PC");
        if (g.platforms?.mac) platforms.add("Mac");
        if (g.platforms?.linux) platforms.add("Linux");
        platforms.add("Steam");

        const comingSoon = !!g.release_date?.coming_soon;
        const releaseIso = parseSteamDate(g.release_date?.date, comingSoon);

        rows.push({
          igdb_id: id, // reuse column for steam appid
          name: g.name ?? `App ${id}`,
          slug: (g.name ?? `app-${id}`)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
            .slice(0, 80),
          summary: g.short_description ?? null,
          cover_url: g.header_image ?? null,
          release_date: releaseIso,
          release_human: g.release_date?.date ?? null,
          platforms: [...platforms, ...(g.publishers ?? []).slice(0, 1)],
          genres: (g.genres ?? []).map((x: any) => x.description).filter(Boolean),
          hype: (g.recommendations?.total ?? 0),
          url: `https://store.steampowered.com/app/${id}/`,
          is_released: !comingSoon,
          fetched_at: new Date().toISOString(),
        });
      } catch (e) {
        failed++;
        console.warn("[steam] appdetails fail", id, String(e));
      }
      // throttle ~4 req/s (Steam allows ~10 req/s but be safe)
      await new Promise((res) => setTimeout(res, 220));
    }

    console.log("[steam] details ok:", rows.length, "failed:", failed);

    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, failed }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Replace prior catalog with the fresh Steam data
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
      source: "steam",
      synced,
      considered: appIds.length,
      failed,
      buckets: Object.fromEntries(Object.entries(buckets).map(([k, v]) => [k, v.length])),
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[steam] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Sync upcoming + recent game releases from IGDB into game_releases table
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// IGDB platform IDs → friendly label
const PLATFORM_MAP: Record<number, string> = {
  6: "PC",
  167: "PlayStation 5",
  48: "PlayStation 4",
  169: "Xbox Series X|S",
  49: "Xbox One",
  130: "Nintendo Switch",
  508: "Nintendo Switch 2",
  39: "iOS",
  34: "Android",
  14: "Mac",
  3: "Linux",
};

// IGDB external_games.category → store label
const STORE_MAP: Record<number, string> = {
  1: "Steam",
  5: "GOG",
  11: "Microsoft",
  13: "Apple",
  15: "Android",
  26: "Epic Games Store",
  28: "Oculus",
  30: "Itch.io",
  31: "Xbox Marketplace",
  36: "Playstation Store",
  37: "Focus Entertainment",
};

const DEFAULT_PLATFORMS = [6, 167, 48, 169, 49, 130, 508];

async function getIgdbToken(clientId: string, clientSecret: string): Promise<string> {
  const r = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" },
  );
  const j = await r.json();
  if (!j.access_token) throw new Error(`IGDB token failed: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function igdb<T>(endpoint: string, body: string, clientId: string, token: string): Promise<T> {
  const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST",
    headers: {
      "Client-ID": clientId,
      Authorization: `Bearer ${token}`,
      "Content-Type": "text/plain",
    },
    body,
  });
  if (!r.ok) throw new Error(`IGDB ${endpoint} ${r.status}: ${await r.text()}`);
  return r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const clientId = Deno.env.get("TWITCH_CLIENT_ID");
    const clientSecret = Deno.env.get("TWITCH_CLIENT_SECRET");
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!clientId || !clientSecret) {
      throw new Error("TWITCH_CLIENT_ID / TWITCH_CLIENT_SECRET not configured");
    }

    // Body: { platforms?: number[], days_back?: number, days_forward?: number }
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body */ }
    const platforms: number[] = Array.isArray(body.platforms) && body.platforms.length > 0
      ? body.platforms.map((x: any) => Number(x)).filter((x: number) => PLATFORM_MAP[x])
      : DEFAULT_PLATFORMS;
    const daysBack = Number(body.days_back ?? 30);
    const daysForward = Number(body.days_forward ?? 365);

    console.log("[sync] platforms:", platforms, "window:", daysBack, "/", daysForward);

    const token = await getIgdbToken(clientId, clientSecret);
    const supabase = createClient(supaUrl, serviceKey);

    const now = Math.floor(Date.now() / 1000);
    const from = now - daysBack * 86400;
    const to = now + daysForward * 86400;

    const platformIds = platforms.join(",");

    // Pull release_dates — paginate up to 1500 records
    const releaseDates: Array<{
      id: number; game: number; date: number; human: string; platform: number;
    }> = [];
    for (let offset = 0; offset < 1500; offset += 500) {
      const page = await igdb<typeof releaseDates>(
        "release_dates",
        `fields game, date, human, platform;
         where date >= ${from} & date <= ${to} & platform = (${platformIds});
         sort date asc;
         limit 500;
         offset ${offset};`,
        clientId,
        token,
      );
      releaseDates.push(...page);
      if (page.length < 500) break;
    }

    console.log("[sync] release_dates fetched:", releaseDates.length);

    const gameIds = [...new Set(releaseDates.map((r) => r.game))];
    if (gameIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0, release_dates: 0, message: "No releases found for the selected platforms in the given window" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch game details in batches of 100
    const games: any[] = [];
    for (let i = 0; i < gameIds.length; i += 100) {
      const batch = gameIds.slice(i, i + 100).join(",");
      const res = await igdb<any[]>(
        "games",
        `fields name, slug, summary, cover.image_id, genres.name, hypes, url,
                external_games.category, external_games.url, first_release_date;
         where id = (${batch});
         limit 100;`,
        clientId,
        token,
      );
      games.push(...res);
    }

    console.log("[sync] games fetched:", games.length);

    const earliestByGame = new Map<number, { date: number; human: string; platforms: Set<string> }>();
    for (const rd of releaseDates) {
      const cur = earliestByGame.get(rd.game);
      const platLabel = PLATFORM_MAP[rd.platform] ?? null;
      if (!cur) {
        earliestByGame.set(rd.game, {
          date: rd.date, human: rd.human,
          platforms: new Set(platLabel ? [platLabel] : []),
        });
      } else {
        if (rd.date < cur.date) { cur.date = rd.date; cur.human = rd.human; }
        if (platLabel) cur.platforms.add(platLabel);
      }
    }

    const rows = games.map((g) => {
      const meta = earliestByGame.get(g.id);
      const dateMs = meta ? meta.date * 1000 : null;
      const platformSet = new Set<string>(meta ? [...meta.platforms] : []);
      const stores = new Set<string>();
      for (const ext of g.external_games ?? []) {
        const label = STORE_MAP[ext.category];
        if (label) stores.add(label);
      }
      const platformList = [...platformSet, ...stores];

      const cover = g.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
        : null;

      return {
        igdb_id: g.id,
        name: g.name,
        slug: g.slug ?? null,
        summary: g.summary ?? null,
        cover_url: cover,
        release_date: dateMs ? new Date(dateMs).toISOString() : null,
        release_human: meta?.human ?? null,
        platforms: platformList,
        genres: (g.genres ?? []).map((x: any) => x.name).filter(Boolean),
        hype: g.hypes ?? 0,
        url: g.url ?? null,
        is_released: dateMs ? dateMs < Date.now() : false,
        fetched_at: new Date().toISOString(),
      };
    });

    let synced = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("game_releases")
        .upsert(chunk, { onConflict: "igdb_id" });
      if (error) throw error;
      synced += chunk.length;
    }

    console.log("[sync] upserted:", synced);

    return new Response(JSON.stringify({
      ok: true,
      synced,
      release_dates: releaseDates.length,
      games: games.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[sync] error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

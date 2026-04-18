// Sync upcoming + recent game releases from IGDB into game_releases table
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// IGDB platform IDs we care about → friendly label (used for filtering UI)
const PLATFORM_MAP: Record<number, string> = {
  6: "PC (Steam/Epic/Ubisoft/EA)",
  // Storefront tagging is done via "external_games" category below.
  167: "PlayStation 5",
  48: "PlayStation 4",
  169: "Xbox Series X|S",
  49: "Xbox One",
  130: "Nintendo Switch",
  39: "iOS",
  34: "Android",
};

// IGDB external_games.category → store label
const STORE_MAP: Record<number, string> = {
  1: "Steam",
  5: "GOG",
  10: "YouTube",
  11: "Microsoft",
  13: "Apple",
  14: "Twitch",
  15: "Android",
  20: "Amazon ASIN",
  22: "Amazon Luna",
  23: "Amazon ADG",
  26: "Epic Games Store",
  28: "Oculus",
  29: "Utomik",
  30: "Itch.io",
  31: "Xbox Marketplace",
  32: "Kartridge",
  36: "Playstation Store US",
  37: "Focus Entertainment",
  54: "Xbox Game Pass Ultimate Cloud",
  55: "Gamejolt",
};

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

    const token = await getIgdbToken(clientId, clientSecret);
    const supabase = createClient(supaUrl, serviceKey);

    // Window: -30 days … +180 days
    const now = Math.floor(Date.now() / 1000);
    const from = now - 30 * 86400;
    const to = now + 180 * 86400;

    const platformIds = Object.keys(PLATFORM_MAP).join(",");

    // Pull release_dates first → get unique games with upcoming windows
    const releaseDates = await igdb<Array<{
      id: number;
      game: number;
      date: number;
      human: string;
      platform: number;
    }>>(
      "release_dates",
      `fields game, date, human, platform;
       where date >= ${from} & date <= ${to} & platform = (${platformIds});
       sort date asc;
       limit 500;`,
      clientId,
      token,
    );

    const gameIds = [...new Set(releaseDates.map((r) => r.game))];
    if (gameIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, synced: 0 }), {
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

    // Build map of earliest release per game from releaseDates
    const earliestByGame = new Map<number, { date: number; human: string; platforms: Set<string> }>();
    for (const rd of releaseDates) {
      const cur = earliestByGame.get(rd.game);
      const platLabel = PLATFORM_MAP[rd.platform] ?? null;
      if (!cur) {
        earliestByGame.set(rd.game, {
          date: rd.date,
          human: rd.human,
          platforms: new Set(platLabel ? [platLabel] : []),
        });
      } else {
        if (rd.date < cur.date) {
          cur.date = rd.date;
          cur.human = rd.human;
        }
        if (platLabel) cur.platforms.add(platLabel);
      }
    }

    const rows = games.map((g) => {
      const meta = earliestByGame.get(g.id);
      const dateMs = meta ? meta.date * 1000 : null;
      const platforms = new Set<string>(meta ? [...meta.platforms] : []);

      // Add storefronts from external_games (Steam, Epic, GOG, ...)
      const stores = new Set<string>();
      for (const ext of g.external_games ?? []) {
        const label = STORE_MAP[ext.category];
        if (label) stores.add(label);
      }
      // Heuristic: if PC platform present but no storefront tagged, still mark as PC
      const platformList = [...platforms, ...stores];

      const cover = g.cover?.image_id
        ? `https://images.igdb.com/igdb/image/upload/t_cover_big/${g.cover.image_id}.jpg`
        : null;

      const genres = (g.genres ?? []).map((x: any) => x.name).filter(Boolean);

      return {
        igdb_id: g.id,
        name: g.name,
        slug: g.slug ?? null,
        summary: g.summary ?? null,
        cover_url: cover,
        release_date: dateMs ? new Date(dateMs).toISOString() : null,
        release_human: meta?.human ?? null,
        platforms: platformList,
        genres,
        hype: g.hypes ?? 0,
        url: g.url ?? null,
        is_released: dateMs ? dateMs < Date.now() : false,
        fetched_at: new Date().toISOString(),
      };
    });

    // Upsert in chunks
    let synced = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      const { error } = await supabase
        .from("game_releases")
        .upsert(chunk, { onConflict: "igdb_id" });
      if (error) throw error;
      synced += chunk.length;
    }

    return new Response(JSON.stringify({ ok: true, synced }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sync-game-releases error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

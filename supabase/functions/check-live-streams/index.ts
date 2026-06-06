// Check live status across Twitch, YouTube, Kick for all featured streamers
// and write results into public.live_streams_cache
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWITCH_GATEWAY = "https://connector-gateway.lovable.dev/twitch";

type FeaturedRow = {
  user_id: string;
  twitch_username: string | null;
  youtube_handle: string | null;
  kick_username: string | null;
};

type StreamRecord = {
  user_id: string;
  platform: "twitch" | "youtube" | "kick";
  handle: string;
  is_live: boolean;
  title: string | null;
  game_name: string | null;
  viewer_count: number;
  thumbnail_url: string | null;
  stream_url: string;
  started_at: string | null;
  checked_at: string;
};

// ---------- Twitch ----------
async function checkTwitch(
  handles: { user_id: string; login: string }[],
): Promise<StreamRecord[]> {
  if (handles.length === 0) return [];
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWITCH_API_KEY = Deno.env.get("TWITCH_API_KEY");
  if (!LOVABLE_API_KEY || !TWITCH_API_KEY) {
    console.warn("Twitch keys missing — skipping Twitch checks");
    return [];
  }

  // Twitch GET /streams supports up to 100 user_login params
  const params = handles
    .map((h) => `user_login=${encodeURIComponent(h.login)}`)
    .join("&");
  const url = `${TWITCH_GATEWAY}/streams?${params}&first=100`;
  console.log("[twitch] checking", handles.map((h) => h.login).join(","));
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWITCH_API_KEY,
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error("Twitch streams error", res.status, txt);
    return handles.map((h) => offlineRec(h.user_id, "twitch", h.login));
  }
  const json = await res.json();
  console.log("[twitch] live results:", (json.data ?? []).length);
  const liveByLogin = new Map<string, any>();
  for (const s of json.data ?? []) {
    // Match by both user_login and user_name (case-insensitive) for robustness
    if (s.user_login) liveByLogin.set(String(s.user_login).toLowerCase(), s);
    if (s.user_name) liveByLogin.set(String(s.user_name).toLowerCase(), s);
  }
  const checkedAt = new Date().toISOString();
  return handles.map((h) => {
    const s = liveByLogin.get(h.login.toLowerCase());
    if (!s) return offlineRec(h.user_id, "twitch", h.login);
    const thumb = (s.thumbnail_url ?? "")
      .replace("{width}", "640")
      .replace("{height}", "360");
    return {
      user_id: h.user_id,
      platform: "twitch",
      handle: h.login,
      is_live: true,
      title: s.title ?? null,
      game_name: s.game_name ?? null,
      viewer_count: Number(s.viewer_count ?? 0),
      thumbnail_url: thumb || null,
      stream_url: `https://twitch.tv/${h.login}`,
      started_at: s.started_at ?? null,
      checked_at: checkedAt,
    };
  });
}

// ---------- Kick (unofficial public API) ----------
async function checkKick(
  handles: { user_id: string; login: string }[],
): Promise<StreamRecord[]> {
  const checkedAt = new Date().toISOString();
  const out: StreamRecord[] = [];
  await Promise.all(
    handles.map(async (h) => {
      try {
        const res = await fetch(
          `https://kick.com/api/v2/channels/${encodeURIComponent(h.login)}`,
          { headers: { "User-Agent": "Mozilla/5.0 NeonHub" } },
        );
        if (!res.ok) {
          out.push(offlineRec(h.user_id, "kick", h.login));
          return;
        }
        const j = await res.json();
        const live = j?.livestream;
        if (!live) {
          out.push(offlineRec(h.user_id, "kick", h.login));
          return;
        }
        out.push({
          user_id: h.user_id,
          platform: "kick",
          handle: h.login,
          is_live: true,
          title: live.session_title ?? null,
          game_name: live.categories?.[0]?.name ?? null,
          viewer_count: Number(live.viewer_count ?? 0),
          thumbnail_url: live.thumbnail?.url ?? null,
          stream_url: `https://kick.com/${h.login}`,
          started_at: live.created_at ?? null,
          checked_at: checkedAt,
        });
      } catch (e) {
        console.error("Kick error for", h.login, e);
        out.push(offlineRec(h.user_id, "kick", h.login));
      }
    }),
  );
  return out;
}

// ---------- YouTube (scrape /live to avoid expensive Search API quota) ----------
async function checkYouTube(
  handles: { user_id: string; login: string }[],
): Promise<StreamRecord[]> {
  const checkedAt = new Date().toISOString();
  const out: StreamRecord[] = [];
  await Promise.all(
    handles.map(async (h) => {
      try {
        const handle = h.login.startsWith("@") ? h.login : `@${h.login}`;
        const liveUrl = `https://www.youtube.com/${handle}/live`;
        const res = await fetch(liveUrl, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
          },
          redirect: "follow",
        });
        const html = await res.text();
        const isLive =
          html.includes('"isLiveBroadcast":true') ||
          html.includes('"isLive":true') ||
          /"liveBroadcastContent":"live"/.test(html);
        if (!isLive) {
          out.push(offlineRec(h.user_id, "youtube", h.login));
          return;
        }
        const vidMatch =
          html.match(/"videoId":"([A-Za-z0-9_-]{11})"/) ||
          html.match(/watch\?v=([A-Za-z0-9_-]{11})/);
        const videoId = vidMatch?.[1] ?? "";
        const titleMatch =
          html.match(/<meta name="title" content="([^"]+)"/) ||
          html.match(/<title>([^<]+)<\/title>/);
        const title = titleMatch?.[1]?.replace(/ - YouTube$/, "") ?? null;
        // Prefer the uploader's custom thumbnail (maxresdefault → hqdefault).
        // hqdefault.jpg is always available; maxresdefault only if the creator uploaded HD.
        const thumb = videoId
          ? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`
          : null;
        const viewersMatch = html.match(/"concurrentViewers":"(\d+)"/);
        const viewers = viewersMatch ? Number(viewersMatch[1]) : 0;
        out.push({
          user_id: h.user_id,
          platform: "youtube",
          handle: h.login,
          is_live: true,
          title,
          game_name: null,
          viewer_count: viewers,
          thumbnail_url: thumb,
          stream_url: videoId
            ? `https://www.youtube.com/watch?v=${videoId}`
            : liveUrl,
          started_at: null,
          checked_at: checkedAt,
        });
      } catch (e) {
        console.error("YouTube scrape error for", h.login, e);
        out.push(offlineRec(h.user_id, "youtube", h.login));
      }
    }),
  );
  return out;
}

function offlineRec(
  user_id: string,
  platform: "twitch" | "youtube" | "kick",
  handle: string,
): StreamRecord {
  const url =
    platform === "twitch"
      ? `https://twitch.tv/${handle}`
      : platform === "kick"
        ? `https://kick.com/${handle}`
        : `https://www.youtube.com/${handle.startsWith("@") ? handle : "@" + handle}`;
  return {
    user_id,
    platform,
    handle,
    is_live: false,
    title: null,
    game_name: null,
    viewer_count: 0,
    thumbnail_url: null,
    stream_url: url,
    started_at: null,
    checked_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Get featured user_ids
    const { data: featured, error: fErr } = await admin.rpc(
      "get_featured_streamers",
    );
    if (fErr) throw fErr;
    const ids = (featured ?? []).map((r: any) => r.user_id);
    if (ids.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, checked: 0, message: "No featured users" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2) Fetch profiles with handles
    const { data: profiles } = await admin
      .from("profiles")
      .select("user_id, twitch_username, youtube_handle, kick_username")
      .in("user_id", ids);

    const twitch: { user_id: string; login: string }[] = [];
    const youtube: { user_id: string; login: string }[] = [];
    const kick: { user_id: string; login: string }[] = [];
    (profiles ?? []).forEach((p: FeaturedRow) => {
      if (p.twitch_username?.trim())
        twitch.push({ user_id: p.user_id, login: p.twitch_username.trim() });
      if (p.youtube_handle?.trim())
        youtube.push({ user_id: p.user_id, login: p.youtube_handle.trim() });
      if (p.kick_username?.trim())
        kick.push({ user_id: p.user_id, login: p.kick_username.trim() });
    });

    // 3) Check all platforms in parallel
    const [tRes, yRes, kRes] = await Promise.all([
      checkTwitch(twitch),
      checkYouTube(youtube),
      checkKick(kick),
    ]);
    const all = [...tRes, ...yRes, ...kRes];

    // 4) Upsert into cache
    if (all.length > 0) {
      const { error: upErr } = await admin
        .from("live_streams_cache")
        .upsert(all, { onConflict: "user_id,platform" });
      if (upErr) throw upErr;
    }

    // 5) Cleanup: delete cache rows for handles that no longer exist
    const keep = all.map((r) => `${r.user_id}:${r.platform}`);
    const { data: existing } = await admin
      .from("live_streams_cache")
      .select("id, user_id, platform");
    const toDelete = (existing ?? []).filter(
      (r: any) => !keep.includes(`${r.user_id}:${r.platform}`),
    );
    if (toDelete.length > 0) {
      await admin
        .from("live_streams_cache")
        .delete()
        .in(
          "id",
          toDelete.map((r: any) => r.id),
        );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        checked: all.length,
        live: all.filter((r) => r.is_live).length,
        platforms: {
          twitch: twitch.length,
          youtube: youtube.length,
          kick: kick.length,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("check-live-streams error", e);
    const msg = e instanceof Error ? e.message : "unknown";
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

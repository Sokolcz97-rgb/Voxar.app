// Poll Twitch + YouTube for tracked handles, send Discord webhook notification
// when a new live stream / new video appears.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const TWITCH_GATEWAY = "https://connector-gateway.lovable.dev/twitch";

type Row = {
  id: string;
  platform: "twitch" | "youtube";
  handle: string;
  discord_channel_id: string;
  webhook_url: string | null;
  template: string;
  enabled: boolean;
  last_notified_at: string | null;
  last_video_id: string | null;
  last_upload_id: string | null;
  last_subscribed_at: string | null;
};

const WEBSUB_HUB = "https://pubsubhubbub.appspot.com/subscribe";
const CALLBACK_BASE = "https://rioexuvgvmdwvidfakxy.supabase.co/functions/v1/yt-websub";

async function ensureWebSub(row: Row, channelId: string, supabase: any) {
  // Refresh subscription every 4 days (hub lease is typically 5 days)
  const fresh = row.last_subscribed_at &&
    Date.now() - new Date(row.last_subscribed_at).getTime() < 4 * 86400 * 1000;
  if (fresh) return;
  try {
    const body = new URLSearchParams({
      "hub.mode": "subscribe",
      "hub.topic": `https://www.youtube.com/xml/feeds/videos.xml?channel_id=${channelId}`,
      "hub.callback": `${CALLBACK_BASE}?id=${row.id}`,
      "hub.verify": "async",
      "hub.lease_seconds": "432000",
    });
    const res = await fetch(WEBSUB_HUB, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    if (res.status === 202 || res.ok) {
      await supabase.from("bot_stream_notifications")
        .update({ last_subscribed_at: new Date().toISOString() })
        .eq("id", row.id);
    } else {
      console.warn("websub subscribe failed", row.handle, res.status, await res.text());
    }
  } catch (e) {
    console.error("websub subscribe error", row.handle, e);
  }
}

function fmt(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

async function sendDiscord(row: Row, content: string, embed?: Record<string, unknown>, supabase?: any) {
  const payload: Record<string, unknown> = { content };
  if (embed) payload.embeds = [embed];
  if (row.webhook_url) {
    const res = await fetch(row.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) console.error("webhook failed", res.status, await res.text());
    return;
  }
  // No webhook → queue for external bot
  if (supabase) {
    await supabase.from("bot_outbound_queue").insert({
      channel_id: row.discord_channel_id,
      payload,
      source: "bot-poll-streams",
    });
  }
}

async function pollTwitch(rows: Row[], supabase: any) {
  if (rows.length === 0) return;
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWITCH_API_KEY = Deno.env.get("TWITCH_API_KEY");
  if (!LOVABLE_API_KEY || !TWITCH_API_KEY) {
    console.warn("Twitch keys missing");
    return;
  }
  const params = rows.map((r) => `user_login=${encodeURIComponent(r.handle)}`).join("&");
  const res = await fetch(`${TWITCH_GATEWAY}/streams?${params}&first=100`, {
    headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "X-Connection-Api-Key": TWITCH_API_KEY },
  });
  if (!res.ok) { console.error("twitch error", res.status, await res.text()); return; }
  const json = await res.json();
  const live = new Map<string, any>();
  for (const s of json.data ?? []) live.set(String(s.user_login).toLowerCase(), s);

  for (const row of rows) {
    const s = live.get(row.handle.toLowerCase());
    if (!s) continue;
    // Skip if notified within last 6h (avoid spamming same stream)
    if (row.last_notified_at && Date.now() - new Date(row.last_notified_at).getTime() < 6 * 60 * 60 * 1000) continue;

    const url = `https://twitch.tv/${row.handle}`;
    const content = fmt(row.template, { handle: row.handle, title: s.title ?? "", url, game: s.game_name ?? "" });
    const thumb = (s.thumbnail_url ?? "").replace("{width}", "640").replace("{height}", "360");
    const embed = {
      title: s.title ?? row.handle,
      url,
      color: 0x9146ff,
      author: { name: `${row.handle} je živě na Twitchi` },
      fields: [
        { name: "Hra", value: s.game_name || "—", inline: true },
        { name: "Diváci", value: String(s.viewer_count ?? 0), inline: true },
      ],
      image: thumb ? { url: thumb } : undefined,
    };
    await sendDiscord(row, content, embed, supabase);
    await supabase.from("bot_stream_notifications").update({ last_notified_at: new Date().toISOString() }).eq("id", row.id);
  }
}

async function resolveChannelId(handle: string, ua: string): Promise<string | null> {
  if (handle.startsWith("UC") && handle.length === 24) return handle;
  const h = handle.startsWith("@") ? handle : `@${handle}`;
  try {
    const res = await fetch(`https://www.youtube.com/${h}`, {
      headers: { "User-Agent": ua, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+cb; SOCS=CAI" },
      redirect: "follow",
    });
    const html = await res.text();
    const m = html.match(/"channelId":"(UC[A-Za-z0-9_-]{22})"/) ||
              html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[A-Za-z0-9_-]{22})"/) ||
              html.match(/\/channel\/(UC[A-Za-z0-9_-]{22})/);
    return m?.[1] ?? null;
  } catch (e) {
    console.error("resolveChannelId", handle, e);
    return null;
  }
}

async function pollYouTube(rows: Row[], supabase: any) {
  if (rows.length === 0) return;
  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

  for (const row of rows) {
    try {
      const channelId = await resolveChannelId(row.handle, UA);
      if (!channelId) { console.warn(`[yt] no channelId for ${row.handle}`); continue; }

      // RSS feed lists the 15 newest uploads (also live broadcasts once they go live)
      const feedRes = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`, {
        headers: { "User-Agent": UA },
      });
      if (!feedRes.ok) { console.warn(`[yt] feed ${row.handle} status=${feedRes.status}`); continue; }
      const xml = await feedRes.text();
      const entry = xml.match(/<entry>[\s\S]*?<\/entry>/);
      if (!entry) continue;
      const videoId = entry[0].match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1];
      const title = entry[0].match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
      const published = entry[0].match(/<published>([^<]+)<\/published>/)?.[1];
      if (!videoId) continue;
      if (videoId === row.last_upload_id) continue;

      // Skip very old videos on first run (avoid spam): only notify if published in last 24h
      if (!row.last_upload_id && published) {
        const ageHours = (Date.now() - new Date(published).getTime()) / 36e5;
        if (ageHours > 24) {
          await supabase.from("bot_stream_notifications")
            .update({ last_upload_id: videoId })
            .eq("id", row.id);
          continue;
        }
      }

      // Check if the video is currently live to pick the right label
      const watchRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", Cookie: "CONSENT=YES+cb; SOCS=CAI" },
      });
      const watchHtml = await watchRes.text();
      const isLive =
        watchHtml.includes('"isLiveBroadcast":true') ||
        watchHtml.includes('"isLiveNow":true') ||
        /"liveBroadcastContent":"live"/.test(watchHtml);

      const url = `https://youtu.be/${videoId}`;
      const ogImg = watchHtml.match(/<meta property="og:image" content="([^"]+)"/);
      const thumbUrl = ogImg?.[1] ?? `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      const content = fmt(row.template, { handle: row.handle, title, url, game: "" });
      const embed = {
        title: title || row.handle,
        url,
        color: isLive ? 0xff0033 : 0xcc0000,
        author: { name: isLive ? `${row.handle} je živě na YouTube` : `${row.handle} nahrál nové video` },
        image: { url: thumbUrl },
      };
      await sendDiscord(row, content, embed, supabase);
      await supabase.from("bot_stream_notifications")
        .update({
          last_notified_at: new Date().toISOString(),
          last_video_id: isLive ? videoId : row.last_video_id,
          last_upload_id: videoId,
        })
        .eq("id", row.id);
    } catch (e) {
      console.error("yt scrape error", row.handle, e);
    }
  }
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: rows, error } = await supabase
      .from("bot_stream_notifications")
      .select("*")
      .eq("enabled", true);
    if (error) throw error;

    const twitch = (rows ?? []).filter((r: Row) => r.platform === "twitch");
    const youtube = (rows ?? []).filter((r: Row) => r.platform === "youtube");

    await Promise.all([pollTwitch(twitch, supabase), pollYouTube(youtube, supabase)]);

    return new Response(JSON.stringify({ checked: rows?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    const msg = e instanceof Error ? e.message : "error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

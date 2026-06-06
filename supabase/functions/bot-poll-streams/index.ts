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
};

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

async function pollYouTube(rows: Row[], supabase: any) {
  if (rows.length === 0) return;
  const UA =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

  for (const row of rows) {
    try {
      const handle = row.handle.startsWith("@") ? row.handle : `@${row.handle}`;
      const liveUrl = row.handle.startsWith("UC") && row.handle.length === 24
        ? `https://www.youtube.com/channel/${row.handle}/live`
        : `https://www.youtube.com/${handle}/live`;
      const res = await fetch(liveUrl, {
        headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" },
        redirect: "follow",
      });
      const html = await res.text();
      const isLive =
        html.includes('"isLiveBroadcast":true') ||
        html.includes('"isLive":true') ||
        /"liveBroadcastContent":"live"/.test(html);
      if (!isLive) continue;

      const vidMatch =
        html.match(/"videoId":"([A-Za-z0-9_-]{11})"/) ||
        html.match(/watch\?v=([A-Za-z0-9_-]{11})/);
      const videoId = vidMatch?.[1] ?? "";
      if (!videoId) continue;
      // Already notified about this live broadcast
      if (videoId === row.last_video_id) continue;

      const titleMatch =
        html.match(/<meta name="title" content="([^"]+)"/) ||
        html.match(/<title>([^<]+)<\/title>/);
      const title = (titleMatch?.[1] ?? "").replace(/ - YouTube$/, "");
      const url = `https://youtu.be/${videoId}`;
      const content = fmt(row.template, { handle: row.handle, title, url, game: "" });
      const embed = {
        title: title || row.handle,
        url,
        color: 0xff0033,
        author: { name: `${row.handle} je živě na YouTube` },
        image: { url: `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg` },
      };
      await sendDiscord(row, content, embed, supabase);
      await supabase.from("bot_stream_notifications")
        .update({ last_notified_at: new Date().toISOString(), last_video_id: videoId })
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

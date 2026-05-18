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
  const YT_KEY = Deno.env.get("YOUTUBE_API_KEY");
  if (!YT_KEY) { console.warn("YOUTUBE_API_KEY missing"); return; }

  for (const row of rows) {
    // Resolve channel id from handle (cached via last_video_id field — not ideal but works)
    let channelId: string | null = null;
    // Treat handle starting with UC as channel id directly
    if (row.handle.startsWith("UC") && row.handle.length === 24) {
      channelId = row.handle;
    } else {
      const handle = row.handle.replace(/^@/, "");
      const sr = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(handle)}&maxResults=1&key=${YT_KEY}`);
      if (!sr.ok) { console.error("yt search", sr.status, await sr.text()); continue; }
      const sj = await sr.json();
      channelId = sj.items?.[0]?.snippet?.channelId ?? sj.items?.[0]?.id?.channelId ?? null;
    }
    if (!channelId) continue;

    // Latest upload via search ordered by date
    const lr = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&type=video&maxResults=1&key=${YT_KEY}`);
    if (!lr.ok) { console.error("yt latest", lr.status, await lr.text()); continue; }
    const lj = await lr.json();
    const item = lj.items?.[0];
    if (!item) continue;
    const videoId = item.id?.videoId;
    if (!videoId || videoId === row.last_video_id) continue;

    const url = `https://youtu.be/${videoId}`;
    const title = item.snippet?.title ?? "";
    const content = fmt(row.template, { handle: row.handle, title, url, game: "" });
    const embed = {
      title,
      url,
      color: 0xff0033,
      author: { name: `${row.handle} vydal nové video` },
      description: item.snippet?.description?.slice(0, 200) ?? "",
      image: item.snippet?.thumbnails?.high?.url ? { url: item.snippet.thumbnails.high.url } : undefined,
    };
    await sendDiscord(row, content, embed, supabase);
    await supabase.from("bot_stream_notifications")
      .update({ last_notified_at: new Date().toISOString(), last_video_id: videoId })
      .eq("id", row.id);
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

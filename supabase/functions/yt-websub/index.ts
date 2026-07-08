// YouTube PubSubHubbub (WebSub) push receiver — instant notifications on new videos/live streams
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function fmt(template: string, vars: Record<string, string>) {
  return template.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

async function notify(row: any, videoId: string, title: string, supabase: any) {
  const UA = "Mozilla/5.0 (compatible; DiscordBot/1.0)";
  const url = `https://youtu.be/${videoId}`;
  let isLive = false;
  let thumbUrl = `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
  try {
    const w = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "User-Agent": UA, Cookie: "CONSENT=YES+cb; SOCS=CAI" },
    });
    const html = await w.text();
    isLive =
      html.includes('"isLiveBroadcast":true') ||
      html.includes('"isLiveNow":true') ||
      /"liveBroadcastContent":"live"/.test(html);
    const og = html.match(/<meta property="og:image" content="([^"]+)"/);
    if (og) thumbUrl = og[1];
  } catch (_) { /* ignore */ }

  const content = fmt(row.template || "", { handle: row.handle, title, url, game: "" });
  const embed = {
    title: title || row.handle,
    url,
    color: isLive ? 0xff0033 : 0xcc0000,
    author: { name: isLive ? `${row.handle} je živě na YouTube` : `${row.handle} nahrál nové video` },
    image: { url: thumbUrl },
  };
  const payload: Record<string, unknown> = { content, embeds: [embed] };

  if (row.webhook_url) {
    await fetch(row.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch((e) => console.error("webhook", e));
  } else {
    await supabase.from("bot_outbound_queue").insert({
      channel_id: row.discord_channel_id,
      payload,
      source: "yt-websub",
    });
  }

  await supabase.from("bot_stream_notifications").update({
    last_notified_at: new Date().toISOString(),
    last_upload_id: videoId,
    last_video_id: isLive ? videoId : row.last_video_id,
  }).eq("id", row.id);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const rowId = url.searchParams.get("id");

  // Hub verification (GET with hub.challenge)
  if (req.method === "GET") {
    const challenge = url.searchParams.get("hub.challenge");
    if (challenge) return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    return new Response("ok", { status: 200, headers: CORS });
  }

  if (req.method !== "POST") return new Response("method not allowed", { status: 405 });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const xml = await req.text();
    const videoId = xml.match(/<yt:videoId>([A-Za-z0-9_-]{11})<\/yt:videoId>/)?.[1];
    const channelId = xml.match(/<yt:channelId>([A-Za-z0-9_-]+)<\/yt:channelId>/)?.[1];
    const title = xml.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() ?? "";
    const published = xml.match(/<published>([^<]+)<\/published>/)?.[1];
    if (!videoId) return new Response("no video", { status: 200 });

    // Skip republish notifications older than 2h (WebSub can send updates on edits)
    if (published) {
      const ageMs = Date.now() - new Date(published).getTime();
      if (ageMs > 2 * 3600 * 1000) return new Response("stale", { status: 200 });
    }

    // Find matching row(s): prefer by ?id=, otherwise match by channelId lookup
    let rows: any[] = [];
    if (rowId) {
      const { data } = await supabase.from("bot_stream_notifications").select("*").eq("id", rowId).eq("enabled", true);
      rows = data ?? [];
    } else if (channelId) {
      const { data } = await supabase.from("bot_stream_notifications").select("*").eq("platform", "youtube").eq("enabled", true);
      rows = (data ?? []).filter((r: any) => (r.handle || "").includes(channelId));
    }

    for (const row of rows) {
      if (row.last_upload_id === videoId) continue;
      await notify(row, videoId, title, supabase);
    }
    return new Response("ok", { status: 200 });
  } catch (e) {
    console.error("yt-websub error", e);
    return new Response("error", { status: 200 }); // return 200 so hub doesn't retry-storm
  }
});

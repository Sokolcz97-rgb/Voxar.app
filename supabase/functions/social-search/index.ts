import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

interface Suggestion {
  handle: string;
  display_name: string;
  url: string;
  avatar_url: string | null;
}

const TWITCH_GATEWAY = 'https://connector-gateway.lovable.dev/twitch';

async function searchTwitch(query: string): Promise<Suggestion[]> {
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  const twitchKey = Deno.env.get('TWITCH_API_KEY');
  if (!lovableKey || !twitchKey) return [];

  const r = await fetch(
    `${TWITCH_GATEWAY}/search/channels?query=${encodeURIComponent(query)}&first=8`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        'X-Connection-Api-Key': twitchKey,
      },
    },
  );
  if (!r.ok) return [];
  const data = await r.json();
  return (data.data || []).map((c: any) => ({
    handle: c.broadcaster_login,
    display_name: c.display_name,
    url: `https://twitch.tv/${c.broadcaster_login}`,
    avatar_url: c.thumbnail_url || null,
  }));
}

async function searchYouTubeApi(query: string): Promise<Suggestion[]> {
  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return [];
  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(query)}&key=${key}`,
  );
  if (!r.ok) return [];
  const data = await r.json();
  return (data.items || []).map((it: any) => {
    const title = it.snippet?.channelTitle || '';
    return {
      handle: title,
      display_name: title,
      url: `https://www.youtube.com/channel/${it.snippet?.channelId ?? it.id?.channelId}`,
      avatar_url: it.snippet?.thumbnails?.default?.url || null,
    } as Suggestion;
  });
}

/** Fallback: scrape youtube.com/results s filtrem na kanály — bez API kvóty. */
async function searchYouTubeScrape(query: string): Promise<Suggestion[]> {
  // sp=EgIQAg → filter "Channel"
  const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D&hl=en`;
  const r = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
  });
  if (!r.ok) return [];
  const html = await r.text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) return [];
  let data: any;
  try { data = JSON.parse(m[1]); } catch { return []; }

  const out: Suggestion[] = [];
  const walk = (node: any) => {
    if (!node || out.length >= 8) return;
    if (Array.isArray(node)) { for (const x of node) walk(x); return; }
    if (typeof node === 'object') {
      if (node.channelRenderer) {
        const c = node.channelRenderer;
        const title = c.title?.simpleText || '';
        const handle =
          c.subscriberCountText?.simpleText?.startsWith('@')
            ? c.subscriberCountText.simpleText
            : `@${(title || '').replace(/\s+/g, '')}`;
        const thumbs = c.thumbnail?.thumbnails || [];
        const avatar = thumbs[thumbs.length - 1]?.url || null;
        const canonical = c.navigationEndpoint?.browseEndpoint?.canonicalBaseUrl || '';
        const channelUrl = canonical
          ? `https://www.youtube.com${canonical}`
          : `https://www.youtube.com/channel/${c.channelId}`;
        out.push({
          handle: handle || title,
          display_name: title,
          url: channelUrl,
          avatar_url: avatar?.startsWith('//') ? `https:${avatar}` : avatar,
        });
        return;
      }
      for (const k in node) walk(node[k]);
    }
  };
  walk(data);
  return out;
}

async function searchYouTube(query: string): Promise<Suggestion[]> {
  const api = await searchYouTubeApi(query).catch(() => []);
  if (api.length > 0) return api;
  return await searchYouTubeScrape(query).catch(() => []);
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { platform, query } = await req.json();
    if (typeof query !== 'string' || query.trim().length < 2) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const q = query.trim().replace(/^@/, '');

    let results: Suggestion[] = [];
    if (platform === 'twitch') results = await searchTwitch(q);
    else if (platform === 'youtube') results = await searchYouTube(q);
    // kick: žádné veřejné search API → vrátíme prázdné pole

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), results: [] }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

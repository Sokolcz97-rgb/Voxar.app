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

async function searchYouTube(query: string): Promise<Suggestion[]> {
  const key = Deno.env.get('YOUTUBE_API_KEY');
  if (!key) return [];

  const r = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&maxResults=8&q=${encodeURIComponent(query)}&key=${key}`,
  );
  if (!r.ok) return [];
  const data = await r.json();
  return (data.items || []).map((it: any) => {
    const handle = it.snippet?.customUrl || it.snippet?.channelTitle || '';
    const cleanHandle = handle.startsWith('@') ? handle : `@${handle.replace(/^@+/, '')}`;
    return {
      handle: cleanHandle,
      display_name: it.snippet?.channelTitle ?? cleanHandle,
      url: `https://www.youtube.com/channel/${it.snippet?.channelId ?? it.id?.channelId}`,
      avatar_url: it.snippet?.thumbnails?.default?.url || null,
    };
  });
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

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const guildId = url.searchParams.get('guild_id');
    if (!guildId || !/^\d{15,25}$/.test(guildId)) {
      return json({ error: 'invalid guild_id' }, 400);
    }
    if (!BOT_TOKEN) return json({ error: 'DISCORD_BOT_TOKEN not configured' }, 500);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const [{ data: canManage }, { data: isMgr }] = await Promise.all([
      supabase.rpc('can', { _module: 'bot', _action: 'manage' }),
      supabase.rpc('is_guild_manager', { _user_id: user.id, _guild_id: guildId }),
    ]);
    if (!canManage && !isMgr) return json({ error: 'Forbidden' }, 403);

    const headers = { Authorization: `Bot ${BOT_TOKEN}` };
    const [chRes, rolesRes] = await Promise.all([
      fetch(`https://discord.com/api/v10/guilds/${guildId}/channels`, { headers }),
      fetch(`https://discord.com/api/v10/guilds/${guildId}/roles`, { headers }),
    ]);
    if (!chRes.ok) {
      const t = await chRes.text();
      return json({ error: `Discord channels ${chRes.status}: ${t}` }, 502);
    }
    if (!rolesRes.ok) {
      const t = await rolesRes.text();
      return json({ error: `Discord roles ${rolesRes.status}: ${t}` }, 502);
    }
    const channelsRaw = await chRes.json() as any[];
    const rolesRaw = await rolesRes.json() as any[];

    const channels = channelsRaw.map((c) => ({
      id: c.id, name: c.name, type: c.type, parent_id: c.parent_id ?? null, position: c.position ?? 0,
    })).sort((a, b) => a.position - b.position);
    const roles = rolesRaw
      .filter((r) => r.name !== '@everyone')
      .map((r) => ({ id: r.id, name: r.name, color: r.color, position: r.position }))
      .sort((a, b) => b.position - a.position);

    return json({ channels, roles }, 200, {
      'Cache-Control': 'private, max-age=30',
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Unknown' }, 500);
  }
});

function json(data: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

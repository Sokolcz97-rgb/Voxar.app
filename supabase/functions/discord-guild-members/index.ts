import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');

type MemberInfo = {
  id: string;
  nick: string | null;
  username: string;
  global_name: string | null;
  avatar_url: string | null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    if (!BOT_TOKEN) return json({ error: 'DISCORD_BOT_TOKEN not configured' }, 500);
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Unauthorized' }, 401);

    let body: { guild_id?: string; user_ids?: string[] } = {};
    try { body = await req.json(); } catch { /* ignore */ }
    const guildId = body.guild_id;
    const userIds = Array.from(new Set((body.user_ids ?? []).filter((s) => typeof s === 'string' && /^\d{15,25}$/.test(s))));
    if (!guildId || !/^\d{15,25}$/.test(guildId)) return json({ error: 'invalid guild_id' }, 400);
    if (userIds.length === 0) return json({ members: {} }, 200);
    if (userIds.length > 100) return json({ error: 'too many user_ids (max 100)' }, 400);

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
    const members: Record<string, MemberInfo> = {};

    // Limited-concurrency lookup
    const concurrency = 8;
    let idx = 0;
    async function worker() {
      while (idx < userIds.length) {
        const my = idx++;
        const uid = userIds[my];
        try {
          const r = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${uid}`, { headers });
          if (r.ok) {
            const m = await r.json() as any;
            const u = m.user ?? {};
            const avatarHash = m.avatar || u.avatar;
            const avatar_url = avatarHash
              ? (m.avatar
                  ? `https://cdn.discordapp.com/guilds/${guildId}/users/${uid}/avatars/${avatarHash}.png`
                  : `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.png`)
              : null;
            members[uid] = {
              id: uid,
              nick: m.nick ?? null,
              username: u.username ?? uid,
              global_name: u.global_name ?? null,
              avatar_url,
            };
          } else if (r.status === 404) {
            // Not a member (left) — try plain user
            const ur = await fetch(`https://discord.com/api/v10/users/${uid}`, { headers });
            if (ur.ok) {
              const u = await ur.json() as any;
              members[uid] = {
                id: uid,
                nick: null,
                username: u.username ?? uid,
                global_name: u.global_name ?? null,
                avatar_url: u.avatar ? `https://cdn.discordapp.com/avatars/${uid}/${u.avatar}.png` : null,
              };
            }
          }
        } catch { /* skip */ }
      }
    }
    await Promise.all(Array.from({ length: Math.min(concurrency, userIds.length) }, worker));

    return json({ members }, 200, { 'Cache-Control': 'private, max-age=60' });
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

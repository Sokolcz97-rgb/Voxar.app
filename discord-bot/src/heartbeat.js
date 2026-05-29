import { supabase } from './supabase.js';

const DEFAULT_BOT_VERSION = 'server-stats-2026-05-29';

export function startHeartbeat(client) {
  const send = async () => {
    try {
      const { data: existing } = await supabase
        .from('bot_status')
        .select('id')
        .limit(1)
        .maybeSingle();
      const payload = {
        guild_count: client.guilds.cache.size,
        version: process.env.BOT_VERSION || DEFAULT_BOT_VERSION,
        last_heartbeat: new Date().toISOString(),
      };
      if (existing?.id) {
        await supabase.from('bot_status').update(payload).eq('id', existing.id);
      } else {
        await supabase.from('bot_status').insert(payload);
      }
    } catch (e) {
      console.error('heartbeat', e);
    }
  };
  setInterval(send, 30_000);
  send();
}

import { supabase } from './supabase.js';

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
        version: process.env.BOT_VERSION || '1.0.0',
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

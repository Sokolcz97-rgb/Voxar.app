import { supabase } from './supabase.js';
import { registerGuildSlashCommands } from './slashCommands.js';

let debounceTimers = new Map(); // guildId|"*" → timeout

function schedule(client, guildId) {
  const key = guildId || '*';
  clearTimeout(debounceTimers.get(key));
  debounceTimers.set(
    key,
    setTimeout(async () => {
      if (guildId) {
        await registerGuildSlashCommands(client, guildId).catch(() => {});
      } else {
        // Global command → re-register na všech schválených guildách
        for (const g of client.guilds.cache.values()) {
          await registerGuildSlashCommands(client, g.id).catch(() => {});
        }
      }
    }, 1500),
  );
}

/**
 * Sleduje změny v bot_commands a přeregistruje slash commandy pro dotčené guildy.
 * Volat jednou po ready.
 */
export function startCommandsRealtime(client) {
  const channel = supabase
    .channel('bot-commands-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bot_commands' },
      (payload) => {
        const newGuild = payload.new?.guild_id ?? null;
        const oldGuild = payload.old?.guild_id ?? null;
        const guilds = new Set([newGuild, oldGuild]);
        for (const g of guilds) schedule(client, g);
        console.log(`🔄 bot_commands změna (${payload.eventType}) → reload slash commandů`);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('📡 Realtime: bot_commands sleduji');
      }
    });
  return channel;
}

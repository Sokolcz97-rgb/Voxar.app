import { supabase } from './supabase.js';

const approvedCache = new Map(); // guild_id -> { approved: bool, ts }
const TTL = 60_000;

export async function isGuildApproved(guildId) {
  if (!guildId) return false;
  const cached = approvedCache.get(guildId);
  if (cached && Date.now() - cached.ts < TTL) return cached.approved;
  const { data } = await supabase
    .from('bot_guilds')
    .select('status')
    .eq('guild_id', guildId)
    .maybeSingle();
  const approved = data?.status === 'approved';
  approvedCache.set(guildId, { approved, ts: Date.now() });
  return approved;
}

export function invalidateGuildCache(guildId) {
  approvedCache.delete(guildId);
}

export async function registerGuild(guild) {
  try {
    const owner = await guild.fetchOwner().catch(() => null);
    const payload = {
      guild_id: guild.id,
      name: guild.name,
      icon_url: guild.iconURL?.() ?? null,
      owner_discord_id: owner?.id ?? null,
      member_count: guild.memberCount ?? null,
      source: 'auto',
    };
    // Insert if missing; if exists keep status, just refresh metadata
    const { data: existing } = await supabase
      .from('bot_guilds')
      .select('id, status')
      .eq('guild_id', guild.id)
      .maybeSingle();

    if (!existing) {
      await supabase.from('bot_guilds').insert(payload);
      console.log(`📥 Registered new guild as pending: ${guild.name} (${guild.id})`);
    } else {
      await supabase
        .from('bot_guilds')
        .update({
          name: payload.name,
          icon_url: payload.icon_url,
          owner_discord_id: payload.owner_discord_id,
          member_count: payload.member_count,
        })
        .eq('id', existing.id);
    }
    invalidateGuildCache(guild.id);
  } catch (e) {
    console.error('registerGuild error', e);
  }
}

export async function syncAllGuilds(client) {
  for (const guild of client.guilds.cache.values()) {
    await registerGuild(guild);
  }
}

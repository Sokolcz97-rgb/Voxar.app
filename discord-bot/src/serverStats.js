import { ChannelType, PermissionsBitField } from 'discord.js';
import { supabase } from './supabase.js';
import { isGuildApproved } from './guilds.js';

const INTERVAL_MS = 10 * 60 * 1000; // Discord rate-limits channel renames to ~2/10min
const KIND_DEFAULTS = {
  members: { template: '👥 Členové: {value}' },
  online: { template: '🟢 Online: {value}' },
  web_status: { template: '🌐 Web: {value}' },
  bot_status: { template: '🤖 Bot: {value}' },
  boosts: { template: '🚀 Boosty: {value}' },
};

async function fetchWebStatus() {
  try {
    const { data } = await supabase.from('bot_config').select('web_maintenance').maybeSingle();
    return data?.web_maintenance ? 'DOWN' : 'UP';
  } catch { return 'UP'; }
}

async function valueFor(kind, guild) {
  switch (kind) {
    case 'members': {
      try {
        const members = await guild.members.fetch().catch(() => null);
        if (!members) return String(guild.memberCount ?? '?');
        const humans = members.filter((m) => !m.user.bot).size;
        return String(humans);
      } catch { return String(guild.memberCount ?? '?'); }
    }
    case 'online': {
      try {
        const members = await guild.members.fetch({ withPresences: true }).catch(() => null);
        if (!members) return '?';
        let online = 0;
        members.forEach((m) => {
          if (m.user.bot) return;
          const s = m.presence?.status;
          if (s && s !== 'offline') online += 1;
        });
        return String(online);
      } catch { return '?'; }
    }
    case 'web_status':
      return await fetchWebStatus();
    case 'bot_status':
      return 'UP';
    case 'boosts':
      return String(guild.premiumSubscriptionCount ?? 0);
    default:
      return '?';
  }
}

function renderName(slot, value) {
  const tpl = slot.template || KIND_DEFAULTS[slot.kind]?.template || '{value}';
  let out = tpl.replace(/\{value\}/g, value);
  if (out.length > 100) out = out.slice(0, 100);
  return out;
}

function botHasPerms(guild) {
  const me = guild.members.me;
  if (!me) return false;
  return me.permissions.has(PermissionsBitField.Flags.ManageChannels);
}

async function ensureCategory(guild, cfg) {
  if (cfg.category_id) {
    const ch = guild.channels.cache.get(cfg.category_id)
      || await guild.channels.fetch(cfg.category_id).catch(() => null);
    if (ch && ch.type === ChannelType.GuildCategory) return ch;
  }
  console.log(`[serverStats] creating category in ${guild.name}`);
  const created = await guild.channels.create({
    name: cfg.category_name || '📊 Statistiky',
    type: ChannelType.GuildCategory,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.Connect] },
    ],
  }).catch((e) => { console.error('[serverStats] create category failed:', e?.message || e); return null; });
  if (created) {
    try { await created.setPosition(0).catch(() => {}); } catch {}
    cfg.category_id = created.id;
    await supabase.from('bot_server_stats').update({ category_id: created.id }).eq('guild_id', guild.id);
  }
  return created;
}

async function ensureChannel(guild, category, slot, name) {
  if (slot.channel_id) {
    const ch = guild.channels.cache.get(slot.channel_id)
      || await guild.channels.fetch(slot.channel_id).catch(() => null);
    if (ch) {
      if (ch.name !== name) {
        await ch.setName(name).catch((e) => console.error('[serverStats] rename failed:', e?.message || e));
      }
      return ch;
    }
  }
  console.log(`[serverStats] creating channel "${name}" in ${guild.name}`);
  const created = await guild.channels.create({
    name,
    type: ChannelType.GuildVoice,
    parent: category?.id,
    permissionOverwrites: [
      { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.Connect] },
    ],
  }).catch((e) => { console.error('[serverStats] create channel failed:', e?.message || e); return null; });
  if (created) slot.channel_id = created.id;
  return created;
}

async function updateGuildStats(guild) {
  try {
    const { data: cfg, error } = await supabase
      .from('bot_server_stats')
      .select('*')
      .eq('guild_id', guild.id)
      .maybeSingle();
    if (error) { console.error('[serverStats] load cfg error:', error.message); return; }
    if (!cfg || !cfg.enabled) return;
    if (!botHasPerms(guild)) {
      console.warn(`[serverStats] missing Manage Channels permission in ${guild.name} (${guild.id})`);
      return;
    }
    const slots = Array.isArray(cfg.slots) ? cfg.slots.slice(0, 4) : [];
    const active = slots.filter((s) => s && s.kind && s.kind !== 'none');
    if (active.length === 0) return;

    const category = await ensureCategory(guild, cfg);
    if (!category) return;
    let dirty = false;
    for (const slot of active) {
      const value = await valueFor(slot.kind, guild);
      const name = renderName(slot, value);
      const before = slot.channel_id;
      await ensureChannel(guild, category, slot, name);
      if (slot.channel_id !== before) dirty = true;
    }
    if (dirty) {
      await supabase.from('bot_server_stats').update({ slots: cfg.slots }).eq('guild_id', guild.id);
    }
  } catch (e) {
    console.error('[serverStats] updateGuildStats:', e?.message || e);
  }
}

export async function runServerStats(client) {
  for (const guild of client.guilds.cache.values()) {
    if (!(await isGuildApproved(guild.id))) continue;
    await updateGuildStats(guild);
  }
}

async function updateOneGuild(client, guildId) {
  const guild = client.guilds.cache.get(guildId);
  if (!guild) return;
  if (!(await isGuildApproved(guildId))) return;
  await updateGuildStats(guild);
}

export function startServerStats(client) {
  // Initial run quickly, then every 10 minutes
  setTimeout(() => runServerStats(client).catch((e) => console.error('[serverStats] initial:', e)), 5_000);
  setInterval(() => runServerStats(client).catch((e) => console.error('[serverStats] tick:', e)), INTERVAL_MS);

  // Realtime: when dashboard saves a config, run immediately for that guild
  try {
    supabase
      .channel('bot_server_stats_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bot_server_stats' }, (payload) => {
        const row = payload.new || payload.old;
        const guildId = row?.guild_id;
        if (!guildId) return;
        console.log('[serverStats] realtime change for', guildId);
        setTimeout(() => updateOneGuild(client, guildId).catch((e) => console.error('[serverStats] realtime run:', e)), 1500);
      })
      .subscribe((status) => console.log('[serverStats] realtime status:', status));
  } catch (e) {
    console.error('[serverStats] realtime subscribe failed:', e?.message || e);
  }
}

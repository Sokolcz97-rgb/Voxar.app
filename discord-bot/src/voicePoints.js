// Voice-activity points system.
// - Tracks time spent by members in voice channels.
// - Converts minutes → points (configurable per guild).
// - Announces milestones into a configurable "goal" channel.
// - Provides /body slash command (view, top, admin add/remove/set/reset, config).
//
// Storage:
//   public.bot_points_config  — per-guild settings
//   public.bot_points         — per-user totals
//   public.bot_voice_sessions — active sessions (checkpointed)
//   public.bot_points_log     — manual adjustments audit
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { supabase } from './supabase.js';
import { isGuildApproved } from './guilds.js';

const CFG_TTL = 30_000;
const cfgCache = new Map(); // guild_id -> { data, ts }

async function getPointsConfig(guildId) {
  const cached = cfgCache.get(guildId);
  if (cached && Date.now() - cached.ts < CFG_TTL) return cached.data;
  let { data } = await supabase
    .from('bot_points_config')
    .select('*')
    .eq('guild_id', guildId)
    .maybeSingle();
  if (!data) {
    const ins = await supabase
      .from('bot_points_config')
      .insert({ guild_id: guildId })
      .select()
      .maybeSingle();
    data = ins.data;
  }
  cfgCache.set(guildId, { data, ts: Date.now() });
  return data;
}

export function invalidatePointsConfig(guildId) {
  if (guildId) cfgCache.delete(guildId);
  else cfgCache.clear();
}

// ---- Eligibility ----
function isEligible(state, cfg, guild) {
  if (!state.channelId) return false;
  if (cfg.ignored_channel_ids?.includes(state.channelId)) return false;
  if (cfg.ignore_afk && guild?.afkChannelId && state.channelId === guild.afkChannelId) return false;
  if (cfg.ignore_muted && (state.selfMute || state.serverMute)) return false;
  if (cfg.ignore_deafened && (state.selfDeaf || state.serverDeaf)) return false;
  return true;
}

function countHumansInChannel(guild, channelId) {
  const ch = guild.channels.cache.get(channelId);
  if (!ch) return 0;
  return ch.members.filter((m) => !m.user.bot).size;
}

// ---- Session lifecycle ----
async function startSession(guildId, userId, channelId) {
  await supabase
    .from('bot_voice_sessions')
    .upsert(
      { guild_id: guildId, user_id: userId, channel_id: channelId, joined_at: new Date().toISOString() },
      { onConflict: 'guild_id,user_id' },
    );
}

async function finalizeSession(guild, userId, { restart = false, restartChannelId = null } = {}) {
  const guildId = guild.id;
  const { data: session } = await supabase
    .from('bot_voice_sessions')
    .select('*')
    .eq('guild_id', guildId)
    .eq('user_id', userId)
    .maybeSingle();
  if (!session) {
    if (restart && restartChannelId) await startSession(guildId, userId, restartChannelId);
    return;
  }

  const cfg = await getPointsConfig(guildId);
  const mpp = Math.max(1, cfg?.minutes_per_point ?? 10);

  const ms = Date.now() - new Date(session.joined_at).getTime();
  const minutes = Math.max(0, Math.floor(ms / 60_000));

  // Delete first so we can't double-count on race.
  await supabase
    .from('bot_voice_sessions')
    .delete()
    .eq('guild_id', guildId)
    .eq('user_id', userId);

  if (minutes > 0 && cfg?.enabled !== false) {
    // Bonus multiplier via roles
    let multiplier = 1;
    try {
      if (cfg.bonus_role_ids?.length && Number(cfg.bonus_multiplier) > 1) {
        const member = await guild.members.fetch(userId).catch(() => null);
        if (member && cfg.bonus_role_ids.some((r) => member.roles.cache.has(r))) {
          multiplier = Number(cfg.bonus_multiplier);
        }
      }
    } catch {}

    // Read prior totals
    const { data: prev } = await supabase
      .from('bot_points')
      .select('*')
      .eq('guild_id', guildId)
      .eq('user_id', userId)
      .maybeSingle();

    const prevMinutes = prev?.total_minutes ?? 0;
    const prevPoints = prev?.points ?? 0;
    const prevLastMs = prev?.last_milestone ?? 0;

    const newMinutes = prevMinutes + minutes;
    // Points are derived from cumulative minutes so partials aren't lost.
    const basePoints = Math.floor(newMinutes / mpp) - Math.floor(prevMinutes / mpp);
    const gained = Math.round(basePoints * multiplier);
    const newPoints = prevPoints + gained;

    // Milestone detection
    const crossed = [];
    const milestones = (cfg.milestones || []).filter((m) => Number(m) > 0).sort((a, b) => a - b);
    for (const m of milestones) {
      if (m > prevLastMs && m <= newPoints) crossed.push(m);
    }
    if (Number(cfg.repeat_every) > 0) {
      const step = Number(cfg.repeat_every);
      const from = Math.floor(prevLastMs / step) + 1;
      const to = Math.floor(newPoints / step);
      for (let k = from; k <= to; k++) {
        const v = k * step;
        if (!crossed.includes(v)) crossed.push(v);
      }
    }
    const lastMs = crossed.length ? Math.max(prevLastMs, ...crossed) : prevLastMs;

    await supabase
      .from('bot_points')
      .upsert({
        guild_id: guildId,
        user_id: userId,
        points: newPoints,
        total_minutes: newMinutes,
        last_milestone: lastMs,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'guild_id,user_id' });

    if (crossed.length && cfg.goal_channel_id) {
      const ch = guild.channels.cache.get(cfg.goal_channel_id)
        || await guild.channels.fetch(cfg.goal_channel_id).catch(() => null);
      if (ch?.isTextBased?.()) {
        const template = cfg.announce_message
          || '🎉 {user} právě dosáhl **{points} bodů**! Skvělá práce v hlasovém kanálu.';
        for (const m of crossed) {
          const text = template
            .replaceAll('{user}', `<@${userId}>`)
            .replaceAll('{points}', String(m))
            .replaceAll('{total}', String(newPoints))
            .replaceAll('{minutes}', String(newMinutes));
          await ch.send(text).catch(() => {});
        }
      }
    }
  }

  if (restart && restartChannelId) {
    await startSession(guildId, userId, restartChannelId);
  }
}

// ---- Public event handler ----
export async function handleVoiceStateUpdate(oldState, newState) {
  try {
    const guild = newState.guild || oldState.guild;
    if (!guild) return;
    if (!(await isGuildApproved(guild.id))) return;
    const userId = newState.id || oldState.id;
    const member = newState.member || oldState.member;
    if (!member || member.user?.bot) return;

    const cfg = await getPointsConfig(guild.id);
    if (!cfg || cfg.enabled === false) return;

    const wasEligible = isEligible(oldState, cfg, guild);
    const isNowEligible = isEligible(newState, cfg, guild);
    const changedChannel = oldState.channelId !== newState.channelId;

    // Enforce minimum humans in channel at *start* (not at finalize — keep it simple).
    let canStart = isNowEligible;
    if (canStart && (cfg.min_members ?? 1) > 1) {
      if (countHumansInChannel(guild, newState.channelId) < cfg.min_members) canStart = false;
    }

    if (wasEligible && (!isNowEligible || changedChannel)) {
      await finalizeSession(guild, userId, {
        restart: canStart,
        restartChannelId: canStart ? newState.channelId : null,
      });
    } else if (!wasEligible && canStart) {
      await startSession(guild.id, userId, newState.channelId);
    }
  } catch (e) {
    console.error('handleVoiceStateUpdate', e?.message || e);
  }
}

// ---- Startup: seed sessions for members currently in voice ----
export async function initVoicePoints(client) {
  try {
    for (const guild of client.guilds.cache.values()) {
      if (!(await isGuildApproved(guild.id))) continue;
      const cfg = await getPointsConfig(guild.id);
      if (!cfg || cfg.enabled === false) continue;

      // Clear stale sessions from previous bot lifecycle
      await supabase.from('bot_voice_sessions').delete().eq('guild_id', guild.id);

      for (const state of guild.voiceStates.cache.values()) {
        const member = state.member;
        if (!member || member.user.bot) continue;
        if (!isEligible(state, cfg, guild)) continue;
        if ((cfg.min_members ?? 1) > 1 && countHumansInChannel(guild, state.channelId) < cfg.min_members) continue;
        await startSession(guild.id, state.id, state.channelId);
      }
    }
    console.log('🎙️ Voice points tracker initialised');
  } catch (e) {
    console.error('initVoicePoints', e?.message || e);
  }

  // Periodic checkpoint every 5 min so long sessions get points & milestones fire.
  setInterval(async () => {
    try {
      for (const guild of client.guilds.cache.values()) {
        if (!(await isGuildApproved(guild.id))) continue;
        const cfg = await getPointsConfig(guild.id);
        if (!cfg || cfg.enabled === false) continue;
        for (const state of guild.voiceStates.cache.values()) {
          const member = state.member;
          if (!member || member.user.bot) continue;
          if (!isEligible(state, cfg, guild)) continue;
          await finalizeSession(guild, state.id, { restart: true, restartChannelId: state.channelId });
        }
      }
    } catch (e) {
      console.error('voice checkpoint', e?.message || e);
    }
  }, 5 * 60_000);
}

// ============= Slash commands =============
const MG = PermissionFlagsBits.ManageGuild.toString();

export const POINTS_DEFS = [
  new SlashCommandBuilder()
    .setName('body')
    .setDescription('Bodový systém za čas v hlasových kanálech')
    // View own or someone else's points
    .addSubcommand((s) =>
      s.setName('me').setDescription('Zobraz moje body'))
    .addSubcommand((s) =>
      s.setName('user').setDescription('Zobraz body jiného uživatele')
        .addUserOption((o) => o.setName('uživatel').setDescription('Koho').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('top').setDescription('Top 10 na tomto serveru'))
    .addSubcommand((s) =>
      s.setName('config').setDescription('Aktuální konfigurace bodového systému'))
    // Admin — Manage Server
    .addSubcommand((s) =>
      s.setName('add').setDescription('Přidat body uživateli (admin)')
        .addUserOption((o) => o.setName('uživatel').setDescription('Komu').setRequired(true))
        .addIntegerOption((o) => o.setName('počet').setDescription('Kolik bodů').setMinValue(1).setRequired(true))
        .addStringOption((o) => o.setName('důvod').setDescription('Důvod').setRequired(false)))
    .addSubcommand((s) =>
      s.setName('remove').setDescription('Odebrat body uživateli (admin)')
        .addUserOption((o) => o.setName('uživatel').setDescription('Komu').setRequired(true))
        .addIntegerOption((o) => o.setName('počet').setDescription('Kolik bodů').setMinValue(1).setRequired(true))
        .addStringOption((o) => o.setName('důvod').setDescription('Důvod').setRequired(false)))
    .addSubcommand((s) =>
      s.setName('set').setDescription('Nastavit body uživateli (admin)')
        .addUserOption((o) => o.setName('uživatel').setDescription('Komu').setRequired(true))
        .addIntegerOption((o) => o.setName('počet').setDescription('Nová hodnota').setMinValue(0).setRequired(true))
        .addStringOption((o) => o.setName('důvod').setDescription('Důvod').setRequired(false)))
    .addSubcommand((s) =>
      s.setName('reset').setDescription('Vymazat body uživateli (admin)')
        .addUserOption((o) => o.setName('uživatel').setDescription('Komu').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('toggle').setDescription('Zapnout / vypnout sledování (admin)')
        .addBooleanOption((o) => o.setName('zapnuto').setDescription('true/false').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('set-goal-channel').setDescription('Kam posílat oznámení o milnících (admin)')
        .addChannelOption((o) => o.setName('kanál').setDescription('Kanál').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) =>
      s.setName('set-minutes-per-point').setDescription('Kolik minut = 1 bod (admin)')
        .addIntegerOption((o) => o.setName('minut').setDescription('Např. 10').setMinValue(1).setMaxValue(240).setRequired(true))),
];

// ---- Formatting helpers ----
const fmtMinutes = (min) => {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${m} min`;
};

async function readPoints(guildId, userId) {
  const { data } = await supabase
    .from('bot_points').select('*')
    .eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
  return data || { points: 0, total_minutes: 0 };
}

async function adjust(guildId, userId, delta, reason, actor) {
  const { data: prev } = await supabase
    .from('bot_points').select('points').eq('guild_id', guildId).eq('user_id', userId).maybeSingle();
  const next = Math.max(0, (prev?.points ?? 0) + delta);
  await supabase.from('bot_points').upsert({
    guild_id: guildId,
    user_id: userId,
    points: next,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'guild_id,user_id' });
  await supabase.from('bot_points_log').insert({
    guild_id: guildId, user_id: userId, delta, reason: reason || null, actor_user_id: actor || null,
  });
  return next;
}

export async function handlePointsSlash(interaction) {
  if (!interaction.isChatInputCommand?.()) return false;
  if (interaction.commandName !== 'body') return false;
  const guildId = interaction.guild?.id;
  if (!guildId) {
    await interaction.reply({ content: 'Pouze na serveru.', ephemeral: true });
    return true;
  }

  const sub = interaction.options.getSubcommand();
  const adminSubs = new Set(['add', 'remove', 'set', 'reset', 'toggle', 'set-goal-channel', 'set-minutes-per-point']);
  if (adminSubs.has(sub) && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await interaction.reply({ content: '❌ Vyžaduje oprávnění Manage Server.', ephemeral: true });
    return true;
  }

  try {
    if (sub === 'me' || sub === 'user') {
      const user = sub === 'user' ? interaction.options.getUser('uživatel', true) : interaction.user;
      const p = await readPoints(guildId, user.id);
      const cfg = await getPointsConfig(guildId);
      const nextMs = (cfg?.milestones || []).filter((m) => m > (p.points ?? 0)).sort((a, b) => a - b)[0];
      const embed = new EmbedBuilder()
        .setTitle(`🏆 Body — ${user.username}`)
        .setThumbnail(user.displayAvatarURL({ size: 128 }))
        .setColor(0xf59e0b)
        .addFields(
          { name: 'Body', value: `**${p.points ?? 0}**`, inline: true },
          { name: 'Čas ve voice', value: fmtMinutes(p.total_minutes ?? 0), inline: true },
          { name: 'Poměr', value: `1 bod / ${cfg?.minutes_per_point ?? 10} min`, inline: true },
          ...(nextMs ? [{ name: 'Další milník', value: `${nextMs} bodů (${nextMs - (p.points ?? 0)} do cíle)`, inline: false }] : []),
        );
      await interaction.reply({ embeds: [embed], ephemeral: sub === 'me' });
      return true;
    }

    if (sub === 'top') {
      const { data } = await supabase
        .from('bot_points').select('user_id, points, total_minutes')
        .eq('guild_id', guildId).order('points', { ascending: false }).limit(10);
      if (!data?.length) {
        await interaction.reply({ content: 'Zatím tu nikdo nemá body.', ephemeral: true });
        return true;
      }
      const lines = data.map((r, i) => {
        const medal = ['🥇', '🥈', '🥉'][i] || `**${i + 1}.**`;
        return `${medal} <@${r.user_id}> — **${r.points}** bodů _(${fmtMinutes(r.total_minutes)})_`;
      });
      const embed = new EmbedBuilder()
        .setTitle('🏆 Top 10 – bodový systém')
        .setColor(0xf59e0b)
        .setDescription(lines.join('\n'));
      await interaction.reply({ embeds: [embed] });
      return true;
    }

    if (sub === 'config') {
      const cfg = await getPointsConfig(guildId);
      const embed = new EmbedBuilder().setTitle('⚙️ Bodový systém – konfigurace').setColor(0x5865f2).addFields(
        { name: 'Stav', value: cfg.enabled ? '✅ zapnuto' : '❌ vypnuto', inline: true },
        { name: 'Poměr', value: `1 bod / ${cfg.minutes_per_point} min`, inline: true },
        { name: 'Goal kanál', value: cfg.goal_channel_id ? `<#${cfg.goal_channel_id}>` : '—', inline: true },
        { name: 'Milníky', value: (cfg.milestones || []).join(', ') || '—', inline: true },
        { name: 'Opakovat každých', value: cfg.repeat_every ? `${cfg.repeat_every} bodů` : '—', inline: true },
        { name: 'Min. lidí v kanálu', value: String(cfg.min_members ?? 1), inline: true },
        { name: 'Ignore AFK / muted / deafened', value: `${cfg.ignore_afk ? '✅' : '❌'} / ${cfg.ignore_muted ? '✅' : '❌'} / ${cfg.ignore_deafened ? '✅' : '❌'}`, inline: false },
        { name: 'Bonus role × násobitel', value: cfg.bonus_role_ids?.length ? `${cfg.bonus_role_ids.map((r) => `<@&${r}>`).join(', ')} × ${cfg.bonus_multiplier}` : '—', inline: false },
      );
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return true;
    }

    // ---- Admin ops ----
    if (sub === 'add' || sub === 'remove' || sub === 'set') {
      const user = interaction.options.getUser('uživatel', true);
      const count = interaction.options.getInteger('počet', true);
      const reason = interaction.options.getString('důvod') || null;

      let delta = 0;
      let finalPts = 0;
      if (sub === 'add') { delta = count; finalPts = await adjust(guildId, user.id, delta, reason, null); }
      else if (sub === 'remove') { delta = -count; finalPts = await adjust(guildId, user.id, delta, reason, null); }
      else {
        const { data: prev } = await supabase.from('bot_points').select('points').eq('guild_id', guildId).eq('user_id', user.id).maybeSingle();
        delta = count - (prev?.points ?? 0);
        finalPts = await adjust(guildId, user.id, delta, reason, null);
      }
      await interaction.reply({
        content: `✅ ${user.tag}: **${finalPts}** bodů (${delta >= 0 ? '+' : ''}${delta})${reason ? ` — _${reason}_` : ''}`,
      });
      return true;
    }
    if (sub === 'reset') {
      const user = interaction.options.getUser('uživatel', true);
      await supabase.from('bot_points').delete().eq('guild_id', guildId).eq('user_id', user.id);
      await supabase.from('bot_points_log').insert({ guild_id: guildId, user_id: user.id, delta: 0, reason: 'reset' });
      await interaction.reply({ content: `✅ Body pro ${user.tag} vymazány.`, ephemeral: true });
      return true;
    }
    if (sub === 'toggle') {
      const enabled = interaction.options.getBoolean('zapnuto', true);
      await supabase.from('bot_points_config').upsert({ guild_id: guildId, enabled }, { onConflict: 'guild_id' });
      invalidatePointsConfig(guildId);
      await interaction.reply({ content: `✅ Sledování ${enabled ? 'zapnuto' : 'vypnuto'}.`, ephemeral: true });
      return true;
    }
    if (sub === 'set-goal-channel') {
      const ch = interaction.options.getChannel('kanál', true);
      await supabase.from('bot_points_config').upsert({ guild_id: guildId, goal_channel_id: ch.id }, { onConflict: 'guild_id' });
      invalidatePointsConfig(guildId);
      await interaction.reply({ content: `✅ Milníky se budou posílat do <#${ch.id}>.`, ephemeral: true });
      return true;
    }
    if (sub === 'set-minutes-per-point') {
      const mpp = interaction.options.getInteger('minut', true);
      await supabase.from('bot_points_config').upsert({ guild_id: guildId, minutes_per_point: mpp }, { onConflict: 'guild_id' });
      invalidatePointsConfig(guildId);
      await interaction.reply({ content: `✅ Nový poměr: 1 bod / ${mpp} min.`, ephemeral: true });
      return true;
    }
  } catch (e) {
    console.error('handlePointsSlash', e);
    if (!interaction.replied) await interaction.reply({ content: `❌ ${e.message}`, ephemeral: true });
    return true;
  }

  return false;
}

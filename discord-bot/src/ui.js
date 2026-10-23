import { EmbedBuilder } from 'discord.js';
import { supabase } from './supabase.js';

// Jednotný vzhled zpráv bota (barvy, patička, čas).
export const BRAND = {
  name: 'StudioVoxario',
  color: 0x22d3ee,     // tyrkysová jako web
  ok: 0x57f287,
  warn: 0xfee75c,
  danger: 0xed4245,
  info: 0x5865f2,
  muted: 0x2b2d31,
};

/** Embed ve stylu StudioVoxario: barevný proužek, patička se jménem serveru a čas. */
export function brandEmbed({ title, description, color = BRAND.color, guild, icon } = {}) {
  const e = new EmbedBuilder().setColor(color).setTimestamp();
  if (title) e.setTitle(icon ? `${icon}  ${title}` : title);
  if (description) e.setDescription(description);
  e.setFooter({ text: guild ? `${guild.name} · ${BRAND.name}` : BRAND.name, iconURL: guild?.iconURL?.() || undefined });
  return e;
}

/** Zapíše zásah do bot_moderation_events (přehled v dashboardu). Chyby neblokují. */
export async function logModeration(evt) {
  try {
    const { data } = await supabase.from('bot_moderation_events').insert({
      guild_id: evt.guildId,
      user_id: evt.userId,
      user_tag: evt.userTag ?? null,
      source: evt.source ?? 'antiscam',
      level: evt.level,
      score: evt.score != null ? Math.round(evt.score) : null,
      reasons: (evt.reasons || []).slice(0, 12),
      channel_id: evt.channelId ?? null,
      content: evt.content ? String(evt.content).slice(0, 1000) : null,
      moderator: evt.moderator ?? null,
    }).select('id').maybeSingle();
    return data?.id ?? null;
  } catch (e) {
    console.error('logModeration', e?.message || e);
    return null;
  }
}

/** Označí poslední nevyřešený zásah u uživatele jako vyřešený (tlačítka v hlášení). */
export async function resolveModeration(guildId, userId, resolution, moderator) {
  try {
    const { data } = await supabase.from('bot_moderation_events')
      .select('id').eq('guild_id', guildId).eq('user_id', userId).is('resolved_at', null)
      .order('created_at', { ascending: false }).limit(1).maybeSingle();
    if (data?.id) {
      await supabase.from('bot_moderation_events')
        .update({ resolution, moderator, resolved_at: new Date().toISOString() }).eq('id', data.id);
    }
  } catch (e) { console.error('resolveModeration', e?.message || e); }
}

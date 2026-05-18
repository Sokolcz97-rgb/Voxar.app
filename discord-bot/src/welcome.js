import { supabase } from './supabase.js';

export async function sendWelcome(member) {
  const guildId = member.guild.id;
  // Per-guild welcome rows + legacy global rows (guild_id IS NULL)
  const { data: rows } = await supabase
    .from('bot_welcome')
    .select('*')
    .eq('enabled', true)
    .or(`guild_id.eq.${guildId},guild_id.is.null`);
  if (!rows?.length) return;

  for (const row of rows) {
    try {
      const channel = await member.guild.channels.fetch(row.channel_id).catch(() => null);
      if (!channel?.isTextBased?.()) continue;

      const vars = {
        '{user}': `<@${member.id}>`,
        '{username}': member.user.username,
        '{server}': member.guild.name,
      };
      const apply = (s) =>
        typeof s === 'string'
          ? Object.entries(vars).reduce((acc, [k, v]) => acc.split(k).join(v), s)
          : s;

      if (row.message_type === 'embed') {
        const embed = JSON.parse(JSON.stringify(row.content), (_, v) =>
          typeof v === 'string' ? apply(v) : v
        );
        await channel.send({ embeds: [embed] });
      } else {
        await channel.send(apply(row.content?.text || `Vítej {user}!`));
      }
    } catch (e) {
      console.error('welcome error', e);
    }
  }
}

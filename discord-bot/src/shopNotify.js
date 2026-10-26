// Oznámení z obchodu do soukromých zpráv správcům (mobil zapípá přes aplikaci Discord).
// Úlohy vkládá databázový spouštěč na shop_purchases (payload.action = 'dm_users').
import { EmbedBuilder } from 'discord.js';
import { supabase } from './supabase.js';

const COLORS = { order: 0xf5b942, donation: 0xe0457b, paid: 0x3fbf6f, renewal: 0x4aa3df, refund: 0xe0672a };

export async function handleShopNotifyJob(client, job) {
  const p = job.payload || {};
  if (p.action !== 'dm_users') return false;
  const { data: claimed } = await supabase.from('bot_outbound_queue')
    .update({ sent_at: new Date().toISOString(), error: 'processing' })
    .eq('id', job.id).is('sent_at', null).select('id');
  if (!claimed?.length) return true;
  const failed = [];
  const embed = new EmbedBuilder()
    .setTitle(String(p.title || 'Obchod').slice(0, 250))
    .setColor(COLORS[p.kind] ?? 0xd2ae68)
    .setTimestamp(new Date(p.at || Date.now()));
  if (p.description) embed.setDescription(String(p.description).slice(0, 3900));
  for (const f of p.fields || []) {
    if (f?.name && f?.value) embed.addFields({ name: String(f.name).slice(0, 250), value: String(f.value).slice(0, 1000), inline: !!f.inline });
  }
  if (p.url) embed.setURL(p.url);
  for (const id of p.user_ids || []) {
    try {
      const user = await client.users.fetch(String(id));
      await user.send({ embeds: [embed] });
    } catch (e) {
      failed.push(`${id}: ${e?.message || e}`);
    }
  }
  await supabase.from('bot_outbound_queue')
    .update({ sent_at: new Date().toISOString(), error: failed.length ? failed.join('; ').slice(0, 900) : null })
    .eq('id', job.id);
  return true;
}

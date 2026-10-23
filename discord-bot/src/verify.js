// Ověření členů: role „Ověřen“ při vstupu (po přijetí pravidel serveru) + záložní tlačítko.
// Nastavení v bot_guild_config: verified_role_id, unverified_role_id, auto_verify.
import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { supabase } from './supabase.js';

export const VERIFY_BUTTON_ID = 'verify:me';
const cache = new Map();

async function verifyConfig(guildId) {
  const hit = cache.get(guildId);
  if (hit && Date.now() - hit.at < 60_000) return hit.cfg;
  const { data } = await supabase.from('bot_guild_config')
    .select('verified_role_id, unverified_role_id, auto_verify')
    .eq('guild_id', guildId).maybeSingle();
  const cfg = data?.verified_role_id ? data : null;
  cache.set(guildId, { at: Date.now(), cfg });
  return cfg;
}

/** Dá roli Ověřen a odebere Neověřen. Vrací true, když se něco změnilo. */
async function grantVerified(member, reason) {
  const cfg = await verifyConfig(member.guild.id);
  if (!cfg) return false;
  if (member.user.bot) return false;
  // podezřelé účty v karanténě anti-bot ochrany se neověřují
  if (member.isCommunicationDisabled?.()) return false;
  let changed = false;
  if (!member.roles.cache.has(cfg.verified_role_id)) {
    await member.roles.add(cfg.verified_role_id, reason);
    changed = true;
  }
  if (cfg.unverified_role_id && member.roles.cache.has(cfg.unverified_role_id)) {
    await member.roles.remove(cfg.unverified_role_id, reason).catch(() => {});
    changed = true;
  }
  if (changed) console.log(`[verify] ${member.guild.name}: ${member.user.tag} ověřen (${reason})`);
  return changed;
}

/** Nový člen: kdo už přijal pravidla (nebo server pravidla nemá), je ověřen hned; jinak dostane Neověřen. */
export async function onMemberJoin(member) {
  const cfg = await verifyConfig(member.guild.id);
  if (!cfg || member.user.bot) return;
  if (cfg.auto_verify && !member.pending) {
    // chvilka pro anti-bot kontrolu (karanténa = timeout)
    await new Promise((r) => setTimeout(r, 4000));
    const fresh = await member.guild.members.fetch(member.id).catch(() => null);
    if (fresh && (await grantVerified(fresh, 'Ověření při vstupu na server'))) return;
  }
  if (cfg.unverified_role_id && !member.roles.cache.has(cfg.verified_role_id)) {
    await member.roles.add(cfg.unverified_role_id, 'Nový člen – čeká na ověření').catch(() => {});
  }
}

/** Člen právě přijal pravidla serveru (pending → false). */
export async function onMemberUpdate(oldMember, newMember) {
  if (!(oldMember.pending && !newMember.pending)) return;
  const cfg = await verifyConfig(newMember.guild.id);
  if (!cfg?.auto_verify) return;
  await grantVerified(newMember, 'Přijetí pravidel serveru').catch((e) => console.error('verify update', e?.message || e));
}

/** Záložní tlačítko „Ověřit se“. */
export async function handleVerifyButton(interaction) {
  if (!interaction.isButton?.() || interaction.customId !== VERIFY_BUTTON_ID) return false;
  const cfg = await verifyConfig(interaction.guildId);
  if (!cfg) {
    await interaction.reply({ content: 'Ověření na tomto serveru není nastavené.', ephemeral: true });
    return true;
  }
  const member = await interaction.guild.members.fetch(interaction.user.id);
  if (member.isCommunicationDisabled?.()) {
    await interaction.reply({ content: '⏳ Tvůj účet je dočasně omezený ochranou serveru. Pokud jde o omyl, otevři ticket.', ephemeral: true });
    return true;
  }
  const changed = await grantVerified(member, 'Tlačítko Ověřit se').catch(() => false);
  await interaction.reply({
    content: changed ? '✅ Hotovo, jsi ověřený – vítej zpátky! Kanály se ti teď zobrazí.' : '✅ Už jsi ověřený.',
    ephemeral: true,
  });
  return true;
}

export async function postVerifyPanel(channel) {
  const embed = new EmbedBuilder()
    .setColor(0x22d3ee)
    .setTitle('✅ Ověření účtu')
    .setDescription([
      'Ověření běžně proběhne **samo při vstupu na server**, jakmile přijmeš pravidla.',
      '',
      'Pokud vidíš tento kanál, roli **Ověřen** nemáš – třeba ti ji někdo omylem odebral.',
      'Klikni na tlačítko níže a kanály serveru se ti znovu zobrazí.',
      '',
      'Nejde to? Napiš do **🆘┃podpora** nebo otevři ticket.',
    ].join('\n'))
    .setFooter({ text: 'StudioVoxario · ochrana serveru' });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(VERIFY_BUTTON_ID).setLabel('Ověřit se').setEmoji('✅').setStyle(ButtonStyle.Success),
  );
  return channel.send({ embeds: [embed], components: [row] });
}

/** Úklid: kdo má Ověřen i Neověřen → odebrat Neověřen. Volitelně ověřit všechny, kdo už pravidla přijali. */
export async function syncVerifiedRoles(guild, { verifyAccepted = false } = {}) {
  const cfg = await verifyConfig(guild.id);
  if (!cfg) return { error: 'ověření není nastavené' };
  const members = await guild.members.fetch();
  let cleaned = 0;
  let verified = 0;
  for (const m of members.values()) {
    if (m.user.bot) continue;
    const has = m.roles.cache.has(cfg.verified_role_id);
    if (has && cfg.unverified_role_id && m.roles.cache.has(cfg.unverified_role_id)) {
      await m.roles.remove(cfg.unverified_role_id, 'Úklid rolí – už je ověřený').catch(() => {});
      cleaned += 1;
    } else if (!has && verifyAccepted && !m.pending && !m.isCommunicationDisabled?.()) {
      if (await grantVerified(m, 'Úklid rolí – pravidla přijata').catch(() => false)) verified += 1;
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  return { members: members.size, cleaned, verified };
}

/** Úlohy z fronty: verify_panel { guild_id, channel_id }, verify_sync { guild_id, verify_accepted } */
export async function handleVerifyJob(client, job) {
  const p = job.payload || {};
  if (!['verify_panel', 'verify_sync'].includes(p.action)) return false;
  const { data: claimed } = await supabase.from('bot_outbound_queue')
    .update({ sent_at: new Date().toISOString(), error: 'processing' })
    .eq('id', job.id).is('sent_at', null).select('id');
  if (!claimed?.length) return true;
  const done = (patch) => supabase.from('bot_outbound_queue').update({ sent_at: new Date().toISOString(), ...patch }).eq('id', job.id);
  try {
    const guild = await client.guilds.fetch(p.guild_id);
    cache.delete(guild.id);
    if (p.action === 'verify_panel') {
      const channel = await guild.channels.fetch(p.channel_id);
      const msg = await postVerifyPanel(channel);
      await done({ error: null, payload: { ...p, result: { message_id: msg.id } } });
    } else {
      const result = await syncVerifiedRoles(guild, { verifyAccepted: !!p.verify_accepted });
      await done({ error: result.error ?? null, payload: { ...p, result } });
    }
  } catch (e) {
    await done({ error: String(e?.message || e) });
  }
  return true;
}

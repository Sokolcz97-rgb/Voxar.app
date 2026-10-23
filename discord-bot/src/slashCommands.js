import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import { brandEmbed, BRAND, logModeration } from './ui.js';
import { supabase } from './supabase.js';
import { getConfig } from './config.js';
import { translateText } from './translate.js';
import { ADMIN_DEFS, handleAdminSlashCommand, buildHelpEmbeds } from './adminSlashCommands.js';
import { POINTS_DEFS, handlePointsSlash } from './voicePoints.js';

// ---------------- Built-in slash commands ----------------

const BUILTIN_DEFS = [
  new SlashCommandBuilder().setName('ping').setDescription('Test latence bota'),
  new SlashCommandBuilder().setName('help').setDescription('Seznam dostupných příkazů'),
  new SlashCommandBuilder().setName('serverinfo').setDescription('Informace o tomto serveru'),
  new SlashCommandBuilder()
    .setName('userinfo')
    .setDescription('Informace o uživateli')
    .addUserOption((o) => o.setName('uživatel').setDescription('Koho zobrazit').setRequired(false)),
  new SlashCommandBuilder()
    .setName('avatar')
    .setDescription('Zobrazí avatar uživatele')
    .addUserOption((o) => o.setName('uživatel').setDescription('Koho zobrazit').setRequired(false)),
  new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Smaže N posledních zpráv (1–100)')
    .addIntegerOption((o) =>
      o.setName('počet').setDescription('1 až 100').setMinValue(1).setMaxValue(100).setRequired(true),
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages.toString()),
  new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Vyhodí uživatele ze serveru')
    .addUserOption((o) => o.setName('uživatel').setDescription('Koho vyhodit').setRequired(true))
    .addStringOption((o) => o.setName('důvod').setDescription('Důvod').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers.toString()),
  new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Zabanuje uživatele')
    .addUserOption((o) => o.setName('uživatel').setDescription('Koho zabanovat').setRequired(true))
    .addStringOption((o) => o.setName('důvod').setDescription('Důvod').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers.toString()),
  new SlashCommandBuilder()
    .setName('timeout')
    .setDescription('Dočasně ztlumí uživatele (nemůže psát ani mluvit)')
    .addUserOption((o) => o.setName('uživatel').setDescription('Koho ztlumit').setRequired(true))
    .addStringOption((o) => o.setName('doba').setDescription('Na jak dlouho').setRequired(true).addChoices(
      { name: '5 minut', value: '5' }, { name: '30 minut', value: '30' }, { name: '1 hodina', value: '60' },
      { name: '6 hodin', value: '360' }, { name: '1 den', value: '1440' }, { name: '1 týden', value: '10080' }, { name: 'Zrušit timeout', value: '0' }))
    .addStringOption((o) => o.setName('důvod').setDescription('Důvod').setRequired(false))
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers.toString()),
];

// Čekající potvrzení moderátorských akcí (id → data), platí 2 minuty
const pendingActions = new Map();

const CONTEXT_MENU_DEFS = [
  new ContextMenuCommandBuilder()
    .setName('Přeložit do češtiny')
    .setType(ApplicationCommandType.Message),
  new ContextMenuCommandBuilder()
    .setName('Translate to English')
    .setType(ApplicationCommandType.Message),
];

const BUILTIN_NAMES = new Set(BUILTIN_DEFS.map((c) => c.name));

// Sanitize custom command name → Discord slash naming rules (lowercase, 1-32, [a-z0-9_-])
function sanitizeName(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_')
    .slice(0, 32);
}

async function buildCustomDefsForGuild(guildId) {
  const { data } = await supabase
    .from('bot_commands')
    .select('name, description, guild_id')
    .eq('enabled', true)
    .or(`guild_id.eq.${guildId},guild_id.is.null`);
  const defs = [];
  const seen = new Set([...BUILTIN_NAMES]);
  for (const c of data || []) {
    const n = sanitizeName(c.name);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    defs.push(
      new SlashCommandBuilder()
        .setName(n)
        .setDescription((c.description || 'Vlastní příkaz').slice(0, 100))
        .addStringOption((o) =>
          o.setName('args').setDescription('Volitelné argumenty').setRequired(false),
        ),
    );
  }
  return defs;
}

// ---------------- Registration ----------------

export async function registerGuildSlashCommands(client, guildId) {
  try {
    const token = process.env.DISCORD_TOKEN;
    const appId = client.application?.id ?? client.user?.id;
    if (!token || !appId || !guildId) return;
    const custom = await buildCustomDefsForGuild(guildId);
    const body = [...BUILTIN_DEFS, ...ADMIN_DEFS, ...POINTS_DEFS, ...custom, ...CONTEXT_MENU_DEFS].map((c) => c.toJSON());
    const rest = new REST({ version: '10' }).setToken(token);
    await rest.put(Routes.applicationGuildCommands(appId, guildId), { body });
    console.log(`🔧 Slash commands zaregistrovány pro ${guildId} (${body.length})`);
  } catch (e) {
    console.error('registerGuildSlashCommands error', e?.message || e);
  }
}

// ---------------- Handler ----------------

function renderVars(value, interaction, argsStr) {
  const vars = {
    '{user}': `<@${interaction.user.id}>`,
    '{username}': interaction.user.username,
    '{server}': interaction.guild?.name ?? '',
    '{channel}': `<#${interaction.channelId}>`,
    '{args}': argsStr || '',
  };
  const replace = (s) =>
    typeof s === 'string'
      ? Object.entries(vars).reduce((acc, [k, v]) => acc.split(k).join(v), s)
      : s;
  if (typeof value === 'string') return replace(value);
  return JSON.parse(JSON.stringify(value), (_, v) => (typeof v === 'string' ? replace(v) : v));
}

export async function handleSlashCommand(interaction) {
  if (interaction.isMessageContextMenuCommand?.()) {
    return handleMessageContextMenu(interaction);
  }
  if (!interaction.isChatInputCommand()) return false;
  const name = interaction.commandName;
  const guildId = interaction.guild?.id ?? null;

  // Admin commands (config/automod/welcome/cmd/ticketpanel/status/stream/say) –
  // dostupné i v režimu údržby, aby šel bot ovládat bez dashboardu.
  const adminHandled = await handleAdminSlashCommand(interaction);
  if (adminHandled) return true;

  // /body – bodový systém (view + admin)
  const pointsHandled = await handlePointsSlash(interaction);
  if (pointsHandled) return true;

  // Maintenance kill-switch (po admin commandech, aby admin mohl údržbu vypnout)
  if (guildId) {
    const cfg = await getConfig(guildId);
    if (cfg.bot_maintenance && name !== 'help' && name !== 'ping') {
      await interaction.reply({ content: '🛠️ Bot je v režimu údržby.', ephemeral: true });
      return true;
    }
  }

  // Built-ins
  if (name === 'ping') {
    const up = Math.floor(process.uptime());
    const e = brandEmbed({ title: 'Pong!', icon: '🏓', guild: interaction.guild })
      .addFields(
        { name: 'Odezva', value: `${Math.round(interaction.client.ws.ping)} ms`, inline: true },
        { name: 'Běží', value: `${Math.floor(up / 3600)} h ${Math.floor((up % 3600) / 60)} min`, inline: true },
        { name: 'Serverů', value: String(interaction.client.guilds.cache.size), inline: true },
      );
    await interaction.reply({ embeds: [e], ephemeral: true });
    return true;
  }

  if (name === 'help') {
    const embeds = buildHelpEmbeds();
    const { data } = await supabase
      .from('bot_commands')
      .select('name, description, guild_id')
      .eq('enabled', true)
      .or(`guild_id.eq.${guildId},guild_id.is.null`)
      .order('name');
    if (data?.length) {
      const customLines = data.map((c) => `\`/${sanitizeName(c.name)}\`${c.description ? ` – ${c.description}` : ''}`).join('\n');
      embeds.push(
        new EmbedBuilder().setTitle('✨ Vlastní příkazy').setColor(0xf59e0b).setDescription(customLines.slice(0, 4000)),
      );
    }
    // jedna stránka + menu pro přepínání kategorií (vidí jen tazatel)
    helpPages.set(interaction.user.id, { embeds, t: Date.now() });
    const menu = new StringSelectMenuBuilder().setCustomId('help:page').setPlaceholder('Vyber kategorii příkazů')
      .addOptions(embeds.slice(0, 25).map((e, i) => ({ label: (e.data.title || `Strana ${i + 1}`).replace(/^\S+\s+/, '').slice(0, 100), value: String(i), default: i === 0 })));
    await interaction.reply({ embeds: [embeds[0]], components: [new ActionRowBuilder().addComponents(menu)], ephemeral: true });
    return true;
  }

  if (name === 'serverinfo') {
    const g = interaction.guild;
    if (!g) {
      await interaction.reply({ content: 'Pouze na serveru.', ephemeral: true });
      return true;
    }
    const embed = brandEmbed({ title: g.name, guild: g })
      .setThumbnail(g.iconURL() || null)
      .addFields(
        { name: 'Členů', value: String(g.memberCount ?? '?'), inline: true },
        { name: 'Kanálů', value: String(g.channels.cache.size), inline: true },
        { name: 'Rolí', value: String(g.roles.cache.size), inline: true },
        { name: 'Boosty', value: `${g.premiumSubscriptionCount ?? 0} (úroveň ${g.premiumTier ?? 0})`, inline: true },
        { name: 'Vytvořen', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'Majitel', value: `<@${g.ownerId}>`, inline: true },
      );
    await interaction.reply({ embeds: [embed] });
    return true;
  }

  if (name === 'userinfo') {
    const u = interaction.options.getUser('uživatel') || interaction.user;
    const m = interaction.guild?.members.cache.get(u.id);
    const embed = brandEmbed({ title: m?.displayName || u.globalName || u.username, guild: interaction.guild })
      .setDescription(`<@${u.id}>${m?.roles?.highest && m.roles.highest.id !== interaction.guild?.id ? ` · nejvyšší role <@&${m.roles.highest.id}>` : ''}`)
      .setThumbnail(u.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: u.id, inline: true },
        { name: 'Účet vytvořen', value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
        ...(m?.joinedTimestamp
          ? [{ name: 'Na serveru od', value: `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>`, inline: true }]
          : []),
      );
    await interaction.reply({ embeds: [embed] });
    return true;
  }

  if (name === 'avatar') {
    const u = interaction.options.getUser('uživatel') || interaction.user;
    await interaction.reply({ content: u.displayAvatarURL({ size: 1024 }) });
    return true;
  }

  if (name === 'purge') {
    if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
      await interaction.reply({ content: 'Nemáš oprávnění.', ephemeral: true });
      return true;
    }
    const n = interaction.options.getInteger('počet', true);
    try {
      const deleted = await interaction.channel.bulkDelete(n, true);
      await interaction.reply({ content: `🧹 Smazáno ${deleted.size} zpráv.`, ephemeral: true });
    } catch (e) {
      await interaction.reply({ content: `Chyba: ${e.message}`, ephemeral: true });
    }
    return true;
  }

  if (name === 'kick' || name === 'ban' || name === 'timeout') {
    const needed = name === 'kick' ? PermissionFlagsBits.KickMembers : name === 'ban' ? PermissionFlagsBits.BanMembers : PermissionFlagsBits.ModerateMembers;
    if (!interaction.memberPermissions?.has(needed)) {
      await interaction.reply({ content: 'Nemáš oprávnění.', ephemeral: true });
      return true;
    }
    const user = interaction.options.getUser('uživatel', true);
    const reason = interaction.options.getString('důvod') || 'Bez udání důvodu';
    const minutes = name === 'timeout' ? parseInt(interaction.options.getString('doba', true), 10) : 0;
    const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
    if (!member && name !== 'ban') {
      await interaction.reply({ content: 'Uživatel na serveru není.', ephemeral: true });
      return true;
    }
    if (member && (member.id === interaction.user.id || member.id === interaction.guild.ownerId)) {
      await interaction.reply({ content: 'Tohle udělat nejde.', ephemeral: true });
      return true;
    }
    // potvrzení (vidí jen moderátor)
    const id = `${interaction.id}`;
    pendingActions.set(id, { action: name, userId: user.id, userTag: user.tag, reason, minutes, mod: interaction.user.id, t: Date.now() });
    const what = name === 'ban' ? 'zabanovat' : name === 'kick' ? 'vyhodit' : minutes ? `ztlumit na ${fmtMinutes(minutes)}` : 'zrušit timeout';
    const e = brandEmbed({ title: 'Potvrď akci', icon: name === 'ban' ? '🔨' : name === 'kick' ? '👢' : '🔇', color: name === 'ban' ? BRAND.danger : BRAND.warn, guild: interaction.guild })
      .setDescription(`Opravdu **${what}** <@${user.id}>?`)
      .addFields({ name: 'Důvod', value: reason.slice(0, 1000) })
      .setThumbnail(user.displayAvatarURL({ size: 128 }));
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`mod:ok:${id}`).setLabel('Potvrdit').setStyle(name === 'ban' ? ButtonStyle.Danger : ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`mod:no:${id}`).setLabel('Zrušit').setStyle(ButtonStyle.Secondary),
    );
    await interaction.reply({ embeds: [e], components: [row], ephemeral: true });
    return true;
  }

  // Custom command from DB
  const { data: cmd } =
    (await supabase
      .from('bot_commands')
      .select('*')
      .eq('enabled', true)
      .eq('guild_id', guildId)
      .ilike('name', name)
      .maybeSingle()) ||
    (await supabase
      .from('bot_commands')
      .select('*')
      .eq('enabled', true)
      .is('guild_id', null)
      .ilike('name', name)
      .maybeSingle());

  if (!cmd) return false;

  const argsStr = interaction.options.getString('args') || '';
  try {
    if (cmd.response_type === 'embed') {
      const embed = renderVars(cmd.content, interaction, argsStr);
      await interaction.reply({ embeds: [embed] });
    } else {
      const text = renderVars(cmd.content?.text ?? '', interaction, argsStr);
      await interaction.reply({ content: text || '(prázdná odpověď)' });
    }
  } catch (e) {
    console.error('slash custom command error', e);
    if (!interaction.replied) await interaction.reply({ content: 'Chyba.', ephemeral: true });
  }
  return true;
}

// ---------------- Message context menu (Translate) ----------------

async function handleMessageContextMenu(interaction) {
  const name = interaction.commandName;
  let target = null;
  if (name === 'Přeložit do češtiny') target = 'cs';
  else if (name === 'Translate to English') target = 'en';
  if (!target) return false;

  const msg = interaction.targetMessage;
  const text = (msg?.content || '').trim();
  if (!text) {
    await interaction.reply({ content: 'Tato zpráva neobsahuje text k překladu.', ephemeral: true });
    return true;
  }

  await interaction.deferReply({ ephemeral: true });
  try {
    const translation = await translateText(text, target);
    if (!translation) {
      await interaction.editReply('Překlad se nepodařilo získat.');
      return true;
    }
    const header = target === 'cs' ? '🇨🇿 Překlad do češtiny' : '🇬🇧 Translation to English';
    const author = msg.author ? `**${msg.author.username}**: ` : '';
    const body = translation.length > 1800 ? translation.slice(0, 1797) + '…' : translation;
    await interaction.editReply(`${header}\n${author}${body}`);
  } catch (e) {
    await interaction.editReply(`Chyba překladu: ${e?.message || 'neznámá'}`);
  }
  return true;
}


// ---------------- Nápověda (menu) a potvrzení moderace ----------------

const helpPages = new Map(); // userId → { embeds, t }

function fmtMinutes(m) {
  if (m >= 1440) return `${Math.round(m / 1440)} d`;
  if (m >= 60) return `${Math.round(m / 60)} h`;
  return `${m} min`;
}

/** Komponenty vestavěných příkazů (menu nápovědy, potvrzení banu/kicku/timeoutu). */
export async function handleBuiltinComponent(interaction) {
  if (interaction.isStringSelectMenu?.() && interaction.customId === 'help:page') {
    const pages = helpPages.get(interaction.user.id);
    const i = parseInt(interaction.values?.[0] ?? '0', 10);
    if (!pages?.embeds?.[i]) { await interaction.update({ content: 'Nápověda vypršela – použij znovu /help.', embeds: [], components: [] }).catch(() => {}); return true; }
    const menu = StringSelectMenuBuilder.from(interaction.component);
    menu.setOptions(pages.embeds.slice(0, 25).map((e, k) => ({ label: (e.data.title || `Strana ${k + 1}`).replace(/^\S+\s+/, '').slice(0, 100), value: String(k), default: k === i })));
    await interaction.update({ embeds: [pages.embeds[i]], components: [new ActionRowBuilder().addComponents(menu)] }).catch(() => {});
    return true;
  }
  if (!interaction.isButton?.() || !interaction.customId?.startsWith('mod:')) return false;
  const [, choice, id] = interaction.customId.split(':');
  const p = pendingActions.get(id);
  pendingActions.delete(id);
  if (!p || Date.now() - p.t > 120000 || p.mod !== interaction.user.id) {
    await interaction.update({ content: 'Potvrzení vypršelo.', embeds: [], components: [] }).catch(() => {});
    return true;
  }
  if (choice === 'no') {
    await interaction.update({ content: 'Zrušeno.', embeds: [], components: [] }).catch(() => {});
    return true;
  }
  const g = interaction.guild;
  let done = '';
  try {
    const member = await g.members.fetch(p.userId).catch(() => null);
    const why = `${p.reason} – ${interaction.user.tag}`.slice(0, 500);
    if (p.action === 'ban') { await g.members.ban(p.userId, { reason: why, deleteMessageSeconds: 3600 }); done = '🔨 Zabanován'; }
    else if (p.action === 'kick') { await member.kick(why); done = '👢 Vyhozen'; }
    else if (p.minutes) { await member.timeout(p.minutes * 60000, why); done = `🔇 Ztlumen na ${fmtMinutes(p.minutes)}`; }
    else { await member.timeout(null, why); done = '🔊 Timeout zrušen'; }
  } catch (e) {
    await interaction.update({ content: `Akce se nepovedla: ${e?.message || e}`, embeds: [], components: [] }).catch(() => {});
    return true;
  }
  logModeration({ guildId: g.id, userId: p.userId, userTag: p.userTag, source: 'manual', level: p.action === 'timeout' ? 'timeout' : p.action, reasons: [p.reason], moderator: interaction.user.tag, channelId: interaction.channelId });
  await interaction.update({ content: `${done}: <@${p.userId}> – ${p.reason}`, embeds: [], components: [] }).catch(() => {});
  // veřejný záznam do log kanálu
  try {
    const cfg = await getConfig(g.id);
    const chId = cfg.default_log_channel || cfg.default_alerts_channel;
    const ch = chId ? await g.channels.fetch(chId).catch(() => null) : null;
    if (ch?.isTextBased?.()) {
      await ch.send({ embeds: [brandEmbed({ title: 'Moderace', icon: '🛡️', color: p.action === 'ban' ? BRAND.danger : BRAND.warn, guild: g })
        .setDescription(`${done}: <@${p.userId}> (\`${p.userTag}\`)`)
        .addFields({ name: 'Moderátor', value: `<@${interaction.user.id}>`, inline: true }, { name: 'Důvod', value: p.reason.slice(0, 1000) })] }).catch(() => {});
    }
  } catch { /* ignore */ }
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of pendingActions) if (now - v.t > 120000) pendingActions.delete(k);
  for (const [k, v] of helpPages) if (now - v.t > 600000) helpPages.delete(k);
}, 60000).unref?.();

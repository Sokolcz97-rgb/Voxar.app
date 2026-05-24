import {
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ContextMenuCommandBuilder,
  ApplicationCommandType,
} from 'discord.js';
import { supabase } from './supabase.js';
import { getConfig } from './config.js';
import { translateText } from './translate.js';

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
    const body = [...BUILTIN_DEFS, ...custom].map((c) => c.toJSON());
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
  if (!interaction.isChatInputCommand()) return false;
  const name = interaction.commandName;
  const guildId = interaction.guild?.id ?? null;

  // Maintenance kill-switch
  if (guildId) {
    const cfg = await getConfig(guildId);
    if (cfg.bot_maintenance) {
      await interaction.reply({ content: '🛠️ Bot je v režimu údržby.', ephemeral: true });
      return true;
    }
  }

  // Built-ins
  if (name === 'ping') {
    await interaction.reply({ content: `🏓 Pong! ${Math.round(interaction.client.ws.ping)}ms` });
    return true;
  }

  if (name === 'help') {
    const { data } = await supabase
      .from('bot_commands')
      .select('name, description, guild_id')
      .eq('enabled', true)
      .or(`guild_id.eq.${guildId},guild_id.is.null`)
      .order('name');
    const lines = [
      '**Vestavěné příkazy**',
      '`/ping` `/help` `/serverinfo` `/userinfo` `/avatar` `/purge` `/kick` `/ban`',
    ];
    if (data?.length) {
      lines.push('', '**Vlastní příkazy**');
      for (const c of data) {
        lines.push(`\`/${sanitizeName(c.name)}\`${c.description ? ` – ${c.description}` : ''}`);
      }
    }
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
    return true;
  }

  if (name === 'serverinfo') {
    const g = interaction.guild;
    if (!g) {
      await interaction.reply({ content: 'Pouze na serveru.', ephemeral: true });
      return true;
    }
    const embed = new EmbedBuilder()
      .setTitle(g.name)
      .setThumbnail(g.iconURL() || null)
      .addFields(
        { name: 'Členů', value: String(g.memberCount ?? '?'), inline: true },
        { name: 'Vytvořen', value: `<t:${Math.floor(g.createdTimestamp / 1000)}:D>`, inline: true },
        { name: 'ID', value: g.id, inline: true },
      )
      .setColor(0x5865f2);
    await interaction.reply({ embeds: [embed] });
    return true;
  }

  if (name === 'userinfo') {
    const u = interaction.options.getUser('uživatel') || interaction.user;
    const m = interaction.guild?.members.cache.get(u.id);
    const embed = new EmbedBuilder()
      .setTitle(u.tag)
      .setThumbnail(u.displayAvatarURL({ size: 256 }))
      .addFields(
        { name: 'ID', value: u.id, inline: true },
        { name: 'Účet vytvořen', value: `<t:${Math.floor(u.createdTimestamp / 1000)}:R>`, inline: true },
        ...(m?.joinedTimestamp
          ? [{ name: 'Na serveru od', value: `<t:${Math.floor(m.joinedTimestamp / 1000)}:R>`, inline: true }]
          : []),
      )
      .setColor(0x5865f2);
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

  if (name === 'kick' || name === 'ban') {
    const needed = name === 'kick' ? PermissionFlagsBits.KickMembers : PermissionFlagsBits.BanMembers;
    if (!interaction.memberPermissions?.has(needed)) {
      await interaction.reply({ content: 'Nemáš oprávnění.', ephemeral: true });
      return true;
    }
    const user = interaction.options.getUser('uživatel', true);
    const reason = interaction.options.getString('důvod') || 'Bez důvodu';
    const member = await interaction.guild?.members.fetch(user.id).catch(() => null);
    if (!member) {
      await interaction.reply({ content: 'Uživatel nenalezen.', ephemeral: true });
      return true;
    }
    try {
      if (name === 'kick') await member.kick(reason);
      else await member.ban({ reason });
      await interaction.reply({
        content: `✅ ${name === 'kick' ? 'Vyhozen' : 'Zabanován'} ${user.tag} – ${reason}`,
      });
    } catch (e) {
      await interaction.reply({ content: `Chyba: ${e.message}`, ephemeral: true });
    }
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

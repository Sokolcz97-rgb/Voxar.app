// Admin slash commands – umožňují spravovat bota přímo z Discordu,
// i kdyby webový dashboard byl mimo provoz.
// Všechny vyžadují oprávnění Manage Guild.
import {
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
} from 'discord.js';
import { supabase } from './supabase.js';
import { invalidateConfig } from './config.js';
import { setupTicketPanel } from './tickets.js';

const MG = PermissionFlagsBits.ManageGuild.toString();

// ---------------- Builders ----------------

export const ADMIN_DEFS = [
  // /config
  new SlashCommandBuilder()
    .setName('config')
    .setDescription('Zobrazit / upravit konfiguraci bota pro tento server')
    .setDefaultMemberPermissions(MG)
    .addSubcommand((s) => s.setName('show').setDescription('Zobrazí aktuální konfiguraci'))
    .addSubcommand((s) =>
      s.setName('set-prefix').setDescription('Nastaví prefix pro textové příkazy')
        .addStringOption((o) => o.setName('prefix').setDescription('Nový prefix (např. !)').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('set-welcome-channel').setDescription('Kanál pro uvítací zprávy')
        .addChannelOption((o) => o.setName('kanál').setDescription('Kanál').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) =>
      s.setName('set-log-channel').setDescription('Kanál pro logy moderace')
        .addChannelOption((o) => o.setName('kanál').setDescription('Kanál').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) =>
      s.setName('set-alerts-channel').setDescription('Kanál pro alerty (anti-scam, status)')
        .addChannelOption((o) => o.setName('kanál').setDescription('Kanál').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) =>
      s.setName('maintenance').setDescription('Zapnout/vypnout režim údržby bota')
        .addBooleanOption((o) => o.setName('zapnuto').setDescription('true = údržba').setRequired(true))),

  // /automod
  new SlashCommandBuilder()
    .setName('automod')
    .setDescription('Automatická moderace zpráv')
    .setDefaultMemberPermissions(MG)
    .addSubcommand((s) => s.setName('status').setDescription('Zobrazí stav automod'))
    .addSubcommand((s) =>
      s.setName('toggle').setDescription('Zapne/vypne automod')
        .addBooleanOption((o) => o.setName('zapnuto').setDescription('true/false').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('action').setDescription('Akce při porušení')
        .addStringOption((o) => o.setName('akce').setDescription('warn|delete|mute|kick|ban').setRequired(true)
          .addChoices({ name: 'warn', value: 'warn' }, { name: 'delete', value: 'delete' }, { name: 'mute', value: 'mute' }, { name: 'kick', value: 'kick' }, { name: 'ban', value: 'ban' })))
    .addSubcommand((s) =>
      s.setName('add-word').setDescription('Přidá zakázané slovo')
        .addStringOption((o) => o.setName('slovo').setDescription('Slovo / fráze').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('remove-word').setDescription('Odebere zakázané slovo')
        .addStringOption((o) => o.setName('slovo').setDescription('Slovo / fráze').setRequired(true)))
    .addSubcommand((s) => s.setName('list-words').setDescription('Vypíše zakázaná slova'))
    .addSubcommand((s) =>
      s.setName('max-mentions').setDescription('Max počet @mentions ve zprávě')
        .addIntegerOption((o) => o.setName('počet').setDescription('0 = vypnuto').setMinValue(0).setMaxValue(50).setRequired(true)))
    .addSubcommand((s) =>
      s.setName('max-emojis').setDescription('Max počet emoji ve zprávě')
        .addIntegerOption((o) => o.setName('počet').setDescription('0 = vypnuto').setMinValue(0).setMaxValue(100).setRequired(true)))
    .addSubcommand((s) =>
      s.setName('spam-threshold').setDescription('Práh pro spam (zpráv za 10s)')
        .addIntegerOption((o) => o.setName('počet').setDescription('0 = vypnuto').setMinValue(0).setMaxValue(50).setRequired(true)))
    .addSubcommand((s) =>
      s.setName('nsfw').setDescription('Ochrana proti NSFW obrázkům')
        .addBooleanOption((o) => o.setName('zapnuto').setDescription('true/false').setRequired(true))),

  // /welcome
  new SlashCommandBuilder()
    .setName('welcome')
    .setDescription('Uvítací zprávy pro nové členy')
    .setDefaultMemberPermissions(MG)
    .addSubcommand((s) => s.setName('show').setDescription('Zobrazí aktuální nastavení'))
    .addSubcommand((s) =>
      s.setName('set').setDescription('Nastaví uvítací zprávu')
        .addChannelOption((o) => o.setName('kanál').setDescription('Kam posílat').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption((o) => o.setName('zpráva').setDescription('Text. Použij {user}, {server}').setRequired(true)))
    .addSubcommand((s) => s.setName('disable').setDescription('Vypne uvítací zprávy'))
    .addSubcommand((s) => s.setName('test').setDescription('Pošle testovací uvítací zprávu')),

  // /cmd – vlastní příkazy
  new SlashCommandBuilder()
    .setName('cmd')
    .setDescription('Spravovat vlastní příkazy')
    .setDefaultMemberPermissions(MG)
    .addSubcommand((s) =>
      s.setName('add').setDescription('Přidá / přepíše vlastní příkaz')
        .addStringOption((o) => o.setName('název').setDescription('Bez lomítka').setRequired(true))
        .addStringOption((o) => o.setName('odpověď').setDescription('Text odpovědi').setRequired(true))
        .addStringOption((o) => o.setName('popis').setDescription('Krátký popis').setRequired(false)))
    .addSubcommand((s) =>
      s.setName('remove').setDescription('Smaže vlastní příkaz')
        .addStringOption((o) => o.setName('název').setDescription('Bez lomítka').setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('Seznam vlastních příkazů'))
    .addSubcommand((s) =>
      s.setName('toggle').setDescription('Zapne/vypne vlastní příkaz')
        .addStringOption((o) => o.setName('název').setDescription('Bez lomítka').setRequired(true))
        .addBooleanOption((o) => o.setName('zapnuto').setDescription('true/false').setRequired(true))),

  // /ticketpanel
  new SlashCommandBuilder()
    .setName('ticketpanel')
    .setDescription('Spravovat ticket panel')
    .setDefaultMemberPermissions(MG)
    .addSubcommand((s) =>
      s.setName('set-channel').setDescription('Kam umístit ticket panel')
        .addChannelOption((o) => o.setName('kanál').setDescription('Kanál').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName('resend').setDescription('Pošle ticket panel znovu'))
    .addSubcommand((s) =>
      s.setName('set-mode').setDescription('Režim panelu')
        .addStringOption((o) => o.setName('režim').setDescription('button|categories|markdown').setRequired(true)
          .addChoices({ name: 'button', value: 'button' }, { name: 'categories', value: 'categories' }, { name: 'markdown', value: 'markdown' })))
    .addSubcommand((s) =>
      s.setName('set-support-role').setDescription('Role podpory pro tickety')
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))),

  // /status – status checks (uptime ping)
  new SlashCommandBuilder()
    .setName('status')
    .setDescription('Sledování dostupnosti webů / služeb')
    .setDefaultMemberPermissions(MG)
    .addSubcommand((s) =>
      s.setName('add').setDescription('Přidá nový status check')
        .addStringOption((o) => o.setName('název').setDescription('Popisek').setRequired(true))
        .addStringOption((o) => o.setName('url').setDescription('Cíl (URL)').setRequired(true))
        .addChannelOption((o) => o.setName('kanál').setDescription('Kam posílat alerty').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('Seznam status checků'))
    .addSubcommand((s) =>
      s.setName('remove').setDescription('Smaže status check podle názvu')
        .addStringOption((o) => o.setName('název').setDescription('Popisek').setRequired(true)))
    .addSubcommand((s) =>
      s.setName('toggle').setDescription('Zapne/vypne status check')
        .addStringOption((o) => o.setName('název').setDescription('Popisek').setRequired(true))
        .addBooleanOption((o) => o.setName('zapnuto').setDescription('true/false').setRequired(true))),

  // /stream – stream notifications
  new SlashCommandBuilder()
    .setName('stream')
    .setDescription('Notifikace o živých streamech')
    .setDefaultMemberPermissions(MG)
    .addSubcommand((s) =>
      s.setName('add').setDescription('Přidá streamera')
        .addStringOption((o) => o.setName('platforma').setDescription('twitch|youtube|kick').setRequired(true)
          .addChoices({ name: 'twitch', value: 'twitch' }, { name: 'youtube', value: 'youtube' }, { name: 'kick', value: 'kick' }))
        .addStringOption((o) => o.setName('handle').setDescription('Jméno kanálu').setRequired(true))
        .addChannelOption((o) => o.setName('kanál').setDescription('Kam posílat notifikaci').addChannelTypes(ChannelType.GuildText).setRequired(true)))
    .addSubcommand((s) => s.setName('list').setDescription('Seznam streamerů'))
    .addSubcommand((s) =>
      s.setName('remove').setDescription('Smaže streamera')
        .addStringOption((o) => o.setName('handle').setDescription('Jméno kanálu').setRequired(true))),

  // /say – broadcast přes bota
  new SlashCommandBuilder()
    .setName('say')
    .setDescription('Pošle zprávu botem do kanálu')
    .setDefaultMemberPermissions(MG)
    .addChannelOption((o) => o.setName('kanál').setDescription('Kam').addChannelTypes(ChannelType.GuildText).setRequired(true))
    .addStringOption((o) => o.setName('text').setDescription('Obsah zprávy').setRequired(true)),
];

// ---------------- Helpers ----------------

async function upsertGuildConfig(guildId, patch) {
  invalidateConfig(guildId);
  const { data: existing } = await supabase
    .from('bot_guild_config').select('id').eq('guild_id', guildId).maybeSingle();
  if (existing) {
    await supabase.from('bot_guild_config').update({ ...patch, updated_at: new Date().toISOString() }).eq('guild_id', guildId);
  } else {
    await supabase.from('bot_guild_config').insert({ guild_id: guildId, ...patch });
  }
}

async function loadGuildConfig(guildId) {
  const { data } = await supabase.from('bot_guild_config').select('*').eq('guild_id', guildId).maybeSingle();
  if (data) return data;
  const { data: g } = await supabase.from('bot_config').select('*').limit(1).maybeSingle();
  return g || {};
}

const ok = (interaction, text) => interaction.reply({ content: `✅ ${text}`, ephemeral: true });
const err = (interaction, text) => interaction.reply({ content: `❌ ${text}`, ephemeral: true });

// ---------------- Handler ----------------

export async function handleAdminSlashCommand(interaction) {
  if (!interaction.isChatInputCommand?.()) return false;
  const name = interaction.commandName;
  if (!['config', 'automod', 'welcome', 'cmd', 'ticketpanel', 'status', 'stream', 'say'].includes(name)) return false;

  const guildId = interaction.guild?.id;
  if (!guildId) {
    await err(interaction, 'Pouze na serveru.');
    return true;
  }
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
    await err(interaction, 'Vyžaduje oprávnění Manage Server.');
    return true;
  }

  try {
    if (name === 'config') return await handleConfig(interaction, guildId);
    if (name === 'automod') return await handleAutomod(interaction, guildId);
    if (name === 'welcome') return await handleWelcome(interaction, guildId);
    if (name === 'cmd') return await handleCmd(interaction, guildId);
    if (name === 'ticketpanel') return await handleTicketPanel(interaction, guildId);
    if (name === 'status') return await handleStatus(interaction, guildId);
    if (name === 'stream') return await handleStream(interaction, guildId);
    if (name === 'say') return await handleSay(interaction, guildId);
  } catch (e) {
    console.error('admin slash error', e);
    if (!interaction.replied) await err(interaction, e?.message || 'Chyba');
  }
  return true;
}

// ----- /config -----
async function handleConfig(interaction, guildId) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'show') {
    const cfg = await loadGuildConfig(guildId);
    const e = new EmbedBuilder().setTitle('Konfigurace bota').setColor(0x5865f2).addFields(
      { name: 'Prefix', value: `\`${cfg.prefix || '!'}\``, inline: true },
      { name: 'Údržba', value: cfg.bot_maintenance ? '🛠️ ZAPNUTO' : '✅ vypnuto', inline: true },
      { name: 'Automod', value: cfg.automod_enabled ? `✅ (${cfg.automod_action || 'warn'})` : '❌', inline: true },
      { name: 'Welcome kanál', value: cfg.default_welcome_channel ? `<#${cfg.default_welcome_channel}>` : '—', inline: true },
      { name: 'Log kanál', value: cfg.default_log_channel ? `<#${cfg.default_log_channel}>` : '—', inline: true },
      { name: 'Alerts kanál', value: cfg.default_alerts_channel ? `<#${cfg.default_alerts_channel}>` : '—', inline: true },
      { name: 'NSFW ochrana', value: cfg.nsfw_protection ? '✅' : '❌', inline: true },
      { name: 'Max mentions', value: String(cfg.automod_max_mentions ?? 0), inline: true },
      { name: 'Max emojis', value: String(cfg.automod_max_emojis ?? 0), inline: true },
    );
    return interaction.reply({ embeds: [e], ephemeral: true });
  }
  const map = {
    'set-prefix': ['prefix', (i) => ({ prefix: i.options.getString('prefix', true).slice(0, 5) })],
    'set-welcome-channel': ['welcome kanál', (i) => ({ default_welcome_channel: i.options.getChannel('kanál', true).id })],
    'set-log-channel': ['log kanál', (i) => ({ default_log_channel: i.options.getChannel('kanál', true).id })],
    'set-alerts-channel': ['alerts kanál', (i) => ({ default_alerts_channel: i.options.getChannel('kanál', true).id })],
    'maintenance': ['údržba', (i) => ({ bot_maintenance: i.options.getBoolean('zapnuto', true) })],
  };
  const entry = map[sub];
  if (!entry) return err(interaction, 'Neznámý subcommand.');
  await upsertGuildConfig(guildId, entry[1](interaction));
  return ok(interaction, `Nastaveno (${entry[0]}).`);
}

// ----- /automod -----
async function handleAutomod(interaction, guildId) {
  const sub = interaction.options.getSubcommand();
  const cfg = await loadGuildConfig(guildId);

  if (sub === 'status') {
    const words = cfg.automod_blocked_words || [];
    const e = new EmbedBuilder().setTitle('Automod').setColor(cfg.automod_enabled ? 0x22c55e : 0x6b7280).addFields(
      { name: 'Stav', value: cfg.automod_enabled ? '✅ aktivní' : '❌ vypnuto', inline: true },
      { name: 'Akce', value: cfg.automod_action || 'warn', inline: true },
      { name: 'Max mentions', value: String(cfg.automod_max_mentions ?? 0), inline: true },
      { name: 'Max emojis', value: String(cfg.automod_max_emojis ?? 0), inline: true },
      { name: 'Spam práh', value: String(cfg.automod_spam_threshold ?? 0), inline: true },
      { name: 'NSFW ochrana', value: cfg.nsfw_protection ? '✅' : '❌', inline: true },
      { name: `Zakázaná slova (${words.length})`, value: words.length ? words.slice(0, 30).map((w) => `\`${w}\``).join(', ') : '—' },
    );
    return interaction.reply({ embeds: [e], ephemeral: true });
  }

  if (sub === 'toggle') {
    await upsertGuildConfig(guildId, { automod_enabled: interaction.options.getBoolean('zapnuto', true) });
    return ok(interaction, 'Automod aktualizován.');
  }
  if (sub === 'action') {
    await upsertGuildConfig(guildId, { automod_action: interaction.options.getString('akce', true) });
    return ok(interaction, 'Akce nastavena.');
  }
  if (sub === 'max-mentions') {
    await upsertGuildConfig(guildId, { automod_max_mentions: interaction.options.getInteger('počet', true) });
    return ok(interaction, 'Limit @mentions nastaven.');
  }
  if (sub === 'max-emojis') {
    await upsertGuildConfig(guildId, { automod_max_emojis: interaction.options.getInteger('počet', true) });
    return ok(interaction, 'Limit emoji nastaven.');
  }
  if (sub === 'spam-threshold') {
    await upsertGuildConfig(guildId, { automod_spam_threshold: interaction.options.getInteger('počet', true) });
    return ok(interaction, 'Spam práh nastaven.');
  }
  if (sub === 'nsfw') {
    await upsertGuildConfig(guildId, { nsfw_protection: interaction.options.getBoolean('zapnuto', true) });
    return ok(interaction, 'NSFW ochrana aktualizována.');
  }
  if (sub === 'add-word' || sub === 'remove-word') {
    const word = interaction.options.getString('slovo', true).toLowerCase().trim();
    const list = new Set((cfg.automod_blocked_words || []).map((w) => String(w).toLowerCase()));
    if (sub === 'add-word') list.add(word); else list.delete(word);
    await upsertGuildConfig(guildId, { automod_blocked_words: [...list] });
    return ok(interaction, sub === 'add-word' ? `Přidáno \`${word}\`.` : `Odebráno \`${word}\`.`);
  }
  if (sub === 'list-words') {
    const words = cfg.automod_blocked_words || [];
    return interaction.reply({
      content: words.length ? `**Zakázaná slova (${words.length}):**\n${words.map((w) => `• \`${w}\``).join('\n').slice(0, 1900)}` : 'Žádná slova.',
      ephemeral: true,
    });
  }
  return err(interaction, 'Neznámý subcommand.');
}

// ----- /welcome -----
async function handleWelcome(interaction, guildId) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'show') {
    const { data } = await supabase.from('bot_welcome').select('*').eq('guild_id', guildId).maybeSingle();
    if (!data) return interaction.reply({ content: 'Welcome není nastaven.', ephemeral: true });
    const text = data.content?.text || '—';
    return interaction.reply({
      content: `**Welcome** – ${data.enabled ? '✅' : '❌'}\nKanál: <#${data.channel_id}>\nText:\n>>> ${text}`.slice(0, 1900),
      ephemeral: true,
    });
  }
  if (sub === 'set') {
    const channel = interaction.options.getChannel('kanál', true);
    const text = interaction.options.getString('zpráva', true);
    const { data: existing } = await supabase.from('bot_welcome').select('id').eq('guild_id', guildId).maybeSingle();
    const payload = {
      guild_id: guildId,
      channel_id: channel.id,
      message_type: 'text',
      content: { text },
      enabled: true,
      updated_at: new Date().toISOString(),
    };
    if (existing) await supabase.from('bot_welcome').update(payload).eq('id', existing.id);
    else await supabase.from('bot_welcome').insert(payload);
    return ok(interaction, `Welcome nastaven do <#${channel.id}>.`);
  }
  if (sub === 'disable') {
    await supabase.from('bot_welcome').update({ enabled: false }).eq('guild_id', guildId);
    return ok(interaction, 'Welcome vypnut.');
  }
  if (sub === 'test') {
    const { sendWelcome } = await import('./welcome.js');
    const member = interaction.guild.members.cache.get(interaction.user.id) || await interaction.guild.members.fetch(interaction.user.id);
    await sendWelcome(member);
    return ok(interaction, 'Testovací welcome odeslán.');
  }
  return err(interaction, 'Neznámý subcommand.');
}

// ----- /cmd -----
async function handleCmd(interaction, guildId) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') {
    const name = interaction.options.getString('název', true).toLowerCase().replace(/[^a-z0-9_-]/g, '_').slice(0, 32);
    const text = interaction.options.getString('odpověď', true);
    const description = interaction.options.getString('popis') || null;
    const { data: existing } = await supabase.from('bot_commands').select('id').eq('guild_id', guildId).eq('name', name).maybeSingle();
    const payload = { guild_id: guildId, name, description, response_type: 'text', content: { text }, enabled: true, updated_at: new Date().toISOString() };
    if (existing) await supabase.from('bot_commands').update(payload).eq('id', existing.id);
    else await supabase.from('bot_commands').insert(payload);
    return ok(interaction, `Příkaz \`/${name}\` uložen (registrace slash commandu může trvat pár sekund).`);
  }
  if (sub === 'remove') {
    const name = interaction.options.getString('název', true).toLowerCase();
    await supabase.from('bot_commands').delete().eq('guild_id', guildId).eq('name', name);
    return ok(interaction, `Příkaz \`${name}\` smazán.`);
  }
  if (sub === 'toggle') {
    const name = interaction.options.getString('název', true).toLowerCase();
    const enabled = interaction.options.getBoolean('zapnuto', true);
    await supabase.from('bot_commands').update({ enabled }).eq('guild_id', guildId).eq('name', name);
    return ok(interaction, `Příkaz \`${name}\` ${enabled ? 'zapnut' : 'vypnut'}.`);
  }
  if (sub === 'list') {
    const { data } = await supabase.from('bot_commands').select('name, description, enabled').eq('guild_id', guildId).order('name');
    if (!data?.length) return interaction.reply({ content: 'Žádné vlastní příkazy.', ephemeral: true });
    const body = data.map((c) => `${c.enabled ? '✅' : '❌'} \`/${c.name}\`${c.description ? ` – ${c.description}` : ''}`).join('\n');
    return interaction.reply({ content: body.slice(0, 1900), ephemeral: true });
  }
  return err(interaction, 'Neznámý subcommand.');
}

// ----- /ticketpanel -----
async function handleTicketPanel(interaction, guildId) {
  const sub = interaction.options.getSubcommand();
  const { data: existing } = await supabase.from('bot_tickets_config').select('id').eq('guild_id', guildId).maybeSingle();
  const upsert = async (patch) => {
    const payload = { guild_id: guildId, ...patch, updated_at: new Date().toISOString() };
    if (existing) await supabase.from('bot_tickets_config').update(payload).eq('id', existing.id);
    else await supabase.from('bot_tickets_config').insert(payload);
  };
  if (sub === 'set-channel') {
    const ch = interaction.options.getChannel('kanál', true);
    await upsert({ panel_channel_id: ch.id });
    await setupTicketPanel(interaction.client, guildId).catch(() => {});
    return ok(interaction, `Ticket panel umístěn do <#${ch.id}>.`);
  }
  if (sub === 'resend') {
    await setupTicketPanel(interaction.client, guildId).catch(() => {});
    return ok(interaction, 'Ticket panel přeposlán.');
  }
  if (sub === 'set-mode') {
    await upsert({ panel_mode: interaction.options.getString('režim', true) });
    await setupTicketPanel(interaction.client, guildId).catch(() => {});
    return ok(interaction, 'Režim panelu uložen.');
  }
  if (sub === 'set-support-role') {
    await upsert({ support_role_id: interaction.options.getRole('role', true).id });
    return ok(interaction, 'Support role nastavena.');
  }
  return err(interaction, 'Neznámý subcommand.');
}

// ----- /status -----
async function handleStatus(interaction, guildId) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') {
    const label = interaction.options.getString('název', true);
    const target = interaction.options.getString('url', true);
    const channel = interaction.options.getChannel('kanál', true);
    await supabase.from('bot_status_checks').insert({
      guild_id: guildId, label, target_type: 'http', target, discord_channel_id: channel.id, enabled: true,
    });
    return ok(interaction, `Status check **${label}** přidán.`);
  }
  if (sub === 'list') {
    const { data } = await supabase.from('bot_status_checks').select('label, target, enabled, last_status').eq('guild_id', guildId);
    if (!data?.length) return interaction.reply({ content: 'Žádné status checks.', ephemeral: true });
    return interaction.reply({
      content: data.map((c) => `${c.enabled ? '✅' : '❌'} **${c.label}** – ${c.target} (${c.last_status || '?'})`).join('\n').slice(0, 1900),
      ephemeral: true,
    });
  }
  if (sub === 'remove') {
    await supabase.from('bot_status_checks').delete().eq('guild_id', guildId).eq('label', interaction.options.getString('název', true));
    return ok(interaction, 'Smazáno.');
  }
  if (sub === 'toggle') {
    await supabase.from('bot_status_checks').update({ enabled: interaction.options.getBoolean('zapnuto', true) })
      .eq('guild_id', guildId).eq('label', interaction.options.getString('název', true));
    return ok(interaction, 'Stav aktualizován.');
  }
  return err(interaction, 'Neznámý subcommand.');
}

// ----- /stream -----
async function handleStream(interaction, guildId) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') {
    const platform = interaction.options.getString('platforma', true);
    const handle = interaction.options.getString('handle', true);
    const channel = interaction.options.getChannel('kanál', true);
    await supabase.from('bot_stream_notifications').insert({
      guild_id: guildId, platform, handle, discord_channel_id: channel.id, enabled: true,
    });
    return ok(interaction, `Streamer **${handle}** (${platform}) přidán.`);
  }
  if (sub === 'list') {
    const { data } = await supabase.from('bot_stream_notifications').select('platform, handle, enabled, discord_channel_id').eq('guild_id', guildId);
    if (!data?.length) return interaction.reply({ content: 'Žádní streameři.', ephemeral: true });
    return interaction.reply({
      content: data.map((s) => `${s.enabled ? '✅' : '❌'} **${s.handle}** [${s.platform}] → <#${s.discord_channel_id}>`).join('\n').slice(0, 1900),
      ephemeral: true,
    });
  }
  if (sub === 'remove') {
    await supabase.from('bot_stream_notifications').delete().eq('guild_id', guildId).eq('handle', interaction.options.getString('handle', true));
    return ok(interaction, 'Smazáno.');
  }
  return err(interaction, 'Neznámý subcommand.');
}

// ----- /say -----
async function handleSay(interaction, guildId) {
  const ch = interaction.options.getChannel('kanál', true);
  const text = interaction.options.getString('text', true);
  try {
    const target = await interaction.client.channels.fetch(ch.id);
    await target.send(text);
    return ok(interaction, `Posláno do <#${ch.id}>.`);
  } catch (e) {
    return err(interaction, `Chyba: ${e.message}`);
  }
}

// ---------------- Help text ----------------

export function buildHelpEmbeds() {
  const general = new EmbedBuilder()
    .setTitle('📖 Nápověda – obecné příkazy')
    .setColor(0x5865f2)
    .setDescription('Příkazy dostupné všem členům.')
    .addFields(
      { name: '/ping', value: 'Test latence bota.' },
      { name: '/help', value: 'Zobrazí tuto nápovědu.' },
      { name: '/serverinfo', value: 'Informace o serveru.' },
      { name: '/userinfo [uživatel]', value: 'Informace o uživateli.' },
      { name: '/avatar [uživatel]', value: 'Zobrazí avatar.' },
      { name: 'Kontext zprávy → „Přeložit do češtiny / Translate to English"', value: 'Překlad zprávy přes pravé tlačítko.' },
      { name: 'Vlajková reakce 🇨🇿 🇬🇧 🇺🇸 🇸🇰', value: 'Přeloží zprávu do daného jazyka (do vlákna).' },
    );

  const mod = new EmbedBuilder()
    .setTitle('🛡️ Moderace')
    .setColor(0xef4444)
    .addFields(
      { name: '/purge <počet>', value: 'Smaže N posledních zpráv (1–100). *Manage Messages*' },
      { name: '/kick <uživatel> [důvod]', value: 'Vyhodí uživatele. *Kick Members*' },
      { name: '/ban <uživatel> [důvod]', value: 'Zabanuje uživatele. *Ban Members*' },
    );

  const admin = new EmbedBuilder()
    .setTitle('⚙️ Správa bota (Manage Server)')
    .setColor(0x22c55e)
    .setDescription('Vše lze nastavit i bez webového dashboardu.')
    .addFields(
      { name: '/config show|set-prefix|set-welcome-channel|set-log-channel|set-alerts-channel|maintenance', value: 'Hlavní konfigurace serveru.' },
      { name: '/automod status|toggle|action|add-word|remove-word|list-words|max-mentions|max-emojis|spam-threshold|nsfw', value: 'Auto-moderace zpráv.' },
      { name: '/welcome show|set|disable|test', value: 'Uvítací zprávy pro nové členy.' },
      { name: '/cmd add|remove|toggle|list', value: 'Vlastní slash příkazy.' },
      { name: '/ticketpanel set-channel|resend|set-mode|set-support-role', value: 'Ticket systém.' },
      { name: '/status add|list|remove|toggle', value: 'Sledování dostupnosti URL / služeb.' },
      { name: '/stream add|list|remove', value: 'Notifikace o živých streamech (Twitch/YouTube/Kick).' },
      { name: '/say <kanál> <text>', value: 'Pošle zprávu botem do kanálu.' },
    );

  const auto = new EmbedBuilder()
    .setTitle('🤖 Automatické funkce')
    .setColor(0xa855f7)
    .setDescription('Běží na pozadí podle nastavení.')
    .addFields(
      { name: 'Anti-scam / anti-phishing', value: 'Detekce podvodných odkazů a screenů → ban + alert.' },
      { name: 'Anti-bot', value: 'Ban podezřelých čerstvých účtů při vstupu.' },
      { name: 'Welcome zprávy', value: 'Automatické přivítání nových členů.' },
      { name: 'Ticket systém', value: 'Panel s tlačítkem / kategoriemi pro otevření ticketu.' },
      { name: 'Server stats', value: 'Aktualizace statistik (členové, online) v názvech kanálů.' },
      { name: 'Twitch / YouTube chat', value: 'Mostování chatu ze streamů do Discordu.' },
      { name: 'Status checks', value: 'Pravidelný ping URL → alert při výpadku.' },
    );

  return [general, mod, admin, auto];
}

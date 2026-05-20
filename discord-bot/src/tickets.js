import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { supabase } from './supabase.js';

const TICKET_BTN_ID = 'ticket_open';
const TICKET_CLOSE_ID = 'ticket_close';
const TICKET_CATEGORY_SELECT_ID = 'ticket_category_select';

export function buildTicketPanelMessage(cfg = {}, categories = []) {
  const mode = cfg.panel_mode || 'button';
  const content = cfg.welcome_md || (mode === 'button' ? 'Klikni níže pro otevření ticketu.' : 'Pro otevření ticketu napiš zprávu.');

  if ((mode === 'categories' || mode === 'markdown') && categories.length > 0) {
    return {
      content,
      components: [{
        type: 1,
        components: [{
          type: 3,
          custom_id: TICKET_CATEGORY_SELECT_ID,
          placeholder: 'Vyber typ ticketu',
          min_values: 1,
          max_values: 1,
          options: categories.slice(0, 25).map((category) => ({
            label: category.label.slice(0, 100),
            value: category.id,
            description: category.description?.slice(0, 100) || undefined,
            emoji: category.emoji ? { name: category.emoji } : undefined,
          })),
        }],
      }],
    };
  }

  return {
    content,
    components: [{
      type: 1,
      components: [{ type: 2, style: 1, custom_id: TICKET_BTN_ID, label: 'Otevřít ticket', emoji: { name: '🎫' } }],
    }],
  };
}

async function loadCfg(guildId = null) {
  if (guildId) {
    const r = await supabase.from('bot_tickets_config').select('*').eq('guild_id', guildId).maybeSingle();
    if (r.data) return r.data;
  }
  const r = await supabase.from('bot_tickets_config').select('*').is('guild_id', null).limit(1).maybeSingle();
  return r.data;
}

async function loadTicketCategories(guildId = null) {
  if (!guildId) return [];
  const { data, error } = await supabase
    .from('bot_ticket_categories')
    .select('*')
    .eq('guild_id', guildId)
    .eq('enabled', true)
    .order('position', { ascending: true })
    .order('label', { ascending: true });
  if (error) {
    console.error('loadTicketCategories', error);
    return [];
  }
  return data || [];
}

export async function setupTicketPanel(client, guildId = null, options = {}) {
  const cfg = await loadCfg(guildId);
  const categories = await loadTicketCategories(guildId);
  const panelChannelId = options.channelId || cfg?.panel_channel_id;
  if (!panelChannelId) return { ok: false, error: 'no panel_channel_id' };

  try {
    const channel = await client.channels.fetch(panelChannelId).catch(() => null);
    if (!channel?.isTextBased?.()) return { ok: false, error: 'channel not found' };

    // Refresh panel: delete old bot messages and post a fresh one
    const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (messages) {
      for (const m of messages.values()) {
        if (m.author.id === client.user.id) await m.delete().catch(() => {});
      }
    }

    await channel.send(options.message || buildTicketPanelMessage(cfg, categories));
    return { ok: true, channelId: panelChannelId, mode: cfg.panel_mode || 'button' };
  } catch (e) {
    console.error('setupTicketPanel', e);
    return { ok: false, error: String(e) };
  }
}

export async function handleInteraction(interaction) {
  if (interaction.isStringSelectMenu?.() && interaction.customId === TICKET_CATEGORY_SELECT_ID) {
    await openTicket(interaction, interaction.values?.[0] || null);
    return true;
  }

  if (!interaction.isButton()) return false;

  if (interaction.customId === TICKET_BTN_ID) {
    await openTicket(interaction);
    return true;
  }
  if (interaction.customId === TICKET_CLOSE_ID) {
    await closeTicket(interaction);
    return true;
  }
  return false;
}

async function openTicket(interaction, ticketCategoryId = null) {
  const cfg = await loadCfg(interaction.guild?.id);
  const ticketCategory = ticketCategoryId
    ? (await loadTicketCategories(interaction.guild?.id)).find((category) => category.id === ticketCategoryId)
    : null;

  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Nelze otevřít ticket zde.', ephemeral: true });

  const prefix = ticketCategory?.label ? `${ticketCategory.label}-` : 'ticket-';
  const name = `${prefix}${interaction.user.username}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);

  // Determine parent category: explicit cfg.category_id, else fall back to
  // the panel channel's parent (so ticket lands in the same category as the panel).
  let parentId = ticketCategory?.discord_category_id || cfg?.category_id || undefined;
  if (!parentId && cfg?.panel_channel_id) {
    const panel = await guild.channels.fetch(cfg.panel_channel_id).catch(() => null);
    if (panel?.parentId) parentId = panel.parentId;
  }

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
    {
      id: interaction.client.user.id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ManageChannels,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    },
  ];

  if (cfg?.support_role_id) {
    overwrites.push({
      id: cfg.support_role_id,
      allow: [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.ReadMessageHistory,
      ],
    });
  }

  try {
    const channel = await guild.channels.create({
      name,
      type: ChannelType.GuildText,
      parent: parentId,
      permissionOverwrites: overwrites,
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_CLOSE_ID)
        .setLabel('Uzavřít')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒'),
    );

    await channel.send({
      content: `${ticketCategory ? `**${ticketCategory.label}**\n${ticketCategory.description || ''}\n\n` : ''}${cfg?.welcome_md || 'Ahoj! Popiš svůj problém.'}\n\n${interaction.user}, díky.`,
      components: [closeRow],
    });

    await interaction.reply({
      content: `🎫 Ticket vytvořen: <#${channel.id}>`,
      ephemeral: true,
    });
  } catch (e) {
    console.error('openTicket', e);
    await interaction.reply({ content: 'Nepodařilo se vytvořit ticket.', ephemeral: true });
  }
}

async function closeTicket(interaction) {
  const cfg = await loadCfg(interaction.guild?.id);

  await interaction.reply({ content: 'Zavírám ticket za 5 s…' });

  if (cfg?.transcripts_enabled) {
    try {
      const msgs = await interaction.channel.messages.fetch({ limit: 100 });
      const lines = [...msgs.values()]
        .reverse()
        .map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`)
        .join('\n');
      await interaction.channel.send({
        files: [{ attachment: Buffer.from(lines, 'utf8'), name: 'transcript.txt' }],
      });
    } catch (e) {
      console.error('transcript', e);
    }
  }

  setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
}

/**
 * Sleduje změny v bot_tickets_config a přerenderuje panel pro dotčenou guildu.
 */
export function startTicketsConfigRealtime(client) {
  const debounce = new Map();
  const schedule = (guildId) => {
    const key = guildId || '*';
    clearTimeout(debounce.get(key));
    debounce.set(
      key,
      setTimeout(async () => {
        if (guildId) {
          await setupTicketPanel(client, guildId).catch(() => {});
        } else {
          for (const g of client.guilds.cache.values()) {
            await setupTicketPanel(client, g.id).catch(() => {});
          }
        }
      }, 800),
    );
  };

  return supabase
    .channel('bot-tickets-config-realtime')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'bot_tickets_config' },
      (payload) => {
        const guilds = new Set([payload.new?.guild_id ?? null, payload.old?.guild_id ?? null]);
        for (const g of guilds) schedule(g);
        console.log(`🔄 bot_tickets_config změna (${payload.eventType}) → refresh panelu`);
      },
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') console.log('📡 Realtime: bot_tickets_config sleduji');
    });
}

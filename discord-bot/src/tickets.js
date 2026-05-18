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

export async function setupTicketPanel(client) {
  const { data: cfg } = await supabase
    .from('bot_tickets_config')
    .select('*')
    .limit(1)
    .maybeSingle();
  if (!cfg?.panel_channel_id) return;

  try {
    const channel = await client.channels.fetch(cfg.panel_channel_id).catch(() => null);
    if (!channel?.isTextBased?.()) return;

    // Refresh panel: delete old bot messages and post a fresh one
    const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
    if (messages) {
      for (const m of messages.values()) {
        if (m.author.id === client.user.id) await m.delete().catch(() => {});
      }
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_BTN_ID)
        .setLabel('Otevřít ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );

    await channel.send({
      content: cfg.welcome_md || 'Klikni níže pro otevření ticketu.',
      components: [row],
    });
  } catch (e) {
    console.error('setupTicketPanel', e);
  }
}

export async function handleInteraction(interaction) {
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

async function openTicket(interaction) {
  const { data: cfg } = await supabase
    .from('bot_tickets_config')
    .select('*')
    .limit(1)
    .maybeSingle();

  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Nelze otevřít ticket zde.', ephemeral: true });

  const name = `ticket-${interaction.user.username}`.toLowerCase().slice(0, 90);

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
      parent: cfg?.category_id || undefined,
      permissionOverwrites: overwrites,
    });

    const closeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(TICKET_CLOSE_ID)
        .setLabel('Uzavřít')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🔒')
    );

    await channel.send({
      content: `${cfg?.welcome_md || 'Ahoj! Popiš svůj problém.'}\n\n${interaction.user}, díky.`,
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
  const { data: cfg } = await supabase
    .from('bot_tickets_config')
    .select('transcripts_enabled')
    .limit(1)
    .maybeSingle();

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

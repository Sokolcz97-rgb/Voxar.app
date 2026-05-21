import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionFlagsBits,
} from 'discord.js';
import { supabase } from './supabase.js';
import { setupTicketPanel } from './tickets.js';

export function startOutboundWorker(client) {
  // Poll every 5s for queued jobs (channel sends + special actions)
  const tick = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_outbound_queue')
        .select('*')
        .is('sent_at', null)
        .is('webhook_url', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('queue fetch', error);
        return;
      }

      for (const job of data || []) {
        try {
          const payload = job.payload || {};

          // Special action: refresh ticket panel
          if (payload.action === 'refresh_ticket_panel') {
            const channelId = payload.panel_channel_id || job.channel_id || null;
            if (!channelId) {
              await supabase.from('bot_outbound_queue')
                .update({ error: 'no panel_channel_id', sent_at: new Date().toISOString() })
                .eq('id', job.id);
              continue;
            }
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (!channel?.isTextBased?.()) {
              await supabase.from('bot_outbound_queue')
                .update({ error: 'panel channel not found', sent_at: new Date().toISOString() })
                .eq('id', job.id);
              continue;
            }
            // delete old bot messages
            try {
              const msgs = await channel.messages.fetch({ limit: 20 });
              for (const m of msgs.values()) {
                if (m.author.id === client.user.id) await m.delete().catch(() => {});
              }
            } catch (e) { console.error('panel cleanup', e); }

            // If payload supplies content/components, send directly (this avoids
            // depending on setupTicketPanel/buildTicketPanelMessage versions).
            if (payload.content || payload.components) {
              try {
                await channel.send({
                  content: payload.content || '',
                  components: payload.components || [],
                });
                await supabase.from('bot_outbound_queue')
                  .update({ sent_at: new Date().toISOString(), error: null })
                  .eq('id', job.id);
              } catch (e) {
                console.error('panel send', e);
                await supabase.from('bot_outbound_queue')
                  .update({ error: String(e), sent_at: new Date().toISOString() })
                  .eq('id', job.id);
              }
              continue;
            }

            // Fallback: build from DB cfg
            const result = await setupTicketPanel(client, payload.guild_id || null, { channelId });
            await supabase.from('bot_outbound_queue')
              .update({
                sent_at: new Date().toISOString(),
                error: result?.ok ? null : (result?.error || 'ticket panel send failed'),
              })
              .eq('id', job.id);
            continue;
          }

          // Special action: create a Discord channel for a web-created ticket
          if (payload.action === 'create_web_ticket_channel') {
            const guildId = payload.guild_id;
            const guild = guildId ? await client.guilds.fetch(guildId).catch(() => null) : null;
            if (!guild) {
              await supabase.from('bot_outbound_queue')
                .update({ error: 'guild not found', sent_at: new Date().toISOString() })
                .eq('id', job.id);
              continue;
            }
            try {
              const { data: cfgRow } = await supabase
                .from('bot_tickets_config')
                .select('category_id, support_role_id, panel_channel_id')
                .eq('guild_id', guildId)
                .maybeSingle();

              let parentId = cfgRow?.category_id || undefined;
              if (parentId) {
                const cand = await guild.channels.fetch(parentId).catch(() => null);
                if (!cand || cand.type !== ChannelType.GuildCategory) parentId = undefined;
              }
              if (!parentId && cfgRow?.panel_channel_id) {
                const panel = await guild.channels.fetch(cfgRow.panel_channel_id).catch(() => null);
                if (panel?.parentId) parentId = panel.parentId;
              }

              const me = await guild.members.fetchMe();
              const safe = `web-${(payload.subject || 'ticket')}`
                .toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 90);

              const overwrites = [
                { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
                {
                  id: me.id,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ManageChannels,
                    PermissionFlagsBits.ReadMessageHistory,
                  ],
                },
              ];
              if (cfgRow?.support_role_id) {
                overwrites.push({
                  id: cfgRow.support_role_id,
                  allow: [
                    PermissionFlagsBits.ViewChannel,
                    PermissionFlagsBits.SendMessages,
                    PermissionFlagsBits.ReadMessageHistory,
                  ],
                });
              }

              const channel = await guild.channels.create({
                name: safe,
                type: ChannelType.GuildText,
                parent: parentId,
                permissionOverwrites: overwrites,
              });

              const closeRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('ticket_close')
                  .setLabel('Uzavřít')
                  .setStyle(ButtonStyle.Danger)
                  .setEmoji('🔒'),
              );

              const head = `🌐 **Web ticket od ${payload.author_name || 'uživatele'}**\n**${payload.subject || ''}**` +
                (payload.priority ? `\nPriorita: \`${payload.priority}\`` : '') +
                (payload.category ? ` · Kategorie: \`${payload.category}\`` : '');
              await channel.send({ content: `${head}\n\n${payload.description_text || ''}`.slice(0, 1900), components: [closeRow] });

              // Persist back the channel id + track open ticket
              await supabase.from('tickets').update({ discord_channel_id: channel.id }).eq('id', payload.web_ticket_id);
              await supabase.from('bot_open_tickets').insert({
                guild_id: guildId,
                channel_id: channel.id,
                user_id: payload.author_user_id || 'web',
                user_tag: payload.author_name || null,
                category_id: null,
                category_label: payload.category || 'Web',
                source: 'web',
                web_ticket_id: payload.web_ticket_id,
              });

              await supabase.from('bot_outbound_queue')
                .update({ sent_at: new Date().toISOString(), error: null })
                .eq('id', job.id);
            } catch (e) {
              console.error('create_web_ticket_channel', e);
              await supabase.from('bot_outbound_queue')
                .update({ error: String(e), sent_at: new Date().toISOString() })
                .eq('id', job.id);
            }
            continue;
          }

          // Special action: close/delete a ticket channel from dashboard
          if (payload.action === 'close_ticket' || payload.action === 'delete_ticket') {
            const channelId = payload.channel_id || job.channel_id;
            if (!channelId) {
              await supabase.from('bot_outbound_queue')
                .update({ error: 'no channel_id', sent_at: new Date().toISOString() })
                .eq('id', job.id);
              continue;
            }
            // Look up linked web ticket if any
            const { data: openRow } = await supabase
              .from('bot_open_tickets')
              .select('web_ticket_id')
              .eq('channel_id', channelId)
              .maybeSingle();

            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel) {
              if (payload.action === 'close_ticket' && payload.transcripts_enabled) {
                try {
                  const msgs = await channel.messages.fetch({ limit: 100 });
                  const lines = [...msgs.values()].reverse()
                    .map((m) => `[${m.createdAt.toISOString()}] ${m.author.tag}: ${m.content}`)
                    .join('\n');
                  await channel.send({
                    files: [{ attachment: Buffer.from(lines, 'utf8'), name: 'transcript.txt' }],
                  });
                } catch (e) { console.error('transcript (queue)', e); }
              }
              if (payload.notice) {
                try { await channel.send({ content: payload.notice }); } catch {}
              }
              await channel.delete().catch((e) => console.error('delete ticket channel', e));
            }
            try { await supabase.from('bot_open_tickets').delete().eq('channel_id', channelId); } catch {}

            // Sync linked web ticket
            if (openRow?.web_ticket_id) {
              if (payload.action === 'close_ticket') {
                await supabase.from('tickets').update({ status: 'closed' }).eq('id', openRow.web_ticket_id).catch(() => {});
              } else {
                await supabase.from('tickets').delete().eq('id', openRow.web_ticket_id).catch(() => {});
              }
            }

            await supabase.from('bot_outbound_queue')
              .update({ sent_at: new Date().toISOString(), error: channel ? null : 'channel not found' })
              .eq('id', job.id);
            continue;
          }

          if (!job.channel_id) {
            await supabase
              .from('bot_outbound_queue')
              .update({ error: 'no channel_id', sent_at: new Date().toISOString() })
              .eq('id', job.id);
            continue;
          }

          const channel = await client.channels.fetch(job.channel_id).catch(() => null);
          if (!channel?.isTextBased?.()) {
            await supabase
              .from('bot_outbound_queue')
              .update({ error: 'channel not found', sent_at: new Date().toISOString() })
              .eq('id', job.id);
            continue;
          }
          await channel.send({
            content: payload.content,
            embeds: payload.embeds,
            components: payload.components,
          });
          await supabase
            .from('bot_outbound_queue')
            .update({ sent_at: new Date().toISOString() })
            .eq('id', job.id);
        } catch (e) {
          console.error('send job', job.id, e);
          await supabase
            .from('bot_outbound_queue')
            .update({ error: String(e), sent_at: new Date().toISOString() })
            .eq('id', job.id);
        }
      }
    } catch (e) {
      console.error('outbound tick', e);
    }
  };

  setInterval(tick, 5000);
  tick();
}

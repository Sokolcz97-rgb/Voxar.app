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

          // Special action: close/delete a ticket channel from dashboard
          if (payload.action === 'close_ticket' || payload.action === 'delete_ticket') {
            const channelId = payload.channel_id || job.channel_id;
            if (!channelId) {
              await supabase.from('bot_outbound_queue')
                .update({ error: 'no channel_id', sent_at: new Date().toISOString() })
                .eq('id', job.id);
              continue;
            }
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

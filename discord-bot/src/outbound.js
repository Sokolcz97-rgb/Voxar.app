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
            const result = await setupTicketPanel(client, payload.guild_id || null, {
              channelId: payload.panel_channel_id || job.channel_id || null,
            });
            if (!result?.ok) {
              await supabase
                .from('bot_outbound_queue')
                .update({ error: result?.error || 'ticket panel send failed', sent_at: new Date().toISOString() })
                .eq('id', job.id);
              continue;
            }
            await supabase
              .from('bot_outbound_queue')
              .update({ sent_at: new Date().toISOString(), error: null })
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

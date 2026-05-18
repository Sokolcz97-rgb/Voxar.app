import { supabase } from './supabase.js';

export function startOutboundWorker(client) {
  // Poll every 5s for queued messages without webhook_url (channel sends)
  const tick = async () => {
    try {
      const { data, error } = await supabase
        .from('bot_outbound_queue')
        .select('*')
        .is('sent_at', null)
        .is('webhook_url', null)
        .not('channel_id', 'is', null)
        .order('created_at', { ascending: true })
        .limit(10);

      if (error) {
        console.error('queue fetch', error);
        return;
      }

      for (const job of data || []) {
        try {
          const channel = await client.channels.fetch(job.channel_id).catch(() => null);
          if (!channel?.isTextBased?.()) {
            await supabase
              .from('bot_outbound_queue')
              .update({ error: 'channel not found', sent_at: new Date().toISOString() })
              .eq('id', job.id);
            continue;
          }
          const payload = job.payload || {};
          await channel.send({
            content: payload.content,
            embeds: payload.embeds,
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

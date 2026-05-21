import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface Body {
  ticket_id: string;
  event: 'created' | 'reply' | 'status';
  reply_content?: string;
  new_status?: string;
}

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<li>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function trunc(s: string, n: number) {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

function statusColor(status: string): number {
  switch (status) {
    case 'open': return 0x3498db;
    case 'in_progress': return 0xf1c40f;
    case 'resolved': return 0x2ecc71;
    case 'closed': return 0x95a5a6;
    default: return 0x5865f2;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as Body;
    if (!body.ticket_id || !body.event) {
      return new Response(JSON.stringify({ error: 'Missing ticket_id or event' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: ticket, error: tErr } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', body.ticket_id)
      .maybeSingle();
    if (tErr || !ticket) {
      return new Response(JSON.stringify({ error: 'Ticket not found or no access' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: cfg } = await admin
      .from('bot_tickets_config')
      .select('mirror_enabled, sync_channel_id, sync_webhook_url, panel_channel_id, guild_id, category_id, support_role_id, transcripts_enabled, welcome_md')
      .limit(1)
      .maybeSingle();

    // Site-level guild for web ticket sync (only this Discord server receives web tickets)
    const { data: siteCfg } = await admin
      .from('site_settings')
      .select('web_tickets_guild_id')
      .limit(1)
      .maybeSingle();
    const webGuildId = (siteCfg as { web_tickets_guild_id?: string | null } | null)?.web_tickets_guild_id || null;

    const { data: authorProfile } = await admin
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('user_id', ticket.user_id)
      .maybeSingle();

    const { data: actorProfile } = await admin
      .from('profiles')
      .select('display_name, username, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle();

    const authorName = authorProfile?.display_name || authorProfile?.username || 'Uživatel';
    const actorName = actorProfile?.display_name || actorProfile?.username || 'Uživatel';

    // -------- Per-ticket Discord channel flow (web ticket → real channel) --------
    // 1) On 'created' → ask bot to create a channel for this ticket
    if (body.event === 'created' && cfg?.guild_id && !ticket.discord_channel_id) {
      await admin.from('bot_outbound_queue').insert({
        source: 'web_ticket',
        payload: {
          action: 'create_web_ticket_channel',
          guild_id: cfg.guild_id,
          web_ticket_id: ticket.id,
          subject: ticket.subject,
          description_text: trunc(stripHtml(ticket.description || ''), 1800),
          author_name: authorName,
          author_user_id: ticket.user_id,
          category: ticket.category,
          priority: ticket.priority,
          welcome_md: cfg.welcome_md,
        },
      });
    }

    // 2) On 'reply' → forward to per-ticket channel if it exists
    if (body.event === 'reply' && ticket.discord_channel_id && body.reply_content) {
      const text = trunc(stripHtml(body.reply_content), 1900);
      await admin.from('bot_outbound_queue').insert({
        source: 'web_ticket',
        channel_id: ticket.discord_channel_id,
        payload: { content: `**${actorName}** (web):\n${text}` },
      });
    }

    // 3) On 'status' → notice in channel + (close → schedule close action)
    if (body.event === 'status' && ticket.discord_channel_id) {
      const newStatus = body.new_status || ticket.status;
      await admin.from('bot_outbound_queue').insert({
        source: 'web_ticket',
        channel_id: ticket.discord_channel_id,
        payload: { content: `🔄 **${actorName}** změnil status: \`${ticket.status}\` → \`${newStatus}\`` },
      });
    }

    // -------- Legacy: mirror digest to a single shared channel/webhook --------
    if (cfg?.mirror_enabled && (cfg.sync_channel_id || cfg.sync_webhook_url)) {
      let embed: Record<string, unknown> = {};
      if (body.event === 'created') {
        embed = {
          title: `🎫 Nový ticket: ${trunc(ticket.subject, 240)}`,
          description: trunc(stripHtml(ticket.description || ''), 1800),
          color: statusColor(ticket.status),
          fields: [
            { name: 'Status', value: ticket.status, inline: true },
            { name: 'Priorita', value: ticket.priority, inline: true },
            ...(ticket.category ? [{ name: 'Kategorie', value: ticket.category, inline: true }] : []),
          ],
          author: { name: authorName, icon_url: authorProfile?.avatar_url ?? undefined },
          footer: { text: `Ticket #${ticket.id.slice(0, 8)}` },
          timestamp: new Date().toISOString(),
        };
      } else if (body.event === 'reply') {
        embed = {
          title: `💬 Odpověď: ${trunc(ticket.subject, 240)}`,
          description: trunc(stripHtml(body.reply_content || ''), 1800),
          color: 0x5865f2,
          author: { name: actorName, icon_url: actorProfile?.avatar_url ?? undefined },
          footer: { text: `Ticket #${ticket.id.slice(0, 8)} · ${ticket.status}` },
          timestamp: new Date().toISOString(),
        };
      } else if (body.event === 'status') {
        const newStatus = body.new_status || ticket.status;
        embed = {
          title: `🔄 Status změněn: ${trunc(ticket.subject, 220)}`,
          description: `**${ticket.status}** → **${newStatus}**`,
          color: statusColor(newStatus),
          author: { name: actorName, icon_url: actorProfile?.avatar_url ?? undefined },
          footer: { text: `Ticket #${ticket.id.slice(0, 8)}` },
          timestamp: new Date().toISOString(),
        };
      }

      if (cfg.sync_webhook_url) {
        await fetch(cfg.sync_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ embeds: [embed] }),
        }).catch(() => {});
      } else if (cfg.sync_channel_id) {
        await admin.from('bot_outbound_queue').insert({
          channel_id: cfg.sync_channel_id,
          payload: { embeds: [embed] },
          source: `ticket:${body.event}`,
        });
      }
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

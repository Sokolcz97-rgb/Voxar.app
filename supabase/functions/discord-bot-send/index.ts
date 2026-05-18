import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

interface SendBody {
  webhook_url?: string;
  channel_id?: string;
  content?: string;
  embed?: Record<string, unknown>;
  username?: string;
  avatar_url?: string;
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

    const { data: canManage } = await supabase.rpc('can', { _module: 'bot', _action: 'manage' });
    if (!canManage) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = (await req.json()) as SendBody;

    if (!body.webhook_url) {
      // Queue it for the external bot
      const { error: qErr } = await supabase.from('bot_outbound_queue').insert({
        channel_id: body.channel_id ?? null,
        payload: {
          content: body.content,
          embeds: body.embed ? [body.embed] : undefined,
          username: body.username,
          avatar_url: body.avatar_url,
        },
        source: 'web',
      });
      if (qErr) throw qErr;
      return new Response(JSON.stringify({ queued: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//.test(body.webhook_url)) {
      return new Response(JSON.stringify({ error: 'Invalid webhook URL' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const payload: Record<string, unknown> = {};
    if (body.content) payload.content = body.content;
    if (body.embed) payload.embeds = [body.embed];
    if (body.username) payload.username = body.username;
    if (body.avatar_url) payload.avatar_url = body.avatar_url;

    const res = await fetch(body.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text();
      return new Response(JSON.stringify({ error: `Discord ${res.status}: ${text}` }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
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

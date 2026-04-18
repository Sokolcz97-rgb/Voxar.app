// Pings IP:port servers via TCP and updates is_online + last_pinged_at.
// Can be triggered by cron or manually with { server_id?: string } body.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.95.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function tcpPing(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  try {
    const conn = await Promise.race([
      Deno.connect({ hostname: host, port, transport: 'tcp' }),
      new Promise<null>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      ),
    ]);
    if (conn) {
      (conn as Deno.Conn).close();
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    let body: { server_id?: string } = {};
    try { body = await req.json(); } catch { /* no body */ }

    let query = supabase
      .from('servers')
      .select('id, ip, port, game_id, games!inner(connection_type)')
      .eq('games.connection_type', 'ip_port')
      .not('ip', 'is', null)
      .not('port', 'is', null);

    if (body.server_id) query = query.eq('id', body.server_id);

    const { data: servers, error } = await query;
    if (error) throw error;

    const results = await Promise.all(
      (servers ?? []).map(async (s: any) => {
        const online = await tcpPing(s.ip, s.port);
        await supabase
          .from('servers')
          .update({ is_online: online, last_pinged_at: new Date().toISOString() })
          .eq('id', s.id);
        return { id: s.id, online };
      })
    );

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

// Vrací veřejné informace pro sestavení Discord invite URL pro bota.
// Client ID je veřejná hodnota (objevuje se v každém invite linku).
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const clientId = Deno.env.get('DISCORD_OAUTH_CLIENT_ID') ?? '';
  if (!clientId) {
    return new Response(JSON.stringify({ error: 'Bot client ID není nakonfigurován' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Permissions = 8 (Administrator) – nejjednodušší, aby fungovaly všechny moduly bota
  // (automod mazání, kick/ban, tvorba kanálů pro tickety, role pro welcome…)
  // Pokud chceš později zúžit, stačí přepočítat bitmasku.
  const permissions = '8';
  const scope = 'bot applications.commands';
  const url =
    `https://discord.com/api/oauth2/authorize?client_id=${clientId}` +
    `&permissions=${permissions}&scope=${encodeURIComponent(scope)}`;

  return new Response(JSON.stringify({ client_id: clientId, invite_url: url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});

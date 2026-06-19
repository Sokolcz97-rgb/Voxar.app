// Returns Discord OAuth authorization URL for the authenticated user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DISCORD_CLIENT_ID = Deno.env.get("DISCORD_OAUTH_CLIENT_ID")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/discord-oauth-callback`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error } = await userClient.auth.getUser();
    if (error || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const origin = String(body.origin ?? "").replace(/\/+$/, "");
    const prompt = body.prompt === "none" ? "none" : "consent";
    if (!origin || !/^https?:\/\//.test(origin)) {
      return new Response(JSON.stringify({ error: "invalid origin" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const nonce = crypto.randomUUID();
    const stateObj = { nonce, origin, user_id: user.id };
    const state = btoa(JSON.stringify(stateObj))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const params = new URLSearchParams({
      client_id: DISCORD_CLIENT_ID,
      response_type: "code",
      redirect_uri: REDIRECT_URI,
      scope: "identify guilds",
      state,
      // prompt=none → Discord přeskočí potvrzovací obrazovku, pokud uživatel
      // už dříve autorizoval naši aplikaci.
      prompt,
    });
    const url = `https://discord.com/api/oauth2/authorize?${params.toString()}`;
    return new Response(JSON.stringify({ url, state: nonce }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { AccessToken } from "npm:livekit-server-sdk@2.17.0";

const backendUrl = Deno.env.get("SUPABASE_URL") ?? "";
const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const livekitUrl = Deno.env.get("LIVEKIT_URL") ?? "";
const livekitApiKey = Deno.env.get("LIVEKIT_API_KEY") ?? "";
const livekitApiSecret = Deno.env.get("LIVEKIT_API_SECRET") ?? "";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    if (!backendUrl || !publishableKey || !livekitUrl || !livekitApiKey || !livekitApiSecret) {
      console.error("LiveKit environment is incomplete");
      return json({ error: "Hlasová služba není nakonfigurovaná." }, 503);
    }

    const authorization = req.headers.get("Authorization") ?? "";
    if (!authorization.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const client = createClient(backendUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error: userError } = await client.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const channelId = typeof body.channel_id === "string" ? body.channel_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(channelId)) {
      return json({ error: "Neplatný hlasový kanál." }, 400);
    }

    const { data: channel, error: channelError } = await client
      .from("vox_channels")
      .select("id, guild_id, type")
      .eq("id", channelId)
      .maybeSingle();
    if (channelError || !channel || channel.type !== "voice") {
      return json({ error: "Hlasový kanál nebyl nalezen." }, 404);
    }

    const { data: membership, error: membershipError } = await client
      .from("vox_guild_members")
      .select("user_id")
      .eq("guild_id", channel.guild_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (membershipError || !membership) return json({ error: "K tomuto kanálu nemáte přístup." }, 403);

    const { data: profile } = await client
      .from("profiles")
      .select("display_name, avatar_url")
      .eq("user_id", user.id)
      .maybeSingle();

    const roomName = `vox-${channelId}`;
    const token = new AccessToken(livekitApiKey, livekitApiSecret, {
      identity: user.id,
      name: profile?.display_name || user.email?.split("@")[0] || "Voxar user",
      metadata: JSON.stringify({ avatar_url: profile?.avatar_url ?? null, channel_id: channelId }),
      ttl: "15m",
    });
    token.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    return json({ url: livekitUrl, token: await token.toJwt(), room: roomName });
  } catch (error) {
    console.error("LiveKit token error", error);
    return json({ error: "Token pro hlasové spojení se nepodařilo vytvořit." }, 500);
  }
});
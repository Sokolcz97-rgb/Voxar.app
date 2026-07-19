// Claim ownership of a bot guild after Discord OAuth verification.
// Inputs: { state: string, guild_id: string }
// Verifies the OAuth session belongs to the caller and that the guild is in
// their manageable Discord guilds (already filtered by the callback), then
// sets owner_user_id / owner_discord_id and auto-approves the registration.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) {
      return json({ error: "Unauthorized" }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const state = String(body.state ?? "");
    const guildId = String(body.guild_id ?? "");
    if (!state || !guildId) return json({ error: "missing state or guild_id" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const { data: session, error: sErr } = await admin
      .from("discord_oauth_sessions")
      .select("*")
      .eq("state", state)
      .maybeSingle();
    if (sErr || !session) return json({ error: "session not found" }, 404);
    if (session.user_id !== user.id) return json({ error: "forbidden" }, 403);
    if (new Date(session.expires_at).getTime() < Date.now()) return json({ error: "expired" }, 410);

    const guilds = Array.isArray(session.guilds) ? session.guilds : [];
    const match = guilds.find((g: any) => String(g.id) === guildId);
    if (!match) return json({ error: "not_manager_of_guild" }, 403);

    // Upsert: if row exists, claim it; otherwise create approved row.
    const { data: existing } = await admin
      .from("bot_guilds")
      .select("id, owner_user_id")
      .eq("guild_id", guildId)
      .maybeSingle();

    const patch = {
      guild_id: guildId,
      name: match.name,
      icon_url: match.icon_url ?? null,
      owner_user_id: user.id,
      owner_discord_id: session.discord_user_id,
      status: "approved" as const,
      source: existing ? (existing.owner_user_id ? "transferred" : "claim") : "claim",
      member_count: match.approximate_member_count ?? null,
      reviewed_at: new Date().toISOString(),
    };

    let result;
    if (existing) {
      result = await admin.from("bot_guilds").update(patch).eq("id", existing.id).select().maybeSingle();
    } else {
      result = await admin.from("bot_guilds").insert(patch).select().maybeSingle();
    }
    if (result.error) return json({ error: result.error.message }, 500);

    // Track reviewer separately in staff-only table
    if (result.data?.id) {
      await admin.from("bot_guilds_review").upsert({
        guild_row_id: result.data.id,
        reviewed_by: user.id,
        updated_at: new Date().toISOString(),
      });
    }

    return json({ ok: true, guild: result.data });
  } catch (e) {
    return json({ error: String(e instanceof Error ? e.message : e) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

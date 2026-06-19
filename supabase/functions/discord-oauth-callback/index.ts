// Discord OAuth callback: exchanges code, fetches user's guilds, stores in session, redirects back to web.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DISCORD_CLIENT_ID = Deno.env.get("DISCORD_OAUTH_CLIENT_ID")!;
const DISCORD_CLIENT_SECRET = Deno.env.get("DISCORD_OAUTH_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/discord-oauth-callback`;

// Discord permission bit for MANAGE_GUILD
const MANAGE_GUILD = 0x20n;

function htmlError(msg: string) {
  return new Response(
    `<html><body style="font-family:sans-serif;padding:2rem;background:#0a0a1a;color:#fff"><h2>Chyba při připojení Discordu</h2><p>${msg}</p><p><a style="color:#7dd3fc" href="javascript:window.close()">Zavřít</a></p></body></html>`,
    { status: 400, headers: { "Content-Type": "text/html; charset=utf-8" } },
  );
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateRaw = url.searchParams.get("state");
    const err = url.searchParams.get("error");

    if (err) return htmlError(`Discord vrátil chybu: ${err}`);
    if (!code || !stateRaw) return htmlError("Chybí code nebo state.");

    // state = base64url({ nonce, origin, user_id })
    let stateObj: { nonce: string; origin: string; user_id: string };
    try {
      stateObj = JSON.parse(atob(stateRaw.replace(/-/g, "+").replace(/_/g, "/")));
    } catch {
      return htmlError("Neplatný state parametr.");
    }
    const { nonce, origin, user_id } = stateObj;
    if (!nonce || !origin || !user_id) return htmlError("Neúplný state.");

    // Exchange code -> access_token
    const tokenRes = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      const t = await tokenRes.text();
      return htmlError(`Výměna tokenu selhala: ${t}`);
    }
    const tok = await tokenRes.json();

    // Fetch user
    const meRes = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    const me = meRes.ok ? await meRes.json() : null;

    // Fetch guilds
    const gRes = await fetch("https://discord.com/api/users/@me/guilds", {
      headers: { Authorization: `Bearer ${tok.access_token}` },
    });
    if (!gRes.ok) return htmlError("Nepodařilo se získat seznam serverů.");
    const allGuilds = await gRes.json();

    // Keep only guilds where user has MANAGE_GUILD (owner or admin perms)
    const manageable = (allGuilds as any[])
      .filter((g) => {
        try {
          const perms = BigInt(g.permissions ?? "0");
          return g.owner === true || (perms & MANAGE_GUILD) === MANAGE_GUILD;
        } catch {
          return g.owner === true;
        }
      })
      .map((g) => ({
        id: g.id,
        name: g.name,
        icon_url: g.icon
          ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png`
          : null,
        owner: !!g.owner,
        approximate_member_count: g.approximate_member_count ?? null,
      }));

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);
    await supabase.from("discord_oauth_sessions").upsert({
      state: nonce,
      user_id,
      discord_user_id: me?.id ?? null,
      discord_username: me?.username ?? null,
      guilds: manageable,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    });

    if (me?.id) {
      await supabase.from("user_discord_links").upsert({
        user_id,
        discord_user_id: me.id,
        discord_username: me?.username ?? null,
        updated_at: new Date().toISOString(),
      });
    }

    const completeUrl = `${origin}/discord-oauth-complete?discord_session=${encodeURIComponent(nonce)}`;
    return Response.redirect(completeUrl, 302);
  } catch (e) {
    return htmlError(String(e instanceof Error ? e.message : e));
  }
});

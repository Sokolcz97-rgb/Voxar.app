// Přihlášení launcheru Ashes of Eryon účtem StudioVoxario.
//
// Tok (viz game/launcher/spec/AUTH_HANDOFF.md):
//  1. launcher otevře v prohlížeči /game/auth/launcher s PKCE "challenge" a portem 127.0.0.1,
//  2. přihlášený uživatel potvrdí → web zavolá  action "start"  → jednorázový kód (2 min),
//  3. web přesměruje na http://127.0.0.1:<port>/callback?code=…&state=…,
//  4. launcher zavolá  action "redeem"  s kódem a "verifier" → token_hash,
//     který si sám vymění za vlastní relaci (POST /auth/v1/verify). Heslo launcher nikdy nevidí.
//  5. před spuštěním hry launcher zavolá  action "ticket"  (svou relací) → token_hash pro hru,
//     hra si z něj udělá vlastní nezávislou relaci a přeskočí přihlašovací obrazovku.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const b64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

async function sha256(text: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

const B64URL = /^[A-Za-z0-9_-]{43,128}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return json({ error: "Neplatný požadavek." }, 400);
  }
  const action = String(body.action ?? "");
  const device = typeof body.device === "string" ? body.device.slice(0, 80) : null;

  async function currentUser() {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return null;
    const client = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
    const { data } = await client.auth.getUser();
    return data.user ?? null;
  }

  async function tokenHashFor(userId: string) {
    const { data: u, error } = await admin.auth.admin.getUserById(userId);
    if (error || !u?.user) return { error: "Účet nebyl nalezen." };
    if (!u.user.email) return { error: "K účtu není přiřazený e-mail – doplň ho v nastavení účtu na webu." };
    // generateLink e-mail neposílá, jen vytvoří jednorázový token pro /auth/v1/verify
    const { data, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: u.user.email });
    if (linkErr || !data?.properties?.hashed_token) return { error: "Přihlášení se nepodařilo připravit." };
    return { token_hash: data.properties.hashed_token, email: u.user.email };
  }

  try {
    if (action === "start") {
      const user = await currentUser();
      if (!user) return json({ error: "Nejsi přihlášený." }, 401);
      const challenge = String(body.challenge ?? "");
      if (!B64URL.test(challenge)) return json({ error: "Neplatný požadavek launcheru." }, 400);
      const code = b64url(crypto.getRandomValues(new Uint8Array(32)));
      const { error } = await admin.from("launcher_auth_codes").insert({
        code_hash: hex(await sha256(code)),
        user_id: user.id,
        challenge,
        device,
      });
      if (error) return json({ error: "Kód se nepodařilo vytvořit." }, 500);
      return json({ code });
    }

    if (action === "redeem") {
      const code = String(body.code ?? "");
      const verifier = String(body.verifier ?? "");
      if (!B64URL.test(code) || !B64URL.test(verifier)) return json({ error: "Neplatný kód." }, 400);
      // jednorázově: kód se označí jako použitý jen jednou
      const { data: row } = await admin
        .from("launcher_auth_codes")
        .update({ used_at: new Date().toISOString() })
        .eq("code_hash", hex(await sha256(code)))
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString())
        .select("user_id, challenge")
        .maybeSingle();
      if (!row) return json({ error: "Kód vypršel nebo už byl použitý. Přihlas se znovu." }, 400);
      if (b64url(await sha256(verifier)) !== row.challenge) return json({ error: "Kód nepatří tomuto launcheru." }, 400);
      const result = await tokenHashFor(row.user_id);
      if ("error" in result) return json(result, 400);
      await admin.from("launcher_sessions_log").insert({ user_id: row.user_id, event: "login", device });
      return json(result);
    }

    if (action === "ticket") {
      const user = await currentUser();
      if (!user) return json({ error: "Přihlášení vypršelo." }, 401);
      const result = await tokenHashFor(user.id);
      if ("error" in result) return json(result, 400);
      await admin.from("launcher_sessions_log").insert({ user_id: user.id, event: "game", device });
      return json({ token_hash: result.token_hash });
    }

    return json({ error: "Neznámá akce." }, 400);
  } catch (e) {
    console.error("launcher-auth", e);
    return json({ error: "Chyba serveru." }, 500);
  }
});

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const encoder = new TextEncoder();
const MAX_BODY_BYTES = 2_048;
const CHALLENGE_TTL_MS = 5 * 60 * 1_000;
const allowedFlags = new Set(["defender_tamper_recent", "defender_realtime_off"]);

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

async function sha256(value: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/i.test(value);
}

function normalizedFlags(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return [...new Set(value.filter((flag): flag is string => typeof flag === "string" && allowedFlags.has(flag)))].slice(0, 2);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const length = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);

  const bodyText = await req.text();
  if (encoder.encode(bodyText).byteLength > MAX_BODY_BYTES) return json({ error: "payload_too_large" }, 413);
  let body: Record<string, unknown>;
  try { body = JSON.parse(bodyText); } catch { return json({ error: "invalid_json" }, 400); }

  const authHeader = req.headers.get("Authorization") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const url = Deno.env.get("SUPABASE_URL")!;
  const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const action = body.action;
  const scope = body.scope === "game" ? "game" : "account";

  if (action === "challenge") {
    const nonce = randomNonce();
    const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS).toISOString();
    // Průběžně odstraníme jen vlastní expirované výzvy; nejde o periodický job.
    await admin.from("vox_protect_challenges").delete().eq("user_id", user.id).lt("expires_at", new Date().toISOString());
    const { data, error } = await admin
      .from("vox_protect_challenges")
      .insert({ user_id: user.id, nonce_hash: await sha256(nonce), scope, expires_at: expiresAt })
      .select("id, expires_at")
      .single();
    if (error || !data) return json({ error: "challenge_unavailable" }, 503);
    return json({ challenge_id: data.id, nonce, expires_at: data.expires_at, max_payload_bytes: MAX_BODY_BYTES });
  }

  if (action !== "verify") return json({ error: "unknown_action" }, 400);

  const challengeId = typeof body.challenge_id === "string" ? body.challenge_id : "";
  const nonce = typeof body.nonce === "string" ? body.nonce : "";
  const platform = body.platform;
  const appVersion = typeof body.app_version === "string" ? body.app_version.trim().slice(0, 80) : "";
  const integrityHash = body.integrity_hash;
  const flags = normalizedFlags(body.security_flags);
  if (!challengeId || nonce.length < 24 || !["win32", "darwin", "linux"].includes(String(platform)) || !appVersion || !isSha256(integrityHash)) {
    return json({ error: "invalid_attestation" }, 400);
  }

  const { data: challenge } = await admin
    .from("vox_protect_challenges")
    .select("id, nonce_hash, expires_at, used_at, scope")
    .eq("id", challengeId).eq("user_id", user.id).maybeSingle();
  if (!challenge || challenge.used_at || challenge.scope !== scope || new Date(challenge.expires_at).getTime() < Date.now() || challenge.nonce_hash !== await sha256(nonce)) {
    return json({ error: "challenge_invalid" }, 409);
  }

  const { data: consumed } = await admin
    .from("vox_protect_challenges")
    .update({ used_at: new Date().toISOString() })
    .eq("id", challenge.id).is("used_at", null)
    .select("id");
  if (!consumed?.length) return json({ error: "challenge_used" }, 409);

  const { data: policy } = await admin
    .from("vox_protect_build_policies")
    .select("enforcement")
    .eq("platform", platform).eq("app_version", appVersion).eq("integrity_hash", integrityHash.toLowerCase()).eq("active", true)
    .maybeSingle();

  const decision = policy?.enforcement === "block" ? "block" : policy?.enforcement === "warn" || flags.length ? "warn" : "allow";
  await admin.from("vox_protect_challenges").update({ decision }).eq("id", challenge.id);
  if (decision === "block" || flags.length) {
    await admin.from("vox_protect_incidents").insert({
      user_id: user.id,
      kind: decision === "block" ? "blocked_build" : "security_flag",
      scope,
      app_version: appVersion,
      integrity_hash: integrityHash.toLowerCase(),
      flags,
    });
  }
  return json({ decision, reason: decision === "block" ? "blocked_build" : flags.length ? "security_attention" : "ok", next_check_after_seconds: 21_600 });
});

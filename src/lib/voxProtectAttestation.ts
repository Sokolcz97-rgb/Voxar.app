import { supabase } from "@/integrations/supabase/client";

type DesktopIntegrity = {
  platform: "win32" | "darwin" | "linux";
  appVersion: string;
  integrityHash: string;
  securityFlags: string[];
};

type AttestationResult = { decision: "allow" | "warn" | "block"; reason: string } | null;

declare global {
  interface Window {
    studioVoxarioDesktop?: {
      protectGetIntegrity?: () => Promise<DesktopIntegrity | { ok: false; error: string }>;
      returnToLauncher?: () => Promise<unknown>;
    };
  }
}

// One short handshake per browser session. It is intentionally unavailable in
// the web-only client: the server must never treat a browser value as desktop
// anti-cheat evidence.
export async function attestDesktopProtect(scope: "account" | "game" = "account"): Promise<AttestationResult> {
  const bridge = window.studioVoxarioDesktop?.protectGetIntegrity;
  if (!bridge || sessionStorage.getItem(`vox-protect-attested:${scope}`)) return null;
  const local = await bridge();
  if (!("integrityHash" in local) || !/^[a-f0-9]{64}$/i.test(local.integrityHash)) return null;

  const { data: challenge, error: challengeError } = await supabase.functions.invoke("protect-attestation", { body: { action: "challenge", scope } });
  if (challengeError || !challenge?.challenge_id || !challenge?.nonce) return null;
  const payload = {
    action: "verify", scope, challenge_id: challenge.challenge_id, nonce: challenge.nonce,
    platform: local.platform, app_version: local.appVersion, integrity_hash: local.integrityHash,
    security_flags: local.securityFlags.slice(0, 2),
  };
  // Keep a hard client cap as a regression guard; the function independently
  // enforces the same 2 KiB maximum.
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 2_048) return null;
  const { data, error } = await supabase.functions.invoke("protect-attestation", { body: payload });
  if (error || !data || !["allow", "warn", "block"].includes(data.decision)) return null;
  sessionStorage.setItem(`vox-protect-attested:${scope}`, "1");
  return data as AttestationResult;
}

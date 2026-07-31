/**
 * Vox.app — end-to-end šifrování zpráv (AES-256-GCM / PBKDF2).
 *
 * Klíč se odvozuje z tajné fráze, kterou zadá uživatel v daném sektoru.
 * Fráze ani klíč nikdy neopouští zařízení — server vidí pouze šifrovaný
 * blob ve tvaru `E2EE1:<base64(iv||ciphertext)>`.
 */

const PREFIX = "E2EE1:";
const KEY_STORE = "vox.e2ee.pass.";
const enc = new TextEncoder();
const dec = new TextDecoder();

const cache = new Map<string, CryptoKey>();

export function getPassphrase(scopeId: string): string | null {
  try {
    return localStorage.getItem(KEY_STORE + scopeId);
  } catch {
    return null;
  }
}

export function setPassphrase(scopeId: string, pass: string | null) {
  try {
    if (pass) localStorage.setItem(KEY_STORE + scopeId, pass);
    else localStorage.removeItem(KEY_STORE + scopeId);
  } catch {
    /* ignore */
  }
  cache.delete(scopeId);
}

export function isEncrypted(content: string): boolean {
  return typeof content === "string" && content.startsWith(PREFIX);
}

async function getKey(scopeId: string): Promise<CryptoKey | null> {
  const cached = cache.get(scopeId);
  if (cached) return cached;
  const pass = getPassphrase(scopeId);
  if (!pass) return null;

  const base = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: enc.encode(`vox.app:${scopeId}`), iterations: 200_000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
  cache.set(scopeId, key);
  return key;
}

function toB64(buf: Uint8Array): string {
  let s = "";
  buf.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Zašifruje text. Když pro daný sektor není klíč, vrátí původní text. */
export async function encryptMessage(scopeId: string, plain: string): Promise<string> {
  const key = await getKey(scopeId);
  if (!key) return plain;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain)));
  const packed = new Uint8Array(iv.length + ct.length);
  packed.set(iv, 0);
  packed.set(ct, iv.length);
  return PREFIX + toB64(packed);
}

/** Rozšifruje text. Vrací `null`, pokud klíč chybí nebo nesedí. */
export async function decryptMessage(scopeId: string, content: string): Promise<string | null> {
  if (!isEncrypted(content)) return content;
  const key = await getKey(scopeId);
  if (!key) return null;
  try {
    const packed = fromB64(content.slice(PREFIX.length));
    const iv = packed.slice(0, 12);
    const ct = packed.slice(12);
    const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return dec.decode(pt);
  } catch {
    return null;
  }
}

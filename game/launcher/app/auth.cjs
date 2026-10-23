"use strict";

/**
 * Přihlášení launcheru účtem StudioVoxario (viz ../spec/AUTH_HANDOFF.md).
 *
 * 1. Launcher vytvoří PKCE pár (verifier + challenge) a náhodný state a spustí
 *    dočasný server jen na 127.0.0.1 s náhodným portem.
 * 2. V prohlížeči otevře  <web>/game/auth/launcher?state&challenge&port.
 *    Hráč se tam přihlásí (e-mail, Google, Discord…) a potvrdí launcher.
 * 3. Web přesměruje na http://127.0.0.1:<port>/callback?code&state.
 * 4. Launcher vymění kód + verifier (edge funkce launcher-auth / redeem) za jednorázový
 *    token a z něj si u Supabase vytvoří vlastní relaci. Heslo nikdy nevidí.
 * 5. Obnovovací token se ukládá šifrovaně přes Windows (Electron safeStorage / DPAPI).
 * 6. Před spuštěním hry launcher vyžádá pro hru samostatný jednorázový lístek (ticket),
 *    hra si z něj udělá vlastní relaci – relace launcheru a hry se navzájem neodhlašují.
 */

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { app, net, safeStorage, shell } = require("electron");

const SUPABASE = "https://rioexuvgvmdwvidfakxy.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-";
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function createAuth({ webOrigin, onStatus, log = () => {} }) {
  let session = null; // { access_token, refresh_token, expires_at }
  let user = null; // { id, email, name, avatar }
  let offline = false;
  let pending = null; // probíhající přihlášení v prohlížeči
  let lastError = null;
  let restoring = false;

  const file = () => path.join(app.getPath("userData"), "account.bin");

  function status() {
    return {
      signedIn: Boolean(user && (session || offline)),
      offline,
      pending: Boolean(pending),
      restoring,
      error: lastError,
      user: user ? { name: user.name, email: user.email, avatar: user.avatar } : null,
      secureStorage: safeStorage.isEncryptionAvailable(),
    };
  }
  const emit = () => {
    try { onStatus?.(status()); } catch {}
  };

  // ------------------------------------------------------------------ úložiště
  function persist() {
    if (!session?.refresh_token || !safeStorage.isEncryptionAvailable()) return;
    try {
      const payload = JSON.stringify({ refresh_token: session.refresh_token, user });
      fs.mkdirSync(path.dirname(file()), { recursive: true });
      fs.writeFileSync(file(), safeStorage.encryptString(payload), { mode: 0o600 });
    } catch (e) {
      log(`Účet: uložení selhalo ${e?.message || e}`);
    }
  }
  function loadStored() {
    try {
      if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(file())) return null;
      return JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
    } catch {
      return null;
    }
  }
  function forget() {
    session = null;
    user = null;
    offline = false;
    try { fs.rmSync(file(), { force: true }); } catch {}
  }

  // ------------------------------------------------------------------ Supabase
  async function call(url, body, token) {
    const res = await net.fetch(url, {
      method: "POST",
      headers: {
        apikey: PUBLISHABLE_KEY,
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body ?? {}),
      cache: "no-store",
    });
    let data = null;
    try { data = await res.json(); } catch {}
    return { ok: res.ok, status: res.status, data };
  }
  const fn = (body, token) => call(`${SUPABASE}/functions/v1/launcher-auth`, body, token);

  async function adoptSession(data) {
    if (!data?.access_token || !data?.refresh_token) throw new Error("Server nevrátil relaci.");
    session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Number(data.expires_at) || Math.floor(Date.now() / 1000) + Number(data.expires_in || 3600),
    };
    const u = data.user || {};
    user = { id: u.id, email: u.email || "", name: user?.id === u.id ? user.name : "", avatar: user?.id === u.id ? user.avatar : "" };
    offline = false;
    await loadProfile();
    persist();
  }

  async function loadProfile() {
    if (!user?.id || !session) return;
    try {
      const res = await net.fetch(
        `${SUPABASE}/rest/v1/profiles?user_id=eq.${encodeURIComponent(user.id)}&select=display_name,username,avatar_url&limit=1`,
        { headers: { apikey: PUBLISHABLE_KEY, authorization: `Bearer ${session.access_token}`, accept: "application/json" } },
      );
      const rows = res.ok ? await res.json() : [];
      const p = rows?.[0] || {};
      user.name = p.display_name || p.username || user.email.split("@")[0] || "Hráč";
      user.avatar = /^https:\/\//.test(p.avatar_url || "") ? p.avatar_url : "";
    } catch {
      if (!user.name) user.name = user.email.split("@")[0] || "Hráč";
    }
  }

  async function refresh(refreshToken) {
    const r = await call(`${SUPABASE}/auth/v1/token?grant_type=refresh_token`, { refresh_token: refreshToken });
    if (!r.ok) {
      const err = new Error(r.data?.error_description || r.data?.msg || `HTTP ${r.status}`);
      err.invalid = r.status >= 400 && r.status < 500;
      throw err;
    }
    await adoptSession(r.data);
  }

  /** Platný přístupový token (obnoví se minutu před vypršením). */
  async function accessToken() {
    if (!session) {
      const stored = loadStored();
      if (!stored?.refresh_token) return null;
      await refresh(stored.refresh_token);
    } else if (session.expires_at - 60 < Date.now() / 1000) {
      await refresh(session.refresh_token);
    }
    return session?.access_token || null;
  }

  // ------------------------------------------------------------------ start launcheru
  async function init() {
    const stored = loadStored();
    if (stored?.refresh_token) {
      user = stored.user || null;
      restoring = true;
      emit();
      try {
        await refresh(stored.refresh_token);
        log(`Účet: obnoveno přihlášení ${user?.name || ""}`);
      } catch (e) {
        if (e.invalid) {
          log(`Účet: přihlášení vypršelo (${e.message})`);
          forget();
          lastError = "Přihlášení vypršelo – přihlas se prosím znovu.";
        } else {
          // bez internetu: ukážeme poslední známý účet, obnovíme později
          offline = Boolean(user);
          log(`Účet: offline (${e?.message || e})`);
        }
      }
      restoring = false;
    }
    emit();
    return status();
  }

  // ------------------------------------------------------------------ přihlášení v prohlížeči
  function page(title, text, ok) {
    const color = ok ? "#d9a54a" : "#c46a5a";
    return `<!doctype html><html lang="cs"><head><meta charset="utf-8"><title>Ashes of Eryon</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:radial-gradient(circle at 50% 30%,#2a1c14,#0b0908 70%);color:#efe3cf;font:16px/1.5 Georgia,serif}
.card{max-width:440px;padding:40px 44px;border:1px solid #5a4330;border-radius:14px;background:rgba(20,14,11,.85);text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6)}
h1{margin:0 0 10px;font-size:24px;letter-spacing:.06em;color:${color}}p{margin:0;color:#c9b89d}small{display:block;margin-top:22px;color:#7d6c58;font-size:12px;letter-spacing:.2em}</style></head>
<body><div class="card"><h1>${title}</h1><p>${text}</p><small>ASHES OF ERYON · STUDIOVOXARIO</small></div></body></html>`;
  }

  function cancel() {
    if (!pending) return status();
    pending.finish(new Error("cancelled"));
    return status();
  }

  function signIn() {
    if (pending) {
      void shell.openExternal(pending.url);
      return status();
    }
    lastError = null;
    const verifier = b64url(crypto.randomBytes(32));
    const challenge = b64url(crypto.createHash("sha256").update(verifier).digest());
    const state = b64url(crypto.randomBytes(24));
    let finished = false;

    const server = http.createServer(async (req, res) => {
      const reqUrl = new URL(req.url || "/", "http://127.0.0.1");
      if (reqUrl.pathname !== "/callback" || reqUrl.searchParams.get("state") !== state || finished) {
        res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        res.end("Nenalezeno");
        return;
      }
      const code = reqUrl.searchParams.get("code");
      if (!code) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(page("Přihlášení zamítnuto", "Launcher přihlášený nebyl. Tohle okno můžeš zavřít.", false));
        finish(new Error("denied"));
        return;
      }
      try {
        const r = await fn({ action: "redeem", code, verifier, device: deviceName() });
        if (!r.ok || !r.data?.token_hash) throw new Error(r.data?.error || "Kód se nepodařilo ověřit.");
        const v = await call(`${SUPABASE}/auth/v1/verify`, { type: "magiclink", token_hash: r.data.token_hash });
        if (!v.ok) throw new Error(v.data?.msg || v.data?.error_description || "Server přihlášení odmítl.");
        await adoptSession(v.data);
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(page("Launcher je přihlášený", "Vrať se do launcheru Ashes of Eryon – tohle okno můžeš zavřít.", true));
        log(`Účet: přihlášen ${user?.name || ""}`);
        finish(null);
      } catch (e) {
        res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        res.end(page("Přihlášení se nepovedlo", "Zkus to v launcheru znovu. Pokud to nepomůže, napiš nám ticket.", false));
        finish(e);
      }
    });

    const timer = setTimeout(() => finish(new Error("timeout")), SIGN_IN_TIMEOUT_MS);
    function finish(error) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      setTimeout(() => server.close(), 1500);
      pending = null;
      if (error) {
        const m = error.message;
        lastError = m === "cancelled" ? null
          : m === "denied" ? "Přihlášení bylo v prohlížeči zamítnuto."
          : m === "timeout" ? "Přihlášení vypršelo – zkus to znovu."
          : m;
        if (m !== "cancelled") log(`Účet: přihlášení selhalo (${m})`);
      }
      emit();
    }

    server.on("error", (e) => finish(e));
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      const url = `${webOrigin}/game/auth/launcher?state=${state}&challenge=${challenge}&port=${port}&device=${encodeURIComponent(deviceName())}`;
      pending = { url, finish };
      void shell.openExternal(url);
      emit();
    });
    return { ...status(), pending: true };
  }

  function deviceName() {
    const host = String(os.hostname() || "").replace(/[^\w\- ]/g, "").slice(0, 40);
    return host ? `Windows · ${host}` : "Windows";
  }

  async function signOut() {
    const token = session?.access_token;
    forget();
    lastError = null;
    emit();
    if (token) {
      try { await call(`${SUPABASE}/auth/v1/logout?scope=local`, {}, token); } catch {}
    }
    log("Účet: odhlášen");
    return status();
  }

  /** Jednorázový lístek pro hru (token_hash), hra si z něj vytvoří vlastní relaci. */
  async function gameTicket() {
    try {
      const token = await accessToken();
      if (!token) return null;
      const r = await fn({ action: "ticket", device: deviceName() }, token);
      return r.ok ? r.data?.token_hash || null : null;
    } catch (e) {
      if (e?.invalid) {
        forget();
        lastError = "Přihlášení vypršelo – přihlas se prosím znovu.";
        emit();
      }
      log(`Účet: lístek pro hru se nepodařil (${e?.message || e})`);
      return null;
    }
  }

  async function retryOffline() {
    if (!offline) return;
    try {
      await accessToken();
      emit();
    } catch (e) {
      if (e?.invalid) { forget(); emit(); }
    }
  }

  return { init, status, signIn, cancel, signOut, gameTicket, retryOffline, accessToken };
}

module.exports = { createAuth };

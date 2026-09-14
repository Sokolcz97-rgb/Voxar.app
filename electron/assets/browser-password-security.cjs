"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const VAULT_VERSION = 2;
const WORLD_ID = 12026;
const DEFAULT_PASSWORD_PREFS = Object.freeze({
  autofillPasswords: true,
  requireWindowsHelloForAutofill: true,
  suggestStrongPasswords: true,
  helloGraceSeconds: 300,
  generatedPasswordLength: 22,
});

function normalizeOrigin(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  let candidate = raw;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) candidate = `https://${candidate}`;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.toLowerCase().replace(/\.$/, "");
    if (!host) return null;
    const port = url.port ? `:${url.port}` : "";
    return `${url.protocol}//${host}${port}`;
  } catch {
    return null;
  }
}

function isSecureAutofillOrigin(origin) {
  try {
    const url = new URL(origin);
    if (url.protocol === "https:") return true;
    if (url.protocol !== "http:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]";
  } catch {
    return false;
  }
}

function parseCsv(text) {
  const source = String(text || "").replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field.length || row.length) {
    row.push(field.replace(/\r$/, ""));
    rows.push(row);
  }
  return rows.filter((r) => r.some((v) => String(v).trim() !== ""));
}

function csvCredentials(text, source = "csv") {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const headers = rows[0].map((v) => String(v).trim().toLowerCase());
  const column = (...names) => headers.findIndex((h) => names.includes(h));
  const urlIndex = column("url", "website", "origin", "login_uri", "login url");
  const usernameIndex = column("username", "user", "login_username", "login username", "email");
  const passwordIndex = column("password", "pass", "login_password", "login password");
  if (urlIndex < 0 || usernameIndex < 0 || passwordIndex < 0) return [];
  const output = [];
  for (const values of rows.slice(1, 50001)) {
    const origin = normalizeOrigin(values[urlIndex]);
    const username = String(values[usernameIndex] || "").trim();
    const password = String(values[passwordIndex] || "");
    if (!origin || !username || !password) continue;
    output.push({ origin, username, password, source });
  }
  return output;
}

function randomChoice(chars) {
  return chars[crypto.randomInt(0, chars.length)];
}

function secureShuffle(values) {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = crypto.randomInt(0, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function generateStrongPassword(length = 22) {
  const target = Math.max(16, Math.min(64, Number(length) || 22));
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const symbols = "!@#$%^&*()-_=+[]{}:,.?";
  const all = lower + upper + digits + symbols;
  const chars = [randomChoice(lower), randomChoice(upper), randomChoice(digits), randomChoice(symbols)];
  while (chars.length < target) chars.push(randomChoice(all));
  return secureShuffle(chars).join("");
}

function rendererPasswordManager() {
  if (window.__voxarioSecurePasswordUiV1) {
    window.__voxarioSecurePasswordUiV1.refresh?.();
    return;
  }
  const { ipcRenderer } = require("electron");
  const section = document.querySelector('.sec[data-sec="vault"]');
  if (!section) return;

  const style = document.createElement("style");
  style.id = "voxarioPasswordSecurityStyle";
  style.textContent = `
    .vbs-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.vbs-card{border:1px solid var(--line);background:rgba(7,13,24,.75);padding:12px}.vbs-card strong{display:block;margin-top:4px;color:var(--text);font-size:12px}.vbs-card small{color:#64748b;font-size:9px;letter-spacing:.08em}.vbs-card p{color:var(--muted);font-size:10px;line-height:1.5;margin:7px 0 0}.vbs-good{color:#6ee7b7!important}.vbs-warn{color:var(--gold)!important}.vbs-bad{color:#f87171!important}.vbs-line{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:10px}.vbs-field{background:#060b14;border:1px solid var(--line);color:var(--text);padding:8px 10px;min-width:180px;outline:none}.vbs-field:focus{border-color:rgba(34,211,238,.65)}.vbs-list{display:grid;gap:7px;margin-top:10px}.vbs-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;padding:10px;border:1px solid var(--line);background:rgba(5,9,16,.65)}.vbs-row strong{font-size:11px}.vbs-row span{display:block;color:#64748b;font-size:10px;margin-top:3px;overflow-wrap:anywhere}.vbs-actions{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.vbs-chip{display:inline-flex;align-items:center;padding:3px 7px;border:1px solid rgba(34,211,238,.28);color:#67e8f9;font-size:9px}.vbs-secret{font-family:ui-monospace,Consolas,monospace;color:#d9f99d!important;word-break:break-all}.vbs-toggle{display:flex;justify-content:space-between;gap:14px;align-items:center;padding:9px 0;border-bottom:1px dashed rgba(30,41,59,.9)}.vbs-toggle input{width:18px;height:18px;accent-color:#22d3ee}.vbs-note{color:#94a3b8;font-size:10px;line-height:1.55;margin-top:10px}.vbs-note b{color:#e2e8f0}@media(max-width:900px){.vbs-grid{grid-template-columns:1fr}.vbs-row{grid-template-columns:1fr}.vbs-actions{justify-content:flex-start}}
  `;
  document.head.appendChild(style);

  section.innerHTML = `
    <div class="card">
      <h3>Voxario Secure Vault</h3>
      <div class="vbs-grid">
        <div class="vbs-card"><small>ŠIFROVÁNÍ</small><strong id="vbsEncryption">ověřuji…</strong><p>AES-256-GCM; hlavní klíč je zabalený přes Windows DPAPI. Hesla, weby ani uživatelská jména nejsou ve vault souboru v plaintextu.</p></div>
        <div class="vbs-card"><small>WINDOWS HELLO</small><strong id="vbsHello">ověřuji…</strong><p>Zobrazení a kopírování hesla vždy vyžaduje ověření Windows. Autofill má ve výchozím stavu stejnou ochranu s krátkou per-site relací.</p></div>
        <div class="vbs-card"><small>LOKÁLNÍ OCHRANA</small><strong id="vbsLocal">pouze zařízení</strong><p>Vault se nesynchronizuje do GitHubu ani do webu. Soubory dostávají omezená oprávnění jen pro aktuální účet a SYSTEM.</p></div>
      </div>
      <div class="vbs-note" id="vbsStatusNote">Načítám stav zabezpečení…</div>
    </div>

    <div class="card">
      <h3>Automatické přihlášení</h3>
      <label class="vbs-toggle"><span><b>Předvyplňovat login a heslo</b><small class="dsc">Jen pro přesně odpovídající HTTPS doménu. Formulář se nikdy automaticky neodesílá.</small></span><input id="vbsAutofill" type="checkbox"></label>
      <label class="vbs-toggle"><span><b>Windows Hello před autofillem</b><small class="dsc">Doporučeno. Po ověření platí krátká autorizace jen pro konkrétní web.</small></span><input id="vbsAutofillHello" type="checkbox"></label>
      <label class="vbs-toggle"><span><b>Nabízet silné heslo</b><small class="dsc">Na registračních / změnových formulářích se zobrazí malá nabídka VoxarioBrowseru. Použití je vždy ruční.</small></span><input id="vbsSuggest" type="checkbox"></label>
    </div>

    <div class="card">
      <h3>Import z jiného prohlížeče</h3>
      <div class="row">
        <button class="pbtn" id="vbsImportEdge">Importovat z Microsoft Edge (CSV)</button>
        <button class="pbtn" id="vbsImportOpera">Importovat z Opera GX (CSV)</button>
      </div>
      <div class="vbs-note"><b>Bezpečný způsob importu:</b> používá oficiální CSV export správce hesel Edge/Opera GX. VoxarioBrowser záměrně neobchází jejich šifrovanou databázi Login Data. Po úspěšném importu nabídne smazání plaintextového CSV.</div>
    </div>

    <div class="card">
      <h3>Přidat / aktualizovat přihlášení</h3>
      <div class="vbs-line">
        <input class="vbs-field" id="vbsOrigin" placeholder="https://example.com" />
        <input class="vbs-field" id="vbsUsername" placeholder="uživatelské jméno / e-mail" />
        <input class="vbs-field" id="vbsPassword" type="password" placeholder="heslo" />
        <button class="pbtn" id="vbsGenerate">Navrhnout silné heslo</button>
        <button class="pbtn gold" id="vbsSave">Uložit do Secure Vault</button>
      </div>
      <div class="vbs-note" id="vbsManualNote">Generované heslo používá kryptografický generátor a minimálně 16 znaků.</div>
    </div>

    <div class="card">
      <h3>Uložená přihlášení</h3>
      <div class="vbs-line"><span class="vbs-chip" id="vbsCount">0 záznamů</span><button class="pbtn" id="vbsRefresh">Obnovit</button></div>
      <div class="vbs-list" id="vbsList"></div>
      <div class="vbs-note">Zobrazení hesla se po 15 sekundách automaticky zase skryje. Kopírování po Windows Hello vyčistí schránku po 45 sekundách, pokud v ní stále zůstává stejné heslo.</div>
    </div>
  `;

  const q = (id) => document.getElementById(id);
  let prefs = {};
  let revealTimers = new Map();

  async function refreshStatus() {
    const status = await ipcRenderer.invoke("vbs:status");
    q("vbsEncryption").textContent = status?.encryptionAvailable ? "AES-256-GCM + Windows DPAPI" : "Nedostupné — vault je zamčený";
    q("vbsEncryption").className = status?.encryptionAvailable ? "vbs-good" : "vbs-bad";
    q("vbsHello").textContent = status?.hello?.available ? "Windows Hello / PIN dostupné" : `Nedostupné${status?.hello?.reason ? ` · ${status.hello.reason}` : ""}`;
    q("vbsHello").className = status?.hello?.available ? "vbs-good" : "vbs-warn";
    q("vbsLocal").textContent = status?.fileAcl ? "ACL omezené na uživatele" : "Lokální šifrování aktivní";
    q("vbsStatusNote").textContent = status?.legacyPending
      ? "Starší vault nebylo možné kompletně migrovat. Původní soubor nebyl smazán, aby nedošlo ke ztrátě hesel."
      : "Secure Vault je oddělený od repozitáře a od exportu nastavení. Git commit ani GitHub release neobsahuje uživatelská hesla.";
  }

  async function refreshPrefs() {
    prefs = await ipcRenderer.invoke("vbs:prefs:get") || {};
    q("vbsAutofill").checked = prefs.autofillPasswords !== false;
    q("vbsAutofillHello").checked = prefs.requireWindowsHelloForAutofill !== false;
    q("vbsSuggest").checked = prefs.suggestStrongPasswords !== false;
  }

  async function setPref(key, value) {
    prefs = await ipcRenderer.invoke("vbs:prefs:set", { [key]: value }) || prefs;
  }

  q("vbsAutofill").onchange = (e) => setPref("autofillPasswords", e.target.checked);
  q("vbsAutofillHello").onchange = (e) => setPref("requireWindowsHelloForAutofill", e.target.checked);
  q("vbsSuggest").onchange = (e) => setPref("suggestStrongPasswords", e.target.checked);

  async function refreshList() {
    const items = await ipcRenderer.invoke("vbs:vault:list") || [];
    q("vbsCount").textContent = `${items.length} záznamů`;
    const list = q("vbsList");
    list.replaceChildren();
    if (!items.length) {
      const empty = document.createElement("div");
      empty.className = "pnote";
      empty.textContent = "Secure Vault je zatím prázdný.";
      list.appendChild(empty);
      return;
    }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "vbs-row";
      const copy = document.createElement("div");
      const title = document.createElement("strong");
      title.textContent = `${item.origin} — ${item.username}`;
      const sub = document.createElement("span");
      sub.textContent = `•••••••• · ${item.source || "VoxarioBrowser"} · ${new Date(item.at || Date.now()).toLocaleString("cs-CZ")}`;
      copy.append(title, sub);
      const actions = document.createElement("div");
      actions.className = "vbs-actions";
      const reveal = document.createElement("button");
      reveal.className = "mini";
      reveal.textContent = "Zobrazit · Hello";
      reveal.onclick = async () => {
        reveal.disabled = true;
        try {
          const result = await ipcRenderer.invoke("vbs:vault:reveal", item.id);
          if (!result?.ok) {
            sub.textContent = result?.error || "Ověření selhalo.";
            sub.className = "vbs-bad";
            return;
          }
          sub.textContent = result.password;
          sub.className = "vbs-secret";
          clearTimeout(revealTimers.get(item.id));
          revealTimers.set(item.id, setTimeout(() => {
            sub.textContent = `•••••••• · ${item.source || "VoxarioBrowser"}`;
            sub.className = "";
          }, 15000));
        } finally {
          reveal.disabled = false;
        }
      };
      const clip = document.createElement("button");
      clip.className = "mini";
      clip.textContent = "Kopírovat · Hello";
      clip.onclick = async () => {
        clip.disabled = true;
        try {
          const result = await ipcRenderer.invoke("vbs:vault:copy", item.id);
          q("vbsStatusNote").textContent = result?.ok ? "Heslo bylo po ověření zkopírováno. Schránka se automaticky vyčistí." : (result?.error || "Kopírování selhalo.");
        } finally { clip.disabled = false; }
      };
      const del = document.createElement("button");
      del.className = "mini dang";
      del.textContent = "Smazat · Hello";
      del.onclick = async () => {
        del.disabled = true;
        try {
          const result = await ipcRenderer.invoke("vbs:vault:delete", item.id);
          q("vbsStatusNote").textContent = result?.ok ? "Přihlášení bylo odstraněno." : (result?.error || "Smazání selhalo.");
          if (result?.ok) await refreshList();
        } finally { del.disabled = false; }
      };
      actions.append(reveal, clip, del);
      row.append(copy, actions);
      list.appendChild(row);
    }
  }

  q("vbsRefresh").onclick = () => { refreshStatus(); refreshList(); };
  q("vbsGenerate").onclick = async () => {
    const result = await ipcRenderer.invoke("vbs:generate");
    if (!result?.ok) return;
    q("vbsPassword").value = result.password;
    q("vbsPassword").type = "text";
    q("vbsManualNote").textContent = `Vygenerováno ${result.password.length} znaků. Po uložení se pole vymaže.`;
    setTimeout(() => { if (q("vbsPassword").value) q("vbsPassword").type = "password"; }, 12000);
  };
  q("vbsSave").onclick = async () => {
    const origin = q("vbsOrigin").value.trim();
    const username = q("vbsUsername").value.trim();
    const password = q("vbsPassword").value;
    if (!origin || !username || !password) {
      q("vbsManualNote").textContent = "Vyplň web, uživatelské jméno i heslo.";
      return;
    }
    const result = await ipcRenderer.invoke("vbs:vault:save", { origin, username, password, source: "manual" });
    q("vbsManualNote").textContent = result?.ok ? "Přihlášení je uložené v Secure Vaultu." : (result?.error || "Uložení selhalo.");
    if (result?.ok) {
      q("vbsOrigin").value = "";
      q("vbsUsername").value = "";
      q("vbsPassword").value = "";
      q("vbsPassword").type = "password";
      await refreshList();
    }
  };

  async function doImport(source) {
    const result = await ipcRenderer.invoke("vbs:vault:import-csv", source);
    q("vbsStatusNote").textContent = result?.ok
      ? `Import dokončen: ${result.imported} přihlášení, ${result.updated} aktualizováno.${result.sourceDeleted ? " Zdrojové CSV bylo smazáno." : ""}`
      : (result?.canceled ? "Import zrušen." : (result?.error || "Import selhal."));
    if (result?.ok) await refreshList();
  }
  q("vbsImportEdge").onclick = () => doImport("edge");
  q("vbsImportOpera").onclick = () => doImport("opera-gx");

  async function refresh() {
    await Promise.all([refreshPrefs(), refreshStatus(), refreshList()]);
  }
  window.__voxarioSecurePasswordUiV1 = { refresh };
  refresh().catch(() => {});
}

function installBrowserPasswordSecurity() {
  if (process.argv.slice(1).includes("--protect-background")) return;
  if (global.__VOXARIO_BROWSER_PASSWORD_SECURITY_V1__) return;
  global.__VOXARIO_BROWSER_PASSWORD_SECURITY_V1__ = true;

  const electron = require("electron");
  const { app, ipcMain, dialog, BrowserWindow, safeStorage, clipboard, session } = electron;
  const vaultPath = () => path.join(app.getPath("userData"), "browser-secure-vault.v2.json");
  const keyPath = () => path.join(app.getPath("userData"), "browser-secure-vault.key.json");
  const legacyPath = () => path.join(app.getPath("userData"), "browser-vault.json");
  const prefsPath = () => path.join(app.getPath("userData"), "browser-password-prefs.json");
  let cachedKey = null;
  let currentSid = null;
  let fileAclApplied = false;
  let legacyPending = false;
  let helloStatusCache = null;
  let helloStatusAt = 0;
  const helloGrants = new Map();
  const guests = new Map();

  function encryptionAvailable() {
    try {
      if (!safeStorage.isEncryptionAvailable()) return false;
      if (process.platform === "linux" && typeof safeStorage.getSelectedStorageBackend === "function") {
        return safeStorage.getSelectedStorageBackend() !== "basic_text";
      }
      return true;
    } catch {
      return false;
    }
  }

  function getSid() {
    if (currentSid !== null) return currentSid;
    currentSid = "";
    if (process.platform !== "win32") return currentSid;
    try {
      const out = spawnSync("whoami.exe", ["/user", "/fo", "csv", "/nh"], { encoding: "utf8", windowsHide: true, timeout: 3000 });
      const match = String(out.stdout || "").match(/S-1-[0-9-]+/);
      currentSid = match ? match[0] : "";
    } catch {}
    return currentSid;
  }

  function hardenFile(file) {
    try { fs.chmodSync(file, 0o600); } catch {}
    if (process.platform !== "win32") return;
    const sid = getSid();
    if (!sid) return;
    try {
      const result = spawnSync("icacls.exe", [file, "/inheritance:r", "/grant:r", `*${sid}:(F)`, "*S-1-5-18:(F)"], {
        encoding: "utf8",
        windowsHide: true,
        timeout: 5000,
      });
      if (result.status === 0) fileAclApplied = true;
    } catch {}
  }

  function secureWrite(file, value) {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp-${process.pid}-${crypto.randomBytes(4).toString("hex")}`;
    fs.writeFileSync(tmp, JSON.stringify(value, null, 2), { encoding: "utf8", mode: 0o600 });
    hardenFile(tmp);
    try {
      fs.renameSync(tmp, file);
    } catch {
      try { fs.rmSync(file, { force: true }); } catch {}
      fs.renameSync(tmp, file);
    }
    hardenFile(file);
  }

  function readJson(file, fallback) {
    try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
  }

  function loadPasswordPrefs() {
    const stored = readJson(prefsPath(), {});
    return { ...DEFAULT_PASSWORD_PREFS, ...(stored && typeof stored === "object" ? stored : {}) };
  }

  function savePasswordPrefs(patch) {
    const current = loadPasswordPrefs();
    const next = {
      ...current,
      ...(patch && typeof patch === "object" ? patch : {}),
    };
    next.autofillPasswords = next.autofillPasswords !== false;
    next.requireWindowsHelloForAutofill = next.requireWindowsHelloForAutofill !== false;
    next.suggestStrongPasswords = next.suggestStrongPasswords !== false;
    next.helloGraceSeconds = Math.max(0, Math.min(1800, Number(next.helloGraceSeconds) || 300));
    next.generatedPasswordLength = Math.max(16, Math.min(64, Number(next.generatedPasswordLength) || 22));
    secureWrite(prefsPath(), next);
    return next;
  }

  function getMasterKey() {
    if (cachedKey) return cachedKey;
    if (!encryptionAvailable()) throw new Error("Bezpečné úložiště Windows není dostupné. Secure Vault zůstává zamčený.");
    const keyFile = readJson(keyPath(), null);
    if (keyFile?.version === 1 && typeof keyFile.wrappedKey === "string") {
      const raw = safeStorage.decryptString(Buffer.from(keyFile.wrappedKey, "base64"));
      const key = Buffer.from(raw, "base64");
      if (key.length !== 32) throw new Error("Klíč Secure Vaultu má neplatný formát.");
      cachedKey = key;
      hardenFile(keyPath());
      return cachedKey;
    }
    const key = crypto.randomBytes(32);
    const wrappedKey = safeStorage.encryptString(key.toString("base64")).toString("base64");
    secureWrite(keyPath(), { version: 1, wrappedKey, provider: process.platform === "win32" ? "windows-dpapi" : "os-safe-storage", createdAt: Date.now() });
    cachedKey = key;
    return cachedKey;
  }

  function readVaultFile() {
    const value = readJson(vaultPath(), null);
    if (!value || value.version !== VAULT_VERSION || !Array.isArray(value.entries)) {
      return { version: VAULT_VERSION, entries: [], updatedAt: Date.now() };
    }
    return value;
  }

  function writeVaultFile(vault) {
    secureWrite(vaultPath(), { version: VAULT_VERSION, entries: Array.isArray(vault.entries) ? vault.entries : [], updatedAt: Date.now() });
  }

  function lookupTag(origin, key = getMasterKey()) {
    return crypto.createHmac("sha256", key).update(`origin\0${origin}`, "utf8").digest("base64url");
  }

  function encryptPayload(payload, metadata, key = getMasterKey()) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    const aad = Buffer.from(`${metadata.id}|${metadata.lookup}|${metadata.at}`, "utf8");
    cipher.setAAD(aad);
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    return {
      alg: "AES-256-GCM",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: ciphertext.toString("base64"),
    };
  }

  function decryptEntry(entry, key = getMasterKey()) {
    if (!entry?.secret || entry.secret.alg !== "AES-256-GCM") throw new Error("Neplatný šifrovaný záznam.");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(entry.secret.iv, "base64"));
    decipher.setAAD(Buffer.from(`${entry.id}|${entry.lookup}|${entry.at}`, "utf8"));
    decipher.setAuthTag(Buffer.from(entry.secret.tag, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(entry.secret.data, "base64")), decipher.final()]).toString("utf8");
    const value = JSON.parse(plain);
    if (!value?.origin || !value?.username || typeof value.password !== "string") throw new Error("Neplatný obsah šifrovaného záznamu.");
    return value;
  }

  function upsertCredential({ origin, username, password, source = "VoxarioBrowser" }) {
    const normalized = normalizeOrigin(origin);
    const cleanUser = String(username || "").trim();
    const cleanPassword = String(password || "");
    if (!normalized || !cleanUser || !cleanPassword) return { ok: false, error: "Chybí web, uživatelské jméno nebo heslo." };
    if (!encryptionAvailable()) return { ok: false, error: "Bezpečné úložiště Windows není dostupné; heslo nebude uloženo v plaintextu." };
    const key = getMasterKey();
    const vault = readVaultFile();
    const lookup = lookupTag(normalized, key);
    let existingIndex = -1;
    for (let i = 0; i < vault.entries.length; i += 1) {
      if (vault.entries[i]?.lookup !== lookup) continue;
      try {
        const plain = decryptEntry(vault.entries[i], key);
        if (plain.username === cleanUser) { existingIndex = i; break; }
      } catch {}
    }
    const now = Date.now();
    const id = existingIndex >= 0 ? vault.entries[existingIndex].id : crypto.randomUUID();
    const metadata = { id, lookup, at: now };
    const payload = { origin: normalized, username: cleanUser, password: cleanPassword, source: String(source || "VoxarioBrowser").slice(0, 40) };
    const record = { ...metadata, secret: encryptPayload(payload, metadata, key) };
    if (existingIndex >= 0) vault.entries[existingIndex] = record; else vault.entries.push(record);
    writeVaultFile(vault);
    return { ok: true, updated: existingIndex >= 0, id };
  }

  function listCredentials() {
    if (!encryptionAvailable()) return [];
    let key;
    try { key = getMasterKey(); } catch { return []; }
    const items = [];
    for (const entry of readVaultFile().entries) {
      try {
        const plain = decryptEntry(entry, key);
        items.push({ id: entry.id, origin: plain.origin, username: plain.username, source: plain.source || "VoxarioBrowser", at: entry.at });
      } catch {}
    }
    return items.sort((a, b) => Number(b.at || 0) - Number(a.at || 0));
  }

  function findCredential(origin, usernameHint = "") {
    if (!encryptionAvailable()) return null;
    const normalized = normalizeOrigin(origin);
    if (!normalized) return null;
    const key = getMasterKey();
    const lookup = lookupTag(normalized, key);
    const matches = [];
    for (const entry of readVaultFile().entries) {
      if (entry?.lookup !== lookup) continue;
      try {
        const plain = decryptEntry(entry, key);
        matches.push({ entry, plain });
      } catch {}
    }
    if (!matches.length) return null;
    const hint = String(usernameHint || "").trim().toLowerCase();
    const exact = hint ? matches.find((m) => m.plain.username.toLowerCase() === hint) : null;
    return exact || matches.sort((a, b) => Number(b.entry.at || 0) - Number(a.entry.at || 0))[0];
  }

  function credentialById(id) {
    if (!encryptionAvailable()) return null;
    const entry = readVaultFile().entries.find((item) => item?.id === id);
    if (!entry) return null;
    try { return { entry, plain: decryptEntry(entry) }; } catch { return null; }
  }

  function deleteCredential(id) {
    const vault = readVaultFile();
    const next = vault.entries.filter((entry) => entry?.id !== id);
    if (next.length === vault.entries.length) return false;
    vault.entries = next;
    writeVaultFile(vault);
    return true;
  }

  function migrateLegacyVault() {
    legacyPending = false;
    if (!encryptionAvailable()) return;
    const legacy = readJson(legacyPath(), []);
    if (!Array.isArray(legacy) || !legacy.length) return;
    let failed = 0;
    for (const rec of legacy) {
      try {
        const password = rec?.enc
          ? safeStorage.decryptString(Buffer.from(String(rec.password || ""), "base64"))
          : String(rec?.password || "");
        const result = upsertCredential({ origin: rec?.origin, username: rec?.username, password, source: "legacy-vault" });
        if (!result.ok) failed += 1;
      } catch { failed += 1; }
    }
    if (failed === 0) {
      secureWrite(legacyPath(), []);
    } else {
      legacyPending = true;
      hardenFile(legacyPath());
    }
  }

  const HELLO_SCRIPT = String.raw`
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
function Await-WinRt($Operation, [Type]$ResultType) {
  $method = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.IsGenericMethod -and $_.GetParameters().Count -eq 1 } | Select-Object -First 1
  if ($null -eq $method) { throw 'WinRT AsTask helper is unavailable' }
  $task = $method.MakeGenericMethod($ResultType).Invoke($null, @($Operation))
  $task.Wait()
  return $task.Result
}
$availability = Await-WinRt ([Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync()) ([Windows.Security.Credentials.UI.UserConsentVerifierAvailability])
if ($env:VOXARIO_HELLO_CHECK -eq '1') { Write-Output ('AVAILABILITY=' + $availability); exit 0 }
if ($availability -ne [Windows.Security.Credentials.UI.UserConsentVerifierAvailability]::Available) { Write-Output ('UNAVAILABLE=' + $availability); exit 3 }
$result = Await-WinRt ([Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync($env:VOXARIO_HELLO_MESSAGE)) ([Windows.Security.Credentials.UI.UserConsentVerificationResult])
Write-Output ('RESULT=' + $result)
if ($result -eq [Windows.Security.Credentials.UI.UserConsentVerificationResult]::Verified) { exit 0 }
exit 4
`;

  function runHello({ checkOnly = false, message = "Ověřit přístup k heslům VoxarioBrowseru" } = {}) {
    if (process.platform !== "win32") return Promise.resolve({ ok: false, available: false, reason: "Windows Hello je dostupné jen ve Windows." });
    return new Promise((resolve) => {
      const child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-Sta", "-Command", HELLO_SCRIPT], {
        windowsHide: true,
        env: {
          ...process.env,
          VOXARIO_HELLO_CHECK: checkOnly ? "1" : "0",
          VOXARIO_HELLO_MESSAGE: String(message || "Ověřit přístup k heslům VoxarioBrowseru").slice(0, 180),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => { try { child.kill(); } catch {} }, checkOnly ? 8000 : 90000);
      child.stdout.on("data", (chunk) => { stdout += String(chunk); });
      child.stderr.on("data", (chunk) => { stderr += String(chunk); });
      child.once("error", (error) => {
        clearTimeout(timer);
        resolve({ ok: false, available: false, reason: String(error?.message || error) });
      });
      child.once("close", (code) => {
        clearTimeout(timer);
        const availability = /AVAILABILITY=([^\r\n]+)/i.exec(stdout)?.[1]?.trim();
        if (checkOnly) {
          const available = /^Available$/i.test(availability || "");
          resolve({ ok: available, available, reason: available ? "" : (availability || "Windows Hello není nakonfigurované.") });
          return;
        }
        const verified = code === 0 && /RESULT=Verified/i.test(stdout);
        const unavailable = /UNAVAILABLE=([^\r\n]+)/i.exec(stdout)?.[1]?.trim();
        resolve({ ok: verified, available: !unavailable, reason: verified ? "" : (unavailable || (stderr.trim() ? "Ověření Windows se nepodařilo spustit." : "Ověření bylo zrušeno nebo zamítnuto.")) });
      });
    });
  }

  async function helloAvailability() {
    const now = Date.now();
    if (helloStatusCache && now - helloStatusAt < 60000) return helloStatusCache;
    helloStatusCache = await runHello({ checkOnly: true });
    helloStatusAt = now;
    return helloStatusCache;
  }

  async function verifyHello(message) {
    const result = await runHello({ message });
    if (!result.ok) return { ok: false, error: result.reason || "Windows Hello ověření selhalo." };
    return { ok: true };
  }

  async function authorizeAutofill(origin) {
    const prefs = loadPasswordPrefs();
    if (!prefs.requireWindowsHelloForAutofill) return { ok: true };
    const now = Date.now();
    const grant = helloGrants.get(origin) || 0;
    if (grant > now) return { ok: true, cached: true };
    const verified = await verifyHello(`VoxarioBrowser chce předvyplnit uložené přihlášení pro ${new URL(origin).hostname}`);
    if (!verified.ok) return verified;
    helloGrants.set(origin, now + prefs.helloGraceSeconds * 1000);
    return { ok: true };
  }

  function ownerFor(contents) {
    try {
      if (contents?.hostWebContents) return BrowserWindow.fromWebContents(contents.hostWebContents);
      return BrowserWindow.fromWebContents(contents);
    } catch { return undefined; }
  }

  function browserUiWindow(win) {
    try {
      const url = win.webContents.getURL();
      return /\/browser\.html(?:$|[?#])/i.test(url) || /VoxarioBrowser/i.test(win.getTitle());
    } catch { return false; }
  }

  function injectBrowserUi(win) {
    if (!win || win.isDestroyed()) return;
    if (!browserUiWindow(win)) return;
    win.webContents.executeJavaScript(`(${rendererPasswordManager.toString()})()`, true).catch(() => {});
  }

  function registerBrowserUi(win) {
    if (!win || win.isDestroyed() || win.__voxarioPasswordUiBound) return;
    win.__voxarioPasswordUiBound = true;
    const inject = () => injectBrowserUi(win);
    win.webContents.on("did-finish-load", inject);
    win.on("ready-to-show", inject);
    setTimeout(inject, 500).unref?.();
    setTimeout(inject, 1500).unref?.();
  }

  function senderIsBrowserUi(event) {
    try {
      const url = event.sender.getURL();
      return /\/browser\.html(?:$|[?#])/i.test(url);
    } catch { return false; }
  }

  function guestOrigin(contents) {
    try {
      if (contents.getType?.() !== "webview") return null;
      const url = new URL(contents.getURL());
      if (!/^https?:$/.test(url.protocol)) return null;
      return url.origin;
    } catch { return null; }
  }

  function guestSnapshotCode() {
    return `(() => {
      if (window.top !== window) return { hasPassword:false, focused:false, submitTick:0 };
      const visible = (el) => !!el && !el.disabled && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const passwords = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible);
      const passwordField = passwords.find((el) => el.value) || passwords[0] || null;
      const form = passwordField?.form || passwordField?.closest?.('form') || null;
      const scope = form || document;
      const users = Array.from(scope.querySelectorAll('input')).filter((el) => visible(el) && el.type !== 'password');
      const usernameField = users.find((el) => /username/i.test(el.autocomplete || '')) || users.find((el) => el.type === 'email') || users.find((el) => /user|login|email|mail/i.test((el.name || '') + ' ' + (el.id || ''))) || users.find((el) => ['text','email'].includes(el.type));
      return {
        hasPassword: !!passwordField,
        focused: document.hasFocus(),
        username: String(usernameField?.value || '').slice(0, 320),
        password: String(passwordField?.value || '').slice(0, 4096),
        submitTick: Number(window.__voxarioSecureSubmitTick || 0),
        generatedTick: Number(window.__voxarioGeneratedPasswordTick || 0),
      };
    })()`;
  }

  function guestAgentCode(strongPassword, allowSuggestion) {
    return `(() => {
      if (window.top !== window) return;
      if (!window.__voxarioSecureAgentInstalled) {
        window.__voxarioSecureAgentInstalled = true;
        window.__voxarioSecureSubmitTick = 0;
        document.addEventListener('submit', () => { window.__voxarioSecureSubmitTick = Date.now(); }, true);
      }
      if (!${allowSuggestion ? "true" : "false"} || window.__voxarioStrongPasswordUiInstalled) return;
      window.__voxarioStrongPasswordUiInstalled = true;
      const generated = ${JSON.stringify(strongPassword)};
      let host = null;
      const visible = (el) => !!el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const remove = () => { try { host?.remove(); } catch {} host = null; };
      const shouldOffer = (field) => {
        if (!field || field.type !== 'password' || !visible(field) || field.value) return false;
        const form = field.form || field.closest('form');
        const passwords = Array.from((form || document).querySelectorAll('input[type="password"]')).filter(visible);
        const text = String((form?.innerText || '') + ' ' + (field.autocomplete || '') + ' ' + (field.name || '')).toLowerCase();
        return /new-password/.test(field.autocomplete || '') || passwords.length >= 2 || /register|sign up|signup|create account|new password|change password|nové heslo|registr|vytvořit účet|změnit heslo/.test(text);
      };
      document.addEventListener('focusin', (event) => {
        const field = event.target;
        if (!shouldOffer(field)) { remove(); return; }
        remove();
        host = document.createElement('div');
        host.setAttribute('data-voxario-password-suggestion', '1');
        Object.assign(host.style, { position:'fixed', zIndex:'2147483647', left:'12px', top:'12px' });
        const shadow = host.attachShadow({ mode:'closed' });
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = 'VoxarioBrowser · použít silné heslo (${strongPassword.length} znaků)';
        Object.assign(button.style, { background:'#07131f', color:'#67e8f9', border:'1px solid #22d3ee', padding:'9px 12px', borderRadius:'7px', font:'12px Segoe UI, sans-serif', boxShadow:'0 10px 30px rgba(0,0,0,.45)', cursor:'pointer' });
        button.addEventListener('mousedown', (e) => e.preventDefault());
        button.addEventListener('click', () => {
          const form = field.form || field.closest('form');
          const fields = Array.from((form || document).querySelectorAll('input[type="password"]')).filter(visible);
          for (const target of fields) {
            if (target.value) continue;
            const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
            if (setter) setter.call(target, generated); else target.value = generated;
            target.dispatchEvent(new Event('input', { bubbles:true }));
            target.dispatchEvent(new Event('change', { bubbles:true }));
          }
          window.__voxarioGeneratedPasswordTick = Date.now();
          remove();
        });
        shadow.appendChild(button);
        document.documentElement.appendChild(host);
        const rect = field.getBoundingClientRect();
        host.style.left = Math.max(8, Math.min(window.innerWidth - 330, rect.left)) + 'px';
        host.style.top = Math.max(8, Math.min(window.innerHeight - 48, rect.bottom + 6)) + 'px';
      }, true);
      document.addEventListener('focusout', () => setTimeout(remove, 180), true);
    })()`;
  }

  function fillCredentialCode(username, password) {
    return `(() => {
      if (window.top !== window) return false;
      const visible = (el) => !!el && !el.disabled && (el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      const passwords = Array.from(document.querySelectorAll('input[type="password"]')).filter(visible);
      const passwordField = passwords[0];
      if (!passwordField) return false;
      const form = passwordField.form || passwordField.closest('form');
      const scope = form || document;
      const users = Array.from(scope.querySelectorAll('input')).filter((el) => visible(el) && el.type !== 'password');
      const usernameField = users.find((el) => /username/i.test(el.autocomplete || '')) || users.find((el) => el.type === 'email') || users.find((el) => /user|login|email|mail/i.test((el.name || '') + ' ' + (el.id || ''))) || users.find((el) => ['text','email'].includes(el.type));
      const setValue = (field, value) => {
        if (!field || field.value) return;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
        if (setter) setter.call(field, value); else field.value = value;
        field.dispatchEvent(new Event('input', { bubbles:true }));
        field.dispatchEvent(new Event('change', { bubbles:true }));
        field.setAttribute('data-voxario-autofilled', '1');
      };
      setValue(usernameField, ${JSON.stringify(username)});
      setValue(passwordField, ${JSON.stringify(password)});
      return true;
    })()`;
  }

  async function isolated(contents, code) {
    try {
      return await contents.executeJavaScriptInIsolatedWorld(WORLD_ID, [{ code }], true);
    } catch {
      return null;
    }
  }

  async function promptSaveCandidate(contents, state, reason) {
    const candidate = state.lastCandidate;
    state.lastCandidate = null;
    if (!candidate?.password || !candidate?.username || !candidate?.origin) return;
    const existing = findCredential(candidate.origin, candidate.username);
    if (existing && existing.plain.password === candidate.password) return;
    const owner = ownerFor(contents);
    const hostname = (() => { try { return new URL(candidate.origin).hostname; } catch { return candidate.origin; } })();
    const update = !!existing;
    const response = await dialog.showMessageBox(owner, {
      type: "question",
      title: "VoxarioBrowser · Secure Vault",
      message: update ? `Aktualizovat uložené heslo pro ${hostname}?` : `Uložit přihlášení pro ${hostname}?`,
      detail: `${candidate.username}\n\nHeslo bude uloženo pouze lokálně v AES-256-GCM vaultu. Hlavní klíč chrání Windows DPAPI.`,
      buttons: [update ? "Aktualizovat bezpečně" : "Uložit bezpečně", "Teď ne"],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (response.response !== 0) return;
    upsertCredential({ ...candidate, source: reason === "generated" ? "generated" : "autocapture" });
  }

  async function maybeAutofill(contents, state, snapshot) {
    const prefs = loadPasswordPrefs();
    if (!prefs.autofillPasswords || state.autofilled || !snapshot?.hasPassword || !snapshot.focused) return;
    const origin = guestOrigin(contents);
    if (!origin || !isSecureAutofillOrigin(origin)) return;
    const found = findCredential(origin, snapshot.username || "");
    if (!found) return;
    state.autofilled = true;
    const auth = await authorizeAutofill(origin);
    if (!auth.ok) return;
    const filled = await isolated(contents, fillCredentialCode(found.plain.username, found.plain.password));
    if (!filled) state.autofilled = false;
  }

  async function pollGuest(contents, state) {
    if (state.busy || contents.isDestroyed?.()) return;
    state.busy = true;
    try {
      const snapshot = await isolated(contents, guestSnapshotCode());
      if (!snapshot || !snapshot.hasPassword) {
        if (state.lastCandidate?.password) await promptSaveCandidate(contents, state, state.generatedUsed ? "generated" : "disappeared");
        return;
      }
      await maybeAutofill(contents, state, snapshot);
      const origin = guestOrigin(contents);
      if (origin && snapshot.username && snapshot.password) {
        state.lastCandidate = { origin, username: snapshot.username, password: snapshot.password };
      }
      if (snapshot.generatedTick && snapshot.generatedTick !== state.generatedTick) {
        state.generatedTick = snapshot.generatedTick;
        state.generatedUsed = true;
      }
      if (snapshot.submitTick && snapshot.submitTick !== state.submitTick) {
        state.submitTick = snapshot.submitTick;
        await promptSaveCandidate(contents, state, state.generatedUsed ? "generated" : "submit");
        state.generatedUsed = false;
      }
    } finally {
      state.busy = false;
    }
  }

  async function prepareGuest(contents, state) {
    if (contents.isDestroyed?.()) return;
    state.autofilled = false;
    state.submitTick = 0;
    state.generatedTick = 0;
    state.generatedUsed = false;
    state.lastCandidate = null;
    const origin = guestOrigin(contents);
    if (!origin) return;
    const prefs = loadPasswordPrefs();
    const generated = generateStrongPassword(prefs.generatedPasswordLength);
    await isolated(contents, guestAgentCode(generated, prefs.suggestStrongPasswords && isSecureAutofillOrigin(origin)));
  }

  function bindGuest(contents) {
    if (contents.__voxarioSecurePasswordGuest) return;
    contents.__voxarioSecurePasswordGuest = true;
    const state = { timer: null, busy: false, lastCandidate: null, submitTick: 0, generatedTick: 0, generatedUsed: false, autofilled: false };
    guests.set(contents.id, state);
    const reset = () => prepareGuest(contents, state).catch(() => {});
    contents.on("dom-ready", reset);
    contents.on("did-navigate", reset);
    contents.on("did-navigate-in-page", reset);
    contents.on("will-navigate", () => { if (state.lastCandidate?.password) promptSaveCandidate(contents, state, state.generatedUsed ? "generated" : "navigate").catch(() => {}); });
    state.timer = setInterval(() => pollGuest(contents, state).catch(() => {}), 550);
    state.timer.unref?.();
    contents.once("destroyed", () => {
      if (state.timer) clearInterval(state.timer);
      guests.delete(contents.id);
    });
  }

  async function importCsv(source, event) {
    const hello = await verifyHello("VoxarioBrowser chce importovat hesla do Secure Vaultu");
    if (!hello.ok) return hello;
    const owner = ownerFor(event.sender);
    const label = source === "opera-gx" ? "Opera GX" : "Microsoft Edge";
    const result = await dialog.showOpenDialog(owner, {
      title: `Importovat hesla z ${label} — vyber oficiálně exportovaný CSV soubor`,
      properties: ["openFile"],
      filters: [{ name: "CSV s hesly", extensions: ["csv"] }],
    });
    if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
    const file = result.filePaths[0];
    try {
      const stat = fs.statSync(file);
      if (stat.size > 32 * 1024 * 1024) return { ok: false, error: "CSV je příliš velké pro bezpečný import." };
      const records = csvCredentials(fs.readFileSync(file, "utf8"), source);
      if (!records.length) return { ok: false, error: "CSV neobsahuje rozpoznatelné sloupce url, username a password." };
      let imported = 0;
      let updated = 0;
      for (const record of records) {
        const saved = upsertCredential(record);
        if (!saved.ok) continue;
        imported += 1;
        if (saved.updated) updated += 1;
      }
      const cleanup = await dialog.showMessageBox(owner, {
        type: "warning",
        title: "Import hesel dokončen",
        message: `Do Secure Vaultu bylo načteno ${imported} přihlášení.`,
        detail: "Exportní CSV obsahuje hesla v čitelné podobě. Doporučuji ho ihned odstranit. Smazání souboru na SSD není kryptografické přepsání dat.",
        buttons: ["Smazat exportní CSV", "Ponechat soubor"],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
      });
      let sourceDeleted = false;
      if (cleanup.response === 0) {
        try { fs.unlinkSync(file); sourceDeleted = true; } catch {}
      }
      return { ok: true, imported, updated, sourceDeleted };
    } catch (error) {
      return { ok: false, error: String(error?.message || error) };
    }
  }

  // Secure IPC. Password plaintext is returned only by explicit reveal after Windows Hello.
  ipcMain.handle("vbs:prefs:get", () => loadPasswordPrefs());
  ipcMain.handle("vbs:prefs:set", (event, patch) => senderIsBrowserUi(event) ? savePasswordPrefs(patch) : loadPasswordPrefs());
  ipcMain.handle("vbs:generate", () => ({ ok: true, password: generateStrongPassword(loadPasswordPrefs().generatedPasswordLength) }));
  ipcMain.handle("vbs:status", async () => ({
    encryptionAvailable: encryptionAvailable(),
    hello: await helloAvailability(),
    fileAcl: fileAclApplied,
    legacyPending,
    vaultVersion: VAULT_VERSION,
  }));
  ipcMain.handle("vbs:vault:list", (event) => senderIsBrowserUi(event) ? listCredentials() : []);
  ipcMain.handle("vbs:vault:save", async (event, payload) => {
    if (!senderIsBrowserUi(event)) return { ok: false, error: "Nedůvěryhodný požadavek." };
    const normalized = normalizeOrigin(payload?.origin);
    const existing = normalized ? findCredential(normalized, payload?.username) : null;
    if (existing) {
      const hello = await verifyHello("VoxarioBrowser chce změnit uložené heslo");
      if (!hello.ok) return hello;
    }
    return upsertCredential(payload || {});
  });
  ipcMain.handle("vbs:vault:reveal", async (event, id) => {
    if (!senderIsBrowserUi(event)) return { ok: false, error: "Nedůvěryhodný požadavek." };
    const hello = await verifyHello("Zobrazit uložené heslo ve VoxarioBrowseru");
    if (!hello.ok) return hello;
    const found = credentialById(id);
    return found ? { ok: true, password: found.plain.password } : { ok: false, error: "Záznam nebyl nalezen." };
  });
  ipcMain.handle("vbs:vault:copy", async (event, id) => {
    if (!senderIsBrowserUi(event)) return { ok: false, error: "Nedůvěryhodný požadavek." };
    const hello = await verifyHello("Kopírovat uložené heslo z VoxarioBrowseru");
    if (!hello.ok) return hello;
    const found = credentialById(id);
    if (!found) return { ok: false, error: "Záznam nebyl nalezen." };
    const password = found.plain.password;
    clipboard.writeText(password);
    const timer = setTimeout(() => {
      try { if (clipboard.readText() === password) clipboard.clear(); } catch {}
    }, 45000);
    timer.unref?.();
    return { ok: true };
  });
  ipcMain.handle("vbs:vault:delete", async (event, id) => {
    if (!senderIsBrowserUi(event)) return { ok: false, error: "Nedůvěryhodný požadavek." };
    const hello = await verifyHello("Smazat uložené přihlášení z VoxarioBrowseru");
    if (!hello.ok) return hello;
    return deleteCredential(id) ? { ok: true } : { ok: false, error: "Záznam nebyl nalezen." };
  });
  ipcMain.handle("vbs:vault:import-csv", (event, source) => {
    if (!senderIsBrowserUi(event)) return { ok: false, error: "Nedůvěryhodný požadavek." };
    return importCsv(source === "opera-gx" ? "opera-gx" : "edge", event);
  });

  // Install before browser windows/webviews are created.
  app.on("browser-window-created", (_event, win) => registerBrowserUi(win));
  app.on("web-contents-created", (_event, contents) => {
    try {
      if (contents.getType?.() !== "webview") return;
      const voxSession = session.fromPartition("persist:voxario");
      if (contents.session !== voxSession) return;
      bindGuest(contents);
    } catch {}
  });

  app.whenReady().then(() => {
    try { savePasswordPrefs({}); } catch {}
    try { migrateLegacyVault(); } catch { legacyPending = true; }
    BrowserWindow.getAllWindows().forEach(registerBrowserUi);
  }).catch(() => {});
}

module.exports = {
  installBrowserPasswordSecurity,
  normalizeOrigin,
  isSecureAutofillOrigin,
  parseCsv,
  csvCredentials,
  generateStrongPassword,
};

"use strict";

/**
 * Unity verze Ashes of Eryon (DirectX 12 / Vulkan, NVIDIA DLSS, AMD FSR 2).
 *
 * Sestavení z GitHub Actions se publikuje do veřejného bucketu `game-updates`:
 *   unity/latest.json = { "version": "0.1.0", "exe": "AshesOfEryon.exe", "files": [
 *       { "path": "AshesOfEryon_Data/data.unity3d", "url": "0.1.0/AshesOfEryon_Data/data.unity3d",
 *         "sha256": "…", "size": 123, "parts": 2 }, … ] }
 * Velké soubory jsou rozdělené na části `<url>.part1`, `<url>.part2`…
 *
 * Launcher hru instaluje do %LOCALAPPDATA%\StudioVoxario\AshesOfEryon (bez práv správce).
 * Při aktualizaci stáhne jen změněné soubory (porovná SHA-256), ověří je a pak spustí hru.
 *
 * Přechod mezi verzemi (i z Unity 0.10 na Voxario 0.11 s jiným spustitelným souborem a jinými soubory):
 * nové soubory se nejdřív celé stáhnou a ověří do složky .staging; teprve pak se staré soubory
 * (…_Data, UnityPlayer.dll…) přesunou do .rollback a nové na jejich místo. Když nová verze při prvním
 * spuštění do 20 s spadne (nebo nejde spustit), launcher vrátí předchozí verzi z .rollback a tuto verzi
 * už sám znovu neinstaluje. Po prvním úspěšném spuštění se .rollback smaže.
 * Přihlášení: hra dostává jednorázový lístek od launcheru (ASHES_LAUNCHER_TICKET), účet launcheru se nemění.
 * Klávesy z Unity (PlayerPrefs v registru HKCU\Software\StudioVoxario\Ashes of Eryon) se Voxario verzi
 * předají jednou při prvním spuštění (ASHES_IMPORT_KEYS) – hra si je uloží do vlastního nastavení.
 *
 * Testovací kanál (nastavení launcheru „Kanál hry“ = beta): manifest unity/latest-beta.json
 * (verze na Voxario Studio Engine pro testery) a vlastní složka „…-beta“, takže ostrá
 * instalace zůstane nedotčená a přepnutí zpět nic nestahuje.
 */

const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
const { app, net } = require("electron");

let fs = require("node:fs");
try { fs = require("original-fs"); } catch {}

const BASE = process.env.ASHES_UNITY_BASE
  || "https://rioexuvgvmdwvidfakxy.supabase.co/storage/v1/object/public/game-updates/unity/";
const SAFE_PATH = /^[A-Za-z0-9 _.\-()+\/]+$/;

const CHANNELS = { stable: { manifest: "latest.json", suffix: "" }, beta: { manifest: "latest-beta.json", suffix: "-beta" } };
let channel = "stable";
const chosenDirs = {};
/**
 * Složka hry: vedle launcheru (např. E:\Ashes of Eryon\Game), aby hra byla na disku,
 * který si hráč vybral v GameSetupu. Když tam nejde zapisovat, %LOCALAPPDATA%.
 * Testovací kanál má vlastní složku se stejným jménem a příponou „-beta“.
 */
function installDir() {
  if (chosenDirs[channel]) return chosenDirs[channel];
  const suffix = CHANNELS[channel].suffix;
  const fallback = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "StudioVoxario", `AshesOfEryon${suffix}`);
  const candidates = [];
  if (app.isPackaged) candidates.push(path.join(path.dirname(path.dirname(process.execPath)), `Game${suffix}`));
  candidates.push(fallback);
  // už nainstalovaná hra má přednost
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, "install.json"))) return (chosenDirs[channel] = dir);
  }
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, `.probe-${process.pid}`);
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe, { force: true });
      return (chosenDirs[channel] = dir);
    } catch {}
  }
  return (chosenDirs[channel] = fallback);
}

function stateFile() {
  return path.join(installDir(), "install.json");
}

/** Engine sestavení podle manifestu (Voxario sestavení má game.vgame). */
function engineOf(m) {
  if (!m) return "unity";
  if (m.engine) return m.engine;
  return (m.files || []).some((f) => (f.path || f) === "game.vgame") ? "voxario" : "unity";
}

const VERIFY_SECONDS = 20;

// Unity KeyCode -> názvy kláves Voxario (GameUI.cpp)
const UNITY_KEYS = {
  Mouse0: "Mouse1", Mouse1: "Mouse2", Mouse2: "Mouse3", Mouse3: "Mouse4", Mouse4: "Mouse5",
  LeftShift: "Shift", RightShift: "Shift", LeftControl: "Ctrl", RightControl: "Ctrl", LeftAlt: "Alt", RightAlt: "Alt",
  Return: "Enter", KeypadEnter: "Enter", UpArrow: "Up", DownArrow: "Down", LeftArrow: "Left", RightArrow: "Right",
  Quote: "Apostrophe", BackQuote: "Grave", KeypadPlus: "NumPlus", KeypadMinus: "NumMinus",
  Space: "Space", Tab: "Tab", Escape: "Escape", Backspace: "Backspace", Delete: "Delete", Insert: "Insert",
  Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown", CapsLock: "CapsLock", Minus: "Minus",
  Equals: "Equals", Comma: "Comma", Period: "Period", Slash: "Slash", Semicolon: "Semicolon",
  LeftBracket: "LeftBracket", RightBracket: "RightBracket", Backslash: "Backslash",
};
function mapUnityKey(code) {
  if (UNITY_KEYS[code]) return UNITY_KEYS[code];
  let m = /^Alpha([0-9])$/.exec(code);
  if (m) return m[1];
  m = /^Keypad([0-9])$/.exec(code);
  if (m) return `Num${m[1]}`;
  if (/^[A-Z]$/.test(code) || /^F([1-9]|1[0-2])$/.test(code)) return code;
  return null;
}

/**
 * Klávesy nastavené v Unity verzi (PlayerPrefs: hodnoty „ashes.key.<akce>_h<hash>“ typu REG_BINARY
 * s textem KeyCode zakončeným nulou). Vrací „akce=klávesa;…“ nebo "".
 */
function readUnityKeyBinds() {
  if (process.platform !== "win32") return "";
  try {
    const { spawnSync } = require("node:child_process");
    const res = spawnSync("reg.exe", ["query", "HKCU\\Software\\StudioVoxario\\Ashes of Eryon"], { encoding: "utf8", windowsHide: true, timeout: 8000 });
    if (res.status !== 0 || !res.stdout) return "";
    const pairs = [];
    for (const line of res.stdout.split(/\r?\n/)) {
      const m = /^\s*ashes\.key\.([a-z_]+?)_h\d+\s+REG_BINARY\s+([0-9A-Fa-f]*)\s*$/.exec(line);
      if (!m) continue;
      const code = Buffer.from(m[2], "hex").toString("utf8").replace(/\0+$/, "");
      const key = mapUnityKey(code);
      if (key && /^[a-z_]+$/.test(m[1])) pairs.push(`${m[1]}=${key}`);
    }
    return pairs.join(";");
  } catch {
    return "";
  }
}

function readInstalled() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return null;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Stažení s opakováním: server při mnoha požadavcích za sebou vrací HTTP 429
 * (příliš mnoho požadavků) – počkáme (Retry-After nebo 2, 4, 8… s) a zkusíme znovu.
 */
async function fetchBuffer(url, onWait) {
  let lastError = null;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      const res = await net.fetch(url, { cache: "no-store" });
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      lastError = new Error(`HTTP ${res.status}`);
      if (res.status !== 429 && res.status < 500) throw lastError;
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : Math.min(60000, 2000 * 2 ** attempt);
      onWait?.(wait, res.status);
      await sleep(wait);
    } catch (error) {
      if (lastError && error === lastError && !/HTTP (429|5\d\d)/.test(error.message)) throw error;
      lastError = error;
      const wait = Math.min(60000, 2000 * 2 ** attempt);
      onWait?.(wait, 0);
      await sleep(wait);
    }
  }
  throw lastError || new Error("Stažení selhalo");
}

function hashFile(file) {
  return new Promise((resolve) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(file);
    s.on("error", () => resolve(null));
    s.on("data", (d) => h.update(d));
    s.on("end", () => resolve(h.digest("hex")));
  });
}

function createUnityGame({ onStatus, log, channel: initialChannel }) {
  if (CHANNELS[initialChannel]) channel = initialChannel;
  let status = { state: "unknown" };
  let manifest = null;
  let busy = false;
  let child = null;

  function emit(next) {
    status = { ...next, channel, installed: readInstalled()?.version || null };
    try { onStatus?.(status); } catch {}
    return status;
  }

  async function loadManifest() {
    const m = JSON.parse((await fetchBuffer(`${BASE}${CHANNELS[channel].manifest}?t=${Date.now()}`)).toString("utf8"));
    if (!m?.version || !Array.isArray(m.files) || !m.exe) throw new Error("Neplatný manifest hry");
    for (const f of m.files) {
      const rel = String(f.path || "");
      if (!SAFE_PATH.test(rel) || rel.includes("..") || path.isAbsolute(rel)) throw new Error(`Nepovolená cesta: ${rel}`);
    }
    if (!m.files.some((f) => f.path === m.exe)) throw new Error("Manifest neobsahuje spustitelný soubor");
    return m;
  }

  /** Zjistí, jestli je Unity verze k dispozici a jestli je nainstalovaná a aktuální. */
  async function check() {
    if (busy) return status;
    try {
      manifest = await loadManifest();
    } catch (error) {
      manifest = null;
      return emit({ state: readInstalled() ? "offline" : "unavailable", error: String(error?.message || error) });
    }
    const installed = readInstalled();
    const exe = installed ? path.join(installDir(), installed.exe) : null;
    if (installed && installed.version === manifest.version && exe && fs.existsSync(exe)) {
      return emit({ state: "ready", latest: manifest.version, size: totalSize(manifest) });
    }
    // tato verze se už jednou vrátila (nešla spustit) – automaticky ji znovu neinstalovat
    if (installed && installed.failedVersion === manifest.version && exe && fs.existsSync(exe)) {
      return emit({ state: "ready", latest: manifest.version, size: totalSize(manifest), failedUpdate: manifest.version,
        error: `Verze ${manifest.version} se na tomto počítači nespustila – hraješ verzi ${installed.version}.` });
    }
    return emit({ state: installed ? "update" : "install", latest: manifest.version, size: totalSize(manifest) });
  }

  function totalSize(m) {
    return m.files.reduce((a, f) => a + (Number(f.size) || 0), 0);
  }

  async function downloadFile(file, target, onBytes, onWait) {
    const url = new URL(String(file.url || ""), BASE).toString();
    if (!url.startsWith(BASE)) throw new Error("Soubor z cizího zdroje");
    const tmp = `${target}.download`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const out = fs.openSync(tmp, "w");
    const hash = crypto.createHash("sha256");
    try {
      const parts = Math.max(1, Number(file.parts) || 1);
      for (let i = 1; i <= parts; i += 1) {
        const data = await fetchBuffer(parts > 1 ? `${url}.part${i}` : url, onWait);
        hash.update(data);
        fs.writeSync(out, data);
        onBytes(data.length);
      }
    } finally {
      fs.closeSync(out);
    }
    if (hash.digest("hex") !== String(file.sha256).toLowerCase()) {
      fs.rmSync(tmp, { force: true });
      throw new Error(`Poškozený soubor: ${file.path}`);
    }
    fs.rmSync(target, { force: true });
    fs.renameSync(tmp, target);
  }

  /** Nainstaluje nebo aktualizuje hru (stáhne jen změněné soubory). */
  async function install() {
    if (busy) return status;
    busy = true;
    try {
      if (!manifest) manifest = await loadManifest();
      const dir = installDir();
      fs.mkdirSync(dir, { recursive: true });
      emit({ state: "verifying", latest: manifest.version, progress: 0 });
      const todo = [];
      let checked = 0;
      for (const f of manifest.files) {
        const target = path.join(dir, ...f.path.split("/"));
        const same = fs.existsSync(target) && fs.statSync(target).size === Number(f.size) && (await hashFile(target)) === String(f.sha256).toLowerCase();
        if (!same) todo.push(f);
        checked += 1;
        emit({ state: "verifying", latest: manifest.version, progress: checked / manifest.files.length });
      }
      const total = todo.reduce((a, f) => a + (Number(f.size) || 0), 0);
      const prev = readInstalled();
      // 1) vše stáhnout a ověřit do .staging – nainstalovaná verze zůstane do té doby netknutá
      const staging = path.join(dir, ".staging");
      fs.rmSync(staging, { recursive: true, force: true });
      let done = 0;
      for (const f of todo) {
        await downloadFile(f, path.join(staging, ...f.path.split("/")), (n) => {
          done += n;
          emit({ state: "downloading", latest: manifest.version, progress: total ? done / total : 1, done, total });
        }, (ms) => {
          emit({ state: "downloading", latest: manifest.version, progress: total ? done / total : 1, done, total, waiting: Math.round(ms / 1000) });
        });
        // malá pauza mezi soubory, ať server nezahltíme
        await sleep(120);
      }
      // 2) přepnutí: přepisované a už nepotřebné soubory staré verze do .rollback, nové na místo
      emit({ state: "verifying", latest: manifest.version, progress: 1 });
      const rollback = path.join(dir, ".rollback");
      fs.rmSync(rollback, { recursive: true, force: true });
      const moved = [];   // [{ from, to }] pro vrácení při chybě
      const put = (from, to) => {
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.renameSync(from, to);
        moved.push({ from, to });
      };
      const keep = new Set(manifest.files.map((f) => path.join(dir, ...f.path.split("/")).toLowerCase()));
      keep.add(stateFile().toLowerCase());
      try {
        for (const f of todo) {
          const target = path.join(dir, ...f.path.split("/"));
          if (fs.existsSync(target)) put(target, path.join(rollback, ...f.path.split("/")));
          put(path.join(staging, ...f.path.split("/")), target);
        }
        for (const rel of prev?.files || []) {
          const p = path.join(dir, ...String(rel).split("/"));
          if (!keep.has(p.toLowerCase()) && p.startsWith(dir) && fs.existsSync(p)) put(p, path.join(rollback, ...String(rel).split("/")));
        }
      } catch (error) {
        // přesun se nepovedl (soubor drží jiný program) – vrátit vše, jak bylo
        for (const m of moved.reverse()) { try { fs.renameSync(m.to, m.from); } catch {} }
        throw error;
      }
      fs.rmSync(staging, { recursive: true, force: true });
      // prázdné složky po staré verzi (např. AshesOfEryon_Data)
      for (const rel of prev?.files || []) {
        let d = path.dirname(path.join(dir, ...String(rel).split("/")));
        while (d.startsWith(dir) && d !== dir) {
          try { fs.rmdirSync(d); } catch { break; }
          d = path.dirname(d);
        }
      }
      const previous = prev && prev.version !== manifest.version ? { version: prev.version, exe: prev.exe, engine: prev.engine || engineOf(prev), files: prev.files } : null;
      fs.writeFileSync(stateFile(), JSON.stringify({ version: manifest.version, exe: manifest.exe, engine: engineOf(manifest),
        files: manifest.files.map((f) => f.path), installedAt: new Date().toISOString(),
        verified: !previous, previous }, null, 2));
      log?.(`Hra ${manifest.version} (${engineOf(manifest)}) nainstalována (${todo.length} souborů staženo)`);
      return emit({ state: "ready", latest: manifest.version, size: totalSize(manifest) });
    } catch (error) {
      log?.(`Instalace hry selhala: ${error?.stack || error}`);
      return emit({ state: "error", error: String(error?.message || error) });
    } finally {
      busy = false;
    }
  }

  /** Vrátí předchozí verzi z .rollback (nová verze nešla spustit). */
  function rollback(reason) {
    const installed = readInstalled();
    const prev = installed?.previous;
    if (!installed || !prev) return false;
    const dir = installDir();
    const back = path.join(dir, ".rollback");
    try {
      const old = new Set((prev.files || []).map((f) => String(f).toLowerCase()));
      // soubory nové verze, které stará neměla, pryč
      for (const rel of installed.files || []) {
        if (old.has(String(rel).toLowerCase())) continue;
        const p = path.join(dir, ...String(rel).split("/"));
        if (p.startsWith(dir)) { try { fs.rmSync(p, { force: true }); } catch {} }
      }
      // staré soubory zpět na místo
      for (const rel of prev.files || []) {
        const from = path.join(back, ...String(rel).split("/"));
        const to = path.join(dir, ...String(rel).split("/"));
        if (!fs.existsSync(from)) continue;
        fs.mkdirSync(path.dirname(to), { recursive: true });
        try { fs.rmSync(to, { force: true }); } catch {}
        fs.renameSync(from, to);
      }
      fs.rmSync(back, { recursive: true, force: true });
      fs.writeFileSync(stateFile(), JSON.stringify({ ...prev, installedAt: new Date().toISOString(), verified: true,
        failedVersion: installed.version, failedReason: reason }, null, 2));
      log?.(`Verze ${installed.version} se nespustila (${reason}) – vrácena verze ${prev.version}`);
      return true;
    } catch (error) {
      log?.(`Návrat na verzi ${prev.version} selhal: ${error?.stack || error}`);
      return false;
    }
  }

  /** První úspěšné spuštění nové verze: záloha staré už není potřeba. */
  function markVerified() {
    const installed = readInstalled();
    if (!installed || installed.verified !== false) return;
    try {
      fs.writeFileSync(stateFile(), JSON.stringify({ ...installed, verified: true, previous: null }, null, 2));
      fs.rm(path.join(installDir(), ".rollback"), { recursive: true, force: true }, () => {});
      log?.(`Verze ${installed.version} ověřena (první spuštění proběhlo)`);
    } catch {}
  }

  /** Spustí nainstalovanou hru. `onExit` se zavolá po jejím ukončení. */
  function play(onExit, args = [], env = {}) {
    const installed = readInstalled();
    if (!installed) return { opened: false, error: "Hra není nainstalovaná" };
    if (child) return { opened: true, running: true };
    const exe = path.join(installDir(), installed.exe);
    if (!fs.existsSync(exe)) return { opened: false, error: "Chybí spustitelný soubor hry" };
    const extraEnv = { ...env };
    // Voxario verze: klávesy z Unity verze jednou převzít (hra si je pak uloží sama)
    if ((installed.engine || engineOf(installed)) === "voxario") {
      const flag = path.join(app.getPath("userData"), "unity-keys-imported");
      if (!fs.existsSync(flag)) {
        const keys = readUnityKeyBinds();
        if (keys) extraEnv.ASHES_IMPORT_KEYS = keys;
        try { fs.writeFileSync(flag, keys || "-"); } catch {}
      }
    }
    const verifying = installed.verified === false && installed.previous;
    const startedAt = Date.now();
    let failed = false;
    const fail = (reason) => {
      if (failed || !verifying) return;
      failed = true;
      if (rollback(reason)) emit({ ...status, state: "ready", failedUpdate: installed.version,
        error: `Nová verze ${installed.version} se nespustila – vrátil jsem verzi ${installed.previous.version}. Zkus to prosím znovu později.` });
    };
    let verifyTimer = null;
    try {
      child = spawn(exe, ["-ashes-launcher", ...args], {
        cwd: path.dirname(exe),
        detached: false,
        stdio: "ignore",
        windowsHide: false,
        // jednorázový lístek přihlášení jde přes proměnnou prostředí (není vidět v seznamu procesů)
        env: { ...process.env, ...extraEnv },
      });
    } catch (error) {
      child = null;
      fail(String(error?.message || error));
      return { opened: false, error: "Hru se nepodařilo spustit" };
    }
    if (verifying) verifyTimer = setTimeout(() => markVerified(), VERIFY_SECONDS * 1000);
    child.on("error", (error) => {
      log?.(`Spuštění hry selhalo: ${error?.message || error}`);
      if (verifyTimer) clearTimeout(verifyTimer);
      child = null;
      fail(String(error?.message || error));
      onExit?.(-1);
    });
    child.on("exit", (code) => {
      log?.(`Hra skončila (${code})`);
      child = null;
      if (verifyTimer) clearTimeout(verifyTimer);
      if (verifying && !failed) {
        if (code !== 0 && Date.now() - startedAt < VERIFY_SECONDS * 1000) fail(`kód ${code} po ${Math.round((Date.now() - startedAt) / 1000)} s`);
        else markVerified();
      }
      if (!failed) emit({ ...status, state: "ready" });
      onExit?.(code);
    });
    emit({ ...status, state: "running" });
    return { opened: true };
  }

  /** Přepne kanál (stable / beta) a zjistí jeho stav. Během stahování nebo hraní nejde. */
  async function setChannel(next) {
    if (!CHANNELS[next] || next === channel) return status;
    if (busy || child) return status;
    channel = next;
    manifest = null;
    log?.(`Kanál hry: ${channel}`);
    return check();
  }

  return {
    check,
    install,
    play,
    setChannel,
    get channel() { return channel; },
    installDir,
    get status() { return status; },
    get running() { return Boolean(child); },
  };
}

module.exports = { createUnityGame };

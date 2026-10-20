"use strict";

/**
 * Služby launcheru: nastavení, novinky ze serveru, stav serveru, zástupci
 * s ikonou hry, velikost instalace a mezipaměť hry.
 */

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { app, net, shell } = require("electron");

const SUPABASE = "https://rioexuvgvmdwvidfakxy.supabase.co";
const PUBLISHABLE_KEY = "sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-";

// ------------------------------------------------------------------ nastavení
const DEFAULTS = {
  fullscreen: false,
  afterPlay: "minimize", // "minimize" | "hide" | "keep"
  autoUpdate: true,
  desktopShortcut: true,
  startWithWindows: false,
};

function settingsFile() {
  return path.join(app.getPath("userData"), "launcher-settings.json");
}

function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(settingsFile(), "utf8")) };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveSettings(next) {
  const clean = { ...loadSettings() };
  for (const key of Object.keys(DEFAULTS)) {
    if (key in (next || {})) clean[key] = typeof DEFAULTS[key] === "boolean" ? Boolean(next[key]) : String(next[key]);
  }
  if (!["minimize", "hide", "keep"].includes(clean.afterPlay)) clean.afterPlay = DEFAULTS.afterPlay;
  try {
    fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
    fs.writeFileSync(settingsFile(), JSON.stringify(clean, null, 2));
  } catch {}
  return clean;
}

// ------------------------------------------------------------------ server
async function rest(pathAndQuery) {
  const res = await net.fetch(`${SUPABASE}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: PUBLISHABLE_KEY, accept: "application/json" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Novinky a změny (tabulka ashes_changelog) + nejbližší termín z roadmapy. */
async function loadNews() {
  const [changes, roadmap] = await Promise.all([
    rest("ashes_changelog?select=id,published_at,kind,title_cs,text_cs,image&order=published_at.desc&limit=40").catch(() => []),
    rest("ashes_roadmap?select=title_cs,when_cs,starts_at,status,text_cs&order=sort.asc").catch(() => []),
  ]);
  const next = Array.isArray(roadmap) ? roadmap.find((r) => r.starts_at && r.status !== "done") || null : null;
  return { items: Array.isArray(changes) ? changes : [], next, online: Array.isArray(changes) && changes.length > 0 };
}

async function serverStatus() {
  const started = Date.now();
  try {
    const res = await net.fetch(`${SUPABASE}/rest/v1/ashes_roadmap?select=id&limit=1`, { headers: { apikey: PUBLISHABLE_KEY } });
    return { online: res.ok, ms: Date.now() - started };
  } catch {
    return { online: false, ms: null };
  }
}

// ------------------------------------------------------------------ zástupci s ikonou hry
function iconPath() {
  const packaged = path.join(process.resourcesPath || "", "launcher-ui", "assets", "ashes.ico");
  if (fs.existsSync(packaged)) return packaged;
  return path.join(__dirname, "..", "prototype", "assets", "ashes.ico");
}

function shortcutPaths() {
  return {
    desktop: path.join(app.getPath("desktop"), "Ashes of Eryon.lnk"),
    start: path.join(process.env.APPDATA || os.homedir(), "Microsoft", "Windows", "Start Menu", "Programs", "Ashes of Eryon", "Ashes of Eryon.lnk"),
  };
}

function writeShortcut(file) {
  if (process.platform !== "win32" || !app.isPackaged) return false;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    return shell.writeShortcutLink(file, "create", {
      target: process.execPath,
      cwd: path.dirname(process.execPath),
      description: "Ashes of Eryon",
      icon: iconPath(),
      iconIndex: 0,
      appUserModelId: "com.studiovoxario.ashesoferyon.launcher",
    });
  } catch {
    return false;
  }
}

/** Zástupce na ploše a ve Startu vždy s ikonou hry (opraví i staré zástupce z instalace). */
function syncShortcuts(settings) {
  const p = shortcutPaths();
  if (settings.desktopShortcut) writeShortcut(p.desktop);
  else {
    try { fs.rmSync(p.desktop, { force: true }); } catch {}
  }
  if (fs.existsSync(p.start) || settings.desktopShortcut) writeShortcut(p.start);
}

function applyLoginItem(settings) {
  if (process.platform !== "win32" || !app.isPackaged) return;
  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.startWithWindows), path: process.execPath });
  } catch {}
}

// ------------------------------------------------------------------ instalace
function installDir() {
  return path.dirname(process.execPath);
}

function directorySize(dir) {
  let total = 0;
  const pending = [dir];
  const previous = process.noAsar;
  process.noAsar = true;
  try {
    while (pending.length) {
      const current = pending.pop();
      let entries = [];
      try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
      for (const entry of entries) {
        const file = path.join(current, entry.name);
        try {
          if (entry.isDirectory()) pending.push(file);
          else total += fs.statSync(file).size;
        } catch {}
      }
    }
  } finally {
    process.noAsar = previous;
  }
  return total;
}

function info() {
  const dir = installDir();
  return {
    version: app.getVersion(),
    electron: process.versions.electron,
    installDir: app.isPackaged ? path.dirname(dir) : dir,
    sizeBytes: app.isPackaged ? directorySize(dir) : null,
    packaged: app.isPackaged,
  };
}

module.exports = { loadSettings, saveSettings, loadNews, serverStatus, syncShortcuts, applyLoginItem, info, installDir };

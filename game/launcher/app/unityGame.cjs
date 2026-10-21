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

function installDir() {
  return path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"), "StudioVoxario", "AshesOfEryon");
}

function stateFile() {
  return path.join(installDir(), "install.json");
}

function readInstalled() {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), "utf8"));
  } catch {
    return null;
  }
}

async function fetchBuffer(url) {
  const res = await net.fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
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

function createUnityGame({ onStatus, log }) {
  let status = { state: "unknown" };
  let manifest = null;
  let busy = false;
  let child = null;

  function emit(next) {
    status = { ...next, installed: readInstalled()?.version || null };
    try { onStatus?.(status); } catch {}
    return status;
  }

  async function loadManifest() {
    const m = JSON.parse((await fetchBuffer(`${BASE}latest.json?t=${Date.now()}`)).toString("utf8"));
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
    return emit({ state: installed ? "update" : "install", latest: manifest.version, size: totalSize(manifest) });
  }

  function totalSize(m) {
    return m.files.reduce((a, f) => a + (Number(f.size) || 0), 0);
  }

  async function downloadFile(file, target, onBytes) {
    const url = new URL(String(file.url || ""), BASE).toString();
    if (!url.startsWith(BASE)) throw new Error("Soubor z cizího zdroje");
    const tmp = `${target}.download`;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const out = fs.openSync(tmp, "w");
    const hash = crypto.createHash("sha256");
    try {
      const parts = Math.max(1, Number(file.parts) || 1);
      for (let i = 1; i <= parts; i += 1) {
        const data = await fetchBuffer(parts > 1 ? `${url}.part${i}` : url);
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
      let done = 0;
      for (const f of todo) {
        await downloadFile(f, path.join(dir, ...f.path.split("/")), (n) => {
          done += n;
          emit({ state: "downloading", latest: manifest.version, progress: total ? done / total : 1, done, total });
        });
      }
      // staré soubory z předchozí verze smazat (jen uvnitř složky hry)
      const keep = new Set(manifest.files.map((f) => path.join(dir, ...f.path.split("/")).toLowerCase()));
      keep.add(stateFile().toLowerCase());
      const prev = readInstalled();
      for (const rel of prev?.files || []) {
        const p = path.join(dir, ...String(rel).split("/"));
        if (!keep.has(p.toLowerCase()) && p.startsWith(dir)) {
          try { fs.rmSync(p, { force: true }); } catch {}
        }
      }
      fs.writeFileSync(stateFile(), JSON.stringify({ version: manifest.version, exe: manifest.exe, files: manifest.files.map((f) => f.path), installedAt: new Date().toISOString() }, null, 2));
      log?.(`Unity verze ${manifest.version} nainstalována (${todo.length} souborů staženo)`);
      return emit({ state: "ready", latest: manifest.version, size: totalSize(manifest) });
    } catch (error) {
      log?.(`Instalace Unity verze selhala: ${error?.stack || error}`);
      return emit({ state: "error", error: String(error?.message || error) });
    } finally {
      busy = false;
    }
  }

  /** Spustí nainstalovanou hru. `onExit` se zavolá po jejím ukončení. */
  function play(onExit, args = []) {
    const installed = readInstalled();
    if (!installed) return { opened: false, error: "Hra není nainstalovaná" };
    if (child) return { opened: true, running: true };
    const exe = path.join(installDir(), installed.exe);
    if (!fs.existsSync(exe)) return { opened: false, error: "Chybí spustitelný soubor hry" };
    child = spawn(exe, ["-ashes-launcher", ...args], { cwd: path.dirname(exe), detached: false, stdio: "ignore", windowsHide: false });
    child.on("error", (error) => log?.(`Spuštění hry selhalo: ${error?.message || error}`));
    child.on("exit", (code) => {
      log?.(`Hra skončila (${code})`);
      child = null;
      emit({ ...status, state: "ready" });
      onExit?.(code);
    });
    emit({ ...status, state: "running" });
    return { opened: true };
  }

  return {
    check,
    install,
    play,
    installDir,
    get status() { return status; },
    get running() { return Boolean(child); },
  };
}

module.exports = { createUnityGame };

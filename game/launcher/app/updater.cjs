"use strict";

/**
 * Automatická aktualizace launcheru bez nové instalace.
 *
 * Launcher se skládá z Electron runtime (mění se jen výjimečně) a z vlastních
 * souborů: resources/app.asar (logika) a resources/launcher-ui (vzhled).
 * Ty se publikují do veřejného bucketu `game-updates` spolu s manifestem
 * launcher/latest.json:
 *
 * { "version": "0.2.1", "electron": "31.7.7", "files": [
 *     { "path": "resources/app.asar", "url": "0.2.1/app.asar", "sha256": "…", "size": 123 }, … ] }
 *
 * Postup: launcher při startu (a pak každých 30 minut) stáhne manifest. Když je
 * verze novější a Electron stejný, stáhne soubory do složky .update, ověří
 * SHA-256 a po zavření launcheru (nebo hned, když hra neběží) je malý skript
 * v PowerShellu nakopíruje na místo a launcher znovu spustí.
 * Když nová verze potřebuje jiný Electron, launcher jen nabídne nový GameSetup.
 */

const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { app, net } = require("electron");

let fs = require("node:fs");
// původní fs bez podpory .asar archivů – zapisujeme soubor app.asar jako běžný soubor
try { fs = require("original-fs"); } catch {}

const UPDATE_BASE = process.env.ASHES_UPDATE_BASE
  || "https://rioexuvgvmdwvidfakxy.supabase.co/storage/v1/object/public/game-updates/launcher/";
const CHECK_EVERY_MS = 30 * 60 * 1000;
/** Do aktualizace smí jen tyto cesty (žádné spustitelné soubory ani nic mimo resources). */
const ALLOWED = /^resources\/(app\.asar|launcher-ui\/[A-Za-z0-9._\-\/]+)$/;

function newer(a, b) {
  const pa = String(a).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  const pb = String(b).split(/[.-]/).map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    if ((pa[i] || 0) !== (pb[i] || 0)) return (pa[i] || 0) > (pb[i] || 0);
  }
  return false;
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

async function fetchBuffer(url) {
  const res = await net.fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

function logLine(message) {
  try { fs.appendFileSync(path.join(app.getPath("userData"), "launcher.log"), `[${new Date().toISOString()}] ${message}\n`); } catch {}
}

/**
 * Spustí aktualizační skript tak, aby přežil ukončení launcheru.
 * Windows ukončí všechny podprocesy launcheru spolu s ním (proto aktualizace dřív
 * nikdy nedoběhla). Skript proto zakládá služba WMI (Win32_Process.Create) – mimo
 * launcher. Záloha: spuštění přes Průzkumníka (explorer.exe) z .cmd souboru.
 */
function launchOutsideLauncher(script) {
  const cmdLine = `powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "${script}"`;
  try {
    const ps = `$r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = '${cmdLine.replace(/'/g, "''")}' }; Write-Output "$($r.ReturnValue) $($r.ProcessId)"; exit [int]$r.ReturnValue`;
    const res = spawnSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], { windowsHide: true, timeout: 20000, encoding: "utf8" });
    logLine(`Aktualizační skript přes WMI: status ${res.status} ${String(res.stdout || "").trim()} ${String(res.stderr || "").trim().slice(0, 300)}`);
    if (res.status === 0) return true;
  } catch (error) {
    logLine(`WMI selhalo: ${error?.message || error}`);
  }
  try {
    const cmd = script.replace(/\.ps1$/, ".cmd");
    fs.writeFileSync(cmd, `@echo off\r\n${cmdLine}\r\n`, "utf8");
    const res = spawnSync("explorer.exe", [cmd], { windowsHide: true, timeout: 10000 });
    logLine(`Aktualizační skript přes Průzkumníka: status ${res.status}`);
    // explorer.exe vrací 1 i při úspěchu
    return res.error == null;
  } catch (error) {
    logLine(`Průzkumník selhal: ${error?.message || error}`);
    return false;
  }
}

function createUpdater({ onStatus, canRestart }) {
  const installDir = path.dirname(process.execPath);
  const stagingRoot = path.join(installDir, ".update");
  const attemptFile = path.join(app.getPath("userData"), "update-attempt.json");

  function readAttempt() {
    try { return JSON.parse(fs.readFileSync(attemptFile, "utf8")); } catch { return null; }
  }
  function noteAttempt(version) {
    const prev = readAttempt();
    const count = prev && prev.version === version ? (prev.count || 0) + 1 : 1;
    try { fs.writeFileSync(attemptFile, JSON.stringify({ version, count, at: new Date().toISOString() })); } catch {}
  }
  /** Pojistka proti smyčce: když se instalace stejné verze nepovedla dvakrát, už ji sám nezkouší. */
  function blocked(version) {
    const a = readAttempt();
    return Boolean(a && a.version === version && a.count >= 2 && newer(version, app.getVersion()));
  }
  let state = { state: "idle", current: app.getVersion() };
  let ready = null; // { version, files: [{ from, to }] }
  let checking = false;
  let timer = null;

  function emit(next) {
    state = { ...state, ...next, current: app.getVersion() };
    try { onStatus?.(state); } catch {}
  }

  function writable() {
    try {
      fs.mkdirSync(stagingRoot, { recursive: true });
      const probe = path.join(stagingRoot, ".probe");
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe, { force: true });
      return true;
    } catch {
      return false;
    }
  }

  async function check() {
    if (!app.isPackaged || checking || ready) return state;
    checking = true;
    try {
      emit({ state: "checking" });
      const manifest = JSON.parse((await fetchBuffer(`${UPDATE_BASE}latest.json?t=${Date.now()}`)).toString("utf8"));
      if (!manifest?.version || !Array.isArray(manifest.files) || !newer(manifest.version, app.getVersion())) {
        emit({ state: "current", latest: manifest?.version || app.getVersion() });
        return state;
      }
      if (manifest.electron && manifest.electron !== process.versions.electron) {
        // nová verze potřebuje jiný runtime – jen jednou stáhnout nový GameSetup
        emit({ state: "full", latest: manifest.version });
        return state;
      }
      if (!writable()) {
        emit({ state: "full", latest: manifest.version, reason: "readonly" });
        return state;
      }
      const dir = path.join(stagingRoot, manifest.version.replace(/[^0-9A-Za-z.\-]/g, ""));
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
      const files = [];
      let done = 0;
      for (const file of manifest.files) {
        const rel = String(file.path || "").replace(/\\/g, "/");
        if (!ALLOWED.test(rel) || rel.includes("..")) throw new Error(`Nepovolená cesta v aktualizaci: ${rel}`);
        const url = new URL(String(file.url || ""), UPDATE_BASE).toString();
        if (!url.startsWith(UPDATE_BASE)) throw new Error("Aktualizace z cizího zdroje.");
        emit({ state: "downloading", latest: manifest.version, progress: done / manifest.files.length });
        const data = await fetchBuffer(url);
        if (sha256(data) !== String(file.sha256).toLowerCase()) throw new Error(`Poškozený soubor aktualizace: ${rel}`);
        // .asar přejmenujeme, aby s ním Electron nezacházel jako s archivem
        const staged = path.join(dir, rel.replace(/\.asar$/, ".asar-new"));
        fs.mkdirSync(path.dirname(staged), { recursive: true });
        fs.writeFileSync(staged, data);
        files.push({ from: staged, to: path.join(installDir, ...rel.split("/")) });
        done += 1;
      }
      ready = { version: manifest.version, files, dir };
      if (blocked(manifest.version)) {
        logLine(`Instalace aktualizace ${manifest.version} se opakovaně nepovedla – nabízím GameSetup.`);
        emit({ state: "full", latest: manifest.version, reason: "apply-failed" });
        return state;
      }
      emit({ state: "ready", latest: manifest.version, progress: 1 });
      if (canRestart?.()) apply();
      return state;
    } catch (error) {
      emit({ state: "error", error: String(error?.message || error) });
      return state;
    } finally {
      checking = false;
    }
  }

  /** Nakopíruje stažené soubory po ukončení launcheru a spustí ho znovu. */
  function apply() {
    if (!ready || process.platform !== "win32") return false;
    const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
    const transcript = path.join(app.getPath("userData"), "launcher-update.log");
    const lines = [
      `try { Start-Transcript -LiteralPath ${q(transcript)} -Force | Out-Null } catch {}`,
      "$ErrorActionPreference = 'Stop'",
      `try { Wait-Process -Id ${process.pid} -Timeout 30 -ErrorAction SilentlyContinue } catch {}`,
      "Start-Sleep -Milliseconds 700",
      "function Put($from, $to) {",
      "  $dir = Split-Path -Parent $to",
      "  if (!(Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }",
      "  for ($i = 0; $i -lt 20; $i++) {",
      "    try { [System.IO.File]::Copy($from, $to, $true); return } catch { Start-Sleep -Milliseconds 500 }",
      "  }",
      "  throw \"Nelze přepsat $to\"",
      "}",
      "try {",
      ...ready.files.map((f) => `  Put ${q(f.from)} ${q(f.to)}`),
      `  Remove-Item -LiteralPath ${q(ready.dir)} -Recurse -Force -ErrorAction SilentlyContinue`,
      "} finally {",
      `  Start-Process -FilePath ${q(process.execPath)}`,
      "}",
    ];
    const script = path.join(os.tmpdir(), `ashes-launcher-update-${Date.now()}.ps1`);
    // UTF-8 s BOM, ať PowerShell správně přečte české cesty
    fs.writeFileSync(script, "\ufeff" + lines.join("\r\n"), "utf8");
    if (!launchOutsideLauncher(script)) {
      emit({ state: "error", error: "Aktualizaci se nepodařilo spustit. Stáhni prosím nový GameSetup." });
      return false;
    }
    noteAttempt(ready.version);
    emit({ state: "restarting", latest: ready.version });
    setTimeout(() => app.quit(), 300);
    return true;
  }

  function start() {
    // úspěšná aktualizace: smazat záznam o pokusech
    const a = readAttempt();
    if (a && !newer(a.version, app.getVersion())) { try { fs.rmSync(attemptFile, { force: true }); } catch {} }
    // úklid po předchozí aktualizaci
    try {
      for (const name of fs.existsSync(stagingRoot) ? fs.readdirSync(stagingRoot) : []) {
        if (!newer(name, app.getVersion())) fs.rmSync(path.join(stagingRoot, name), { recursive: true, force: true });
      }
    } catch {}
    void check();
    timer = setInterval(() => void check(), CHECK_EVERY_MS);
  }

  return {
    start,
    check,
    apply,
    get status() { return state; },
    get ready() { return Boolean(ready); },
    stop() { if (timer) clearInterval(timer); },
  };
}

module.exports = { createUpdater };

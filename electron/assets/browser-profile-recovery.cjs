"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const SECURE_FILES = Object.freeze([
  "browser-secure-vault.v2.json",
  "browser-secure-vault.key.json",
]);
const PREFS_FILE = "browser-password-prefs.json";
const LEGACY_FILE = "browser-vault.json";
const MIRROR_DIR = "SecureVaultRecovery";

function isJsonFile(file) {
  try {
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size <= 1 || stat.size > 64 * 1024 * 1024) return false;
    JSON.parse(fs.readFileSync(file, "utf8"));
    return true;
  } catch {
    return false;
  }
}

function sha256File(file) {
  try { return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"); } catch { return null; }
}

function sameFile(a, b) {
  const left = sha256File(a);
  const right = sha256File(b);
  return Boolean(left && right && left === right);
}

function pairAt(root) {
  const vault = path.join(root, SECURE_FILES[0]);
  const key = path.join(root, SECURE_FILES[1]);
  if (!isJsonFile(vault) || !isJsonFile(key)) return null;
  let mtime = 0;
  try { mtime = Math.max(fs.statSync(vault).mtimeMs, fs.statSync(key).mtimeMs); } catch {}
  return { root, vault, key, mtime };
}

function uniqueRoots(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    if (!value) continue;
    const normalized = path.resolve(String(value));
    const key = process.platform === "win32" ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

function newestPairSource(roots) {
  return uniqueRoots(roots)
    .map(pairAt)
    .filter(Boolean)
    .sort((a, b) => b.mtime - a.mtime)[0] || null;
}

function atomicCopy(source, destination) {
  if (!source || !destination || !fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  const temp = `${destination}.tmp-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`;
  try {
    fs.copyFileSync(source, temp);
    try { fs.chmodSync(temp, 0o600); } catch {}
    try { fs.rmSync(destination, { force: true }); } catch {}
    fs.renameSync(temp, destination);
    try { fs.chmodSync(destination, 0o600); } catch {}
    return true;
  } catch {
    try { fs.rmSync(temp, { force: true }); } catch {}
    return false;
  }
}

function recoverPartialPair(currentDir, roots) {
  const currentVault = path.join(currentDir, SECURE_FILES[0]);
  const currentKey = path.join(currentDir, SECURE_FILES[1]);
  const haveVault = isJsonFile(currentVault);
  const haveKey = isJsonFile(currentKey);
  if (haveVault === haveKey) return false;

  for (const root of uniqueRoots(roots)) {
    if (path.resolve(root) === path.resolve(currentDir)) continue;
    const pair = pairAt(root);
    if (!pair) continue;
    if (haveVault && sameFile(currentVault, pair.vault)) return atomicCopy(pair.key, currentKey);
    if (haveKey && sameFile(currentKey, pair.key)) return atomicCopy(pair.vault, currentVault);
  }
  return false;
}

function recoverLegacyIfNeeded(currentDir, roots) {
  const currentLegacy = path.join(currentDir, LEGACY_FILE);
  if (fs.existsSync(currentLegacy)) return false;
  if (pairAt(currentDir)) return false;
  let selected = null;
  for (const root of uniqueRoots(roots)) {
    if (path.resolve(root) === path.resolve(currentDir)) continue;
    const candidate = path.join(root, LEGACY_FILE);
    if (!isJsonFile(candidate)) continue;
    let mtime = 0;
    try { mtime = fs.statSync(candidate).mtimeMs; } catch {}
    if (!selected || mtime > selected.mtime) selected = { file: candidate, mtime };
  }
  // This is only a one-time bridge into the current profile. It is deliberately
  // never copied into the durable recovery mirror because old vaults may contain
  // plaintext records. browser-password-security.cjs immediately migrates it.
  return selected ? atomicCopy(selected.file, currentLegacy) : false;
}

function recoverSecurePair({ currentDir, recoveryDir, candidateDirs = [] }) {
  fs.mkdirSync(currentDir, { recursive: true });
  const roots = uniqueRoots([recoveryDir, ...candidateDirs]);
  let recovered = false;
  const current = pairAt(currentDir);
  if (!current) {
    recovered = recoverPartialPair(currentDir, roots) || recovered;
    if (!pairAt(currentDir) && !isJsonFile(path.join(currentDir, SECURE_FILES[0])) && !isJsonFile(path.join(currentDir, SECURE_FILES[1]))) {
      const source = newestPairSource(roots);
      if (source) {
        const vaultOk = atomicCopy(source.vault, path.join(currentDir, SECURE_FILES[0]));
        const keyOk = atomicCopy(source.key, path.join(currentDir, SECURE_FILES[1]));
        recovered = (vaultOk && keyOk) || recovered;
      }
    }
  }
  if (!pairAt(currentDir)) recovered = recoverLegacyIfNeeded(currentDir, roots) || recovered;
  return { recovered, securePair: Boolean(pairAt(currentDir)), legacyPresent: isJsonFile(path.join(currentDir, LEGACY_FILE)) };
}

function mirrorSecurePair(currentDir, recoveryDir) {
  const pair = pairAt(currentDir);
  if (!pair) return { ok: false, skipped: true };
  fs.mkdirSync(recoveryDir, { recursive: true });
  const vaultOk = atomicCopy(pair.vault, path.join(recoveryDir, SECURE_FILES[0]));
  const keyOk = atomicCopy(pair.key, path.join(recoveryDir, SECURE_FILES[1]));
  const prefs = path.join(currentDir, PREFS_FILE);
  if (isJsonFile(prefs)) atomicCopy(prefs, path.join(recoveryDir, PREFS_FILE));
  return { ok: vaultOk && keyOk };
}

function restorePrefsIfMissing(currentDir, recoveryDir) {
  const current = path.join(currentDir, PREFS_FILE);
  const backup = path.join(recoveryDir, PREFS_FILE);
  if (isJsonFile(current) || !isJsonFile(backup)) return false;
  return atomicCopy(backup, current);
}

function defaultCandidateDirs(appData, currentDir, recoveryDir) {
  return uniqueRoots([
    recoveryDir,
    currentDir,
    path.join(appData, "voxario-browser"),
    path.join(appData, "VoxarioBrowser"),
    path.join(appData, "voxar-app-desktop"),
    path.join(appData, "Voxar.app"),
    path.join(appData, "StudioVoxario"),
  ]);
}

function installBrowserProfileRecovery() {
  if (global.__VOXARIO_BROWSER_PROFILE_RECOVERY_V1__) return;
  global.__VOXARIO_BROWSER_PROFILE_RECOVERY_V1__ = true;
  const { app } = require("electron");
  let currentDir = "";
  let recoveryDir = "";
  try {
    currentDir = app.getPath("userData");
    const appData = app.getPath("appData");
    recoveryDir = path.join(appData, "VoxarioBrowser", MIRROR_DIR);
    const candidates = defaultCandidateDirs(appData, currentDir, recoveryDir);
    recoverSecurePair({ currentDir, recoveryDir, candidateDirs: candidates });
    restorePrefsIfMissing(currentDir, recoveryDir);
    mirrorSecurePair(currentDir, recoveryDir);
  } catch (error) {
    try { console.error("VoxarioBrowser secure-vault recovery failed", error); } catch {}
  }

  const sync = () => {
    if (!currentDir || !recoveryDir) return;
    try { mirrorSecurePair(currentDir, recoveryDir); } catch {}
  };
  let debounce = null;
  app.whenReady().then(() => {
    sync();
    try {
      const watcher = fs.watch(currentDir, { persistent: false }, (_event, filename) => {
        const name = String(filename || "");
        if (!SECURE_FILES.includes(name) && name !== PREFS_FILE) return;
        if (debounce) clearTimeout(debounce);
        debounce = setTimeout(sync, 250);
        debounce.unref?.();
      });
      app.once("before-quit", () => { try { watcher.close(); } catch {} });
    } catch {}
  }).catch(() => {});
  app.on("before-quit", sync);
  const timer = setInterval(sync, 15_000);
  timer.unref?.();
}

module.exports = {
  SECURE_FILES,
  PREFS_FILE,
  LEGACY_FILE,
  MIRROR_DIR,
  isJsonFile,
  sha256File,
  pairAt,
  newestPairSource,
  recoverSecurePair,
  mirrorSecurePair,
  restorePrefsIfMissing,
  defaultCandidateDirs,
  installBrowserProfileRecovery,
};

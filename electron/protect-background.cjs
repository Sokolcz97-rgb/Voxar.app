"use strict";

// Lightweight resident companion for VoxarioProtect.
// Microsoft Defender remains the antivirus engine. This process does not
// create Defender exclusions, restore quarantine items, disable protection,
// delete files, or upload file contents.

const { app, Tray, Menu, nativeImage, shell, Notification } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { calculateProtectionScore, calculateFileTrust } = require("./protect-trust-engine.cjs");
const {
  loadProtectPreferences,
  preferencesPath,
  profileConfig,
} = require("./protect-preferences.cjs");

const RISKY_EXTENSIONS = new Set([
  ".exe", ".msi", ".msix", ".com", ".scr", ".bat", ".cmd", ".ps1",
  ".js", ".jse", ".vbs", ".vbe", ".dll", ".jar",
]);
const DOWNLOAD_DEBOUNCE_MS = 1800;
const MAX_ACTIVITY = 120;

let tray = null;
let downloadWatcher = null;
let defenderTimer = null;
let settingsWatcherActive = false;
let cachedDefenderStatus = { AccessLimited: true };
let protectionScore = 55;
let activities = [];
let preferences = null;
const pendingFiles = new Map();

function stateFile() {
  return path.join(app.getPath("userData"), "voxario-protect-background.json");
}

function loadState() {
  try {
    const data = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    activities = Array.isArray(data.activities) ? data.activities.slice(0, MAX_ACTIVITY) : [];
    if (data.defenderStatus && typeof data.defenderStatus === "object") {
      cachedDefenderStatus = data.defenderStatus;
      protectionScore = calculateProtectionScore(cachedDefenderStatus);
    }
  } catch {}
}

function saveState() {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({
      updatedAt: new Date().toISOString(),
      protectionScore,
      defenderStatus: cachedDefenderStatus,
      profile: preferences?.profile || "balanced",
      activities: activities.slice(0, MAX_ACTIVITY),
    }, null, 2));
  } catch {}
}

function addActivity(item) {
  activities.unshift({ id: crypto.randomUUID(), at: new Date().toISOString(), ...item });
  if (activities.length > MAX_ACTIVITY) activities.length = MAX_ACTIVITY;
  saveState();
  refreshTray();
}

function runPowerShellJson(script, timeoutMs = 9000) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve(null);
    const child = spawn("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script,
    ], { windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
    let out = "";
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      resolve(null);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { out += chunk.toString("utf8"); });
    child.once("error", () => { clearTimeout(timer); resolve(null); });
    child.once("close", () => {
      clearTimeout(timer);
      try { resolve(JSON.parse(out.trim())); } catch { resolve(null); }
    });
  });
}

async function refreshDefenderStatus({ notify = false } = {}) {
  const status = await runPowerShellJson(
    "$s=Get-MpComputerStatus; [pscustomobject]@{AntivirusEnabled=$s.AntivirusEnabled;RealTimeProtectionEnabled=$s.RealTimeProtectionEnabled;BehaviorMonitorEnabled=$s.BehaviorMonitorEnabled;IoavProtectionEnabled=$s.IoavProtectionEnabled;AntivirusSignatureAge=$s.AntivirusSignatureAge;AMRunningMode=$s.AMRunningMode} | ConvertTo-Json -Compress"
  );
  if (!status) {
    cachedDefenderStatus = { AccessLimited: true };
    protectionScore = calculateProtectionScore(cachedDefenderStatus);
    refreshTray();
    saveState();
    return;
  }

  const previousRealtime = cachedDefenderStatus?.RealTimeProtectionEnabled;
  cachedDefenderStatus = status;
  protectionScore = calculateProtectionScore(status);
  refreshTray();
  saveState();

  if (notify && previousRealtime !== false && status.RealTimeProtectionEnabled === false) {
    showNotification("VoxarioProtect", "Microsoft Defender Real-time Protection je vypnutá.");
    addActivity({ type: "defender", status: "warning", title: "Real-time ochrana je vypnutá" });
  }
}

function hashFile(filePath, maxBytes) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    fs.stat(filePath, (statError, stat) => {
      if (statError || !stat.isFile() || stat.size > maxBytes) return finish(null);
      const hash = crypto.createHash("sha256");
      const input = fs.createReadStream(filePath);
      input.on("data", (chunk) => hash.update(chunk));
      input.once("error", () => finish(null));
      input.once("end", () => finish(hash.digest("hex")));
    });
  });
}

async function inspectDownloadedFile(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return;
    const ext = path.extname(filePath).toLowerCase();
    if (!RISKY_EXTENSIONS.has(ext)) return;

    const profile = profileConfig(preferences);
    const sha256 = await hashFile(filePath, profile.maxAutoHashBytes);
    const trust = calculateFileTrust({
      fileName: path.basename(filePath),
      size: stat.size,
      modifiedAt: stat.mtime,
      defenderStatus: cachedDefenderStatus,
      defenderDetected: false,
    });

    addActivity({
      type: "file",
      status: trust.verdict === "risk" ? "warning" : "review",
      title: "Nový spustitelný soubor v Downloads",
      fileName: path.basename(filePath),
      sha256,
      trustScore: trust.score,
      verdict: trust.verdict,
      reasons: trust.reasons,
      profile: profile.id,
    });
  } catch {}
}

function scheduleDownloadInspection(filePath) {
  const key = String(filePath).toLowerCase();
  const old = pendingFiles.get(key);
  if (old) clearTimeout(old);
  const timer = setTimeout(() => {
    pendingFiles.delete(key);
    void inspectDownloadedFile(filePath);
  }, DOWNLOAD_DEBOUNCE_MS);
  pendingFiles.set(key, timer);
}

function stopDownloadsWatcher() {
  try { downloadWatcher?.close(); } catch {}
  downloadWatcher = null;
}

function startDownloadsWatcher() {
  if (!preferences?.monitorDownloads || downloadWatcher) return;
  try {
    const downloads = app.getPath("downloads");
    downloadWatcher = fs.watch(downloads, { persistent: true }, (_event, fileName) => {
      if (!fileName) return;
      scheduleDownloadInspection(path.join(downloads, String(fileName)));
    });
    downloadWatcher.on("error", () => { downloadWatcher = null; });
  } catch {}
}

function showNotification(title, body) {
  if (preferences?.notifications === false) return;
  try {
    if (Notification.isSupported()) new Notification({ title, body }).show();
  } catch {}
}

function launchMainApp() {
  try {
    const child = spawn(process.execPath, [], { detached: true, stdio: "ignore", windowsHide: false });
    child.unref();
  } catch {}
}

function latestActivityLabel() {
  const latest = activities[0];
  if (!latest) return "Žádná nová událost";
  const name = latest.fileName ? ` · ${latest.fileName}` : "";
  return `${latest.title || "Poslední kontrola"}${name}`.slice(0, 90);
}

function refreshTray() {
  if (!tray || tray.isDestroyed?.()) return;
  try {
    const profile = profileConfig(preferences);
    tray.setToolTip(`VoxarioProtect · ${profile.label} · skóre ${protectionScore}/100`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "VoxarioProtect je aktivní", enabled: false },
      { label: `Profil: ${profile.label}`, enabled: false },
      { label: `Protection Score: ${protectionScore}/100`, enabled: false },
      { label: latestActivityLabel(), enabled: false },
      { type: "separator" },
      { label: "Otevřít VoxarioProtect / Nastavení", click: launchMainApp },
      { label: "Obnovit stav Defenderu", click: () => void refreshDefenderStatus({ notify: true }) },
      { label: "Otevřít Windows Security", click: () => shell.openExternal("windowsdefender:") },
      { type: "separator" },
      { label: "Ukončit Protect pro tuto relaci", click: () => app.quit() },
    ]));
  } catch {}
}

function createTray() {
  const candidates = [
    path.join(__dirname, "assets", "tray.png"),
    path.join(__dirname, "assets", "icon.ico"),
  ];
  let icon = nativeImage.createEmpty();
  for (const candidate of candidates) {
    try {
      const loaded = nativeImage.createFromPath(candidate);
      if (!loaded.isEmpty()) { icon = loaded; break; }
    } catch {}
  }
  if (!icon.isEmpty()) icon = icon.resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.on("click", launchMainApp);
  refreshTray();
}

function scheduleDefenderRefresh() {
  if (defenderTimer) clearInterval(defenderTimer);
  const interval = profileConfig(preferences).defenderRefreshMs;
  defenderTimer = setInterval(() => void refreshDefenderStatus({ notify: true }), interval);
  defenderTimer.unref?.();
}

function applyPreferences() {
  const previous = preferences;
  preferences = loadProtectPreferences(app);
  if (!previous || previous.profile !== preferences.profile) scheduleDefenderRefresh();
  if (preferences.monitorDownloads) startDownloadsWatcher();
  else stopDownloadsWatcher();
  refreshTray();
  saveState();
}

function watchPreferences() {
  if (settingsWatcherActive) return;
  settingsWatcherActive = true;
  const target = preferencesPath(app);
  try {
    fs.watchFile(target, { interval: 1500, persistent: false }, () => applyPreferences());
  } catch {}
}

function cleanup() {
  stopDownloadsWatcher();
  if (defenderTimer) clearInterval(defenderTimer);
  for (const timer of pendingFiles.values()) clearTimeout(timer);
  pendingFiles.clear();
  try { fs.unwatchFile(preferencesPath(app)); } catch {}
  saveState();
}

app.whenReady().then(async () => {
  preferences = loadProtectPreferences(app);
  loadState();
  createTray();
  if (preferences.monitorDownloads) startDownloadsWatcher();
  watchPreferences();
  await refreshDefenderStatus({ notify: false });
  scheduleDefenderRefresh();
});

app.on("before-quit", cleanup);

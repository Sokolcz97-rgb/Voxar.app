"use strict";

// Lightweight resident companion for VoxarioProtect.
// Microsoft Defender and Windows Defender Firewall remain the authoritative
// Windows security engines. Protect adds a local second opinion and read-only
// firewall health monitoring. It never creates Defender exclusions, restores
// Defender quarantine items, disables security features, opens firewall ports,
// changes Windows Firewall policy, or uploads file contents.

const { app, Tray, Menu, nativeImage, shell, Notification } = require("electron");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");
const { calculateProtectionScore, calculateFileTrust } = require("./protect-trust-engine.cjs");
const {
  calculateLayeredRisk,
  reconcileVerdicts,
  constants: layeredConstants,
} = require("./protect-layered-engine.cjs");
const {
  firewallStatusScript,
  summarizeFirewallProfiles,
} = require("./protect-firewall.cjs");
const {
  loadProtectPreferences,
  preferencesPath,
  profileConfig,
} = require("./protect-preferences.cjs");

const RISKY_EXTENSIONS = new Set([
  ".exe", ".msi", ".msix", ".com", ".scr", ".bat", ".cmd", ".ps1",
  ".js", ".jse", ".vbs", ".vbe", ".dll", ".jar", ".hta", ".wsf",
]);
const DOWNLOAD_DEBOUNCE_MS = 1800;
const MAX_ACTIVITY = 160;

let tray = null;
let downloadWatcher = null;
let defenderTimer = null;
let settingsWatcherActive = false;
let cachedDefenderStatus = { AccessLimited: true };
let cachedFirewallStatus = { available: false, allEnabled: false, profiles: [] };
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
    if (data.firewallStatus && typeof data.firewallStatus === "object") {
      cachedFirewallStatus = data.firewallStatus;
    }
  } catch {}
}

function saveState() {
  try {
    fs.writeFileSync(stateFile(), JSON.stringify({
      updatedAt: new Date().toISOString(),
      protectionScore,
      defenderStatus: cachedDefenderStatus,
      firewallStatus: cachedFirewallStatus,
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

function runPowerShell(script, timeoutMs = 12_000, env = {}) {
  return new Promise((resolve) => {
    if (process.platform !== "win32") return resolve({ ok: false, error: "Windows only" });
    const child = spawn("powershell.exe", [
      "-NoProfile", "-NonInteractive", "-Command", script,
    ], {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...env },
    });
    let out = "";
    let err = "";
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ ok: false, error: "PowerShell timeout" });
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { out += chunk.toString("utf8"); });
    child.stderr.on("data", (chunk) => { err += chunk.toString("utf8"); });
    child.once("error", (error) => {
      clearTimeout(timer);
      finish({ ok: false, error: error?.message || String(error) });
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return finish({ ok: false, error: err.trim() || `PowerShell exit ${code}`, output: out.trim() });
      finish({ ok: true, output: out.trim() });
    });
  });
}

async function runPowerShellJson(script, timeoutMs = 12_000, env = {}) {
  const result = await runPowerShell(script, timeoutMs, env);
  if (!result.ok) return { ...result, data: null };
  try { return { ...result, data: JSON.parse(result.output || "null") }; }
  catch { return { ok: false, error: "Invalid PowerShell JSON", data: null }; }
}

async function refreshDefenderStatus({ notify = false } = {}) {
  const result = await runPowerShellJson(
    "$s=Get-MpComputerStatus; [pscustomobject]@{AntivirusEnabled=$s.AntivirusEnabled;RealTimeProtectionEnabled=$s.RealTimeProtectionEnabled;BehaviorMonitorEnabled=$s.BehaviorMonitorEnabled;IoavProtectionEnabled=$s.IoavProtectionEnabled;AntivirusSignatureAge=$s.AntivirusSignatureAge;AMRunningMode=$s.AMRunningMode} | ConvertTo-Json -Compress"
  );
  const status = result.data;
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
    addActivity({ type: "defender", status: "warning", severity: "high", title: "Real-time ochrana je vypnutá" });
  }
}

async function refreshFirewallStatus({ notify = false } = {}) {
  const result = await runPowerShellJson(firewallStatusScript());
  if (!result.ok || !result.data) {
    cachedFirewallStatus = { available: false, allEnabled: false, profiles: [] };
    saveState();
    refreshTray();
    return;
  }
  const previousAllEnabled = cachedFirewallStatus?.allEnabled;
  cachedFirewallStatus = summarizeFirewallProfiles(result.data);
  saveState();
  refreshTray();
  if (notify && previousAllEnabled !== false && cachedFirewallStatus.allEnabled === false) {
    showNotification("VoxarioProtect Firewall", "Některý profil Windows Defender Firewall je vypnutý.");
    addActivity({
      type: "firewall",
      status: "warning",
      severity: "high",
      title: "Windows Defender Firewall není plně aktivní",
      detail: "Protect firewall nevypíná ani nenahrazuje. Zkontroluj profily Windows Firewallu.",
    });
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

async function getAuthenticodeSignature(filePath) {
  const result = await runPowerShellJson(
    "$s=Get-AuthenticodeSignature -LiteralPath $env:VOXARIO_PROTECT_TARGET; [pscustomobject]@{Status=[string]$s.Status;Valid=([string]$s.Status -eq 'Valid');Signer=$(if($s.SignerCertificate){$s.SignerCertificate.Subject}else{$null})} | ConvertTo-Json -Compress",
    12_000,
    { VOXARIO_PROTECT_TARGET: filePath },
  );
  return result.ok ? result.data : null;
}

async function readScriptSample(filePath, extension, maxBytes) {
  if (!layeredConstants.SCRIPT_EXTENSIONS.has(extension)) return "";
  try {
    const handle = await fs.promises.open(filePath, "r");
    try {
      const stat = await handle.stat();
      const length = Math.min(stat.size, maxBytes);
      if (length <= 0) return "";
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, 0);
      return buffer.subarray(0, bytesRead).toString("utf8");
    } finally {
      await handle.close();
    }
  } catch {
    return "";
  }
}

async function collectLocalSignals(filePath, previousHash = null) {
  const stat = await fs.promises.stat(filePath);
  if (!stat.isFile()) throw new Error("Not a file");
  const extension = path.extname(filePath).toLowerCase();
  const profile = profileConfig(preferences);
  const [sha256, signature, scriptText] = await Promise.all([
    hashFile(filePath, profile.maxAutoHashBytes),
    getAuthenticodeSignature(filePath),
    readScriptSample(filePath, extension, profile.id === "maximum" ? 2 * 1024 * 1024 : profile.id === "eco" ? 256 * 1024 : 1024 * 1024),
  ]);
  const trust = calculateFileTrust({
    fileName: path.basename(filePath),
    size: stat.size,
    modifiedAt: stat.mtime,
    signature,
    defenderStatus: cachedDefenderStatus,
    defenderDetected: false,
  });
  const layered = calculateLayeredRisk({
    fileName: path.basename(filePath),
    extension,
    size: stat.size,
    signatureValid: signature?.Valid === true || signature?.valid === true,
    trustScore: trust.score,
    scriptText,
    hashChanged: !!(previousHash && sha256 && previousHash !== sha256),
  });
  return { stat, extension, sha256, signature, trust, layered };
}

async function requestDefenderScan(filePath) {
  return runPowerShell(
    "$ErrorActionPreference='Stop'; Start-MpScan -ScanType CustomScan -ScanPath $env:VOXARIO_PROTECT_TARGET; 'ok'",
    60_000,
    { VOXARIO_PROTECT_TARGET: filePath },
  );
}

async function queryRecentDefenderDetection(filePath, sinceIso) {
  const script = [
    "$ErrorActionPreference='Stop'",
    "$target=[IO.Path]::GetFullPath($env:VOXARIO_PROTECT_TARGET).ToLowerInvariant()",
    "$since=[datetime]::Parse($env:VOXARIO_PROTECT_SCAN_SINCE).ToUniversalTime().AddMinutes(-1)",
    "$hit=Get-MpThreatDetection | Where-Object { $_.InitialDetectionTime -ge $since -and $_.Resources -and (($_.Resources -join \"`n\").ToLowerInvariant().Contains($target)) } | Sort-Object InitialDetectionTime -Descending | Select-Object -First 1",
    "$(if($hit){[pscustomobject]@{Detected=$true;ThreatID=$hit.ThreatID;ThreatStatusID=$hit.ThreatStatusID;InitialDetectionTime=$hit.InitialDetectionTime;Resources=$hit.Resources}}else{[pscustomobject]@{Detected=$false}}) | ConvertTo-Json -Compress",
  ].join("; ");
  const result = await runPowerShellJson(script, 20_000, {
    VOXARIO_PROTECT_TARGET: filePath,
    VOXARIO_PROTECT_SCAN_SINCE: sinceIso,
  });
  return result.ok && result.data ? result.data : { Detected: false, QueryFailed: true };
}

async function inspectDownloadedFile(filePath) {
  try {
    const stat = await fs.promises.stat(filePath);
    if (!stat.isFile()) return;
    const ext = path.extname(filePath).toLowerCase();
    if (!RISKY_EXTENSIONS.has(ext)) return;

    const profile = profileConfig(preferences);
    const first = await collectLocalSignals(filePath);
    addActivity({
      type: "file",
      status: first.layered.severity === "critical" ? "warning" : "review",
      severity: first.layered.severity,
      title: "Protect provedl lokální první kontrolu",
      fileName: path.basename(filePath),
      sha256: first.sha256,
      trustScore: first.trust.score,
      protectRiskScore: first.layered.score,
      verdict: first.trust.verdict,
      reasons: [...first.trust.reasons, ...first.layered.reasons],
      profile: profile.id,
    });

    if (!first.layered.shouldEscalateDefender) return;

    addActivity({
      type: "cross-check",
      status: "scanning",
      severity: "info",
      title: "Protect žádá druhý názor Microsoft Defenderu",
      fileName: path.basename(filePath),
      protectRiskScore: first.layered.score,
    });

    const scanStartedAt = new Date().toISOString();
    const defenderScan = await requestDefenderScan(filePath);
    if (!defenderScan.ok) {
      addActivity({
        type: "cross-check",
        status: "warning",
        severity: "medium",
        title: "Defender cross-check se nepodařilo dokončit",
        fileName: path.basename(filePath),
        detail: "Protect nic automaticky nepovolil. Doporučena je ruční kontrola ve Windows Security.",
      });
      return;
    }

    const defender = await queryRecentDefenderDetection(filePath, scanStartedAt);
    if (!fs.existsSync(filePath)) {
      addActivity({
        type: "defender",
        status: "threat",
        severity: "high",
        title: "Soubor po kontrole Defenderu už není na původním místě",
        fileName: path.basename(filePath),
        detail: "Windows Security mohl soubor odstranit nebo přesunout do karantény. Zkontroluj historii ochrany.",
      });
      showNotification("VoxarioProtect", `Defender zasáhl u souboru ${path.basename(filePath)}.`);
      return;
    }

    const second = await collectLocalSignals(filePath, first.sha256);
    const decision = reconcileVerdicts({
      firstPass: first.layered,
      secondPass: second.layered,
      defenderDetected: defender?.Detected === true,
    });

    if (defender?.Detected === true) {
      addActivity({
        type: "defender",
        status: "threat",
        severity: "high",
        title: "Microsoft Defender potvrdil hrozbu",
        fileName: path.basename(filePath),
        detail: "Protect nepřepisuje akci Defenderu. Otevři historii ochrany a ověř výsledek nápravy.",
        threatId: defender.ThreatID || null,
        sha256: second.sha256,
      });
      showNotification("VoxarioProtect", `Defender potvrdil hrozbu: ${path.basename(filePath)}.`);
      return;
    }

    if (decision.verdict === "protect-only-critical") {
      addActivity({
        type: "protect",
        status: "threat",
        severity: "high",
        title: "Protect našel kritické riziko, Defender ale nic nenašel",
        fileName: path.basename(filePath),
        detail: "Dvě nezávislé lokální kontroly Protectu se shodly na kritickém riziku. Protect soubor automaticky nepovolí a doporučí ruční izolaci nebo kontrolu ve Windows Security.",
        protectRiskScore: second.layered.score,
        sha256: second.sha256,
        reasons: second.layered.reasons,
      });
      showNotification("VoxarioProtect — kritické riziko", `${path.basename(filePath)} zůstává podezřelý i po čistém výsledku Defenderu.`);
      return;
    }

    if (decision.verdict === "protect-only-high") {
      addActivity({
        type: "protect",
        status: "warning",
        severity: "high",
        title: "Defender nic nenašel, Protect stále vidí významné riziko",
        fileName: path.basename(filePath),
        detail: decision.message,
        protectRiskScore: second.layered.score,
        sha256: second.sha256,
        reasons: second.layered.reasons,
      });
      showNotification("VoxarioProtect", `${path.basename(filePath)} vyžaduje ruční kontrolu.`);
      return;
    }

    addActivity({
      type: "cross-check",
      status: "complete",
      severity: decision.severity,
      title: "Dvojitá kontrola dokončena",
      fileName: path.basename(filePath),
      detail: decision.message,
      protectRiskScore: second.layered.score,
      sha256: second.sha256,
    });
  } catch (error) {
    addActivity({
      type: "protect",
      status: "warning",
      severity: "medium",
      title: "Lokální kontrola souboru selhala",
      fileName: path.basename(String(filePath || "")),
      detail: String(error?.message || error || "Neznámá chyba").slice(0, 220),
    });
  }
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
    const firewallLabel = cachedFirewallStatus.available
      ? (cachedFirewallStatus.allEnabled ? "Windows Firewall aktivní" : "Windows Firewall vyžaduje pozornost")
      : "Windows Firewall stav neznámý";
    tray.setToolTip(`VoxarioProtect · ${profile.label} · skóre ${protectionScore}/100 · ${firewallLabel}`);
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "VoxarioProtect je aktivní", enabled: false },
      { label: `Profil: ${profile.label}`, enabled: false },
      { label: `Protection Score: ${protectionScore}/100`, enabled: false },
      { label: firewallLabel, enabled: false },
      { label: latestActivityLabel(), enabled: false },
      { type: "separator" },
      { label: "Otevřít VoxarioProtect / Nastavení", click: launchMainApp },
      { label: "Obnovit Defender + Firewall", click: () => { void refreshDefenderStatus({ notify: true }); void refreshFirewallStatus({ notify: true }); } },
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
  defenderTimer = setInterval(() => {
    void refreshDefenderStatus({ notify: true });
    void refreshFirewallStatus({ notify: true });
  }, interval);
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
  await Promise.all([
    refreshDefenderStatus({ notify: false }),
    refreshFirewallStatus({ notify: false }),
  ]);
  scheduleDefenderRefresh();
});

app.on("before-quit", cleanup);

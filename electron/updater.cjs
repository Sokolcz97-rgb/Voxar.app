// StudioVoxario desktop updater — standard electron-updater integration.
// No cmd.exe, no batch files, no custom file replacement. electron-updater
// downloads into its cache, validates checksums from latest.yml/beta.yml, then
// starts the NSIS installer and quits the app via quitAndInstall().
const { app, BrowserWindow, ipcMain, Notification } = require("electron");
const { autoUpdater } = require("electron-updater");
const path = require("path");
const fs = require("fs");
const https = require("https");
const http = require("http");
const pinning = require("./pinning.cjs");

const FEED_URL = process.env.STUDIOVOXARIO_UPDATE_FEED || "https://studiovoxario.com/";
const LEGACY_MANIFEST_URL = process.env.STUDIOVOXARIO_UPDATE_URL || "https://studiovoxario.com/desktop-version.json";

let checking = false;
let installing = false;
let downloadedVersion = null;
let latestInfo = null;
let cancellationToken = null;
let uiBridge = null;

const diagnostics = {
  feedUrl: FEED_URL,
  manifestUrl: LEGACY_MANIFEST_URL,
  currentVersion: null,
  remoteVersion: null,
  channel: "stable",
  status: "idle",
  lastError: null,
  lastCheckAt: null,
  updateInfo: null,
  pinnedThumbprints: [],
  progress: {
    phase: null,
    label: null,
    received: 0,
    total: 0,
    pct: 0,
    speedBps: 0,
    etaSec: null,
    canceled: false,
    startedAt: null,
    updatedAt: null,
  },
  logs: [],
};

function normalizeChannel(channel = "stable") {
  return channel === "beta" ? "beta" : "latest";
}

function publicChannel(channel = "stable") {
  return channel === "beta" ? "beta" : "stable";
}

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`;
  diagnostics.logs.push(line);
  if (diagnostics.logs.length > 200) diagnostics.logs.splice(0, diagnostics.logs.length - 200);
  try { console.log(line); } catch {}
  broadcast("launcher:log", line);
}

function broadcast(channel, payload) {
  try {
    BrowserWindow.getAllWindows().forEach((win) => {
      if (!win.isDestroyed()) win.webContents.send(channel, payload);
    });
  } catch {}
}

function updateProgress(patch) {
  diagnostics.progress = { ...diagnostics.progress, ...patch, updatedAt: new Date().toISOString() };
  broadcast("launcher:progress", diagnostics.progress);
}

function getDiagnostics() {
  return {
    ...diagnostics,
    logs: diagnostics.logs.slice(),
    progress: { ...diagnostics.progress },
    updateInfo: diagnostics.updateInfo ? { ...diagnostics.updateInfo } : null,
    pinnedThumbprints: pinning.loadPins().thumbprints || [],
  };
}

function setUiBridge(fn) {
  uiBridge = typeof fn === "function" ? fn : null;
}

async function notifyUser({ type = "info", title = "StudioVoxario", message, detail }) {
  if (uiBridge) {
    try {
      const res = await uiBridge({ kind: "notice", type, title, message, detail });
      if (res && res.ok) return;
    } catch (error) {
      log(`UI notice selhalo: ${error.message || error}`);
    }
  }
  if (Notification.isSupported()) {
    try { new Notification({ title, body: [message, detail].filter(Boolean).join("\n") }).show(); } catch {}
  }
}

async function askUser({ title, message, detail, buttons, defaultId = 0, cancelId = 1 }) {
  if (uiBridge) {
    try {
      const res = await uiBridge({ kind: "question", title, message, detail, buttons, defaultId, cancelId });
      if (res && typeof res.response === "number") return res.response;
    } catch (error) {
      log(`UI prompt selhal: ${error.message || error}`);
    }
  }
  return cancelId;
}

function fetchJson(url, { bustCache = true } = {}) {
  return new Promise((resolve, reject) => {
    const finalUrl = bustCache ? `${url}${url.includes("?") ? "&" : "?"}t=${Date.now()}` : url;
    const lib = finalUrl.startsWith("https") ? https : http;
    const req = lib.get(finalUrl, {
      headers: {
        "User-Agent": "StudioVoxario-Desktop",
        "Cache-Control": "no-cache, no-store, max-age=0",
        "Pragma": "no-cache",
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(fetchJson(res.headers.location, { bustCache: false }));
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      let body = "";
      res.on("data", (chunk) => { body += chunk; });
      res.on("end", () => {
        try { resolve(JSON.parse(body)); } catch (error) { reject(error); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

function pickLegacyChannel(manifest, channel = "stable") {
  if (!manifest || typeof manifest !== "object") return manifest;
  const key = publicChannel(channel);
  if (manifest.channels && typeof manifest.channels === "object") {
    return { ...manifest, ...(manifest.channels[key] || manifest.channels.stable || manifest.channels.beta || {}) };
  }
  return manifest;
}

async function fetchManifest() {
  return fetchJson(LEGACY_MANIFEST_URL, { bustCache: true });
}

function configureUpdater(channel = "stable") {
  const updaterChannel = normalizeChannel(channel);
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.autoRunAppAfterInstall = true;
  autoUpdater.allowPrerelease = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.disableWebInstaller = true;
  autoUpdater.disableDifferentialDownload = true;
  autoUpdater.channel = updaterChannel;
  autoUpdater.requestHeaders = {
    "Cache-Control": "no-cache, no-store, max-age=0",
    "Pragma": "no-cache",
  };
  autoUpdater.setFeedURL({ provider: "generic", url: FEED_URL, channel: updaterChannel });
  diagnostics.channel = publicChannel(channel);
  diagnostics.currentVersion = app.getVersion();
}

function semverKey(version) {
  return String(version || "")
    .replace(/^v/i, "")
    .split(/[.-]/)
    .map((part) => (/^\d+$/.test(part) ? part.padStart(8, "0") : part.toLowerCase()))
    .join(".");
}

function isNewer(remote, current) {
  return semverKey(remote) > semverKey(current);
}

function toAvailability(updateInfo, channel = "stable") {
  const current = app.getVersion();
  const remote = updateInfo?.version || null;
  const available = Boolean(remote && isNewer(remote, current));
  const payload = {
    available,
    current,
    remote,
    notes: updateInfo?.releaseNotes || updateInfo?.notes || null,
    channel: publicChannel(channel),
  };
  broadcast("update:availability", payload);
  return payload;
}

async function checkForUpdatesQuiet({ channel = "stable" } = {}) {
  configureUpdater(channel);
  diagnostics.lastCheckAt = new Date().toISOString();
  try {
    const result = await autoUpdater.checkForUpdates();
    const info = result?.updateInfo || null;
    latestInfo = info;
    diagnostics.updateInfo = info;
    diagnostics.remoteVersion = info?.version || null;
    diagnostics.status = info?.version && isNewer(info.version, app.getVersion()) ? "available" : "up-to-date";
    return toAvailability(info, channel);
  } catch (error) {
    diagnostics.status = "error";
    diagnostics.lastError = String(error?.message || error);
    log(`Tichá kontrola aktualizací selhala: ${diagnostics.lastError}`);
    return legacyQuietCheck(channel, error);
  }
}

async function legacyQuietCheck(channel, originalError) {
  try {
    const raw = await fetchManifest();
    const manifest = pickLegacyChannel(raw, channel);
    latestInfo = { version: manifest.version, releaseNotes: manifest.notes || null };
    diagnostics.remoteVersion = manifest.version || null;
    diagnostics.updateInfo = latestInfo;
    diagnostics.status = manifest.version && isNewer(manifest.version, app.getVersion()) ? "available" : "up-to-date";
    return toAvailability(latestInfo, channel);
  } catch {
    const payload = { available: false, error: String(originalError?.message || originalError), current: app.getVersion(), remote: null, channel: publicChannel(channel) };
    broadcast("update:availability", payload);
    return payload;
  }
}

async function checkForUpdates({ silent = true, parentWindow = null, channel = "stable" } = {}) {
  if (checking || installing) return { status: "busy" };
  checking = true;
  configureUpdater(channel);
  diagnostics.status = "checking";
  diagnostics.lastError = null;
  diagnostics.lastCheckAt = new Date().toISOString();
  diagnostics.currentVersion = app.getVersion();
  log(`Kontrola aktualizací přes electron-updater — ${diagnostics.currentVersion} (${publicChannel(channel)})`);

  try {
    const result = await autoUpdater.checkForUpdates();
    const info = result?.updateInfo || null;
    latestInfo = info;
    diagnostics.updateInfo = info;
    diagnostics.remoteVersion = info?.version || null;
    const remote = info?.version;

    if (!remote || !isNewer(remote, app.getVersion())) {
      diagnostics.status = "up-to-date";
      toAvailability(info, channel);
      if (!silent) {
        await notifyUser({ title: "StudioVoxario", message: "Máte nejnovější verzi", detail: `Aktuální verze: ${app.getVersion()}` });
      }
      return { status: "up-to-date", current: app.getVersion() };
    }

    diagnostics.status = "available";
    toAvailability(info, channel);

    const shouldDownload = silent ? false : (await askUser({
      title: "Nová verze StudioVoxario",
      message: `Je k dispozici verze ${remote}`,
      detail: `Aktuální verze: ${app.getVersion()}\nNová verze: ${remote}\n\n${info.releaseNotes || ""}`.trim(),
      buttons: ["Stáhnout a nainstalovat", "Později"],
      defaultId: 0,
      cancelId: 1,
    })) === 0;

    if (!shouldDownload) return { status: silent ? "available" : "postponed", version: remote };
    return downloadAndInstall({ parentWindow, channel, source: "manual" });
  } catch (error) {
    diagnostics.status = "error";
    diagnostics.lastError = String(error?.message || error);
    log(`Kontrola aktualizací selhala: ${diagnostics.lastError}`);
    if (!silent) {
      await notifyUser({ type: "error", title: "Aktualizace selhala", message: "Nepodařilo se zkontrolovat aktualizace", detail: diagnostics.lastError });
    }
    return { status: "error", error: diagnostics.lastError };
  } finally {
    checking = false;
  }
}

async function downloadAndInstall({ parentWindow = null, channel = "stable", source = "manual" } = {}) {
  if (installing) return { status: "busy" };
  installing = true;
  configureUpdater(channel);
  diagnostics.status = "downloading";
  diagnostics.lastError = null;
  cancellationToken = new autoUpdater._logger.constructor.CancellationToken?.();

  updateProgress({
    phase: "download",
    label: "Stahuji aktualizaci",
    received: 0,
    total: 0,
    pct: 0,
    speedBps: 0,
    etaSec: null,
    canceled: false,
    startedAt: new Date().toISOString(),
  });

  try {
    const result = latestInfo && isNewer(latestInfo.version, app.getVersion())
      ? null
      : await autoUpdater.checkForUpdates();
    if (result?.updateInfo) latestInfo = result.updateInfo;
    const remote = latestInfo?.version || diagnostics.remoteVersion;
    if (!remote || !isNewer(remote, app.getVersion())) {
      diagnostics.status = "up-to-date";
      installing = false;
      return { status: "up-to-date" };
    }

    log(`${source}: stahuji verzi ${remote} přes electron-updater cache.`);
    await autoUpdater.downloadUpdate(cancellationToken || undefined);
    downloadedVersion = remote;
    diagnostics.status = "downloaded";
    updateProgress({ phase: "installing", label: `Instaluji StudioVoxario ${remote}`, pct: 1 });

    if (uiBridge) {
      uiBridge({
        kind: "installing",
        title: "Instaluji aktualizaci",
        message: `StudioVoxario ${remote}`,
        detail: "Aplikace se ukončí a standardní instalátor dokončí aktualizaci bez příkazového okna.",
        version: remote,
      }).catch(() => {});
    }

    isQuittingForUpdate();
    setTimeout(() => autoUpdater.quitAndInstall(true, true), 600);
    return { status: "installing", version: remote };
  } catch (error) {
    installing = false;
    const msg = String(error?.message || error);
    const canceled = /cancel/i.test(msg);
    diagnostics.status = canceled ? "canceled" : "error";
    diagnostics.lastError = canceled ? "Zrušeno uživatelem" : msg;
    updateProgress({ phase: canceled ? "canceled" : "error", label: canceled ? "Zrušeno" : "Chyba", canceled });
    log(`${source}: aktualizace selhala — ${diagnostics.lastError}`);
    if (!canceled) {
      await notifyUser({ type: "error", title: "Aktualizace selhala", message: "Stažení nebo instalace se nepodařila", detail: msg });
    }
    return { status: canceled ? "canceled" : "error", error: msg };
  }
}

function isQuittingForUpdate() {
  try { app.isQuittingForUpdate = true; } catch {}
}

async function installUpdateFromRenderer({ parentWindow = null, channel = "stable" } = {}) {
  const availability = await checkForUpdatesQuiet({ channel });
  if (!availability.available) return { status: "up-to-date" };
  return downloadAndInstall({ parentWindow, channel, source: "renderer" });
}

async function installVerified({ asset, version, parentWindow = null, label = "install" }) {
  // Rollback used to call the legacy installer pipeline. To avoid reintroducing
  // custom file replacement or shell scripts, rollback now delegates to the
  // standard updater only when the requested version is the current feed target.
  const info = await checkForUpdatesQuiet({ channel: "stable" });
  if (info.available && (!version || info.remote === version)) {
    return downloadAndInstall({ parentWindow, channel: "stable", source: label });
  }
  log(`${label}: rollback přes custom installer je vypnutý; electron-updater nepodporuje bezpečný downgrade z legacy manifestu.`);
  return { status: "unsupported", version, asset };
}

function cancelActiveDownload() {
  try {
    if (cancellationToken && typeof cancellationToken.cancel === "function") {
      cancellationToken.cancel();
      updateProgress({ phase: "canceled", label: "Zrušeno", canceled: true });
      return true;
    }
  } catch {}
  return false;
}

function getPinState() { return pinning.loadPins(); }
function resetPinState() { return pinning.resetPins(); }

function setupEvents() {
  autoUpdater.logger = {
    info: (m) => log(String(m)),
    warn: (m) => log(`WARN: ${m}`),
    error: (m) => log(`ERROR: ${m}`),
    debug: (m) => log(`DEBUG: ${m}`),
  };

  autoUpdater.on("checking-for-update", () => {
    diagnostics.status = "checking";
  });
  autoUpdater.on("update-available", (info) => {
    latestInfo = info;
    diagnostics.status = "available";
    diagnostics.updateInfo = info;
    diagnostics.remoteVersion = info?.version || null;
    toAvailability(info, diagnostics.channel);
  });
  autoUpdater.on("update-not-available", (info) => {
    latestInfo = info;
    diagnostics.status = "up-to-date";
    diagnostics.updateInfo = info;
    diagnostics.remoteVersion = info?.version || null;
    toAvailability(info, diagnostics.channel);
  });
  autoUpdater.on("download-progress", (p) => {
    const total = Number(p.total || 0);
    const received = Number(p.transferred || 0);
    updateProgress({
      phase: "download",
      label: `Stahuji StudioVoxario ${latestInfo?.version || ""}`.trim(),
      received,
      total,
      pct: total > 0 ? received / total : Math.max(0, Math.min(1, Number(p.percent || 0) / 100)),
      speedBps: Number(p.bytesPerSecond || 0),
      etaSec: total > 0 && p.bytesPerSecond > 0 ? (total - received) / p.bytesPerSecond : null,
    });
  });
  autoUpdater.on("update-downloaded", (info) => {
    downloadedVersion = info?.version || latestInfo?.version || null;
    diagnostics.status = "downloaded";
    diagnostics.updateInfo = info;
    log(`Aktualizace stažena: ${downloadedVersion || "neznámá verze"}`);
  });
  autoUpdater.on("error", (error) => {
    diagnostics.status = "error";
    diagnostics.lastError = String(error?.message || error);
    updateProgress({ phase: "error", label: "Chyba" });
    log(`electron-updater chyba: ${diagnostics.lastError}`);
  });

  try {
    const devConfig = path.join(app.getAppPath(), "dev-app-update.yml");
    if (!app.isPackaged && !fs.existsSync(devConfig)) {
      fs.writeFileSync(devConfig, `provider: generic\nurl: ${FEED_URL}\nupdaterCacheDirName: studiovoxario-desktop-updater\n`, "utf8");
    }
  } catch {}
}

setupEvents();

module.exports = {
  checkForUpdates,
  getDiagnostics,
  installVerified,
  fetchManifest,
  cancelActiveDownload,
  getPinState,
  resetPinState,
  setUiBridge,
  checkForUpdatesQuiet,
  installUpdateFromRenderer,
};
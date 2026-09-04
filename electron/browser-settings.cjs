/**
 * VoxarioBrowser – nastavení, soukromí, stahování, ochrana, hesla, výkon.
 * Vše běží v main procesu; renderer (browser.html) komunikuje přes IPC "vb:*".
 */
const fs = require("fs");
const path = require("path");
const { app, ipcMain, session, dialog, shell, safeStorage, BrowserWindow } = require("electron");

const PARTITION = "persist:voxario";

/* ------------------------------------------------------------------ */
/* Vyhledávače                                                         */
/* ------------------------------------------------------------------ */
const SEARCH_ENGINES = [
  { id: "google", label: "Google", url: "https://www.google.com/search?q=%s", home: "https://www.google.com" },
  { id: "bing", label: "Bing", url: "https://www.bing.com/search?q=%s", home: "https://www.bing.com" },
  { id: "seznam", label: "Seznam.cz", url: "https://search.seznam.cz/?q=%s", home: "https://www.seznam.cz" },
  { id: "duckduckgo", label: "DuckDuckGo", url: "https://duckduckgo.com/?q=%s", home: "https://duckduckgo.com" },
  { id: "brave", label: "Brave Search", url: "https://search.brave.com/search?q=%s", home: "https://search.brave.com" },
  { id: "startpage", label: "Startpage", url: "https://www.startpage.com/sp/search?query=%s", home: "https://www.startpage.com" },
  { id: "ecosia", label: "Ecosia", url: "https://www.ecosia.org/search?q=%s", home: "https://www.ecosia.org" },
  { id: "yandex", label: "Yandex", url: "https://yandex.com/search/?text=%s", home: "https://yandex.com" },
];

const DEFAULTS = {
  searchEngine: "google",
  homepage: "",
  // soukromí
  blockThirdPartyCookies: false,
  doNotTrack: true,
  clearOnExit: false,
  historyEnabled: true,
  // ochrana
  adblock: true,
  blockTrackers: true,
  blockMalware: true,
  httpsOnly: true,
  blockDangerousDownloads: true,
  // stahování
  askDownloadLocation: false,
  downloadDir: "",
  // hesla
  savePasswords: true,
  // výkon
  hardwareAcceleration: true,
  imageLoading: true,
  backgroundThrottling: true,
  maxActiveTabs: 0,
  // vývojář
  devtoolsEnabled: false,
};

/* ------------------------------------------------------------------ */
/* Úložiště                                                            */
/* ------------------------------------------------------------------ */
function fileIn(name) {
  return path.join(app.getPath("userData"), name);
}
function readJson(name, fallback) {
  try {
    const raw = fs.readFileSync(fileIn(name), "utf8");
    const data = JSON.parse(raw);
    return data ?? fallback;
  } catch {
    return fallback;
  }
}
function writeJson(name, data) {
  try {
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.writeFileSync(fileIn(name), JSON.stringify(data, null, 2), "utf8");
  } catch (e) {
    console.error("write", name, e);
  }
  return data;
}

let prefs = null;
function getPrefs() {
  if (!prefs) prefs = { ...DEFAULTS, ...readJson("browser-prefs.json", {}) };
  if (!prefs.downloadDir) {
    try { prefs.downloadDir = app.getPath("downloads"); } catch { prefs.downloadDir = ""; }
  }
  return prefs;
}
function setPrefs(patch) {
  prefs = { ...getPrefs(), ...(patch || {}) };
  writeJson("browser-prefs.json", prefs);
  applyPrefs();
  return prefs;
}

/* ------------------------------------------------------------------ */
/* Historie a stahování                                                */
/* ------------------------------------------------------------------ */
const HISTORY_MAX = 3000;
let history = null;
function getHistory() {
  if (!history) history = readJson("browser-history.json", []);
  return history;
}
function pushHistory(entry) {
  if (!getPrefs().historyEnabled) return getHistory();
  const url = String(entry?.url || "");
  if (!/^https?:/i.test(url)) return getHistory();
  const list = getHistory();
  const last = list[0];
  if (last && last.url === url) {
    last.title = entry.title || last.title;
    last.at = Date.now();
  } else {
    list.unshift({ url, title: entry.title || url, at: Date.now() });
  }
  history = list.slice(0, HISTORY_MAX);
  writeJson("browser-history.json", history);
  return history;
}

let downloads = null;
function getDownloads() {
  if (!downloads) downloads = readJson("browser-downloads.json", []);
  return downloads;
}
function saveDownloads() {
  writeJson("browser-downloads.json", getDownloads().slice(0, 500));
  broadcast("vb:downloads", getDownloads());
}

/* ------------------------------------------------------------------ */
/* Hesla (šifrovaná pomocí OS keychain / DPAPI)                        */
/* ------------------------------------------------------------------ */
function encryptionAvailable() {
  try { return safeStorage.isEncryptionAvailable(); } catch { return false; }
}
function readVault() {
  return readJson("browser-vault.json", []);
}
function listPasswords() {
  return readVault().map((r) => ({ id: r.id, origin: r.origin, username: r.username, at: r.at, enc: !!r.enc }));
}
function revealPassword(id) {
  const rec = readVault().find((r) => r.id === id);
  if (!rec) return { ok: false, error: "Záznam nenalezen" };
  try {
    const value = rec.enc
      ? safeStorage.decryptString(Buffer.from(rec.password, "base64"))
      : rec.password;
    return { ok: true, password: value };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}
function savePassword({ origin, username, password }) {
  if (!getPrefs().savePasswords) return { ok: false, error: "Ukládání hesel je vypnuté" };
  const vault = readVault();
  const enc = encryptionAvailable();
  const stored = enc ? safeStorage.encryptString(String(password)).toString("base64") : String(password);
  const id = `${origin}|${username}`;
  const idx = vault.findIndex((r) => r.id === id);
  const rec = { id, origin, username, password: stored, enc, at: Date.now() };
  if (idx >= 0) vault[idx] = rec; else vault.push(rec);
  writeJson("browser-vault.json", vault);
  return { ok: true, items: listPasswords() };
}
function deletePassword(id) {
  writeJson("browser-vault.json", readVault().filter((r) => r.id !== id));
  return listPasswords();
}

/* ------------------------------------------------------------------ */
/* Ochrana: blokace reklam, trackerů, malware                          */
/* ------------------------------------------------------------------ */
const ADS_HOSTS = [
  "doubleclick.net", "googlesyndication.com", "googleadservices.com", "adservice.google.com",
  "adnxs.com", "adsrvr.org", "criteo.com", "criteo.net", "taboola.com", "outbrain.com",
  "pubmatic.com", "rubiconproject.com", "openx.net", "smartadserver.com", "casalemedia.com",
  "3lift.com", "sharethrough.com", "adform.net", "teads.tv", "yieldmo.com", "media.net",
  "zemanta.com", "bidswitch.net", "onetag-sys.com", "sonobi.com", "adroll.com", "ads.yahoo.com",
  "amazon-adsystem.com", "moatads.com", "serving-sys.com", "advertising.com", "revcontent.com",
  "mgid.com", "propellerads.com", "popads.net", "adcash.com", "exoclick.com", "juicyads.com",
  "trafficjunky.net", "seznam.net/rc", "imedia.cz/ad",
];
const TRACKER_HOSTS = [
  "google-analytics.com", "analytics.google.com", "googletagmanager.com", "googletagservices.com",
  "scorecardresearch.com", "quantserve.com", "hotjar.com", "mouseflow.com", "fullstory.com",
  "clarity.ms", "mixpanel.com", "segment.io", "segment.com", "amplitude.com", "branch.io",
  "chartbeat.com", "newrelic.com", "bugsnag.com", "sentry-cdn.com", "matomo.cloud",
  "facebook.net", "connect.facebook.net", "pixel.facebook.com", "analytics.tiktok.com",
  "ads.linkedin.com", "bat.bing.com", "yandex.ru/metrika", "mc.yandex.ru", "hubspot.com/__ptq.gif",
];
const MALWARE_HOSTS = [
  "malwarebytes-download.co", "fast-download-now.com", "free-codec-pack.net", "update-flash-player.net",
  "secure-pc-alert.com", "windows-support-alert.com", "your-pc-is-infected.com",
];
const DANGEROUS_EXT = [
  ".exe", ".scr", ".bat", ".cmd", ".com", ".pif", ".msi", ".vbs", ".vbe", ".js", ".jse",
  ".ps1", ".jar", ".hta", ".reg", ".dll", ".apk", ".lnk",
];

let blockStats = { ads: 0, trackers: 0, malware: 0 };

// Hostitelé, u kterých HTTPS selhalo — příště je pustíme přes HTTP.
const httpsFailures = new Set();

function hostMatches(url, list) {
  try {
    const u = new URL(url);
    const target = (u.hostname + u.pathname).toLowerCase();
    return list.some((h) => target.includes(h));
  } catch {
    return false;
  }
}

// Lokální síť, .local a IP adresy v privátních rozsazích HTTPS nevynucujeme.
function isLocalHost(hostname) {
  const h = String(hostname || "").toLowerCase();
  if (!h) return true;
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".home") || h.endsWith(".lan")) return true;
  if (/^127\./.test(h) || h === "::1" || h === "[::1]") return true;
  if (/^10\./.test(h)) return true;
  if (/^192\.168\./.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (/^169\.254\./.test(h)) return true;
  if (!h.includes(".")) return true; // intranetová jména bez domény
  return false;
}

function registrableHost(url) {
  try { return new URL(url).hostname.toLowerCase().split(".").slice(-2).join("."); } catch { return ""; }
}

// Požadavek mimo doménu právě zobrazené stránky.
function isThirdParty(details) {
  try {
    const target = registrableHost(details.url);
    if (!target) return false;
    let pageUrl = "";
    if (details.webContentsId) {
      const { webContents } = require("electron");
      pageUrl = webContents.fromId(details.webContentsId)?.getURL() || "";
    }
    if (!pageUrl) pageUrl = details.referrer || "";
    const origin = registrableHost(pageUrl);
    if (!origin) return false;
    return origin !== target;
  } catch {
    return false;
  }
}

// Uspávání panelů na pozadí (webview uvnitř prohlížeče).
const trackedContents = new Set();
function applyThrottling(contents) {
  try {
    contents.setBackgroundThrottling?.(getPrefs().backgroundThrottling !== false);
  } catch {}
}
function watchWebContents() {
  app.on("web-contents-created", (_e, contents) => {
    try {
      if (contents.getType?.() !== "webview") return;
    } catch { return; }
    trackedContents.add(contents);
    contents.once("destroyed", () => trackedContents.delete(contents));
    applyThrottling(contents);
  });
}


function voxSession() {
  return session.fromPartition(PARTITION);
}


let filtersInstalled = false;
function installFilters() {
  if (filtersInstalled) return;
  filtersInstalled = true;
  const ses = voxSession();

  ses.webRequest.onBeforeRequest({ urls: ["<all_urls>"] }, (details, callback) => {
    const p = getPrefs();
    const url = details.url || "";
    if (p.blockMalware && hostMatches(url, MALWARE_HOSTS)) {
      blockStats.malware++;
      return callback({ cancel: true });
    }
    if (p.adblock && hostMatches(url, ADS_HOSTS)) {
      blockStats.ads++;
      return callback({ cancel: true });
    }
    if (p.blockTrackers && hostMatches(url, TRACKER_HOSTS)) {
      blockStats.trackers++;
      return callback({ cancel: true });
    }
    if (p.httpsOnly && details.resourceType === "mainFrame" && /^http:\/\//i.test(url)) {
      let host = "";
      try { host = new URL(url).hostname; } catch {}
      if (!isLocalHost(host) && !httpsFailures.has(host.toLowerCase())) {
        return callback({ redirectURL: url.replace(/^http:/i, "https:") });
      }
    }
    if (!p.imageLoading && details.resourceType === "image") return callback({ cancel: true });
    callback({ cancel: false });
  });

  // Pokud HTTPS varianta selže, hostitele si zapamatujeme a příště ho pustíme
  // přes HTTP — jinak by starší weby a routery skončily na chybové stránce.
  ses.webRequest.onErrorOccurred({ urls: ["https://*/*"] }, (details) => {
    if (details.resourceType !== "mainFrame") return;
    try {
      const host = new URL(details.url).hostname.toLowerCase();
      if (/ERR_(SSL|CERT|CONNECTION|TOO_MANY_REDIRECTS|EMPTY_RESPONSE|ADDRESS_UNREACHABLE|NAME_NOT_RESOLVED)/i.test(details.error || "")) {
        httpsFailures.add(host);
        // Okamžitě zkusíme původní HTTP adresu, ať uživatel nekončí na chybě.
        try {
          const { webContents } = require("electron");
          const wc = details.webContentsId ? webContents.fromId(details.webContentsId) : null;
          wc?.loadURL(details.url.replace(/^https:/i, "http:"));
        } catch {}
      }
    } catch {}
  });

  ses.webRequest.onBeforeSendHeaders({ urls: ["<all_urls>"] }, (details, callback) => {
    const headers = details.requestHeaders || {};
    const p = getPrefs();
    if (p.doNotTrack) {
      headers.DNT = "1";
      headers["Sec-GPC"] = "1";
    } else {
      delete headers.DNT;
      delete headers["Sec-GPC"];
    }
    // Blokace cookies třetích stran: u požadavků mimo doménu stránky
    // odstraníme odesílanou hlavičku Cookie.
    if (p.blockThirdPartyCookies && isThirdParty(details)) {
      delete headers.Cookie;
      delete headers.cookie;
    }
    callback({ requestHeaders: headers });
  });

  // …a zahodíme i Set-Cookie z odpovědí třetích stran.
  ses.webRequest.onHeadersReceived({ urls: ["<all_urls>"] }, (details, callback) => {
    if (!getPrefs().blockThirdPartyCookies || !isThirdParty(details)) return callback({});
    const headers = { ...(details.responseHeaders || {}) };
    Object.keys(headers).forEach((k) => {
      if (k.toLowerCase() === "set-cookie") delete headers[k];
    });
    callback({ responseHeaders: headers });
  });


  ses.on("will-download", (event, item) => {
    const p = getPrefs();
    const filename = item.getFilename();
    const ext = path.extname(filename).toLowerCase();

    if (p.blockDangerousDownloads && DANGEROUS_EXT.includes(ext)) {
      const win = BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());
      const choice = dialog.showMessageBoxSync(win, {
        type: "warning",
        buttons: ["Zrušit stahování", "Přesto stáhnout"],
        defaultId: 0,
        cancelId: 0,
        title: "Ochrana VoxarioBrowser",
        message: `Soubor „${filename}“ může být nebezpečný.`,
        detail: "Spustitelné a skriptové soubory mohou obsahovat škodlivý kód. Stahuj jen z důvěryhodných zdrojů.",
      });
      if (choice === 0) {
        event.preventDefault();
        addDownloadRecord({ filename, url: item.getURL(), state: "blocked", path: "", size: item.getTotalBytes() });
        return;
      }
    }

    if (!p.askDownloadLocation && p.downloadDir) {
      try {
        fs.mkdirSync(p.downloadDir, { recursive: true });
        item.setSavePath(uniquePath(path.join(p.downloadDir, filename)));
      } catch {}
    }

    const rec = addDownloadRecord({
      filename,
      url: item.getURL(),
      state: "progressing",
      path: item.getSavePath(),
      size: item.getTotalBytes(),
      received: 0,
    });

    item.on("updated", (_e, state) => {
      rec.received = item.getReceivedBytes();
      rec.state = state === "interrupted" ? "interrupted" : "progressing";
      rec.path = item.getSavePath() || rec.path;
      broadcast("vb:downloads", getDownloads());
    });
    item.once("done", (_e, state) => {
      rec.state = state;
      rec.path = item.getSavePath() || rec.path;
      rec.received = item.getReceivedBytes();
      rec.size = item.getTotalBytes() || rec.received;
      rec.finishedAt = Date.now();
      saveDownloads();
    });
  });
}

function uniquePath(target) {
  if (!fs.existsSync(target)) return target;
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  for (let i = 1; i < 500; i++) {
    const candidate = path.join(dir, `${base} (${i})${ext}`);
    if (!fs.existsSync(candidate)) return candidate;
  }
  return target;
}

function addDownloadRecord(rec) {
  const item = { id: `d${Date.now()}${Math.random().toString(36).slice(2, 6)}`, at: Date.now(), ...rec };
  getDownloads().unshift(item);
  saveDownloads();
  return item;
}

/* ------------------------------------------------------------------ */
/* Aplikace nastavení na session                                       */
/* ------------------------------------------------------------------ */
function applyPrefs() {
  const p = getPrefs();
  try {
    const ses = voxSession();
    if (p.downloadDir && !p.askDownloadLocation) ses.setDownloadPath(p.downloadDir);
    ses.setSpellCheckerEnabled?.(false);
  } catch {}
  trackedContents.forEach((c) => {
    if (c.isDestroyed?.()) trackedContents.delete(c);
    else applyThrottling(c);
  });
  broadcast("vb:prefs", getPrefs());
}

/* ------------------------------------------------------------------ */
/* Mazání dat                                                          */
/* ------------------------------------------------------------------ */
async function clearData(kinds) {
  const set = new Set(kinds || []);
  const ses = voxSession();
  const result = [];
  if (set.has("cache")) { await ses.clearCache(); result.push("cache"); }
  if (set.has("cookies")) { await ses.clearStorageData({ storages: ["cookies"] }); result.push("cookies"); }
  if (set.has("storage")) {
    await ses.clearStorageData({ storages: ["localstorage", "indexdb", "websql", "serviceworkers", "cachestorage", "shadercache"] });
    result.push("storage");
  }
  if (set.has("history")) { history = []; writeJson("browser-history.json", []); result.push("history"); }
  if (set.has("downloads")) { downloads = []; saveDownloads(); result.push("downloads"); }
  if (set.has("auth")) { await ses.clearAuthCache(); result.push("auth"); }
  if (set.has("hostcache")) { await ses.clearHostResolverCache(); result.push("hostcache"); }
  if (set.has("passwords")) { writeJson("browser-vault.json", []); result.push("passwords"); }
  return { ok: true, cleared: result };
}

/* ------------------------------------------------------------------ */
/* Výkon                                                               */
/* ------------------------------------------------------------------ */
function systemStats() {
  let metrics = [];
  try { metrics = app.getAppMetrics(); } catch {}
  const cpu = metrics.reduce((sum, m) => sum + (m.cpu?.percentCPUUsage || 0), 0);
  const ramMB = metrics.reduce((sum, m) => sum + (m.memory?.workingSetSize || 0), 0) / 1024;
  let sys = { total: 0, free: 0 };
  try {
    const info = process.getSystemMemoryInfo();
    sys = { total: info.total / 1024, free: info.free / 1024 };
  } catch {}
  return {
    cpuPercent: Math.round(cpu * 10) / 10,
    ramMB: Math.round(ramMB),
    systemTotalMB: Math.round(sys.total),
    systemFreeMB: Math.round(sys.free),
    processes: metrics.length,
    gpuEnabled: getPrefs().hardwareAcceleration,
    uptimeSec: Math.round(process.uptime()),
    blocked: { ...blockStats },
  };
}

async function speedTest() {
  const target = "https://speed.cloudflare.com/__down?bytes=5000000";
  const started = Date.now();
  try {
    const res = await fetch(target, { cache: "no-store" });
    const buf = await res.arrayBuffer();
    const seconds = (Date.now() - started) / 1000;
    const mbps = (buf.byteLength * 8) / seconds / 1e6;
    return { ok: true, mbps: Math.round(mbps * 10) / 10, seconds: Math.round(seconds * 100) / 100, bytes: buf.byteLength };
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
}

/* ------------------------------------------------------------------ */
/* IPC                                                                 */
/* ------------------------------------------------------------------ */
function broadcast(channel, payload) {
  BrowserWindow.getAllWindows().forEach((w) => {
    if (!w.isDestroyed()) {
      try { w.webContents.send(channel, payload); } catch {}
    }
  });
}

let registered = false;
function registerBrowserSettings() {
  if (registered) return;
  registered = true;

  getPrefs();
  installFilters();
  watchWebContents();
  applyPrefs();

  ipcMain.handle("vb:prefs:get", () => ({ prefs: getPrefs(), engines: SEARCH_ENGINES, encryption: encryptionAvailable() }));
  ipcMain.handle("vb:prefs:set", (_e, patch) => setPrefs(patch));
  ipcMain.handle("vb:prefs:reset", () => setPrefs({ ...DEFAULTS, downloadDir: "" }));

  ipcMain.handle("vb:clear", (_e, kinds) => clearData(kinds));

  ipcMain.handle("vb:history:list", () => getHistory());
  ipcMain.handle("vb:history:push", (_e, entry) => pushHistory(entry));
  ipcMain.handle("vb:history:remove", (_e, url) => {
    history = getHistory().filter((h) => h.url !== url);
    return writeJson("browser-history.json", history);
  });

  ipcMain.handle("vb:downloads:list", () => getDownloads());
  ipcMain.handle("vb:downloads:remove", (_e, id) => {
    downloads = getDownloads().filter((d) => d.id !== id);
    saveDownloads();
    return getDownloads();
  });
  ipcMain.handle("vb:downloads:clear", () => { downloads = []; saveDownloads(); return []; });
  ipcMain.handle("vb:downloads:open", (_e, id) => {
    const rec = getDownloads().find((d) => d.id === id);
    if (!rec?.path) return { ok: false };
    shell.openPath(rec.path);
    return { ok: true };
  });
  ipcMain.handle("vb:downloads:reveal", (_e, id) => {
    const rec = getDownloads().find((d) => d.id === id);
    if (!rec?.path) return { ok: false };
    shell.showItemInFolder(rec.path);
    return { ok: true };
  });
  ipcMain.handle("vb:downloads:pick-dir", async () => {
    const res = await dialog.showOpenDialog({ title: "Kam ukládat stažené soubory", properties: ["openDirectory", "createDirectory"] });
    if (res.canceled || !res.filePaths[0]) return { ok: false };
    setPrefs({ downloadDir: res.filePaths[0] });
    return { ok: true, dir: res.filePaths[0] };
  });

  ipcMain.handle("vb:passwords:list", () => listPasswords());
  ipcMain.handle("vb:passwords:save", (_e, rec) => savePassword(rec || {}));
  ipcMain.handle("vb:passwords:reveal", (_e, id) => revealPassword(id));
  ipcMain.handle("vb:passwords:delete", (_e, id) => deletePassword(id));

  ipcMain.handle("vb:stats", () => systemStats());
  ipcMain.handle("vb:speedtest", () => speedTest());
}

function applyHardwareAcceleration() {
  // musí být zavoláno před app.whenReady()
  try {
    const stored = JSON.parse(fs.readFileSync(path.join(app.getPath("userData"), "browser-prefs.json"), "utf8"));
    if (stored && stored.hardwareAcceleration === false) app.disableHardwareAcceleration();
  } catch {}
}

async function clearOnExitIfNeeded() {
  try {
    if (getPrefs().clearOnExit) await clearData(["cache", "cookies", "storage", "auth", "hostcache"]);
  } catch {}
}

module.exports = {
  registerBrowserSettings,
  applyHardwareAcceleration,
  clearOnExitIfNeeded,
  SEARCH_ENGINES,
  getPrefs,
};

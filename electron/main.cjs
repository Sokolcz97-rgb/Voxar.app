// Voxar.app Desktop - Electron main process
const {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  Notification,
  shell,
  session,
  desktopCapturer,
  dialog,
  screen,
} = require("electron");
const path = require("path");
const fs = require("fs");
const { checkForUpdates, getDiagnostics, installVerified, fetchManifest, cancelActiveDownload, getPinState, resetPinState, setUiBridge, checkForUpdatesQuiet, installUpdateFromRenderer } = require("./updater.cjs");
const rollback = require("./rollback.cjs");
const bookmarks = require("./bookmarks.cjs");
const browserSettings = require("./browser-settings.cjs");
browserSettings.applyHardwareAcceleration();

const APP_URL = process.env.STUDIOVOXARIO_URL || "https://studiovoxario.com/app";
const BROWSER_URL = (() => {
  try { return new URL("/browser", APP_URL).toString(); } catch { return "https://studiovoxario.com/browser"; }
})();
const HUB_URL = (() => {
  try { return new URL("/launcher?hub=1", APP_URL).toString(); } catch { return "https://studiovoxario.com/launcher?hub=1"; }
})();
// "browser" je nativní Electron modul (browser.html), ne webová routa.
const MODULE_URLS = { app: APP_URL, hub: HUB_URL };
const LOCAL_RENDERER = path.join(__dirname, "dist", "index.html");
let pendingModule = "app";

// Samostatná instalace VoxarioBrowseru: product.json vedle exe (nebo --browser)
// znamená, že se má rovnou otevřít nativní prohlížeč, bez rozcestníku.
const BROWSER_ONLY = (() => {
  if (process.argv.slice(1).some((a) => a === "--browser")) return true;
  for (const p of [
    path.join(path.dirname(process.execPath), "product.json"),
    path.join(__dirname, "product.json"),
  ]) {
    try {
      if (fs.existsSync(p)) return !!JSON.parse(fs.readFileSync(p, "utf8")).browserOnly;
    } catch {}
  }
  return false;
})();

// -------- Moduly (VoxarioBrowser) --------
// Instalátor zapíše `modules.json` vedle exe. Když modul chybí, rozcestník
// nabídne jeho doinstalování — engine je součástí balíčku, takže instalace
// probíhá lokálně a okamžitě; jen pokud soubory chybí, stáhneme instalátor.
const INSTALL_DIR = (() => {
  try { return path.dirname(process.execPath); } catch { return __dirname; }
})();
const MODULES_FILE = "modules.json";
const DOWNLOAD_PAGE = "https://studiovoxario.com/download";

function modulesPathCandidates() {
  const list = [path.join(INSTALL_DIR, MODULES_FILE)];
  try { list.push(path.join(app.getPath("userData"), MODULES_FILE)); } catch {}
  return list;
}

function readModulesState() {
  for (const p of modulesPathCandidates()) {
    try {
      if (fs.existsSync(p)) {
        const data = JSON.parse(fs.readFileSync(p, "utf8"));
        return { browser: { installed: !!data?.browser?.installed } };
      }
    } catch {}
  }
  // Žádný soubor (vývoj / starší instalace) — modul považujeme za nenainstalovaný.
  return { browser: { installed: false } };
}

function writeModulesState(state) {
  let lastErr = null;
  for (const p of modulesPathCandidates()) {
    try {
      fs.writeFileSync(p, JSON.stringify(state, null, 2));
      return true;
    } catch (e) {
      lastErr = e;
    }
  }
  console.error("modules.json zápis selhal", lastErr);
  return false;
}

// Engine prohlížeče je součástí balíčku (browser.html) — pokud existuje,
// instalace modulu je jen lokální aktivace, bez stahování.
function browserPayloadAvailable() {
  try { return fs.existsSync(path.join(__dirname, "browser.html")); } catch { return false; }
}

function getModulesInfo() {
  const state = readModulesState();
  return {
    browser: {
      installed: !!state.browser.installed,
      available: browserPayloadAvailable(),
    },
  };
}


// Anti-tamper (basic): v produkci zakážeme remote debugging, --inspect a
// obcházení web security přes CLI flagy.
if (app.isPackaged) {
  const forbiddenFlags = ["--remote-debugging-port", "--inspect", "--inspect-brk", "--disable-web-security", "--no-sandbox"];
  const argv = process.argv.slice(1);
  if (argv.some((a) => forbiddenFlags.some((f) => a.startsWith(f)))) {
    console.error("Zakázaný spouštěcí přepínač detekován, aplikace se ukončí.");
    app.exit(1);
  }
}
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
let launcherWindow = null;

const defaultSettings = {
  minimizeToTray: true,
  closeToTray: true,
  autoStart: false,
  notifications: true,
  hardwareAcceleration: true,
  startMinimized: false,
  // Kanál aktualizací: "stable" = veřejný Release, "beta" = předběžné Alpha buildy.
  // Beta vyžaduje odemčení přístupovým kódem (viz `betaUnlocked`).
  updateChannel: "stable",
  betaUnlocked: false,
};

function loadSettings() {
  try {
    return { ...defaultSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8")) };
  } catch {
    return { ...defaultSettings };
  }
}

function saveSettings(s) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2));
}

let settings = loadSettings();
if (!settings.hardwareAcceleration) app.disableHardwareAcceleration();

// Single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;
let browserWindow = null;

let settingsWindow = null;
let tray = null;
let isQuitting = false;

function startupLog(message, error) {
  try {
    const line = `[${new Date().toISOString()}] ${message}${error ? `: ${error?.stack || error?.message || error}` : ""}\n`;
    fs.mkdirSync(app.getPath("userData"), { recursive: true });
    fs.appendFileSync(path.join(app.getPath("userData"), "startup.log"), line, "utf8");
  } catch {}
}

function revealWindow(win) {
  if (!win || win.isDestroyed()) return false;
  try {
    if (win.isMinimized()) win.restore();
    const bounds = win.getBounds();
    const visible = screen.getAllDisplays().some((display) => {
      const area = display.workArea;
      return bounds.x < area.x + area.width && bounds.x + bounds.width > area.x &&
        bounds.y < area.y + area.height && bounds.y + bounds.height > area.y;
    });
    if (!visible) win.center();
    win.show();
    win.moveTop();
    win.focus();
    return true;
  } catch (error) {
    startupLog("Zobrazení okna selhalo", error);
    return false;
  }
}

function applyAutoStart(enabled) {
  try {
    app.setLoginItemSettings({
      openAtLogin: enabled,
      openAsHidden: settings.startMinimized,
    });
  } catch (e) {
    console.error("autoStart failed", e);
  }
}

function createTray() {
  // Dvojí vytvoření tray ikony (např. návrat z rozcestníku) shodí start.
  if (tray && !tray.isDestroyed?.()) return tray;
  const iconPath = path.join(__dirname, "assets", "tray.png");

  const icon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip("Voxar.app");
  const contextMenu = Menu.buildFromTemplate([
    { label: "Otevřít Voxar.app", click: () => showMain() },
    { label: "Nastavení aplikace", click: () => openSettings() },
    { type: "separator" },
    {
      label: "Zkontrolovat aktualizace",
      click: () => checkForUpdates({ silent: false, parentWindow: mainWindow }),
    },
    {
      label: "Otevřít web v prohlížeči",
      click: () => shell.openExternal(APP_URL),
    },
    { type: "separator" },
    {
      label: "Vrátit na poslední funkční verzi…",
      click: () => triggerRollbackFlow("Ruční požadavek z tray menu.").catch(() => {}),
    },
    { type: "separator" },
    {
      label: "Ukončit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => showMain());
}

function showMain() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    const win = createMainWindow();
    const reveal = () => revealWindow(win);
    win.webContents.once("dom-ready", reveal);
    win.webContents.once("did-fail-load", reveal);
    setTimeout(reveal, 3_000);
    return win;
  }
  revealWindow(mainWindow);
  return mainWindow;
}

function localRouteFor(url) {
  if (url === HUB_URL) return "/launcher";
  return "/app";
}

async function showRendererFailure(targetUrl, remoteError, localError) {
  const details = [
    `Online adresa: ${targetUrl}`,
    `Lokální UI: ${LOCAL_RENDERER}`,
    `Online chyba: ${remoteError?.message || remoteError || "neznámá"}`,
    `Lokální chyba: ${localError?.message || localError || "neznámá"}`,
  ].join("\n");
  console.error("Voxar.app renderer nelze načíst\n" + details);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  await dialog.showMessageBox(mainWindow || undefined, {
    type: "error",
    title: "Voxar.app nelze spustit",
    message: "Nepodařilo se načíst online ani lokální uživatelské rozhraní.",
    detail: details,
    buttons: ["Zavřít"],
  });
}

async function loadMainTarget(targetUrl) {
  try {
    await mainWindow.loadURL(targetUrl, { extraHeaders: "pragma: no-cache\nCache-Control: no-cache\n" });
    return true;
  } catch (remoteError) {
    console.error("Online UI se nenačetlo, zkouším lokální renderer", remoteError);
    if (!fs.existsSync(LOCAL_RENDERER)) {
      await showRendererFailure(targetUrl, remoteError, new Error("dist/index.html není součástí balíčku"));
      return false;
    }
    try {
      await mainWindow.loadFile(LOCAL_RENDERER, { hash: localRouteFor(targetUrl) });
      return true;
    } catch (localError) {
      await showRendererFailure(targetUrl, remoteError, localError);
      return false;
    }
  }
}

function createMainWindow(startUrl) {
  const targetUrl = startUrl || MODULE_URLS[pendingModule] || APP_URL;
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: "#0a0a0f",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
      // VoxarioBrowser modul potřebuje reálný Chromium engine přes <webview>.
      webviewTag: true,

      // Anti-tamper: v produkčních buildech zakážeme DevTools + remote debugging,
      // aby uživatel nemohl injektovat vlastní JS do renderu.
      devTools: !app.isPackaged,
      webSecurity: true,
    },
  });
  startupLog(`Hlavní okno vytvořeno (${targetUrl})`);

  // Načítáme vždy čerstvou verzi (jinak Electron drží starý HTML/JS v cache
  // a uživatel vidí zastaralé přihlašovací okno).
  loadMainTarget(targetUrl).catch((error) => console.error("Renderer startup failed", error));

  // Rollback: považuj spuštění za funkční až po HEALTHY_AFTER_MS bez pádu.
  mainWindow.webContents.once("did-finish-load", () => {
    rollback.scheduleHealthyMark(() => mainWindow);
    // Auto-aktualizace Voxar.app: stejná pipeline jako u prohlížeče —
    // po startu na pozadí stáhne novou verzi a nainstaluje ji bez ptaní.
    setTimeout(() => runAppAutoUpdate().catch(() => {}), 5_000);
    scheduleAppAutoUpdate();
  });


  // Zaznamenej pády renderu — spustí nabídku rollbacku při dalším startu i teď.
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    if (details?.reason && details.reason !== "clean-exit") {
      rollback.recordCrash(`renderer:${details.reason}`);
      triggerRollbackFlow(`Vykreslovací proces spadl (${details.reason}).`).catch(() => {});
    }
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 /* ABORTED */) {
      rollback.recordCrash(`load-failed:${code} ${desc}`);
    }
  });


  // Open external links in system browser — kromě přihlašovacích (OAuth) oken,
  // ta musí zůstat uvnitř aplikace, jinak se uživatel přihlásí v prohlížeči
  // a aplikace o session nikdy nedozví.
  const AUTH_HOSTS = [
    "accounts.google.com",
    "appleid.apple.com",
    "login.microsoftonline.com",
    "login.live.com",
    "discord.com",
    "id.twitch.tv",
  ];
  const isAuthUrl = (u) =>
    AUTH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`)) ||
    u.hostname.endsWith(".supabase.co") ||
    u.hostname.endsWith(".lovable.app") ||
    u.hostname.endsWith(".lovable.dev");

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      const appHost = new URL(APP_URL).hostname;
      if (u.hostname === appHost) return { action: "allow" };
      if (isAuthUrl(u)) {
        // Přihlášení otevřeme přímo v hlavním okně, redirect se vrátí zpět do /app.
        mainWindow.loadURL(url).catch(() => {});
        return { action: "deny" };
      }
    } catch {}
    shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.on("close", (e) => {
    if (!isQuitting && settings.closeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on("minimize", (e) => {
    if (settings.minimizeToTray) {
      e.preventDefault();
      mainWindow.hide();
    }
  });

  // Badge count from renderer
  ipcMain.removeAllListeners("set-badge");
  ipcMain.on("set-badge", (_e, count) => {
    if (process.platform === "darwin") {
      app.dock?.setBadge(count > 0 ? String(count) : "");
    } else if (process.platform === "win32" && mainWindow) {
      mainWindow.setOverlayIcon(null, count > 0 ? `${count} nových zpráv` : "");
    }
  });

  ipcMain.removeAllListeners("show-notification");
  ipcMain.on("show-notification", (_e, { title, body, url }) => {
    if (!settings.notifications || !Notification.isSupported()) return;
    const n = new Notification({
      title: title || "Voxar.app",
      body: body || "",
      icon: path.join(__dirname, "assets", "icon.png"),
      silent: false,
    });
    n.on("click", () => {
      showMain();
      if (url) mainWindow.webContents.loadURL(url).catch(() => {});
    });
    n.show();
  });
}

function openSettings() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }
  settingsWindow = new BrowserWindow({
    width: 520,
    height: 620,
    resizable: false,
    minimizable: false,
    maximizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#0a0a0f",
    title: "Nastavení – Voxar.app",
    parent: mainWindow || undefined,
    webPreferences: {
      preload: path.join(__dirname, "settings-preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWindow.loadFile(path.join(__dirname, "settings.html"));
  settingsWindow.on("closed", () => (settingsWindow = null));
}

ipcMain.handle("settings:get", () => settings);
ipcMain.handle("settings:set", (_e, next) => {
  const prev = settings;
  const merged = { ...settings, ...next };
  // Bezpečnostní pojistka: nedovol přepnout na "beta" bez unlocku.
  if (merged.updateChannel === "beta" && !merged.betaUnlocked) {
    merged.updateChannel = "stable";
  }
  settings = merged;
  saveSettings(settings);
  if (prev.autoStart !== settings.autoStart || prev.startMinimized !== settings.startMinimized) {
    applyAutoStart(settings.autoStart);
  }
  return settings;
});
// Odemčení Beta kanálu — přijímá již OVĚŘENÝ příznak z renderu (Supabase RPC
// `redeem_download_code` se volá v UI, kde je uživatelská session). Main
// process jen zapíše flag do settings.
ipcMain.handle("settings:unlock-beta", (_e, ok) => {
  if (ok === true) {
    settings = { ...settings, betaUnlocked: true };
    saveSettings(settings);
  }
  return { betaUnlocked: !!settings.betaUnlocked };
});
// ---- Screen / window capture -------------------------------------------
// Renderer si zobrazí vlastní HUD picker; main proces jen dodá seznam zdrojů
// (celé obrazovky + jednotlivá okna/hry) s náhledy.
let pendingCaptureSourceId = null;
ipcMain.handle("capture:sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["screen", "window"],
      thumbnailSize: { width: 320, height: 180 },
      fetchWindowIcons: true,
    });
    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: s.id.startsWith("screen:") ? "screen" : "window",
      thumbnail: s.thumbnail?.toDataURL?.() || null,
      appIcon: s.appIcon && !s.appIcon.isEmpty?.() ? s.appIcon.toDataURL() : null,
    }));
  } catch (e) {
    console.error("[capture:sources] failed", e);
    return [];
  }
});
ipcMain.handle("capture:select", (_e, id) => {
  pendingCaptureSourceId = typeof id === "string" ? id : null;
  return true;
});

ipcMain.handle("app:version", () => app.getVersion());

ipcMain.handle("app:quit", () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle("app:return-to-launcher", () => {
  try {
    if (settingsWindow && !settingsWindow.isDestroyed()) {
      settingsWindow.close();
      settingsWindow = null;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      // close() by se kvůli "closeToTray" jen skrylo a okno by zůstalo viset —
      // proto okno rovnou zničíme, ať se dá modul znovu vybrat.
      mainWindow.destroy();
      mainWindow = null;
    }
    if (browserWindow && !browserWindow.isDestroyed()) {
      browserWindow.destroy();
      browserWindow = null;
    }
    if (!launcherWindow || launcherWindow.isDestroyed()) {
      createLauncher();
    } else {

      launcherWindow.show();
      launcherWindow.focus();
    }
    try {
      launcherWindow?.setMinimumSize(980, 560);
      launcherWindow?.setSize(1020, 600);
      launcherWindow?.center();
    } catch {}
    setLauncherStatus("Vyberte modul");
    sendLauncherChoose();

    return { ok: true };
  } catch (e) {
    console.error("return-to-launcher failed", e);
    return { ok: false, error: String(e) };
  }
});
ipcMain.handle("app:reload", () => mainWindow?.webContents.reload());
ipcMain.handle("app:hard-reload", () => {
  try {
    mainWindow?.webContents.session.clearCache();
  } catch {}
  mainWindow?.webContents.reloadIgnoringCache();
});
ipcMain.handle("app:relaunch", () => {
  app.relaunch();
  isQuitting = true;
  app.exit(0);
});
ipcMain.handle("app:open-devtools", () => {
  try { mainWindow?.webContents.openDevTools({ mode: "detach" }); } catch {}
});
ipcMain.handle("app:diagnostics", () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  node: process.versions.node,
  platform: process.platform,
  arch: process.arch,
  channel: settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable",
  betaUnlocked: !!settings.betaUnlocked,
  userDataPath: app.getPath("userData"),
  uptimeSec: Math.round(process.uptime()),
}));
ipcMain.handle("app:check-updates", () =>
  checkForUpdates({
    silent: false,
    parentWindow: mainWindow,
    channel: settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable",
  })
);
// Živá kontrola pro FAB ikonku v aplikaci — bez dialogů.
ipcMain.handle("app:check-updates-quiet", () =>
  checkForUpdatesQuiet({
    channel: settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable",
  })
);
ipcMain.handle("app:install-update-now", () =>
  installUpdateFromRenderer({
    parentWindow: mainWindow,
    channel: settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable",
  })
);
ipcMain.handle("launcher:version", () => app.getVersion());
ipcMain.handle("launcher:diagnostics", () => getDiagnostics());
ipcMain.handle("launcher:recheck", () =>
  checkForUpdates({ silent: false, parentWindow: launcherWindow || mainWindow })
);
ipcMain.handle("launcher:cancel-download", () => cancelActiveDownload());
ipcMain.handle("launcher:pins", () => getPinState());
ipcMain.handle("launcher:pins-reset", () => resetPinState());
ipcMain.handle("launcher:open-logs", () => {
  try {
    const p = path.join(app.getPath("userData"), "launcher-diagnostics.json");
    fs.writeFileSync(p, JSON.stringify(getDiagnostics(), null, 2));
    shell.showItemInFolder(p);
    return p;
  } catch (e) {
    return null;
  }
});
// Stav modulů pro rozcestník.
ipcMain.handle("modules:state", () => getModulesInfo());

// Doinstalování modulu. Engine je součástí balíčku → aktivace je okamžitá.
// Když soubory chybí (poškozená instalace), otevřeme stránku se stažením.
ipcMain.handle("modules:install", (_e, name) => {
  const key = typeof name === "string" ? name : name?.module;
  if (key !== "browser") return { ok: false, error: "Neznámý modul" };
  if (!browserPayloadAvailable()) {
    shell.openExternal(DOWNLOAD_PAGE);
    return { ok: false, downloading: true, url: DOWNLOAD_PAGE };
  }
  const state = readModulesState();
  state.browser = { installed: true, installedAt: new Date().toISOString() };
  writeModulesState(state);
  return { ok: true, modules: getModulesInfo() };
});

ipcMain.handle("modules:uninstall", (_e, name) => {
  const key = typeof name === "string" ? name : name?.module;
  if (key !== "browser") return { ok: false };
  const state = readModulesState();
  state.browser = { installed: false };
  writeModulesState(state);
  return { ok: true, modules: getModulesInfo() };
});

ipcMain.handle("launcher:continue", (_e, payload) => {
  const mod = typeof payload === "string" ? payload : payload?.module;
  if (mod === "browser") {
    const info = getModulesInfo();
    if (!info.browser.installed) {
      if (!info.browser.available) {
        shell.openExternal(DOWNLOAD_PAGE);
        return { ok: false, needsDownload: true, url: DOWNLOAD_PAGE };
      }
      writeModulesState({ browser: { installed: true, installedAt: new Date().toISOString() } });
    }
    createBrowserWindow();
    createTray();
    try { launcherWindow?.close(); } catch {}
    launcherWindow = null;
    return { ok: true };
  }

  if (mod && MODULE_URLS[mod]) pendingModule = mod;
  const targetUrl = MODULE_URLS[pendingModule] || APP_URL;
  if (!mainWindow) {
    createMainWindow(targetUrl);
    createTray();
    applyAutoStart(settings.autoStart);
    // Pojistka: když se stránka nenačte (offline, výpadek serveru), okno se
    // dřív nikdy neukázalo a launcher zůstal viset — aplikace „nešla spustit".
    let shown = false;
    const reveal = () => {
      if (shown) return;
      shown = true;
      try { launcherWindow?.close(); } catch {}
      launcherWindow = null;
      if (!settings.startMinimized) mainWindow?.show();
    };
    mainWindow.webContents.once("dom-ready", reveal);
    mainWindow.webContents.once("did-finish-load", reveal);
    mainWindow.webContents.once("did-fail-load", () => setTimeout(reveal, 500));
    // Pojistka: okno ukážeme nejpozději po 6 s, i kdyby se stránka nenačetla.
    setTimeout(reveal, 6_000);
  } else {
    // Okno už existuje — přepni ho na vybraný modul (jinak by uživatel
    // zůstal v tom předchozím).
    try {
      loadMainTarget(targetUrl).catch((error) => console.error("Module switch failed", error));
    } catch {}
    launcherWindow?.close();
    launcherWindow = null;
    showMain();
  }
  return { ok: true };
});

// Přepnutí modulu přímo z běžícího okna (např. tlačítko Voxar.app v prohlížeči).
ipcMain.handle("app:open-module", (_e, mod) => {
  const key = typeof mod === "string" ? mod : mod?.module;
  if (key === "browser") {
    const info = getModulesInfo();
    if (!info.browser.installed) {
      if (!info.browser.available) {
        shell.openExternal(DOWNLOAD_PAGE);
        return { ok: false, needsDownload: true, url: DOWNLOAD_PAGE };
      }
      writeModulesState({ browser: { installed: true, installedAt: new Date().toISOString() } });
    }
    createBrowserWindow();
    return { ok: true };
  }

  const targetUrl = MODULE_URLS[key];
  if (!targetUrl) return { ok: false };
  pendingModule = key;
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(targetUrl);
    mainWindow.once("ready-to-show", () => mainWindow?.show());
  } else {
    loadMainTarget(targetUrl).catch((error) => console.error("Module open failed", error));
    showMain();
  }
  return { ok: true };
});

// -------- Voxar.app: automatická aktualizace + historie verzí --------
let appUpdateTimer = null;
let appUpdateRunning = false;

const VERSION_HISTORY_PATH = path.join(app.getPath("userData"), "version-history.json");

function readVersionHistory() {
  try {
    const list = JSON.parse(fs.readFileSync(VERSION_HISTORY_PATH, "utf8"));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

// Zaznamená, kdy byla která verze poprvé spuštěna (= nainstalována).
function recordInstalledVersion() {
  try {
    const list = readVersionHistory();
    const version = app.getVersion();
    if (list.some((r) => r.version === version)) return list;
    list.unshift({ version, installedAt: new Date().toISOString(), channel: settings.updateChannel || "stable" });
    fs.writeFileSync(VERSION_HISTORY_PATH, JSON.stringify(list.slice(0, 50), null, 2));
    return list;
  } catch {
    return readVersionHistory();
  }
}

async function runAppAutoUpdate({ manual = false } = {}) {
  if (appUpdateRunning) return { status: "busy" };
  appUpdateRunning = true;
  const channel = settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable";
  try {
    const info = await checkForUpdatesQuiet({ channel });
    if (!info?.available) return { status: "up-to-date", current: app.getVersion() };
    return await installUpdateFromRenderer({ parentWindow: mainWindow, channel });
  } catch (e) {
    return { status: "error", error: String(e?.message || e) };
  } finally {
    appUpdateRunning = false;
    if (manual) { /* jednorázová kontrola z UI */ }
  }
}

function scheduleAppAutoUpdate() {
  if (appUpdateTimer) clearInterval(appUpdateTimer);
  appUpdateTimer = setInterval(() => {
    if (mainWindow && !mainWindow.isDestroyed()) runAppAutoUpdate().catch(() => {});
  }, 3 * 60 * 60 * 1000);
}

ipcMain.handle("app:version-history", () => ({
  current: app.getVersion(),
  history: readVersionHistory(),
}));

// -------- VoxarioBrowser: automatická aktualizace --------

// Prohlížeč se distribuuje ve stejném balíčku jako Voxar.app, takže stačí
// spustit standardní update pipeline. Kontrola běží při startu/restartu okna
// a pak periodicky; nová verze se stáhne a nainstaluje bez ptaní.
let browserUpdateTimer = null;
let browserUpdateRunning = false;

function sendBrowserUpdate(state) {
  try { browserWindow?.webContents.send("vb:update", state); } catch {}
}

async function runBrowserAutoUpdate({ manual = false } = {}) {
  if (browserUpdateRunning) return { status: "busy" };
  browserUpdateRunning = true;
  const channel = settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable";
  try {
    sendBrowserUpdate({ phase: "checking", current: app.getVersion() });
    const info = await checkForUpdatesQuiet({ channel });
    if (!info?.available) {
      sendBrowserUpdate({ phase: "up-to-date", current: app.getVersion() });
      return { status: "up-to-date", current: app.getVersion() };
    }
    sendBrowserUpdate({ phase: "downloading", current: app.getVersion(), version: info.remote });
    const res = await installUpdateFromRenderer({ parentWindow: browserWindow, channel });
    if (res?.status === "installing") {
      sendBrowserUpdate({ phase: "installing", version: res.version || info.remote });
    } else if (res?.status === "error") {
      sendBrowserUpdate({ phase: "error", error: res.error });
    } else {
      sendBrowserUpdate({ phase: "up-to-date", current: app.getVersion() });
    }
    return res;
  } catch (e) {
    sendBrowserUpdate({ phase: "error", error: String(e?.message || e) });
    return { status: "error", error: String(e?.message || e) };
  } finally {
    browserUpdateRunning = false;
    if (manual) { /* jednorázová kontrola z UI */ }
  }
}

function scheduleBrowserAutoUpdate() {
  if (browserUpdateTimer) clearInterval(browserUpdateTimer);
  browserUpdateTimer = setInterval(() => {
    if (browserWindow && !browserWindow.isDestroyed()) runBrowserAutoUpdate().catch(() => {});
  }, 3 * 60 * 60 * 1000);
}

ipcMain.handle("vb:update:check", () => runBrowserAutoUpdate({ manual: true }));
ipcMain.handle("vb:update:version", () => app.getVersion());

// -------- VoxarioBrowser: nativní Chromium okno --------
function createBrowserWindow() {
  if (browserWindow && !browserWindow.isDestroyed()) {
    revealWindow(browserWindow);
    return browserWindow;
  }
  browserWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: "#05070d",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
      webviewTag: true,
      webSecurity: true,
    },
  });
  startupLog("Okno VoxarioBrowseru vytvořeno");
  browserWindow.loadFile(path.join(__dirname, "browser.html")).catch((error) => {
    startupLog("VoxarioBrowser se nepodařilo načíst", error);
    revealWindow(browserWindow);
  });
  browserWindow.webContents.once("dom-ready", () => revealWindow(browserWindow));
  setTimeout(() => revealWindow(browserWindow), 3_000);
  browserWindow.on("closed", () => {
    browserWindow = null;
    if (browserUpdateTimer) { clearInterval(browserUpdateTimer); browserUpdateTimer = null; }
  });

  // Auto-update při každém spuštění/restartu prohlížeče + periodicky.
  browserWindow.webContents.once("did-finish-load", () => {
    setTimeout(() => runBrowserAutoUpdate().catch(() => {}), 3_000);
  });
  scheduleBrowserAutoUpdate();

  // Popupy z webview otevři jako nový panel uvnitř prohlížeče.
  browserWindow.webContents.on("did-attach-webview", (_e, wc) => {
    wc.setWindowOpenHandler(({ url }) => {
      try { browserWindow?.webContents.send("browser:open-tab", url); } catch {}
      return { action: "deny" };
    });
  });
  return browserWindow;
}

ipcMain.handle("browser:window", (_e, action) => {
  if (!browserWindow || browserWindow.isDestroyed()) return false;
  if (action === "minimize") browserWindow.minimize();
  else if (action === "maximize") browserWindow.isMaximized() ? browserWindow.unmaximize() : browserWindow.maximize();
  else if (action === "close") browserWindow.destroy();
  return true;
});

// -------- Záložky prohlížeče (import/export) --------
ipcMain.handle("bookmarks:list", () => bookmarks.readBookmarks(app));
ipcMain.handle("bookmarks:save", (_e, list) => bookmarks.writeBookmarks(app, list));
ipcMain.handle("bookmarks:sources", () => {
  try {
    return bookmarks.detectSources().map((s) => ({ id: s.id, label: s.label, profiles: s.files.length }));
  } catch (e) {
    console.error("bookmarks:sources", e);
    return [];
  }
});
ipcMain.handle("bookmarks:import", (_e, id) => {
  try {
    return bookmarks.importFromSource(app, id);
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle("bookmarks:import-file", async () => {
  const target = browserWindow && !browserWindow.isDestroyed() ? browserWindow : undefined;
  const res = await dialog.showOpenDialog(target, {
    title: "Importovat záložky",
    filters: [{ name: "Záložky", extensions: ["html", "htm", "json", "jsonlz4"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  return bookmarks.importFromFile(app, res.filePaths[0]);
});
ipcMain.handle("bookmarks:export-file", async () => {
  const target = browserWindow && !browserWindow.isDestroyed() ? browserWindow : undefined;
  const res = await dialog.showSaveDialog(target, {
    title: "Exportovat záložky",
    defaultPath: "voxario-bookmarks.html",
    filters: [
      { name: "Netscape HTML", extensions: ["html"] },
      { name: "JSON", extensions: ["json"] },
    ],
  });
  if (res.canceled || !res.filePath) return { ok: false, canceled: true };
  try {
    return bookmarks.exportToFile(app, res.filePath);
  } catch (e) {
    return { ok: false, error: String(e?.message || e) };
  }
});





// -------- Rollback flow --------
let rollbackInProgress = false;
async function triggerRollbackFlow(reason) {
  if (rollbackInProgress) return { status: "busy" };
  rollbackInProgress = true;
  try {
    const manifest = await fetchManifest().catch(() => null);
    const res = await rollback.performRollback({
      manifest,
      parentWindow: mainWindow || launcherWindow,
      reason,
      installVerified,
    });
    if (res?.status && res.status !== "installing" && res.status !== "declined") {
      await require("electron").dialog.showMessageBox(mainWindow || launcherWindow, {
        type: "error",
        title: "Rollback selhal",
        message: `Nepodařilo se vrátit na předchozí verzi (${res.status})`,
        detail:
          res.error
            ? String(res.error)
            : "Zkontrolujte diagnostiku v launcheru nebo kontaktujte podporu.",
      });
    }
    return res;
  } finally {
    rollbackInProgress = false;
  }
}
ipcMain.handle("app:rollback", () => triggerRollbackFlow("Ruční požadavek z aplikace."));
ipcMain.handle("launcher:rollback", () => triggerRollbackFlow("Ruční požadavek z launcheru."));
ipcMain.handle("launcher:rollback-state", () => rollback.readState());

// -------- In-launcher prompt bridge --------
// Nahrazuje nativní dialog.showMessageBox pro update prompt / info / chyby,
// aby to nebyly OS pop-upy, ale integrované UI v launcheru.
const pendingPrompts = new Map(); // id -> { resolve }
let promptSeq = 0;
ipcMain.handle("launcher:prompt-response", (_e, { id, response, ok }) => {
  const p = pendingPrompts.get(id);
  if (!p) return false;
  pendingPrompts.delete(id);
  p.resolve({ response, ok: ok !== false });
  return true;
});

setUiBridge((payload) => {
  const win = launcherWindow;
  if (!win || win.isDestroyed() || !win.webContents) return null; // → fallback na dialog
  return new Promise((resolve) => {
    const id = ++promptSeq;
    pendingPrompts.set(id, { resolve });
    try {
      // Jen skutečné dotazy vytahují okno dopředu; oznámení o aktualizaci
      // na pozadí nesmí uživatele vyrušit.
      if (payload?.kind === "question") {
        win.show();
        win.focus();
      }
      win.webContents.send("launcher:prompt", { id, ...payload });
    } catch (e) {
      pendingPrompts.delete(id);
      resolve(null);
    }
    // Bezpečnostní timeout — pokud UI neodpoví do 10 min, uvolníme handler.
    setTimeout(() => {
      if (pendingPrompts.has(id)) {
        pendingPrompts.delete(id);
        resolve(null);
      }
    }, 10 * 60 * 1000);
  });
});



function createLauncher() {
  if (launcherWindow && !launcherWindow.isDestroyed()) {
    revealWindow(launcherWindow);
    return launcherWindow;
  }
  launcherWindow = new BrowserWindow({
    width: 460,
    height: 340,
    minWidth: 460,
    minHeight: 340,
    frame: false,
    resizable: true,
    backgroundColor: "#020617",
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  startupLog("Launcher vytvořen");
  launcherWindow.loadFile(path.join(__dirname, "launcher.html")).catch((error) => {
    startupLog("Launcher se nepodařilo načíst", error);
    revealWindow(launcherWindow);
  });
  launcherWindow.webContents.once("dom-ready", () => revealWindow(launcherWindow));
  launcherWindow.once("ready-to-show", () => revealWindow(launcherWindow));
  setTimeout(() => revealWindow(launcherWindow), 2_000);
  launcherWindow.on("closed", () => (launcherWindow = null));
  return launcherWindow;
}


function setLauncherStatus(msg) {
  try { launcherWindow?.webContents.send("launcher:status", msg); } catch {}
}

// Rozcestník se smí poslat až po načtení rendereru, jinak se zpráva zahodí
// a uživateli zůstane prázdný splash bez karet i tlačítka.
function sendLauncherChoose() {
  const win = launcherWindow;
  if (!win || win.isDestroyed()) return;
  const send = () => {
    try { win.webContents.send("launcher:choose"); } catch {}
  };
  if (win.webContents.isLoading()) win.webContents.once("did-finish-load", send);
  else send();
}


function runLauncherBackgroundUpdate() {
  const launcherChannel = settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable";
  // Aktualizace běží čistě na pozadí — rozcestník ani moduly se kvůli ní
  // nezdržují. Po dokončení instalace se aplikace sama znovu spustí
  // (quitAndInstall se spouští s forceRunAfter).
  Promise.resolve()
    .then(() => checkForUpdatesQuiet({ channel: launcherChannel }))
    .then((info) => {
      if (!info?.available) return null;
      setLauncherStatus(`Stahuji verzi ${info.remote} na pozadí…`);
      return installUpdateFromRenderer({ parentWindow: launcherWindow, channel: launcherChannel });
    })
    .catch((e) => console.error("launcher background update error", e));
}

async function runLauncherSequence() {
  createLauncher();

  // Rozcestník: uživatel si vybere modul (Voxar.app / VoxarioBrowser).
  // Zobrazíme ho okamžitě, aktualizace doběhne na pozadí.
  setLauncherStatus("Vyberte modul");
  try {
    launcherWindow?.setMinimumSize(980, 560);
    launcherWindow?.setSize(1020, 600);
    launcherWindow?.center();
  } catch {}
  sendLauncherChoose();

  runLauncherBackgroundUpdate();
}


app.whenReady().then(async () => {
  startupLog(`Start aplikace ${app.getVersion()}`);
  browserSettings.registerBrowserSettings();
  // Zahodíme HTTP cache (ne cookies/localStorage – přihlášení zůstává),
  // aby aplikace vždy načetla aktuální verzi webu, ne starou zakešovanou.
  try {
    await session.defaultSession.clearCache();
  } catch { /* ignore */ }

  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    const allowed = ["notifications", "media", "clipboard-read", "clipboard-sanitized-write", "fullscreen", "display-capture"];
    cb(allowed.includes(permission));
  });

  // Screen sharing (getDisplayMedia) — Electron vyžaduje vlastní handler,
  // jinak volání v rendereru tiše selže.
  if (typeof session.defaultSession.setDisplayMediaRequestHandler === "function") {
    session.defaultSession.setDisplayMediaRequestHandler(async (_request, callback) => {
      try {
        const sources = await desktopCapturer.getSources({ types: ["screen", "window"] });
        if (!sources.length) return callback(null);
        const picked =
          sources.find((s) => s.id === pendingCaptureSourceId) ||
          sources.find((s) => s.id.startsWith("screen:")) ||
          sources[0];
        pendingCaptureSourceId = null;
        // Loopback audio je podporovaný jen na Windows; jinde by celý požadavek selhal.
        callback({ video: picked, audio: process.platform === "win32" ? "loopback" : undefined });

      } catch (e) {
        console.error("[display-capture] failed", e);
        callback(null);
      }
    });

  }

  // Historie verzí: zapíšeme datum prvního spuštění aktuální verze.
  recordInstalledVersion();

  // Nejdřív vždy vytvoříme viditelné okno. Kontrola předchozího pádu ani síť
  // nesmí zablokovat start tak, že aplikace zůstane jen mezi procesy.
  const { suspicious, prev } = rollback.recordStartAttempt();

  if (BROWSER_ONLY) {
    createBrowserWindow();
  } else {
    runLauncherSequence();
  }

  if (suspicious && (prev.consecutiveFailures || 0) >= 1) {
    setTimeout(async () => {
      try {
        const manifest = await fetchManifest().catch(() => null);
        await rollback.performRollback({
          manifest,
          parentWindow: browserWindow || launcherWindow || mainWindow,
          reason: `Předchozí spuštění verze ${prev.lastStartVersion} skončilo neočekávaně${prev.lastCrash ? " (" + prev.lastCrash.reason + ")" : ""}.`,
          installVerified,
        });
      } catch (error) {
        startupLog("Kontrola obnovy po startu selhala", error);
        console.error("startup rollback failed", error);
      }
    }, 1_000);
  }

  // Živá quiet-kontrola pro FAB v UI (bez dialogů). První hned po startu,
  // pak každých 15 min. Manifest se fetchuje s cache-bustem, takže výsledek
  // je vždy aktuální — už žádné „vyskočí stará verze".
  const quietTick = () => checkForUpdatesQuiet({
    channel: settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable",
  }).catch(() => {});
  setTimeout(quietTick, 8_000);
  setInterval(quietTick, 15 * 60 * 1000);

  setInterval(() => {
    checkForUpdates({
      silent: true,
      parentWindow: mainWindow,
      channel: settings.betaUnlocked && settings.updateChannel === "beta" ? "beta" : "stable",
    }).catch(() => {});
  }, 4 * 60 * 60 * 1000);
});

app.on("second-instance", (_e, argv) => {
  // Zkratka VoxarioBrowser spouští stejné exe s "--browser" — druhá instance
  // skončí, takže musíme argumenty vyhodnotit tady a otevřít prohlížeč.
  const wantsBrowser = Array.isArray(argv) && argv.some((a) => a === "--browser");
  if (wantsBrowser) {
    if (browserWindow && !browserWindow.isDestroyed()) {
      revealWindow(browserWindow);
    } else {
      createBrowserWindow();
    }
    return;
  }
  if (launcherWindow && !launcherWindow.isDestroyed()) revealWindow(launcherWindow);
  else if (mainWindow && !mainWindow.isDestroyed()) revealWindow(mainWindow);
  else if (browserWindow && !browserWindow.isDestroyed()) revealWindow(browserWindow);
  else runLauncherSequence();
});
app.on("activate", () => {
  if (launcherWindow && !launcherWindow.isDestroyed()) revealWindow(launcherWindow);
  else if (mainWindow && !mainWindow.isDestroyed()) revealWindow(mainWindow);
  else if (browserWindow && !browserWindow.isDestroyed()) revealWindow(browserWindow);
  else if (BROWSER_ONLY) createBrowserWindow();
  else runLauncherSequence();
});
app.on("window-all-closed", () => {
  // Samostatný prohlížeč nemá tray — zavřením okna se aplikace ukončí.
  if (BROWSER_ONLY) return app.quit();
  if (process.platform !== "darwin" && !settings.closeToTray) app.quit();
});

let cleanupDone = false;
app.on("before-quit", (event) => {
  isQuitting = true;
  // Při ukončení kvůli aktualizaci nesmíme quit odkládat — instalátor
  // navazuje na quit a sám aplikaci po dokončení znovu spustí.
  if (app.isQuittingForUpdate) {
    try { browserSettings.backupBrowserSettings?.(); } catch {}
    cleanupDone = true;
    rollback.recordCleanExit();
    return;
  }
  if (!cleanupDone) {
    // Záloha nastavení (přežije aktualizaci), pak asynchronní mazání dat.
    try { browserSettings.backupBrowserSettings?.(); } catch {}
    // Mazání dat při ukončení je asynchronní — odložíme quit, ať se stihne.
    event.preventDefault();

    Promise.resolve(browserSettings.clearOnExitIfNeeded())
      .catch(() => {})
      .finally(() => {
        cleanupDone = true;
        rollback.recordCleanExit();
        app.quit();
      });
    return;
  }
  rollback.recordCleanExit();
});



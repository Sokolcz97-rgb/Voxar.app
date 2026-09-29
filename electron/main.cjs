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
const { spawn } = require("child_process");
const crypto = require("crypto");
const { calculateProtectionScore } = require("./protect-trust-engine.cjs");
const { checkForUpdates, getDiagnostics, installVerified, fetchManifest, cancelActiveDownload, getPinState, resetPinState, setUiBridge, checkForUpdatesQuiet, installUpdateFromRenderer } = require("./updater.cjs");
const rollback = require("./rollback.cjs");
const bookmarks = require("./bookmarks.cjs");
const browserSettings = require("./browser-settings.cjs");
const { inspectProducts, launchProduct } = require("./products.cjs");
const { registerRtmpHandlers, stopProcesses: stopRtmpProcesses } = require("./rtmp.cjs");
browserSettings.applyHardwareAcceleration();

const APP_URL = process.env.STUDIOVOXARIO_URL || "https://studiovoxario.com/app";
const BROWSER_URL = (() => {
  try { return new URL("/browser", APP_URL).toString(); } catch { return "https://studiovoxario.com/browser"; }
})();
const HUB_URL = (() => {
  try { return new URL("/launcher?hub=1", APP_URL).toString(); } catch { return "https://studiovoxario.com/launcher?hub=1"; }
})();
// "browser" je nativnĂ­ Electron modul (browser.html), ne webovĂˇ routa.
const MODULE_URLS = { app: APP_URL, hub: HUB_URL };
const LOCAL_RENDERER = path.join(__dirname, "dist", "index.html");
let pendingModule = "app";

// SamostatnĂˇ instalace VoxarioBrowseru: metadata v zabalenĂ© aplikaci (nebo
// --browser ve starĂ©m spoleÄŤnĂ©m balĂ­ÄŤku) znamenajĂ­, Ĺľe se mĂˇ rovnou otevĹ™Ă­t
// nativnĂ­ prohlĂ­ĹľeÄŤ, bez rozcestnĂ­ku.
const BROWSER_ONLY = (() => {
  if (process.argv.slice(1).some((a) => a === "--browser")) return true;
  for (const p of [
    path.join(path.dirname(process.execPath), "product.json"),
    path.join(__dirname, "product.json"),
    path.join(__dirname, "package.json"),
  ]) {
    try {
      if (fs.existsSync(p)) return !!JSON.parse(fs.readFileSync(p, "utf8")).browserOnly;
    } catch {}
  }
  return false;
})();

function getInstalledProducts() {
  return inspectProducts({
    currentExecutable: app.isPackaged ? process.execPath : null,
    currentVersion: app.getVersion(),
    browserOnly: BROWSER_ONLY,
  });
}

// -------- Moduly (VoxarioBrowser) --------
// InstalĂˇtor zapĂ­Ĺˇe `modules.json` vedle exe. KdyĹľ modul chybĂ­, rozcestnĂ­k
// nabĂ­dne jeho doinstalovĂˇnĂ­ â€” engine je souÄŤĂˇstĂ­ balĂ­ÄŤku, takĹľe instalace
// probĂ­hĂˇ lokĂˇlnÄ› a okamĹľitÄ›; jen pokud soubory chybĂ­, stĂˇhneme instalĂˇtor.
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
        return {
          browser: { installed: !!data?.browser?.installed },
          protect: { installed: !!data?.protect?.installed },
        };
      }
    } catch {}
  }
  // Ĺ˝ĂˇdnĂ˝ soubor (vĂ˝voj / starĹˇĂ­ instalace) â€” modul povaĹľujeme za nenainstalovanĂ˝.
  return { browser: { installed: false }, protect: { installed: false } };
}

function writeModulesState(state) {
  // VOXARIO_MODULE_STATE_DURABLE_V1: stav zapisujeme vedle exe i do userData, aby pĹ™eĹľil NSIS update.
  let wrote = false;
  let lastErr = null;
  for (const p of modulesPathCandidates()) {
    try {
      fs.mkdirSync(path.dirname(p), { recursive: true });
      fs.writeFileSync(p, JSON.stringify(state, null, 2));
      wrote = true;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!wrote) console.error("modules.json zĂˇpis selhal", lastErr);
  return wrote;
}

// Engine prohlĂ­ĹľeÄŤe je souÄŤĂˇstĂ­ balĂ­ÄŤku (browser.html) â€” pokud existuje,
// instalace modulu je jen lokĂˇlnĂ­ aktivace, bez stahovĂˇnĂ­.
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
    protect: {
      installed: !!state.protect?.installed,
      available: fs.existsSync(path.join(__dirname, "protect.html")),
    },
  };
}


// Anti-tamper (basic): v produkci zakĂˇĹľeme remote debugging, --inspect a
// obchĂˇzenĂ­ web security pĹ™es CLI flagy.
if (app.isPackaged) {
  const forbiddenFlags = ["--remote-debugging-port", "--inspect", "--inspect-brk", "--disable-web-security", "--no-sandbox"];
  const argv = process.argv.slice(1);
  if (argv.some((a) => forbiddenFlags.some((f) => a.startsWith(f)))) {
    console.error("ZakĂˇzanĂ˝ spouĹˇtÄ›cĂ­ pĹ™epĂ­naÄŤ detekovĂˇn, aplikace se ukonÄŤĂ­.");
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
  // PoslednĂ­ bezpeÄŤnĂ© rozmÄ›ry nativnĂ­ch oken. Nikdy neuklĂˇdĂˇme Ăşdaje o
  // uĹľivateli ani obsah oken; jen lokĂˇlnĂ­ geometrii pro lepĹˇĂ­ Windows UX.
  windowState: {},
  // KanĂˇl aktualizacĂ­: "stable" = veĹ™ejnĂ˝ Release, "beta" = pĹ™edbÄ›ĹľnĂ© Alpha buildy.
  // Beta vyĹľaduje odemÄŤenĂ­ pĹ™Ă­stupovĂ˝m kĂłdem (viz `betaUnlocked`).
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

function isVisibleBounds(bounds) {
  if (!bounds || ![bounds.x, bounds.y, bounds.width, bounds.height].every(Number.isFinite)) return false;
  if (bounds.width < 240 || bounds.height < 180) return false;
  try {
    return screen.getAllDisplays().some(({ workArea }) =>
      bounds.x < workArea.x + workArea.width && bounds.x + bounds.width > workArea.x &&
      bounds.y < workArea.y + workArea.height && bounds.y + bounds.height > workArea.y,
    );
  } catch {
    return false;
  }
}

function savedWindowState(key) {
  const value = settings.windowState?.[key];
  return isVisibleBounds(value?.bounds) ? value : null;
}

function windowOptions(key, defaults) {
  const saved = savedWindowState(key);
  return saved ? { ...defaults, ...saved.bounds } : defaults;
}

function rememberWindowState(key, win) {
  if (!win || win.isDestroyed()) return;
  try {
    const bounds = win.isMaximized() ? win.getNormalBounds() : win.getBounds();
    if (!isVisibleBounds(bounds)) return;
    settings = {
      ...settings,
      windowState: {
        ...(settings.windowState || {}),
        [key]: { bounds, maximized: win.isMaximized() },
      },
    };
    saveSettings(settings);
  } catch (error) {
    startupLog(`UloĹľenĂ­ velikosti okna ${key} selhalo`, error);
  }
}

function restoreWindowState(key, win) {
  const saved = savedWindowState(key);
  if (!saved?.maximized || !win || win.isDestroyed()) return;
  try { win.maximize(); } catch {}
}

function trackWindowState(key, win) {
  let timer = null;
  const schedule = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => rememberWindowState(key, win), 500);
    timer.unref?.();
  };
  win.on("move", schedule);
  win.on("resize", schedule);
  win.on("maximize", schedule);
  win.on("unmaximize", schedule);
  win.on("close", () => {
    if (timer) clearTimeout(timer);
    rememberWindowState(key, win);
  });
  win.on("closed", () => { if (timer) clearTimeout(timer); });
  win.once("ready-to-show", () => restoreWindowState(key, win));
}

// Single instance
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  return;
}

let mainWindow = null;
let browserWindow = null;
let protectWindow = null;

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
    startupLog("ZobrazenĂ­ okna selhalo", error);
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
  // DvojĂ­ vytvoĹ™enĂ­ tray ikony (napĹ™. nĂˇvrat z rozcestnĂ­ku) shodĂ­ start.
  if (tray && !tray.isDestroyed?.()) return tray;
  const iconPath = path.join(__dirname, "assets", "tray.png");

  const icon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  const protectActive = !!getModulesInfo().protect.installed;
  tray.setToolTip(protectActive ? "Voxar.app Â· VoxarioProtect aktivnĂ­" : "Voxar.app");
  const contextMenu = Menu.buildFromTemplate([
    { label: "OtevĹ™Ă­t Voxar.app", click: () => showMain() },
    ...(protectActive ? [
      { label: "VoxarioProtect je aktivnĂ­", enabled: false },
      { label: "OtevĹ™Ă­t VoxarioProtect", click: () => { createProtectWindow(); revealWindow(protectWindow); } },
      { type: "separator" },
    ] : []),
    { label: "NastavenĂ­ aplikace", click: () => openSettings() },
    { type: "separator" },
    {
      label: "Zkontrolovat aktualizace",
      click: () => checkForUpdates({ silent: false, parentWindow: mainWindow }),
    },
    {
      label: "OtevĹ™Ă­t web v prohlĂ­ĹľeÄŤi",
      click: () => shell.openExternal(APP_URL),
    },
    { type: "separator" },
    {
      label: "VrĂˇtit na poslednĂ­ funkÄŤnĂ­ verziâ€¦",
      click: () => triggerRollbackFlow("RuÄŤnĂ­ poĹľadavek z tray menu.").catch(() => {}),
    },
    { type: "separator" },
    {
      label: "UkonÄŤit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on("click", () => {
    if (getModulesInfo().protect.installed) {
      createProtectWindow();
      revealWindow(protectWindow);
      return;
    }
    showMain();
  });
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
    `LokĂˇlnĂ­ UI: ${LOCAL_RENDERER}`,
    `Online chyba: ${remoteError?.message || remoteError || "neznĂˇmĂˇ"}`,
    `LokĂˇlnĂ­ chyba: ${localError?.message || localError || "neznĂˇmĂˇ"}`,
  ].join("\n");
  console.error("Voxar.app renderer nelze naÄŤĂ­st\n" + details);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.show();
  await dialog.showMessageBox(mainWindow || undefined, {
    type: "error",
    title: "Voxar.app nelze spustit",
    message: "NepodaĹ™ilo se naÄŤĂ­st online ani lokĂˇlnĂ­ uĹľivatelskĂ© rozhranĂ­.",
    detail: details,
    buttons: ["ZavĹ™Ă­t"],
  });
}

async function loadMainTarget(targetUrl) {
  // STUDIO_HUB_LOCAL_RENDERER_V1: HUB naÄŤĂ­tĂˇme vĹľdy z verze zabalenĂ© v desktop aktualizaci.
  // TĂ­m webovĂ˝ deploy/cache nemĹŻĹľe vrĂˇtit starĂ˝ dvojitĂ˝ vĂ˝bÄ›r modulĹŻ.
  if (targetUrl === HUB_URL) {
    if (!fs.existsSync(LOCAL_RENDERER)) {
      await showRendererFailure(
        targetUrl,
        new Error("StudioVoxario Hub pouĹľĂ­vĂˇ zabalenĂ˝ desktop renderer"),
        new Error("dist/index.html nenĂ­ souÄŤĂˇstĂ­ balĂ­ÄŤku")
      );
      return false;
    }
    try {
      await mainWindow.loadFile(LOCAL_RENDERER, { hash: localRouteFor(targetUrl) });
      return true;
    } catch (localError) {
      await showRendererFailure(
        targetUrl,
        new Error("StudioVoxario Hub pouĹľĂ­vĂˇ zabalenĂ˝ desktop renderer"),
        localError
      );
      return false;
    }
  }

  try {
    await mainWindow.loadURL(targetUrl, { extraHeaders: "pragma: no-cache\nCache-Control: no-cache\n" });
    return true;
  } catch (remoteError) {
    console.error("Online UI se nenaÄŤetlo, zkouĹˇĂ­m lokĂˇlnĂ­ renderer", remoteError);
    if (!fs.existsSync(LOCAL_RENDERER)) {
      await showRendererFailure(targetUrl, remoteError, new Error("dist/index.html nenĂ­ souÄŤĂˇstĂ­ balĂ­ÄŤku"));
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
  mainWindow = new BrowserWindow(windowOptions("main", {
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
      // VoxarioBrowser modul potĹ™ebuje reĂˇlnĂ˝ Chromium engine pĹ™es <webview>.
      webviewTag: true,

      // Anti-tamper: v produkÄŤnĂ­ch buildech zakĂˇĹľeme DevTools + remote debugging,
      // aby uĹľivatel nemohl injektovat vlastnĂ­ JS do renderu.
      devTools: !app.isPackaged,
      webSecurity: true,
    },
  }));
  trackWindowState("main", mainWindow);
  startupLog(`HlavnĂ­ okno vytvoĹ™eno (${targetUrl})`);

  // NaÄŤĂ­tĂˇme vĹľdy ÄŤerstvou verzi (jinak Electron drĹľĂ­ starĂ˝ HTML/JS v cache
  // a uĹľivatel vidĂ­ zastaralĂ© pĹ™ihlaĹˇovacĂ­ okno).
  loadMainTarget(targetUrl).catch((error) => console.error("Renderer startup failed", error));

  // Rollback: povaĹľuj spuĹˇtÄ›nĂ­ za funkÄŤnĂ­ aĹľ po HEALTHY_AFTER_MS bez pĂˇdu.
  mainWindow.webContents.once("did-finish-load", () => {
    rollback.scheduleHealthyMark(() => mainWindow);
    // Auto-aktualizace Voxar.app: stejnĂˇ pipeline jako u prohlĂ­ĹľeÄŤe â€”
    // po startu na pozadĂ­ stĂˇhne novou verzi a nainstaluje ji bez ptanĂ­.
    setTimeout(() => runAppAutoUpdate().catch(() => {}), 5_000);
    scheduleAppAutoUpdate();
  });


  // Zaznamenej pĂˇdy renderu â€” spustĂ­ nabĂ­dku rollbacku pĹ™i dalĹˇĂ­m startu i teÄŹ.
  mainWindow.webContents.on("render-process-gone", (_e, details) => {
    if (details?.reason && details.reason !== "clean-exit") {
      rollback.recordCrash(`renderer:${details.reason}`);
      triggerRollbackFlow(`VykreslovacĂ­ proces spadl (${details.reason}).`).catch(() => {});
    }
  });
  mainWindow.webContents.on("did-fail-load", (_e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3 /* ABORTED */) {
      rollback.recordCrash(`load-failed:${code} ${desc}`);
    }
  });


  // Open external links in system browser â€” kromÄ› pĹ™ihlaĹˇovacĂ­ch (OAuth) oken,
  // ta musĂ­ zĹŻstat uvnitĹ™ aplikace, jinak se uĹľivatel pĹ™ihlĂˇsĂ­ v prohlĂ­ĹľeÄŤi
  // a aplikace o session nikdy nedozvĂ­.
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
        // PĹ™ihlĂˇĹˇenĂ­ otevĹ™eme pĹ™Ă­mo v hlavnĂ­m oknÄ›, redirect se vrĂˇtĂ­ zpÄ›t do /app.
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
      mainWindow.setOverlayIcon(null, count > 0 ? `${count} novĂ˝ch zprĂˇv` : "");
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

// ---- VoxarioProtect / Microsoft Defender bridge -----------------------
// VoxarioProtect neobsahuje druhĂ˝ antivir ani rezidentnĂ­ skener. Na vyĹľĂˇdĂˇnĂ­
// ÄŤte stav vestavÄ›nĂ©ho Defenderu a pĹ™edĂˇ mu spuĹˇtÄ›nĂ­ rychlĂ© kontroly; tĂ­m
// nevznikĂˇ soubÄ›h dvou AV enginĹŻ ani trvalĂˇ zĂˇtÄ›Ĺľ CPU/RAM.
function runDefenderPowerShell(script, timeoutMs = 12_000, environment = {}) {
  if (process.platform !== "win32") {
    return Promise.resolve({ ok: false, error: "VoxarioProtect je dostupnĂ˝ pouze ve Windows s Microsoft Defenderem." });
  }

  return new Promise((resolve) => {
    let output = "";
    let errorOutput = "";
    let settled = false;
    let timer;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    let child;
    try {
      child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, ...environment },
      });
    } catch (error) {
      finish({ ok: false, error: error?.message || "PowerShell se nepodaĹ™ilo spustit." });
      return;
    }
    timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ ok: false, error: "Kontrola Defenderu pĹ™ekroÄŤila ÄŤasovĂ˝ limit." });
    }, timeoutMs);
    timer.unref?.();
    child.stdout?.on("data", (chunk) => { output += String(chunk); });
    child.stderr?.on("data", (chunk) => { errorOutput += String(chunk); });
    child.on("error", (error) => finish({ ok: false, error: error?.message || "PowerShell se nepodaĹ™ilo spustit." }));
    child.on("close", (code) => {
      if (code !== 0) return finish({ ok: false, error: errorOutput.trim() || `Defender vrĂˇtil kĂłd ${code}.` });
      finish({ ok: true, output: output.trim() });
    });
  });
}

const DEFENDER_STATUS_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  "$s=Get-MpComputerStatus",
  "[pscustomobject]@{AntivirusEnabled=$s.AntivirusEnabled;RealTimeProtectionEnabled=$s.RealTimeProtectionEnabled;BehaviorMonitorEnabled=$s.BehaviorMonitorEnabled;IoavProtectionEnabled=$s.IoavProtectionEnabled;AntivirusSignatureLastUpdated=$s.AntivirusSignatureLastUpdated;AntivirusSignatureAge=$s.AntivirusSignatureAge;QuickScanStartTime=$s.QuickScanStartTime;QuickScanEndTime=$s.QuickScanEndTime;FullScanStartTime=$s.FullScanStartTime;AMRunningMode=$s.AMRunningMode;AMProductVersion=$s.AMProductVersion}|ConvertTo-Json -Compress",
].join(";");

const DEFENDER_FALLBACK_SCRIPT = [
  "$ErrorActionPreference='Stop'",
  "$p=Get-CimInstance -Namespace root/SecurityCenter2 -ClassName AntivirusProduct | Where-Object {$_.displayName -match 'Defender|Microsoft'} | Select-Object -First 1",
  "if($null -eq $p){throw 'Microsoft Defender nebyl ve Windows Security Center nalezen.'}",
  "[pscustomobject]@{AntivirusEnabled=$true;RealTimeProtectionEnabled=$null;AntivirusSignatureLastUpdated=$null;AntivirusSignatureAge=$null;QuickScanStartTime=$null;QuickScanEndTime=$null;AMRunningMode='OmezenĂ˝ pĹ™Ă­stup';AMProductVersion=$p.productState;Provider=$p.displayName;AccessLimited=$true}|ConvertTo-Json -Compress",
].join(";");

async function getDefenderStatus() {
  const result = await runDefenderPowerShell(DEFENDER_STATUS_SCRIPT);
  if (!result.ok) {
    const fallback = await runDefenderPowerShell(DEFENDER_FALLBACK_SCRIPT);
    if (!fallback.ok) return result;
    try { return normalizeDefenderStatus(JSON.parse(fallback.output || "{}")); }
    catch { return result; }
  }
  try { return normalizeDefenderStatus(JSON.parse(result.output || "{}")); }
  catch { return { ok: false, error: "Defender vrĂˇtil neÄŤitelnĂ˝ stav." }; }
}

function normalizeDefenderStatus(value) {
  const raw = value && typeof value === "object" ? value : {};
  const required = ["AntivirusEnabled", "RealTimeProtectionEnabled", "BehaviorMonitorEnabled", "IoavProtectionEnabled"];
  const status = { ...raw };
  for (const key of required) {
    if (typeof status[key] !== "boolean") status[key] = null;
  }
  const complete = status.AccessLimited !== true && required.every((key) => typeof status[key] === "boolean");
  status.scoreAvailable = complete;
  status.protectionScore = complete ? calculateProtectionScore(status) : null;
  if (!complete) status.diagnostic = "Windows returned a partial Microsoft Defender status; Protection Score is intentionally unavailable.";
  return { ok: true, status };
}

async function desktopIntegrityManifest() {
  const files = ["main.cjs", "preload.cjs", "protect.html", "assets/protect-ui-v27.js", "rtmp.cjs"];
  const digest = crypto.createHash("sha256");
  for (const file of files) {
    const target = path.join(__dirname, file);
    digest.update(file);
    try { digest.update(fs.readFileSync(target)); }
    catch { digest.update("missing"); }
  }
  const securityFlags = [];
  const defender = await getDefenderStatus();
  if (defender.ok && defender.status?.RealTimeProtectionEnabled === false) securityFlags.push("defender_realtime_off");
  if (protectActivities.some((entry) => entry.securityFlag === "defender_tamper_recent")) securityFlags.push("defender_tamper_recent");
  return {
    platform: process.platform,
    appVersion: app.getVersion(),
    integrityHash: digest.digest("hex"),
    // Local events remain local. Only two non-sensitive, boolean-like signals
    // are sent to the serverless policy endpoint when they were observed.
    securityFlags,
  };
}

const PROTECT_RISKY_EXTENSIONS = new Set([".exe", ".msi", ".msix", ".bat", ".cmd", ".com", ".scr", ".ps1", ".js", ".jse", ".vbs", ".vbe", ".dll", ".zip", ".rar", ".7z", ".iso"]);
const PROTECT_SIGNABLE_EXTENSIONS = new Set([".exe", ".msi", ".msix", ".com", ".scr", ".ps1", ".dll"]);
const protectActivities = [];
const protectFiles = new Map();
const protectSeenEvents = new Set();
let protectWatcher = null;
let protectPollTimer = null;
let protectRegistryBaseline = null;

function publicProtectActivity(entry) {
  const { path: _path, ...safe } = entry;
  return safe;
}

function publishProtectActivities() {
  const payload = protectActivities.map(publicProtectActivity);
  try { protectWindow?.webContents?.send("protect:activity", payload); } catch {}
}

function addProtectActivity(entry) {
  const record = {
    id: `protect_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    ...entry,
  };
  protectActivities.unshift(record);
  if (record.path) protectFiles.set(record.id, record.path);
  protectActivities.splice(40);
  for (const id of protectFiles.keys()) {
    if (!protectActivities.some((item) => item.id === id)) protectFiles.delete(id);
  }
  publishProtectActivities();
  return record;
}

function updateProtectActivity(id, patch) {
  const entry = protectActivities.find((item) => item.id === id);
  if (!entry) return null;
  Object.assign(entry, patch, { updatedAt: new Date().toISOString() });
  publishProtectActivities();
  return entry;
}

function sha256File(target) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const source = fs.createReadStream(target);
    source.on("error", reject);
    source.on("data", (chunk) => hash.update(chunk));
    source.on("end", () => resolve(hash.digest("hex")));
  });
}

async function inspectProtectFile(target, source = "StaĹľenĂ© soubory") {
  try {
    const stats = await fs.promises.stat(target);
    if (!stats.isFile() || stats.size > 1_073_741_824) return null;
    const ext = path.extname(target).toLowerCase();
    if (!PROTECT_RISKY_EXTENSIONS.has(ext)) return null;
    const fileName = path.basename(target);
    const entry = addProtectActivity({
      type: "file", status: "checking", severity: "info", path: target, fileName,
      title: "Kontroluji novĂ˝ rizikovĂ˝ soubor", detail: `${source}: ${fileName}`,
    });
    let sha256 = null;
    if (stats.size <= 268_435_456) {
      try { sha256 = await sha256File(target); } catch {}
    }
    if (PROTECT_SIGNABLE_EXTENSIONS.has(ext)) {
      const signatureScript = "$ErrorActionPreference='Stop'; Get-AuthenticodeSignature -LiteralPath $env:VOXARIO_PROTECT_TARGET | Select-Object Status,StatusMessage,@{n='Signer';e={$_.SignerCertificate.Subject}} | ConvertTo-Json -Compress";
      const signature = await runDefenderPowerShell(signatureScript, 12_000, { VOXARIO_PROTECT_TARGET: target });
      let signatureInfo = null;
      try { signatureInfo = signature.ok ? JSON.parse(signature.output || "{}") : null; } catch {}
      if (signatureInfo?.Status === 0 || signatureInfo?.Status === "Valid") {
        updateProtectActivity(entry.id, { status: "ready", severity: "low", sha256, title: "PodepsanĂ˝ soubor ÄŤekĂˇ na kontrolu", detail: `${fileName} Â· podpis ovÄ›Ĺ™en${signatureInfo.Signer ? ` Â· ${signatureInfo.Signer}` : ""}` });
      } else {
        updateProtectActivity(entry.id, { status: "warning", severity: "medium", sha256, title: "NeznĂˇmĂ˝ nebo neplatnÄ› podepsanĂ˝ spustitelnĂ˝ soubor", detail: `${fileName} Â· nespouĹˇtÄ›j jej, dokud jej nezkontroluje Microsoft Defender.` });
      }
    } else {
      updateProtectActivity(entry.id, { status: "warning", severity: "medium", sha256, title: "Archiv nebo rizikovĂ˝ soubor ÄŤekĂˇ na kontrolu", detail: `${fileName} Â· pĹ™ed rozbalenĂ­m jej zkontroluj Microsoft Defenderem.` });
    }
    return entry.id;
  } catch {
    return null;
  }
}

async function scanProtectActivity(id) {
  const target = protectFiles.get(id);
  if (!target || !fs.existsSync(target)) return { ok: false, error: "Soubor uĹľ nenĂ­ na pĹŻvodnĂ­m mĂ­stÄ›." };
  updateProtectActivity(id, { status: "scanning", severity: "info", title: "Defender kontroluje soubor", detail: `${path.basename(target)} Â· ÄŤekĂˇm na udĂˇlost Defenderu.` });
  const scanScript = "$ErrorActionPreference='Stop'; Start-MpScan -ScanType CustomScan -ScanPath $env:VOXARIO_PROTECT_TARGET; 'started'";
  const result = await runDefenderPowerShell(scanScript, 25_000, { VOXARIO_PROTECT_TARGET: target });
  if (!result.ok) {
    updateProtectActivity(id, { status: "warning", severity: "medium", title: "Kontrolu Defenderu se nepodaĹ™ilo spustit", detail: `${path.basename(target)} Â· ${result.error}` });
    return result;
  }
  updateProtectActivity(id, { status: "queued", severity: "info", title: "Kontrola byla pĹ™edĂˇna Defenderu", detail: `${path.basename(target)} Â· vĂ˝sledek se objevĂ­ v pĹ™ehledu Defenderu.` });
  return { ok: true };
}

async function pollDefenderEvents() {
  const eventScript = "$ErrorActionPreference='Stop'; Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational'; Id=1000,1001,1116,1117,1118,5001,5004,5007,5010} -MaxEvents 30 | Select-Object RecordId,Id,TimeCreated,LevelDisplayName,Message | ConvertTo-Json -Compress";
  const result = await runDefenderPowerShell(eventScript, 12_000);
  if (!result.ok) return;
  let rows;
  try { rows = JSON.parse(result.output || "[]"); } catch { return; }
  for (const event of (Array.isArray(rows) ? rows : [rows])) {
    const key = String(event.RecordId || `${event.Id}:${event.TimeCreated}`);
    if (protectSeenEvents.has(key)) continue;
    protectSeenEvents.add(key);
    if (protectSeenEvents.size > 100) protectSeenEvents.delete(protectSeenEvents.values().next().value);
    const message = String(event.Message || "").replace(/\s+/g, " ").trim().slice(0, 350);
    if (event.Id === 1116 || event.Id === 1117 || event.Id === 1118) {
      addProtectActivity({ type: "defender", status: "threat", severity: "high", title: "Microsoft Defender zaznamenal hrozbu", detail: message || "OtevĹ™i Windows ZabezpeÄŤenĂ­ a zkontroluj historii ochrany." });
    } else if (event.Id === 5001 || event.Id === 5010) {
      addProtectActivity({ type: "defender", status: "threat", severity: "high", securityFlag: "defender_tamper_recent", title: "Defender hlĂˇsĂ­ oslabenĂ­ ochrany", detail: message || "ReĂˇlnĂˇ ochrana Defenderu byla vypnuta. OtevĹ™i Windows ZabezpeÄŤenĂ­ a ovÄ›Ĺ™ nastavenĂ­." });
    } else if (event.Id === 5004 || event.Id === 5007) {
      addProtectActivity({ type: "defender", status: "warning", severity: "medium", title: "NastavenĂ­ Defenderu se zmÄ›nilo", detail: `${message || "Zkontroluj, zda byla zmÄ›na oÄŤekĂˇvanĂˇ."} Â· UdĂˇlost ${event.Id} nenĂ­ sama o sobÄ› dĹŻkaz Ăştoku.` });
    } else if (event.Id === 1000) {
      addProtectActivity({ type: "defender", status: "scanning", severity: "info", title: "Microsoft Defender zahĂˇjil kontrolu", detail: message || "Kontrola probĂ­hĂˇ ve Windows." });
    } else if (event.Id === 1001) {
      addProtectActivity({ type: "defender", status: "complete", severity: "low", title: "Microsoft Defender dokonÄŤil kontrolu", detail: message || "VĂ˝sledek najdeĹˇ ve Windows ZabezpeÄŤenĂ­." });
    }
  }
}

// Read-only system context.  This is intentionally a narrow set of security
// related values, not a general registry monitor and never writes a key.
const SYSTEM_SAFETY_SCRIPT = [
  "$ErrorActionPreference='SilentlyContinue'",
  "$os=Get-CimInstance Win32_OperatingSystem",
  "$paths=@('HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System','HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender','HKLM:\SOFTWARE\Microsoft\Windows Defender\Real-Time Protection','HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon')",
  "$registry=@{}; foreach($p in $paths){$item=Get-ItemProperty -Path $p; if($null -ne $item){$registry[$p]=@{EnableLUA=$item.EnableLUA;ConsentPromptBehaviorAdmin=$item.ConsentPromptBehaviorAdmin;DisableAntiSpyware=$item.DisableAntiSpyware;DisableRealtimeMonitoring=$item.DisableRealtimeMonitoring;Shell=$item.Shell}}}",
  "$ring=$null; foreach($p in @('HKLM:\SOFTWARE\Microsoft\WindowsSelfHost\UI\Selection','HKLM:\SOFTWARE\Microsoft\WindowsSelfHost\Applicability')){$v=Get-ItemProperty -Path $p; if($v){$ring=($v.UIBranch,$v.BranchName,$v.Ring | Where-Object {$_} | Select-Object -First 1); if($ring){break}}}",
  "$updates=@(); try{$session=New-Object -ComObject Microsoft.Update.Session; $searcher=$session.CreateUpdateSearcher(); $result=$searcher.Search('IsInstalled=0 and IsHidden=0'); foreach($u in @($result.Updates | Select-Object -First 12)){$updates+=@{title=$u.Title;preview=($u.Title -match '(?i)preview|insider|canary|dev channel|beta channel|release preview');rebootRequired=$u.RebootRequired}}}catch{}",
  "[pscustomobject]@{osCaption=$os.Caption;osBuild=$os.BuildNumber;insiderRing=$ring;updates=$updates;registry=$registry}|ConvertTo-Json -Depth 6 -Compress",
].join(";");

async function getSystemSafety() {
  const result = await runDefenderPowerShell(SYSTEM_SAFETY_SCRIPT, 20_000);
  if (!result.ok) return result;
  let payload;
  try { payload = JSON.parse(result.output || "{}"); }
  catch { return { ok: false, error: "Windows vrĂˇtil neÄŤitelnĂ˝ stav systĂ©mu." }; }
  const registry = payload.registry || {};
  const fingerprint = crypto.createHash("sha256").update(JSON.stringify(registry)).digest("hex");
  const changed = !!protectRegistryBaseline && protectRegistryBaseline !== fingerprint;
  if (changed) addProtectActivity({ type: "system", status: "warning", severity: "medium", title: "ZmÄ›na v citlivĂ©m nastavenĂ­ Windows", detail: "Protect zjistil zmÄ›nu v jednĂ© ze sledovanĂ˝ch bezpeÄŤnostnĂ­ch hodnot registru. NeznĂˇ autora zmÄ›ny a nic automaticky nevracĂ­." });
  protectRegistryBaseline = fingerprint;
  const updates = Array.isArray(payload.updates) ? payload.updates : (payload.updates ? [payload.updates] : []);
  const previewUpdates = updates.filter((item) => item?.preview === true).length;
  const insiderRing = String(payload.insiderRing || "").trim();
  return { ok: true, system: {
    osCaption: payload.osCaption || "Windows", osBuild: payload.osBuild || "â€”", insiderRing: insiderRing || null,
    isPreviewChannel: /canary|dev|beta|release preview|insider/i.test(insiderRing),
    updateCount: updates.length, previewUpdates, updates: updates.map((item) => ({ title: String(item?.title || "Aktualizace Windows"), preview: item?.preview === true, rebootRequired: item?.rebootRequired === true })),
    registry: { monitored: Object.keys(registry).length, changed, fingerprint: fingerprint.slice(0, 12) },
  }};
}

function startProtectMonitor() {
  if (protectPollTimer) return;
  void pollDefenderEvents();
  void getSystemSafety();
  protectPollTimer = setInterval(() => {
    void pollDefenderEvents();
    void getSystemSafety();
  }, 5 * 60 * 1000);
  protectPollTimer.unref?.();
  try {
    const downloads = app.getPath("downloads");
    protectWatcher = fs.watch(downloads, { persistent: false }, (_event, fileName) => {
      if (!fileName) return;
      const target = path.join(downloads, String(fileName));
      const ext = path.extname(target).toLowerCase();
      if (!PROTECT_RISKY_EXTENSIONS.has(ext)) return;
      setTimeout(() => void inspectProtectFile(target, "HlĂ­daÄŤ StaĹľenĂ˝ch souborĹŻ"), 1_500).unref?.();
    });
    protectWatcher.on("error", () => {});
  } catch {}
}

process.on("voxario-protect:download", (payload) => {
  if (!getModulesInfo().protect.installed || !payload?.path) return;
  void inspectProtectFile(payload.path, "VoxarioBrowser");
});

function createProtectWindow() {
  if (protectWindow && !protectWindow.isDestroyed()) {
    revealWindow(protectWindow);
    return protectWindow;
  }
  protectWindow = new BrowserWindow(windowOptions("protect", {
    width: 1060, height: 720, minWidth: 840, minHeight: 580, show: false,
    autoHideMenuBar: true, backgroundColor: "#03111b", title: "VoxarioProtect",
    icon: path.join(__dirname, "assets", "icon.png"),
    webPreferences: { preload: path.join(__dirname, "preload.cjs"), contextIsolation: true, nodeIntegration: false, sandbox: true },
  }));
  trackWindowState("protect", protectWindow);
  protectWindow.loadFile(path.join(__dirname, "protect.html"));
  protectWindow.webContents.once("did-finish-load", () => {
    // Protect may be the only visible StudioVoxario surface. Check the stable
    // GitHub release channel here too so old Protect builds do not stay stale.
    setTimeout(() => runAppAutoUpdate().catch(() => {}), 2_500).unref?.();
    scheduleAppAutoUpdate();
  });
  protectWindow.once("ready-to-show", () => revealWindow(protectWindow));
  protectWindow.on("closed", () => { protectWindow = null; });
  return protectWindow;
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
    title: "NastavenĂ­ â€“ Voxar.app",
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
  // BezpeÄŤnostnĂ­ pojistka: nedovol pĹ™epnout na "beta" bez unlocku.
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
// OdemÄŤenĂ­ Beta kanĂˇlu â€” pĹ™ijĂ­mĂˇ jiĹľ OVÄšĹENĂť pĹ™Ă­znak z renderu (Supabase RPC
// `redeem_download_code` se volĂˇ v UI, kde je uĹľivatelskĂˇ session). Main
// process jen zapĂ­Ĺˇe flag do settings.
ipcMain.handle("settings:unlock-beta", (_e, ok) => {
  if (ok === true) {
    settings = { ...settings, betaUnlocked: true };
    saveSettings(settings);
  }
  return { betaUnlocked: !!settings.betaUnlocked };
});

ipcMain.handle("protect:status", async () => ({
  ...(await getDefenderStatus()),
  background: {
    active: !!protectPollTimer,
    mode: protectPollTimer ? "HlĂ­daÄŤ StaĹľenĂ˝ch souborĹŻ a Defenderu je aktivnĂ­ na pozadĂ­." : "Ochrana na pozadĂ­ nenĂ­ aktivnĂ­.",
  },
}));
ipcMain.handle("protect:integrity", () => desktopIntegrityManifest());
ipcMain.handle("protect:runtime-health", () => ({
  ok: true,
  uptimeSec: Math.round(process.uptime()),
  appVersion: app.getVersion(),
  processMemoryMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  platform: process.platform,
  arch: process.arch,
  // Local paths only; no account data, credentials, tokens or remote URLs.
  appBundlePath: __dirname,
  protectUiAssetPresent: fs.existsSync(path.join(__dirname, "assets", "protect-ui-v27.js")),
  protectHtmlPresent: fs.existsSync(path.join(__dirname, "protect.html")),
}));
ipcMain.handle("protect:activity", () => protectActivities.map(publicProtectActivity));
ipcMain.handle("protect:choose-file", async () => {
  const choice = await dialog.showOpenDialog(protectWindow || mainWindow || undefined, {
    title: "Vybrat soubor pro kontrolu Microsoft Defenderem",
    properties: ["openFile"],
    filters: [{ name: "RizikovĂ© soubory", extensions: [...PROTECT_RISKY_EXTENSIONS].map((ext) => ext.slice(1)) }, { name: "VĹˇechny soubory", extensions: ["*"] }],
  });
  if (choice.canceled || !choice.filePaths[0]) return { ok: false, canceled: true };
  const id = await inspectProtectFile(choice.filePaths[0], "RuÄŤnĂ­ vĂ˝bÄ›r");
  return id ? { ok: true, id } : { ok: false, error: "VybranĂ˝ soubor nenĂ­ moĹľnĂ© zkontrolovat." };
});
ipcMain.handle("protect:scan-activity", (_e, id) => scanProtectActivity(typeof id === "string" ? id : ""));
ipcMain.handle("protect:quick-scan", async () => {
  const result = await runDefenderPowerShell("$ErrorActionPreference='Stop'; Start-MpScan -ScanType QuickScan; 'started'", 20_000);
  return result.ok ? { ok: true } : result;
});
ipcMain.handle("protect:open-windows-security", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Windows ZabezpeÄŤenĂ­ je dostupnĂ© pouze ve Windows." };
  try { await shell.openExternal("windowsdefender:"); return { ok: true }; }
  catch (error) { return { ok: false, error: error?.message || "Windows ZabezpeÄŤenĂ­ se nepodaĹ™ilo otevĹ™Ă­t." }; }
});
ipcMain.handle("protect:system-safety", () => getSystemSafety());
ipcMain.handle("protect:open-windows-update", async () => {
  if (process.platform !== "win32") return { ok: false, error: "Windows Update je dostupnĂ˝ pouze ve Windows." };
  try { await shell.openExternal("ms-settings:windowsupdate"); return { ok: true }; }
  catch (error) { return { ok: false, error: error?.message || "Windows Update se nepodaĹ™ilo otevĹ™Ă­t." }; }
});
ipcMain.handle("protect:return-to-launcher", () => {
  try { protectWindow?.close(); } catch {}
  createLauncher();
  revealWindow(launcherWindow);
  return { ok: true };
});
// ---- Screen / window capture -------------------------------------------
// Renderer si zobrazĂ­ vlastnĂ­ HUD picker; main proces jen dodĂˇ seznam zdrojĹŻ
// (celĂ© obrazovky + jednotlivĂˇ okna/hry) s nĂˇhledy.
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
      // close() by se kvĹŻli "closeToTray" jen skrylo a okno by zĹŻstalo viset â€”
      // proto okno rovnou zniÄŤĂ­me, aĹĄ se dĂˇ modul znovu vybrat.
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
// Ĺ˝ivĂˇ kontrola pro FAB ikonku v aplikaci â€” bez dialogĹŻ.
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
// Product registry is deliberately separate from the legacy in-payload module
// state.  The launcher can therefore launch a genuinely installed Browser EXE
// rather than merely opening a second window in Voxar.app.
ipcMain.handle("products:state", () => getInstalledProducts());
ipcMain.handle("products:launch", (_e, id) => {
  const product = getInstalledProducts()[id];
  if (!product) return { ok: false, error: "NeznĂˇmĂ˝ produkt" };
  if (!product.installed) return { ok: false, needsInstall: true, product };
  if ((id === "app" && !BROWSER_ONLY) || (id === "browser" && BROWSER_ONLY)) {
    return { ok: true, alreadyRunning: true, product };
  }
  const result = launchProduct(product);
  if (result.ok && id === "browser") {
    try { launcherWindow?.close(); } catch {}
    launcherWindow = null;
  }
  return result;
});
ipcMain.handle("products:download-installer", (_e, id) => {
  const product = getInstalledProducts()[id];
  if (!product?.downloadUrl) return { ok: false, error: "InstalĂˇtor produktu nenĂ­ nakonfigurovĂˇn" };
  shell.openExternal(product.downloadUrl);
  return { ok: true, url: product.downloadUrl };
});
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
// Stav modulĹŻ pro rozcestnĂ­k.
ipcMain.handle("modules:state", () => getModulesInfo());

// DoinstalovĂˇnĂ­ modulu. Engine je souÄŤĂˇstĂ­ balĂ­ÄŤku â†’ aktivace je okamĹľitĂˇ.
// KdyĹľ soubory chybĂ­ (poĹˇkozenĂˇ instalace), otevĹ™eme strĂˇnku se staĹľenĂ­m.
ipcMain.handle("modules:install", (_e, name) => {
  const key = typeof name === "string" ? name : name?.module;
  if (key !== "browser" && key !== "protect") return { ok: false, error: "NeznĂˇmĂ˝ modul" };
  const available = key === "browser" ? browserPayloadAvailable() : fs.existsSync(path.join(__dirname, "protect.html"));
  if (!available) {
    shell.openExternal(DOWNLOAD_PAGE);
    return { ok: false, downloading: true, url: DOWNLOAD_PAGE };
  }
  const state = readModulesState();
  state[key] = { installed: true, installedAt: new Date().toISOString() };
  writeModulesState(state);
  if (key === "protect") {
    startProtectMonitor();
    createTray();
  }
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
  if (mod === "protect") {
    if (!getModulesInfo().protect.installed) return { ok: false, needsActivation: true };
    createProtectWindow();
    createTray();
    try { launcherWindow?.close(); } catch {}
    launcherWindow = null;
    return { ok: true };
  }
  if (mod === "browser") {
    const standaloneBrowser = getInstalledProducts().browser;
    if (standaloneBrowser.installed && !BROWSER_ONLY) {
      const launched = launchProduct(standaloneBrowser);
      if (launched.ok) {
        try { launcherWindow?.close(); } catch {}
        launcherWindow = null;
      }
      return launched;
    }
    const info = getModulesInfo();
    if (!info.browser.installed) {
      if (!info.browser.available) {
        shell.openExternal(DOWNLOAD_PAGE);
        return { ok: false, needsDownload: true, url: DOWNLOAD_PAGE };
      }
      writeModulesState({ ...readModulesState(), browser: { installed: true, installedAt: new Date().toISOString() } });
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
    // Pojistka: kdyĹľ se strĂˇnka nenaÄŤte (offline, vĂ˝padek serveru), okno se
    // dĹ™Ă­v nikdy neukĂˇzalo a launcher zĹŻstal viset â€” aplikace â€žneĹˇla spustit".
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
    // Pojistka: okno ukĂˇĹľeme nejpozdÄ›ji po 6 s, i kdyby se strĂˇnka nenaÄŤetla.
    setTimeout(reveal, 6_000);
  } else {
    // Okno uĹľ existuje â€” pĹ™epni ho na vybranĂ˝ modul (jinak by uĹľivatel
    // zĹŻstal v tom pĹ™edchozĂ­m).
    try {
      loadMainTarget(targetUrl).catch((error) => console.error("Module switch failed", error));
    } catch {}
    launcherWindow?.close();
    launcherWindow = null;
    showMain();
  }
  return { ok: true };
});

// PĹ™epnutĂ­ modulu pĹ™Ă­mo z bÄ›ĹľĂ­cĂ­ho okna (napĹ™. tlaÄŤĂ­tko Voxar.app v prohlĂ­ĹľeÄŤi).
ipcMain.handle("app:open-module", (_e, mod) => {
  const key = typeof mod === "string" ? mod : mod?.module;
  if (key === "protect") {
    if (!getModulesInfo().protect.installed) return { ok: false, needsActivation: true };
    createProtectWindow();
    return { ok: true };
  }
  if (key === "browser") {
    const standaloneBrowser = getInstalledProducts().browser;
    if (standaloneBrowser.installed && !BROWSER_ONLY) return launchProduct(standaloneBrowser);
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

// -------- Voxar.app: automatickĂˇ aktualizace + historie verzĂ­ --------
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

// ZaznamenĂˇ, kdy byla kterĂˇ verze poprvĂ© spuĹˇtÄ›na (= nainstalovĂˇna).
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
    return await installUpdateFromRenderer({ parentWindow: mainWindow || protectWindow || launcherWindow, channel });
  } catch (e) {
    return { status: "error", error: String(e?.message || e) };
  } finally {
    appUpdateRunning = false;
    if (manual) { /* jednorĂˇzovĂˇ kontrola z UI */ }
  }
}

function scheduleAppAutoUpdate() {
  if (appUpdateTimer) clearInterval(appUpdateTimer);
  appUpdateTimer = setInterval(() => {
    const surfaceAlive = [mainWindow, protectWindow, launcherWindow].some((win) => win && !win.isDestroyed());
    if (!BROWSER_ONLY && (surfaceAlive || getModulesInfo().protect.installed)) {
      runAppAutoUpdate().catch(() => {});
    }
  }, 3 * 60 * 60 * 1000);
  appUpdateTimer.unref?.();
}

ipcMain.handle("app:version-history", () => ({
  current: app.getVersion(),
  history: readVersionHistory(),
}));

// -------- VoxarioBrowser: automatickĂˇ aktualizace --------

// ProhlĂ­ĹľeÄŤ se distribuuje ve stejnĂ©m balĂ­ÄŤku jako Voxar.app, takĹľe staÄŤĂ­
// spustit standardnĂ­ update pipeline. Kontrola bÄ›ĹľĂ­ pĹ™i startu/restartu okna
// a pak periodicky; novĂˇ verze se stĂˇhne a nainstaluje bez ptanĂ­.
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
    if (manual) { /* jednorĂˇzovĂˇ kontrola z UI */ }
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

// -------- VoxarioBrowser: nativnĂ­ Chromium okno --------
function createBrowserWindow() {
  if (browserWindow && !browserWindow.isDestroyed()) {
    revealWindow(browserWindow);
    return browserWindow;
  }
  browserWindow = new BrowserWindow(windowOptions("browser", {
    width: 1536,
    height: 864,
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
      backgroundThrottling: true,
      spellcheck: false,
    },
  }));
  trackWindowState("browser", browserWindow);
  startupLog("Okno VoxarioBrowseru vytvoĹ™eno");
  browserWindow.loadFile(path.join(__dirname, "browser.html")).catch((error) => {
    startupLog("VoxarioBrowser se nepodaĹ™ilo naÄŤĂ­st", error);
    revealWindow(browserWindow);
  });
  const fitBrowserUiZoom = () => {
    if (!browserWindow || browserWindow.isDestroyed()) return;
    const [width, height] = browserWindow.getContentSize();
    // ReferenÄŤnĂ­ nĂˇvrh je komponovanĂ˝ pĹ™ibliĹľnÄ› pro 1680 Ă— 940 px. Na
    // ĹˇirokĂ˝ch/QHD monitorech zvÄ›tĹˇĂ­me celĂ© nativnĂ­ UI, aby nezĹŻstalo jako
    // drobnĂ˝ pruh nahoĹ™e s prĂˇzdnou plochou pod nĂ­m. Webview si dĂˇl spravuje
    // vlastnĂ­ zoom strĂˇnky nezĂˇvisle.
    const referenceScale = Math.min(width / 1680, height / 940);
    // Na maximalizovanĂ©m QHD oknÄ› staÄŤĂ­ jen jemnĂ© zvÄ›tĹˇenĂ­. PĹŻvodnĂ­ pĹ™epoÄŤet
    // mĂ­Ĺ™il tĂ©mÄ›Ĺ™ na 150 %, coĹľ bylo zbyteÄŤnÄ› mohutnĂ©; 80% korekce jej drĹľĂ­
    // pĹ™ibliĹľnÄ› na 118â€“120 %, zatĂ­mco bÄ›ĹľnĂˇ okna zĹŻstĂˇvajĂ­ na 100 %.
    const factor = Math.max(1, Math.min(1.25, referenceScale * 0.8));
    browserWindow.webContents.setZoomFactor(Math.round(factor * 100) / 100);
  };
  browserWindow.webContents.once("dom-ready", () => revealWindow(browserWindow));
  setTimeout(() => revealWindow(browserWindow), 3_000);
  browserWindow.on("closed", () => {
    browserWindow = null;
    if (browserUpdateTimer) { clearInterval(browserUpdateTimer); browserUpdateTimer = null; }
  });

  // Auto-update pĹ™i kaĹľdĂ©m spuĹˇtÄ›nĂ­/restartu prohlĂ­ĹľeÄŤe + periodicky.
  browserWindow.webContents.once("did-finish-load", () => {
    fitBrowserUiZoom();
    setTimeout(() => runBrowserAutoUpdate().catch(() => {}), 3_000);
  });
  browserWindow.on("resize", fitBrowserUiZoom);
  scheduleBrowserAutoUpdate();

  // Popupy z webview: pĹ™ihlaĹˇovacĂ­ okna (Google, Microsoft, â€¦) musĂ­ zĹŻstat
  // skuteÄŤnĂ˝mi popupy s vazbou na `window.opener`, jinak se pĹ™ihlĂˇĹˇenĂ­
  // nikdy nedokonÄŤĂ­. OstatnĂ­ popupy otevĹ™eme jako novĂ˝ panel.
  browserWindow.webContents.on("did-attach-webview", (_e, wc) => {
    try { wc.setUserAgent(browserSettings.CHROME_UA); } catch {}
    wc.setWindowOpenHandler(({ url, frameName, features }) => {
      const isAuth = (() => {
        try { return browserSettings.isAuthHost(url); } catch { return false; }
      })();
      const wantsPopup = /popup|width=|height=/i.test(features || "") || /oauth|login|signin|auth/i.test(frameName || "");
      if (isAuth || wantsPopup) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: {
            width: 520,
            height: 680,
            autoHideMenuBar: true,
            backgroundColor: "#0b0f18",
            parent: browserWindow || undefined,
            webPreferences: {
              partition: "persist:voxario",
              contextIsolation: true,
              nodeIntegration: false,
              sandbox: true,
            },
          },
        };
      }
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

// -------- ZĂˇloĹľky prohlĂ­ĹľeÄŤe (import/export) --------
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
    title: "Importovat zĂˇloĹľky",
    filters: [{ name: "ZĂˇloĹľky", extensions: ["html", "htm", "json", "jsonlz4"] }],
    properties: ["openFile"],
  });
  if (res.canceled || !res.filePaths[0]) return { ok: false, canceled: true };
  return bookmarks.importFromFile(app, res.filePaths[0]);
});
ipcMain.handle("bookmarks:export-file", async () => {
  const target = browserWindow && !browserWindow.isDestroyed() ? browserWindow : undefined;
  const res = await dialog.showSaveDialog(target, {
    title: "Exportovat zĂˇloĹľky",
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
        message: `NepodaĹ™ilo se vrĂˇtit na pĹ™edchozĂ­ verzi (${res.status})`,
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
ipcMain.handle("app:rollback", () => triggerRollbackFlow("RuÄŤnĂ­ poĹľadavek z aplikace."));
ipcMain.handle("launcher:rollback", () => triggerRollbackFlow("RuÄŤnĂ­ poĹľadavek z launcheru."));
ipcMain.handle("launcher:rollback-state", () => rollback.readState());

// -------- In-launcher prompt bridge --------
// Nahrazuje nativnĂ­ dialog.showMessageBox pro update prompt / info / chyby,
// aby to nebyly OS pop-upy, ale integrovanĂ© UI v launcheru.
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
  if (!win || win.isDestroyed() || !win.webContents) return null; // â†’ fallback na dialog
  return new Promise((resolve) => {
    const id = ++promptSeq;
    pendingPrompts.set(id, { resolve });
    try {
      // Jen skuteÄŤnĂ© dotazy vytahujĂ­ okno dopĹ™edu; oznĂˇmenĂ­ o aktualizaci
      // na pozadĂ­ nesmĂ­ uĹľivatele vyruĹˇit.
      if (payload?.kind === "question") {
        win.show();
        win.focus();
      }
      win.webContents.send("launcher:prompt", { id, ...payload });
    } catch (e) {
      pendingPrompts.delete(id);
      resolve(null);
    }
    // BezpeÄŤnostnĂ­ timeout â€” pokud UI neodpovĂ­ do 10 min, uvolnĂ­me handler.
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
  launcherWindow = new BrowserWindow(windowOptions("launcher", {
    width: 1080,
    height: 680,
    minWidth: 920,
    minHeight: 560,
    frame: false,
    resizable: true,
    backgroundColor: "#020617",
    show: false,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  }));
  trackWindowState("launcher", launcherWindow);
  startupLog("Launcher vytvoĹ™en");
  launcherWindow.loadFile(path.join(__dirname, "launcher.html")).catch((error) => {
    startupLog("Launcher se nepodaĹ™ilo naÄŤĂ­st", error);
    revealWindow(launcherWindow);
  });
  launcherWindow.webContents.once("dom-ready", () => revealWindow(launcherWindow));
  launcherWindow.webContents.once("did-finish-load", () => {
    rollback.scheduleHealthyMark(() => launcherWindow);
  });
  launcherWindow.once("ready-to-show", () => revealWindow(launcherWindow));
  setTimeout(() => revealWindow(launcherWindow), 2_000);
  launcherWindow.on("closed", () => (launcherWindow = null));
  return launcherWindow;
}


function setLauncherStatus(msg) {
  try { launcherWindow?.webContents.send("launcher:status", msg); } catch {}
}

// RozcestnĂ­k se smĂ­ poslat aĹľ po naÄŤtenĂ­ rendereru, jinak se zprĂˇva zahodĂ­
// a uĹľivateli zĹŻstane prĂˇzdnĂ˝ splash bez karet i tlaÄŤĂ­tka.
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
  // Aktualizace bÄ›ĹľĂ­ ÄŤistÄ› na pozadĂ­ â€” rozcestnĂ­k ani moduly se kvĹŻli nĂ­
  // nezdrĹľujĂ­. Po dokonÄŤenĂ­ instalace se aplikace sama znovu spustĂ­
  // (quitAndInstall se spouĹˇtĂ­ s forceRunAfter).
  Promise.resolve()
    .then(() => checkForUpdatesQuiet({ channel: launcherChannel }))
    .then((info) => {
      if (!info?.available) return null;
      setLauncherStatus(`Stahuji verzi ${info.remote} na pozadĂ­â€¦`);
      return installUpdateFromRenderer({ parentWindow: launcherWindow, channel: launcherChannel });
    })
    .catch((e) => console.error("launcher background update error", e));
}

async function runLauncherSequence() {
  createLauncher();

  // RozcestnĂ­k: uĹľivatel si vybere modul (Voxar.app / VoxarioBrowser).
  // ZobrazĂ­me ho okamĹľitÄ›, aktualizace dobÄ›hne na pozadĂ­.
  setLauncherStatus("Vyberte modul");
  try {
    launcherWindow?.setMinimumSize(920, 560);
    // PĹ™i prvnĂ­m spuĹˇtÄ›nĂ­ zachovĂˇme vyvĂˇĹľenou vĂ˝chozĂ­ velikost. PozdÄ›ji uĹľ
    // nesmĂ­me pĹ™epsat uĹľivatelovu uloĹľenou pozici nebo maximalizovanĂ˝ stav.
    if (!savedWindowState("launcher")) {
      launcherWindow?.setSize(1080, 680);
      launcherWindow?.center();
    }
  } catch {}
  sendLauncherChoose();

  runLauncherBackgroundUpdate();
}


app.whenReady().then(async () => {
  startupLog(`Start aplikace ${app.getVersion()}`);
  browserSettings.registerBrowserSettings();
  // RTMP rozhranĂ­ je zĂˇmÄ›rnÄ› registrovanĂ© aĹľ po startu Electronu. Preload jej
  // vystavuje rendereru, ale bez tĂ©to registrace by volĂˇnĂ­ z vysĂ­lacĂ­ho studia
  // skonÄŤilo chybou "No handler registered" a FFmpeg by se nikdy nespustil.
  registerRtmpHandlers();
  if (getModulesInfo().protect.installed) {
    // HlĂ­daÄŤ zĹŻstĂˇvĂˇ aktivnĂ­ i po zavĹ™enĂ­ okna Protect a po nĂˇvratu do
    // rozcestnĂ­ku. Je ĂşspornĂ˝: watcher StaĹľenĂ˝ch souborĹŻ + kontrola udĂˇlostĂ­
    // Defenderu jednou za pÄ›t minut, bez druhĂ©ho AV enginu.
    startProtectMonitor();
    createTray();
    // Background-only Protect must also receive releases even when the user
    // never opens Voxar.app or the launcher.
    setTimeout(() => runAppAutoUpdate().catch(() => {}), 6_000).unref?.();
    scheduleAppAutoUpdate();
  }
  // ZahodĂ­me HTTP cache (ne cookies/localStorage â€“ pĹ™ihlĂˇĹˇenĂ­ zĹŻstĂˇvĂˇ),
  // ale nikdy kvĹŻli tomu neblokujeme vytvoĹ™enĂ­ prvnĂ­ho okna.
  session.defaultSession.clearCache().catch((error) => startupLog("VyÄŤiĹˇtÄ›nĂ­ cache pĹ™i startu selhalo", error));

  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    const allowed = ["notifications", "media", "clipboard-read", "clipboard-sanitized-write", "fullscreen", "display-capture"];
    cb(allowed.includes(permission));
  });

  // Screen sharing (getDisplayMedia) â€” Electron vyĹľaduje vlastnĂ­ handler,
  // jinak volĂˇnĂ­ v rendereru tiĹˇe selĹľe.
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
        // Loopback audio je podporovanĂ˝ jen na Windows; jinde by celĂ˝ poĹľadavek selhal.
        callback({ video: picked, audio: process.platform === "win32" ? "loopback" : undefined });

      } catch (e) {
        console.error("[display-capture] failed", e);
        callback(null);
      }
    });

  }

  // Historie verzĂ­: zapĂ­Ĺˇeme datum prvnĂ­ho spuĹˇtÄ›nĂ­ aktuĂˇlnĂ­ verze.
  recordInstalledVersion();

  // NejdĹ™Ă­v vĹľdy vytvoĹ™Ă­me viditelnĂ© okno. Kontrola pĹ™edchozĂ­ho pĂˇdu ani sĂ­ĹĄ
  // nesmĂ­ zablokovat start tak, Ĺľe aplikace zĹŻstane jen mezi procesy.
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
          reason: `PĹ™edchozĂ­ spuĹˇtÄ›nĂ­ verze ${prev.lastStartVersion} skonÄŤilo neoÄŤekĂˇvanÄ›${prev.lastCrash ? " (" + prev.lastCrash.reason + ")" : ""}.`,
          installVerified,
        });
      } catch (error) {
        startupLog("Kontrola obnovy po startu selhala", error);
        console.error("startup rollback failed", error);
      }
    }, 1_000);
  }

  // Ĺ˝ivĂˇ quiet-kontrola pro FAB v UI (bez dialogĹŻ). PrvnĂ­ hned po startu,
  // pak kaĹľdĂ˝ch 15 min. Manifest se fetchuje s cache-bustem, takĹľe vĂ˝sledek
  // je vĹľdy aktuĂˇlnĂ­ â€” uĹľ ĹľĂˇdnĂ© â€žvyskoÄŤĂ­ starĂˇ verze".
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
  // Zkratka VoxarioBrowser spouĹˇtĂ­ stejnĂ© exe s "--browser" â€” druhĂˇ instance
  // skonÄŤĂ­, takĹľe musĂ­me argumenty vyhodnotit tady a otevĹ™Ă­t prohlĂ­ĹľeÄŤ.
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
  // SamostatnĂ˝ prohlĂ­ĹľeÄŤ nemĂˇ tray â€” zavĹ™enĂ­m okna se aplikace ukonÄŤĂ­.
  if (BROWSER_ONLY) return app.quit();
  if (process.platform !== "darwin" && !settings.closeToTray) app.quit();
});

let cleanupDone = false;
app.on("before-quit", (event) => {
  isQuitting = true;
  // NezanechĂˇvej pĹ™i ukonÄŤenĂ­ aplikace ĹľĂˇdnĂ˝ bÄ›ĹľĂ­cĂ­ lokĂˇlnĂ­ RTMP proces.
  // Funkce je idempotentnĂ­, takĹľe je bezpeÄŤnĂˇ i pĹ™i ukonÄŤenĂ­ kvĹŻli aktualizaci.
  try { stopRtmpProcesses(); } catch {}
  // PĹ™i ukonÄŤenĂ­ kvĹŻli aktualizaci nesmĂ­me quit odklĂˇdat â€” instalĂˇtor
  // navazuje na quit a sĂˇm aplikaci po dokonÄŤenĂ­ znovu spustĂ­.
  if (app.isQuittingForUpdate) {
    try { browserSettings.backupBrowserSettings?.(); } catch {}
    cleanupDone = true;
    rollback.recordCleanExit();
    return;
  }
  if (!cleanupDone) {
    // ZĂˇloha nastavenĂ­ (pĹ™eĹľije aktualizaci), pak asynchronnĂ­ mazĂˇnĂ­ dat.
    try { browserSettings.backupBrowserSettings?.(); } catch {}
    // MazĂˇnĂ­ dat pĹ™i ukonÄŤenĂ­ je asynchronnĂ­ â€” odloĹľĂ­me quit, aĹĄ se stihne.
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


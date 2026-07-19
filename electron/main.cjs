// StudioVoxario Desktop - Electron main process
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
} = require("electron");
const path = require("path");
const fs = require("fs");
const { checkForUpdates } = require("./updater.cjs");

const APP_URL = process.env.STUDIOVOXARIO_URL || "https://studiovoxario.com/app";
const SETTINGS_PATH = path.join(app.getPath("userData"), "settings.json");
let launcherWindow = null;

const defaultSettings = {
  minimizeToTray: true,
  closeToTray: true,
  autoStart: false,
  notifications: true,
  hardwareAcceleration: true,
  startMinimized: false,
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
let settingsWindow = null;
let tray = null;
let isQuitting = false;

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
  const iconPath = path.join(__dirname, "assets", "tray.png");
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 20, height: 20 });
  tray = new Tray(icon);
  tray.setToolTip("StudioVoxario");
  const contextMenu = Menu.buildFromTemplate([
    { label: "Otevřít StudioVoxario", click: () => showMain() },
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
  if (!mainWindow) return createMainWindow();
  if (mainWindow.isMinimized()) mainWindow.restore();
  if (!mainWindow.isVisible()) mainWindow.show();
  mainWindow.focus();
}

function createMainWindow() {
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
    },
  });

  mainWindow.loadURL(APP_URL);

  // Open external links in system browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      const appHost = new URL(APP_URL).hostname;
      if (u.hostname === appHost) return { action: "allow" };
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
      title: title || "StudioVoxario",
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
    title: "Nastavení – StudioVoxario",
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
  settings = { ...settings, ...next };
  saveSettings(settings);
  if (prev.autoStart !== settings.autoStart || prev.startMinimized !== settings.startMinimized) {
    applyAutoStart(settings.autoStart);
  }
  return settings;
});
ipcMain.handle("app:version", () => app.getVersion());
ipcMain.handle("app:quit", () => {
  isQuitting = true;
  app.quit();
});
ipcMain.handle("app:reload", () => mainWindow?.webContents.reload());
ipcMain.handle("app:check-updates", () =>
  checkForUpdates({ silent: false, parentWindow: mainWindow })
);
ipcMain.handle("launcher:version", () => app.getVersion());

function createLauncher() {
  launcherWindow = new BrowserWindow({
    width: 420,
    height: 300,
    frame: false,
    resizable: false,
    backgroundColor: "#020617",
    show: true,
    webPreferences: {
      contextIsolation: false,
      nodeIntegration: true,
    },
  });
  launcherWindow.loadFile(path.join(__dirname, "launcher.html"));
  launcherWindow.on("closed", () => (launcherWindow = null));
}

function setLauncherStatus(msg) {
  try { launcherWindow?.webContents.send("launcher:status", msg); } catch {}
}

async function runLauncherSequence() {
  createLauncher();
  setLauncherStatus("Kontrola aktualizací…");

  let result = { status: "skipped" };
  try {
    // Wait for the update check to actually finish (fetchJson has its own 15s timeout).
    // Do NOT race with a short timer — otherwise the old version boots before the
    // update prompt is answered and the user never sees it.
    result = await checkForUpdates({ silent: true, parentWindow: launcherWindow });
  } catch (e) {
    console.error("launcher update check error", e);
  }

  if (result?.status === "installing") {
    setLauncherStatus("Instaluji novou verzi… aplikace se ukončí.");
    return; // installer will replace the app; do not boot the old UI
  }

  setLauncherStatus("Načítání aplikace…");
  createMainWindow();
  createTray();
  applyAutoStart(settings.autoStart);

  mainWindow.webContents.once("did-finish-load", () => {
    setTimeout(() => {
      launcherWindow?.close();
      launcherWindow = null;
      if (!settings.startMinimized) mainWindow?.show();
    }, 400);
  });

  // Safety net: if the window never finishes loading (offline etc.), close the launcher after 20s.
  setTimeout(() => {
    if (launcherWindow) {
      launcherWindow.close();
      launcherWindow = null;
      mainWindow?.show();
    }
  }, 20000);
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => {
    const allowed = ["notifications", "media", "clipboard-read", "clipboard-sanitized-write", "fullscreen"];
    cb(allowed.includes(permission));
  });

  runLauncherSequence();

  setInterval(() => {
    checkForUpdates({ silent: true, parentWindow: mainWindow }).catch(() => {});
  }, 4 * 60 * 60 * 1000);
});

app.on("second-instance", () => showMain());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin" && !settings.closeToTray) app.quit();
});
app.on("before-quit", () => (isQuitting = true));

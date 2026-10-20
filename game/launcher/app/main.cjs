"use strict";

const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const { app, BrowserWindow, dialog, ipcMain, screen, session, shell } = require("electron");
const { createUpdater } = require("./updater.cjs");
const services = require("./services.cjs");

// ------------------------------------------------------------------ odolný start
// Když složku s daty launcheru vytvořil proces spuštěný jako správce (např. instalátor),
// běžný uživatel do ní nemusí smět zapisovat a launcher by se bez práv správce nespustil.
// V takovém případě použijeme náhradní složku.
function ensureWritableUserData() {
  const tryDir = (dir) => {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, `.probe-${process.pid}`);
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe, { force: true });
      return true;
    } catch {
      return false;
    }
  };
  if (tryDir(app.getPath("userData"))) return;
  const fallback = path.join(process.env.LOCALAPPDATA || os.homedir(), "StudioVoxario", "AshesLauncherData");
  if (tryDir(fallback)) app.setPath("userData", fallback);
}
ensureWritableUserData();

function log(message) {
  try {
    fs.appendFileSync(path.join(app.getPath("userData"), "launcher.log"), `[${new Date().toISOString()}] ${message}\n`);
  } catch {}
}

process.on("uncaughtException", (error) => {
  log(`Chyba: ${error?.stack || error}`);
  try {
    dialog.showErrorBox("Ashes of Eryon", `Launcher narazil na chybu:\n${error?.message || error}\n\nPodrobnosti: ${path.join(app.getPath("userData"), "launcher.log")}`);
  } catch {}
});

// Výkon hry: grafická karta i na kartách, které má Chromium na černé listině,
// rasterizace na GPU a žádné omezování snímků na pozadí.
app.commandLine.appendSwitch("ignore-gpu-blocklist");
app.commandLine.appendSwitch("enable-gpu-rasterization");
app.commandLine.appendSwitch("enable-zero-copy");
app.commandLine.appendSwitch("force_high_performance_gpu");

const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;

let mainWindow = null;
let gameWindow = null;
let updater = null;

const gameRunning = () => Boolean(gameWindow && !gameWindow.isDestroyed());

// Ashes of Eryon běží jako 3D webová hra na studiovoxario.com (stejný účet,
// autoritativní server v databázi). Launcher ji otevírá ve vlastním okně.
const GAME_URL = process.env.ASHES_GAME_URL || "https://studiovoxario.com/hra";
const GAME_ORIGIN = new URL(GAME_URL).origin;

function openGameWindow() {
  if (gameWindow && !gameWindow.isDestroyed()) {
    if (gameWindow.isMinimized()) gameWindow.restore();
    gameWindow.focus();
    return { opened: true, url: GAME_URL };
  }
  gameWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: "#0b0908",
    title: "Ashes of Eryon",
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "game-preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      backgroundThrottling: false,
      devTools: !app.isPackaged
    }
  });
  const settings = services.loadSettings();
  gameWindow.once("ready-to-show", () => {
    if (!gameWindow) return;
    if (settings.fullscreen) gameWindow.setFullScreen(true);
    gameWindow.show();
  });
  gameWindow.on("leave-full-screen", () => gameWindow?.setMenuBarVisibility(false));
  gameWindow.on("closed", () => {
    gameWindow = null;
    // aktualizace launcheru stažená během hraní se nainstaluje hned po zavření hry
    if (updater?.ready) {
      updater.apply();
      return;
    }
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.webContents.send("launcher:game-closed");
    }
  });
  // Uvnitř herního okna jen stránky hry a přihlášení přes https; vše ostatní do systémového prohlížeče.
  gameWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https:\/\//i.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  gameWindow.webContents.on("will-navigate", (event, url) => {
    if (!/^https:\/\//i.test(url)) event.preventDefault();
  });
  void gameWindow.loadURL(GAME_URL);
  if (settings.afterPlay === "hide") mainWindow?.hide();
  else if (settings.afterPlay === "minimize") mainWindow?.minimize();
  return { opened: true, url: GAME_URL };
}

function getRendererPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "launcher-ui", "index.html");
  }
  return path.join(__dirname, "..", "prototype", "index.html");
}

function createMainWindow() {
  const { workAreaSize } = require("electron").screen.getPrimaryDisplay();

  // Poměr stran předlohy launcheru (1672 × 941); obsah se škáluje do okna.
  const width = Math.max(1180, Math.min(1672, workAreaSize.width - 80, Math.round((workAreaSize.height - 80) * 1672 / 941)));
  const height = Math.round(width * 941 / 1672);

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1180,
    minHeight: 664,
    show: false,
    frame: false,
    backgroundColor: "#070607",
    title: "Ashes of Eryon",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  });

  mainWindow.loadFile(getRendererPath());

  mainWindow.once("ready-to-show", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.show();
  });

  mainWindow.on("maximize", () => {
    mainWindow?.webContents.send("launcher:window-state", { maximized: true });
  });

  mainWindow.on("unmaximize", () => {
    mainWindow?.webContents.send("launcher:window-state", { maximized: false });
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (current && url !== current) event.preventDefault();
  });
}

// Požadavky z herního okna přijímáme jen od stránky hry (stejný původ jako GAME_URL).
function fromGame(event) {
  if (!gameWindow || gameWindow.isDestroyed() || event.sender !== gameWindow.webContents) return false;
  try {
    return new URL(event.senderFrame?.url || event.sender.getURL()).origin === GAME_ORIGIN;
  } catch {
    return false;
  }
}

function displayState() {
  if (!gameWindow || gameWindow.isDestroyed()) return null;
  const [width, height] = gameWindow.getContentSize();
  const display = screen.getDisplayMatching(gameWindow.getBounds());
  return {
    mode: gameWindow.isFullScreen() ? "fullscreen" : gameWindow.isMaximized() ? "maximized" : "windowed",
    width,
    height,
    screen: { width: display.size.width, height: display.size.height, scale: display.scaleFactor }
  };
}

function registerIpc() {
  ipcMain.handle("game:exit", (event) => {
    if (!fromGame(event)) return false;
    gameWindow.close();
    return true;
  });

  ipcMain.handle("game:display:get", (event) => (fromGame(event) ? displayState() : null));

  ipcMain.handle("game:display:set", (event, options) => {
    if (!fromGame(event)) return null;
    const mode = options?.mode;
    if (mode === "fullscreen") {
      gameWindow.setFullScreen(true);
    } else {
      if (gameWindow.isFullScreen()) gameWindow.setFullScreen(false);
      if (mode === "maximized") {
        gameWindow.maximize();
      } else {
        if (gameWindow.isMaximized()) gameWindow.unmaximize();
        const work = screen.getDisplayMatching(gameWindow.getBounds()).workAreaSize;
        const width = Math.round(Number(options?.width) || 1600);
        const height = Math.round(Number(options?.height) || 900);
        gameWindow.setContentSize(Math.max(1024, Math.min(width, work.width)), Math.max(640, Math.min(height, work.height)));
        gameWindow.center();
      }
    }
    return displayState();
  });

  ipcMain.handle("launcher:window:minimize", () => {
    mainWindow?.minimize();
  });

  ipcMain.handle("launcher:window:toggle-maximize", () => {
    if (!mainWindow) return { maximized: false };
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return { maximized: mainWindow.isMaximized() };
  });

  ipcMain.handle("launcher:window:close", () => {
    mainWindow?.close();
  });

  ipcMain.handle("launcher:game:play", () => openGameWindow());

  ipcMain.handle("launcher:open-account", () => {
    void shell.openExternal(`${GAME_ORIGIN}/auth?next=/hra`);
  });

  ipcMain.handle("launcher:info", () => services.info());
  ipcMain.handle("launcher:settings:get", () => services.loadSettings());
  ipcMain.handle("launcher:settings:set", (_event, next) => {
    const saved = services.saveSettings(next);
    services.syncShortcuts(saved);
    services.applyLoginItem(saved);
    return saved;
  });
  ipcMain.handle("launcher:news", () => services.loadNews());
  ipcMain.handle("launcher:server", () => services.serverStatus());
  ipcMain.handle("launcher:open", (_event, what) => {
    const links = {
      tickets: `${GAME_ORIGIN}/tickets`,
      roadmap: `${GAME_ORIGIN}/ashes`,
      download: `${GAME_ORIGIN}/download`,
      web: GAME_ORIGIN,
    };
    if (what === "folder") return shell.openPath(services.info().installDir);
    if (what === "logs") return shell.openPath(app.getPath("userData"));
    if (links[what]) void shell.openExternal(links[what]);
    return true;
  });
  ipcMain.handle("launcher:clear-cache", async () => {
    // jen mezipaměť souborů hry (přihlášení a uložené nastavení hry zůstanou)
    await session.defaultSession.clearCache();
    return true;
  });
  ipcMain.handle("launcher:update:status", () => updater?.status ?? null);
  ipcMain.handle("launcher:update:check", () => updater?.check() ?? null);
  ipcMain.handle("launcher:update:full", () => {
    void shell.openExternal(`${GAME_ORIGIN}/download`);
  });

  ipcMain.handle("launcher:window:get-state", () => ({
    maximized: Boolean(mainWindow?.isMaximized()),
    referenceWidth: REFERENCE_WIDTH,
    referenceHeight: REFERENCE_HEIGHT
  }));
}

// Jen jedna instance launcheru – druhé spuštění (zástupce, GameSetup
// "Spustit") jen vyvolá existující okno.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    registerIpc();
    createMainWindow();
    updater = createUpdater({
      onStatus: (status) => {
        if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("launcher:update", status);
      },
      canRestart: () => !gameRunning()
    });
    const settings = services.loadSettings();
    if (settings.autoUpdate) updater.start();
    // zástupce na ploše s ikonou hry (opraví i starší zástupce z instalace)
    services.syncShortcuts(settings);
    services.applyLoginItem(settings);
    log(`Start ${app.getVersion()} (Electron ${process.versions.electron})`);

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

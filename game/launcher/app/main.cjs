"use strict";

const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;

let mainWindow = null;
let gameWindow = null;

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
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      devTools: !app.isPackaged
    }
  });
  gameWindow.once("ready-to-show", () => gameWindow?.show());
  gameWindow.on("closed", () => {
    gameWindow = null;
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
  mainWindow?.minimize();
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

function registerIpc() {
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

    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

"use strict";

const path = require("node:path");
const { app, BrowserWindow, ipcMain, shell } = require("electron");

const REFERENCE_WIDTH = 1920;
const REFERENCE_HEIGHT = 1080;

let mainWindow = null;

function getRendererPath() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "launcher-ui", "index.html");
  }
  return path.join(__dirname, "..", "prototype", "index.html");
}

function createMainWindow() {
  const { workAreaSize } = require("electron").screen.getPrimaryDisplay();

  const width = Math.min(1600, Math.max(1180, workAreaSize.width - 80));
  const height = Math.min(900, Math.max(720, workAreaSize.height - 80));

  mainWindow = new BrowserWindow({
    width,
    height,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    frame: false,
    backgroundColor: "#05070a",
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

  ipcMain.handle("launcher:window:get-state", () => ({
    maximized: Boolean(mainWindow?.isMaximized()),
    referenceWidth: REFERENCE_WIDTH,
    referenceHeight: REFERENCE_HEIGHT
  }));
}

app.whenReady().then(() => {
  registerIpc();
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

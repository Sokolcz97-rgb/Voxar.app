// Preload for the main app window – exposes a small API to studiovoxario.com
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studioVoxarioDesktop", {
  isDesktop: true,
  platform: process.platform,
  arch: process.arch,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  getVersion: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
  setBadge: (count) => ipcRenderer.send("set-badge", Number(count) || 0),
  notify: (title, body, url) =>
    ipcRenderer.send("show-notification", { title, body, url }),
  // App-level (Electron) preferences — surfaced in the in-app Settings.
  getAppSettings: () => ipcRenderer.invoke("settings:get"),
  setAppSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  reloadApp: () => ipcRenderer.invoke("app:reload"),
});

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
  checkForUpdates: () => ipcRenderer.invoke("updater:check-now"),
  setBadge: (count) => ipcRenderer.send("set-badge", Number(count) || 0),
  notify: (title, body, url) =>
    ipcRenderer.send("show-notification", { title, body, url }),
});

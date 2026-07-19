// Preload for the main app window – exposes a small API to studiovoxario.com
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studioVoxarioDesktop", {
  isDesktop: true,
  platform: process.platform,
  setBadge: (count) => ipcRenderer.send("set-badge", Number(count) || 0),
  notify: (title, body, url) =>
    ipcRenderer.send("show-notification", { title, body, url }),
});

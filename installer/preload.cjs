const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("installer", {
  defaults: () => ipcRenderer.invoke("installer:defaults"),
  pickDir: (current) => ipcRenderer.invoke("installer:pick-dir", current),
  install: (opts) => ipcRenderer.invoke("installer:install", opts),
  uninstall: (opts) => ipcRenderer.invoke("installer:uninstall", opts),
  launch: (dir) => ipcRenderer.invoke("installer:launch", dir),
  close: () => ipcRenderer.invoke("installer:close"),
  minimize: () => ipcRenderer.invoke("installer:minimize"),
  onLog: (cb) => ipcRenderer.on("installer:log", (_e, l) => cb(l)),
  onProgress: (cb) => ipcRenderer.on("installer:progress", (_e, p) => cb(p)),
});

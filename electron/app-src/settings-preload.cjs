const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("svSettings", {
  get: () => ipcRenderer.invoke("settings:get"),
  set: (patch) => ipcRenderer.invoke("settings:set", patch),
  version: () => ipcRenderer.invoke("app:version"),
  quit: () => ipcRenderer.invoke("app:quit"),
  reload: () => ipcRenderer.invoke("app:reload"),
  checkUpdates: () => ipcRenderer.invoke("app:check-updates"),
});

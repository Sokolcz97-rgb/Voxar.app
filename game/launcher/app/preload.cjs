"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ashesLauncher", {
  isDesktop: true,
  platform: process.platform,
  window: {
    minimize: () => ipcRenderer.invoke("launcher:window:minimize"),
    toggleMaximize: () => ipcRenderer.invoke("launcher:window:toggle-maximize"),
    close: () => ipcRenderer.invoke("launcher:window:close"),
    getState: () => ipcRenderer.invoke("launcher:window:get-state"),
    onState: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("launcher:window-state", listener);
      return () => ipcRenderer.removeListener("launcher:window-state", listener);
    }
  }
});

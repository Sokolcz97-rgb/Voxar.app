"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ashesInstaller", {
  defaults: () => ipcRenderer.invoke("installer:defaults"),
  pickDirectory: (current) => ipcRenderer.invoke("installer:pick-directory", current),
  diskInfo: (target) => ipcRenderer.invoke("installer:disk-info", target),
  install: (options) => ipcRenderer.invoke("installer:install", options),
  uninstall: (options) => ipcRenderer.invoke("installer:uninstall", options),
  launch: (target) => ipcRenderer.invoke("installer:launch", target),
  openFolder: (target) => ipcRenderer.invoke("installer:open-folder", target),
  minimize: () => ipcRenderer.invoke("installer:window:minimize"),
  close: () => ipcRenderer.invoke("installer:window:close"),
  onProgress: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("installer:progress", listener);
    return () => ipcRenderer.removeListener("installer:progress", listener);
  },
  onLog: (callback) => {
    if (typeof callback !== "function") return () => {};
    const listener = (_event, value) => callback(value);
    ipcRenderer.on("installer:log", listener);
    return () => ipcRenderer.removeListener("installer:log", listener);
  }
});

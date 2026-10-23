"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("ashesLauncher", {
  isDesktop: true,
  platform: process.platform,
  game: {
    play: () => ipcRenderer.invoke("launcher:game:play"),
    openAccount: () => ipcRenderer.invoke("launcher:open-account"),
    onClosed: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = () => callback();
      ipcRenderer.on("launcher:game-closed", listener);
      return () => ipcRenderer.removeListener("launcher:game-closed", listener);
    }
  },
  auth: {
    status: () => ipcRenderer.invoke("launcher:auth:status"),
    signIn: () => ipcRenderer.invoke("launcher:auth:sign-in"),
    cancel: () => ipcRenderer.invoke("launcher:auth:cancel"),
    signOut: () => ipcRenderer.invoke("launcher:auth:sign-out"),
    register: () => ipcRenderer.invoke("launcher:auth:register"),
    forgot: () => ipcRenderer.invoke("launcher:auth:forgot"),
    onStatus: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("launcher:auth", listener);
      return () => ipcRenderer.removeListener("launcher:auth", listener);
    }
  },
  unity: {
    status: () => ipcRenderer.invoke("launcher:unity:status"),
    check: () => ipcRenderer.invoke("launcher:unity:check"),
    install: () => ipcRenderer.invoke("launcher:unity:install"),
    onStatus: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("launcher:unity", listener);
      return () => ipcRenderer.removeListener("launcher:unity", listener);
    }
  },
  info: () => ipcRenderer.invoke("launcher:info"),
  settings: {
    get: () => ipcRenderer.invoke("launcher:settings:get"),
    set: (next) => ipcRenderer.invoke("launcher:settings:set", next)
  },
  news: () => ipcRenderer.invoke("launcher:news"),
  server: () => ipcRenderer.invoke("launcher:server"),
  open: (what) => ipcRenderer.invoke("launcher:open", what),
  clearCache: () => ipcRenderer.invoke("launcher:clear-cache"),
  update: {
    status: () => ipcRenderer.invoke("launcher:update:status"),
    check: () => ipcRenderer.invoke("launcher:update:check"),
    openFullInstaller: () => ipcRenderer.invoke("launcher:update:full"),
    onStatus: (callback) => {
      if (typeof callback !== "function") return () => {};
      const listener = (_event, value) => callback(value);
      ipcRenderer.on("launcher:update", listener);
      return () => ipcRenderer.removeListener("launcher:update", listener);
    }
  },
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

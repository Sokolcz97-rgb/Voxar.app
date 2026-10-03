"use strict";

const { contextBridge } = require("electron");

const GiB = 1024 * 1024 * 1024;

contextBridge.exposeInMainWorld("ashesInstaller", {
  defaults: async () => ({
    productName: "Ashes of Eryon",
    version: "0.1.0",
    mode: "install",
    defaultTarget: "C:\\Games\\Ashes of Eryon",
    payloadBytes: 75.1 * 1024 * 1024,
    requiredBytes: 350 * 1024 * 1024,
    freeBytes: 512.4 * GiB,
    totalBytes: 931.5 * GiB
  }),
  pickDirectory: async (current) => current || "C:\\Games\\Ashes of Eryon",
  diskInfo: async () => ({
    freeBytes: 512.4 * GiB,
    totalBytes: 931.5 * GiB
  }),
  install: async () => ({ ok: true, root: "C:\\Games\\Ashes of Eryon" }),
  uninstall: async () => ({ ok: true }),
  launch: async () => ({ ok: true }),
  openFolder: async () => ({ ok: true }),
  minimize: async () => ({ ok: true }),
  close: async () => ({ ok: true }),
  onProgress: () => () => {},
  onLog: () => () => {}
});

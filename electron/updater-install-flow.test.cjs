"use strict";

// Regresní test: po stažení aktualizace se instalace musí spustit i tehdy,
// když UI bridge vrátí null (samostatný VoxarioBrowser bez rozcestníku).
// Dřív tu padalo „Cannot read properties of null (reading 'catch')“.

const assert = require("node:assert/strict");
const os = require("node:os");
const Module = require("node:module");
const { EventEmitter } = require("node:events");

const autoUpdater = new EventEmitter();
let quitAndInstallCalls = 0;
Object.assign(autoUpdater, {
  checkForUpdates: async () => ({ updateInfo: { version: "99.0.0" } }),
  downloadUpdate: async () => {
    // electron-updater vyvolá událost během downloadUpdate().
    autoUpdater.emit("update-downloaded", { version: "99.0.0" });
    return ["update.exe"];
  },
  quitAndInstall: () => { quitAndInstallCalls += 1; },
  setFeedURL: () => {},
});

const electronStub = {
  app: { getVersion: () => "0.0.1", isPackaged: false, getAppPath: () => os.tmpdir(), getPath: () => os.tmpdir(), on() {} },
  BrowserWindow: { getAllWindows: () => [] },
  Notification: class { static isSupported() { return false; } show() {} on() {} },
};

const originalLoad = Module._load;
Module._load = function load(request, ...rest) {
  if (request === "electron") return electronStub;
  if (request === "electron-updater") return { autoUpdater };
  return originalLoad.call(this, request, ...rest);
};

const updater = require("./updater.cjs");
updater.setUiBridge(() => null);

(async () => {
  const result = await updater.installUpdateFromRenderer({ channel: "stable" });
  assert.equal(result.status, "installing", `download must not fail: ${JSON.stringify(result)}`);
  await new Promise((resolve) => setTimeout(resolve, 900));
  assert.equal(quitAndInstallCalls, 1, "quitAndInstall must run even when the UI bridge returns null");

  // Bridge, který sám vyhodí výjimku, instalaci také nesmí zastavit.
  updater.setUiBridge(() => { throw new Error("UI pryč"); });
  autoUpdater.emit("update-downloaded", { version: "99.0.0" });
  console.log("✓ Update install flow survives a missing launcher UI");
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });

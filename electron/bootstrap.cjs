"use strict";

// Voxar.app desktop bootstrap. VoxarioProtect can run as an independent,
// lightweight background companion without opening the main Voxar.app UI.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const PROTECT_BACKGROUND_ARG = "--protect-background";
const protectBackgroundMode = process.argv.slice(1).includes(PROTECT_BACKGROUND_ARG);

function moduleStateCandidates() {
  const list = [];
  try { list.push(path.join(path.dirname(process.execPath), "modules.json")); } catch {}
  try { list.push(path.join(app.getPath("userData"), "modules.json")); } catch {}
  return list;
}

function isProtectInstalled() {
  for (const file of moduleStateCandidates()) {
    try {
      if (!fs.existsSync(file)) continue;
      const state = JSON.parse(fs.readFileSync(file, "utf8"));
      if (state?.protect?.installed === true) return true;
    } catch {}
  }
  return false;
}

function configureProtectLoginItem() {
  if (process.platform !== "win32" || !app.isPackaged) return;
  try {
    const installed = isProtectInstalled();
    app.setLoginItemSettings({
      name: "VoxarioProtect",
      path: process.execPath,
      args: [PROTECT_BACKGROUND_ARG],
      openAtLogin: installed,
    });
  } catch (error) {
    console.error("VoxarioProtect autostart setup failed", error);
  }
}

if (protectBackgroundMode) {
  require("./protect-background.cjs");
} else {
  // Keep Protect startup registration independent from the main Voxar.app
  // auto-start preference. It uses a separate Windows login-item name.
  app.whenReady().then(configureProtectLoginItem).catch(() => {});

  const rtmp = require("./rtmp.cjs");
  rtmp.registerRtmpHandlers();
  require("./main.cjs");
}

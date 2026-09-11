"use strict";

const fs = require("fs");
const path = require("path");

const DEFAULT_PROTECT_PREFERENCES = Object.freeze({
  profile: "balanced",
  closeAction: "tray",
  minimizeToTray: true,
  startWithWindows: true,
  notifications: true,
  monitorDownloads: true,
});

const PROFILES = Object.freeze({
  eco: Object.freeze({ id: "eco", label: "Úsporný", defenderRefreshMs: 15 * 60 * 1000, maxAutoHashBytes: 32 * 1024 * 1024 }),
  balanced: Object.freeze({ id: "balanced", label: "Vyvážený", defenderRefreshMs: 5 * 60 * 1000, maxAutoHashBytes: 128 * 1024 * 1024 }),
  maximum: Object.freeze({ id: "maximum", label: "Maximální", defenderRefreshMs: 60 * 1000, maxAutoHashBytes: 512 * 1024 * 1024 }),
});

function preferencesPath(app) {
  return path.join(app.getPath("userData"), "voxario-protect-settings.json");
}

function normalize(input = {}) {
  const profile = Object.prototype.hasOwnProperty.call(PROFILES, input.profile) ? input.profile : DEFAULT_PROTECT_PREFERENCES.profile;
  const closeAction = input.closeAction === "close" ? "close" : "tray";
  return {
    profile,
    closeAction,
    minimizeToTray: input.minimizeToTray !== false,
    startWithWindows: input.startWithWindows !== false,
    notifications: input.notifications !== false,
    monitorDownloads: input.monitorDownloads !== false,
  };
}

function loadProtectPreferences(app) {
  try {
    const parsed = JSON.parse(fs.readFileSync(preferencesPath(app), "utf8"));
    return normalize({ ...DEFAULT_PROTECT_PREFERENCES, ...parsed });
  } catch {
    return { ...DEFAULT_PROTECT_PREFERENCES };
  }
}

function saveProtectPreferences(app, patch = {}) {
  const current = loadProtectPreferences(app);
  const next = normalize({ ...current, ...patch });
  const target = preferencesPath(app);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function profileConfig(preferences) {
  return PROFILES[normalize(preferences).profile] || PROFILES.balanced;
}

module.exports = {
  DEFAULT_PROTECT_PREFERENCES,
  PROFILES,
  preferencesPath,
  loadProtectPreferences,
  saveProtectPreferences,
  profileConfig,
};

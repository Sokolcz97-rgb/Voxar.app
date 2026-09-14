"use strict";

// browser-settings.cjs still contains the original password-manager IPC for
// backwards compatibility with old builds. It could reveal a legacy DPAPI
// record without Windows verification and could even fall back to plaintext if
// OS encryption was unavailable. New builds must fail closed instead.
function installLegacyPasswordLockdown() {
  const { app, ipcMain } = require("electron");
  app.whenReady().then(() => {
    setImmediate(() => {
      const legacyChannels = [
        "vb:passwords:list",
        "vb:passwords:save",
        "vb:passwords:reveal",
        "vb:passwords:delete",
        "vb:passwords:update",
      ];
      for (const channel of legacyChannels) {
        try { ipcMain.removeHandler(channel); } catch {}
      }
      ipcMain.handle("vb:passwords:list", () => []);
      ipcMain.handle("vb:passwords:save", () => ({ ok: false, error: "Starý správce hesel je bezpečnostně vypnutý. Otevři Hesla → Voxario Secure Vault." }));
      ipcMain.handle("vb:passwords:reveal", () => ({ ok: false, error: "Zobrazení hesla vyžaduje Voxario Secure Vault a ověření Windows." }));
      ipcMain.handle("vb:passwords:delete", () => ({ ok: false, error: "Použij Voxario Secure Vault." }));
      ipcMain.handle("vb:passwords:update", () => ({ ok: false, error: "Použij Voxario Secure Vault." }));
    });
  }).catch(() => {});
}

module.exports = { installLegacyPasswordLockdown };

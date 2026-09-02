// Preload for the main app window – exposes a small API to studiovoxario.com
const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("studioVoxarioDesktop", {
  isDesktop: true,
  platform: process.platform,
  // Návrat na rozcestník modulů (Voxar.app / VoxarioBrowser)
  returnToLauncher: () => ipcRenderer.invoke("app:return-to-launcher"),
  // Screen sharing: vlastní HUD picker v aplikaci.
  getCaptureSources: () => ipcRenderer.invoke("capture:sources"),
  selectCaptureSource: (id) => ipcRenderer.invoke("capture:select", id),

  arch: process.arch,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  getVersion: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
  // „Tichá" kontrola pro FAB v aplikaci — vrací { available, current, remote, notes }.
  checkUpdatesQuiet: () => ipcRenderer.invoke("app:check-updates-quiet"),
  // Spuštění instalace přímo z rendereru (kliknutí na ikonku).
  installUpdateNow: () => ipcRenderer.invoke("app:install-update-now"),
  // Odběr live oznámení o dostupné aktualizaci (broadcast z main procesu).
  onUpdateAvailability: (cb) => {
    const listener = (_e, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("update:availability", listener);
    return () => ipcRenderer.removeListener("update:availability", listener);
  },
  setBadge: (count) => ipcRenderer.send("set-badge", Number(count) || 0),
  notify: (title, body, url) =>
    ipcRenderer.send("show-notification", { title, body, url }),
  // App-level (Electron) preferences — surfaced in the in-app Settings.
  getAppSettings: () => ipcRenderer.invoke("settings:get"),
  setAppSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  // Beta unlock: renderer ověří kód přes Supabase RPC a předá výsledek main procesu.
  unlockBeta: (ok) => ipcRenderer.invoke("settings:unlock-beta", ok === true),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  reloadApp: () => ipcRenderer.invoke("app:reload"),
  hardReloadApp: () => ipcRenderer.invoke("app:hard-reload"),
  relaunchApp: () => ipcRenderer.invoke("app:relaunch"),
  openDevTools: () => ipcRenderer.invoke("app:open-devtools"),
  getDiagnostics: () => ipcRenderer.invoke("app:diagnostics"),
  rollbackApp: () => ipcRenderer.invoke("app:rollback"),
});

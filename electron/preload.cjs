// Preload for the main app window â€“ exposes a small API to studiovoxario.com
const { contextBridge, ipcRenderer } = require("electron");
const { version: protectVersion } = require("./protect-version.cjs");

contextBridge.exposeInMainWorld("studioVoxarioDesktop", {
  isDesktop: true,
  platform: process.platform,
  protectVersion,
  // NĂˇvrat na rozcestnĂ­k modulĹŻ (Voxar.app / VoxarioBrowser)
  returnToLauncher: () => ipcRenderer.invoke("app:return-to-launcher"),
  // PĹ™Ă­mĂ© pĹ™epnutĂ­ modulu (Voxar.app <-> VoxarioBrowser) bez nĂˇvratu do launcheru.
  openModule: (mod) => ipcRenderer.invoke("app:open-module", mod),

  // VoxarioProtect bridge to Microsoft Defender and Windows Defender Firewall.
  // Defender remains authoritative. Firewall writes are limited to explicit,
  // user-confirmed per-program outbound BLOCK rules owned by VoxarioProtect.
  protectGetStatus: () => ipcRenderer.invoke("protect:status"),
  protectGetIntegrity: () => ipcRenderer.invoke("protect:integrity"),
  protectGetActivity: () => ipcRenderer.invoke("protect:activity"),
  protectChooseFile: () => ipcRenderer.invoke("protect:choose-file"),
  protectScanActivity: (id) => ipcRenderer.invoke("protect:scan-activity", id),
  onProtectActivity: (cb) => {
    const listener = (_e, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("protect:activity", listener);
    return () => ipcRenderer.removeListener("protect:activity", listener);
  },
  protectQuickScan: () => ipcRenderer.invoke("protect:quick-scan"),
  protectOpenWindowsSecurity: () => ipcRenderer.invoke("protect:open-windows-security"),
  protectGetSystemSafety: () => ipcRenderer.invoke("protect:system-safety"),
  protectGetRuntimeHealth: () => ipcRenderer.invoke("protect:runtime-health"),
  protectOpenWindowsUpdate: () => ipcRenderer.invoke("protect:open-windows-update"),
  protectReturnToLauncher: () => ipcRenderer.invoke("protect:return-to-launcher"),

  // VoxarioProtect Firewall category. Renderer never sends an arbitrary path to
  // a privileged operation: selection is performed in main and exchanged for a
  // short-lived token before a user-confirmed UAC-protected BLOCK operation.
  protectFirewallGetStatus: () => ipcRenderer.invoke("protect:firewall-status"),
  protectFirewallSelectProgram: () => ipcRenderer.invoke("protect:firewall-select-program"),
  protectFirewallBlockSelected: (token) => ipcRenderer.invoke("protect:firewall-block-selected", token),
  protectFirewallRemoveRule: (ruleName) => ipcRenderer.invoke("protect:firewall-remove-rule", ruleName),
  protectFirewallOpenWindows: () => ipcRenderer.invoke("protect:firewall-open-windows"),

  // Screen sharing: vlastnĂ­ HUD picker v aplikaci.
  getCaptureSources: () => ipcRenderer.invoke("capture:sources"),
  selectCaptureSource: (id) => ipcRenderer.invoke("capture:select", id),

  // Native RTMP publisher. Renderer captures the selected screen/window with
  // MediaRecorder and streams WebM chunks to bundled FFmpeg in the main process.
  broadcastAvailable: () => ipcRenderer.invoke("broadcast:available"),
  broadcastStart: (config) => ipcRenderer.invoke("broadcast:start", config),
  broadcastWriteChunk: (chunk) => ipcRenderer.send("broadcast:chunk", chunk),
  broadcastStop: () => ipcRenderer.invoke("broadcast:stop"),
  broadcastStatus: () => ipcRenderer.invoke("broadcast:status"),
  onBroadcastState: (cb) => {
    const listener = (_e, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("broadcast:state", listener);
    return () => ipcRenderer.removeListener("broadcast:state", listener);
  },
  onBroadcastLog: (cb) => {
    const listener = (_e, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("broadcast:log", listener);
    return () => ipcRenderer.removeListener("broadcast:log", listener);
  },

  arch: process.arch,
  electronVersion: process.versions.electron,
  chromeVersion: process.versions.chrome,
  nodeVersion: process.versions.node,
  getVersion: () => ipcRenderer.invoke("app:version"),
  checkForUpdates: () => ipcRenderer.invoke("app:check-updates"),
  // â€žTichĂˇ" kontrola pro FAB v aplikaci â€” vracĂ­ { available, current, remote, notes }.
  checkUpdatesQuiet: () => ipcRenderer.invoke("app:check-updates-quiet"),
  // SpuĹˇtÄ›nĂ­ instalace pĹ™Ă­mo z rendereru (kliknutĂ­ na ikonku).
  installUpdateNow: () => ipcRenderer.invoke("app:install-update-now"),
  // Historie nainstalovanĂ˝ch verzĂ­ (kdy byla kterĂˇ verze poprvĂ© spuĹˇtÄ›na).
  getVersionHistory: () => ipcRenderer.invoke("app:version-history"),

  // OdbÄ›r live oznĂˇmenĂ­ o dostupnĂ© aktualizaci (broadcast z main procesu).
  onUpdateAvailability: (cb) => {
    const listener = (_e, payload) => { try { cb(payload); } catch {} };
    ipcRenderer.on("update:availability", listener);
    return () => ipcRenderer.removeListener("update:availability", listener);
  },
  setBadge: (count) => ipcRenderer.send("set-badge", Number(count) || 0),
  notify: (title, body, url) =>
    ipcRenderer.send("show-notification", { title, body, url }),
  // App-level (Electron) preferences â€” surfaced in the in-app Settings.
  getAppSettings: () => ipcRenderer.invoke("settings:get"),
  setAppSettings: (patch) => ipcRenderer.invoke("settings:set", patch),
  // Beta unlock: renderer ovÄ›Ĺ™Ă­ kĂłd pĹ™es Supabase RPC a pĹ™edĂˇ vĂ˝sledek main procesu.
  unlockBeta: (ok) => ipcRenderer.invoke("settings:unlock-beta", ok === true),
  quitApp: () => ipcRenderer.invoke("app:quit"),
  reloadApp: () => ipcRenderer.invoke("app:reload"),
  hardReloadApp: () => ipcRenderer.invoke("app:hard-reload"),
  relaunchApp: () => ipcRenderer.invoke("app:relaunch"),
  openDevTools: () => ipcRenderer.invoke("app:open-devtools"),
  getDiagnostics: () => ipcRenderer.invoke("app:diagnostics"),
  rollbackApp: () => ipcRenderer.invoke("app:rollback"),
});


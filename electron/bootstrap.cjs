"use strict";

// Voxar.app desktop bootstrap. VoxarioProtect can run as an independent,
// lightweight background companion without opening the main Voxar.app UI.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");
const {
  PROFILES,
  loadProtectPreferences,
  saveProtectPreferences,
} = require("./protect-preferences.cjs");

const PROTECT_BACKGROUND_ARG = "--protect-background";
const protectBackgroundMode = process.argv.slice(1).includes(PROTECT_BACKGROUND_ARG);
let appIsQuitting = false;

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
    const prefs = loadProtectPreferences(app);
    app.setLoginItemSettings({
      name: "VoxarioProtect",
      path: process.execPath,
      args: [PROTECT_BACKGROUND_ARG],
      openAtLogin: installed && prefs.startWithWindows,
    });
  } catch (error) {
    console.error("VoxarioProtect autostart setup failed", error);
  }
}

function publicProtectPreferences() {
  const preferences = loadProtectPreferences(app);
  return {
    ...preferences,
    profiles: Object.values(PROFILES).map(({ id, label, defenderRefreshMs, maxAutoHashBytes }) => ({
      id,
      label,
      defenderRefreshMinutes: Math.round(defenderRefreshMs / 60000),
      maxAutoHashMb: Math.round(maxAutoHashBytes / 1024 / 1024),
    })),
  };
}

function protectSettingsInjection(prefs) {
  document.getElementById("voxarioProtectSettingsV23")?.remove();
  document.getElementById("voxarioProtectSettingsV23Style")?.remove();
  const layout = document.querySelector(".layout");
  if (!layout) return;

  const section = document.createElement("section");
  section.id = "voxarioProtectSettingsV23";
  section.className = "panel wide";
  section.innerHTML = `
    <div class="panel-title"><span>NASTAVENÍ VOXARIOPROTECT v2.3</span><span class="muted">LOKÁLNÍ PREFERENCE</span></div>
    <div class="vp23-grid">
      <div class="vp23-card vp23-profile-card">
        <small>INTENZITA OCHRANY</small>
        <strong id="vp23ProfileLabel">Vyvážený</strong>
        <div class="vp23-profiles" id="vp23Profiles"></div>
        <p id="vp23ProfileHint">Nastavuje frekvenci kontroly stavu Defenderu a rozsah lokálního SHA-256 vyhodnocení. Microsoft Defender zůstává hlavním antivirem.</p>
      </div>
      <label class="vp23-toggle"><span><b>Minimalizovat do tray</b><small>Minimalizace schová Protect k hodinám.</small></span><input id="vp23Minimize" type="checkbox"></label>
      <label class="vp23-toggle"><span><b>Křížek schová do tray</b><small>Když je vypnuto, křížek zavře pouze okno Protectu.</small></span><input id="vp23CloseTray" type="checkbox"></label>
      <label class="vp23-toggle"><span><b>Spouštět s Windows</b><small>Samostatný Protect se spustí bez otevření Voxar.app.</small></span><input id="vp23Startup" type="checkbox"></label>
      <label class="vp23-toggle"><span><b>Oznámení ochrany</b><small>Upozornění pouze na důležité změny stavu ochrany.</small></span><input id="vp23Notifications" type="checkbox"></label>
      <label class="vp23-toggle"><span><b>Hlídání Stažených souborů</b><small>Lokálně sleduje rizikové soubory v Downloads.</small></span><input id="vp23Downloads" type="checkbox"></label>
    </div>
    <p class="notice" id="vp23Saved">Nastavení se ukládá lokálně do profilu Windows.</p>`;

  const style = document.createElement("style");
  style.id = "voxarioProtectSettingsV23Style";
  style.textContent = `
    .vp23-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:14px}
    .vp23-card,.vp23-toggle{border:1px solid rgba(71,167,161,.2);background:rgba(1,16,27,.5);padding:13px}
    .vp23-profile-card{grid-column:1/-1}.vp23-card small,.vp23-toggle small{display:block;color:#78979b;font-size:9px;margin-top:3px}
    .vp23-card strong{display:block;margin-top:5px;font-size:14px}.vp23-card p{color:#86a8aa;font-size:10px;line-height:1.5;margin:9px 0 0}
    .vp23-profiles{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.vp23-profile{border:1px solid rgba(86,185,177,.38);background:rgba(5,48,59,.78);color:#bde8df;padding:8px 11px;font-size:10px}
    .vp23-profile.active{border-color:#62efad;color:#06271c;background:linear-gradient(135deg,#62efad,#3cc59a);font-weight:800}
    .vp23-toggle{display:flex;align-items:center;justify-content:space-between;gap:18px;cursor:pointer}.vp23-toggle b{font-size:11px;color:#d5f5ef}
    .vp23-toggle input{appearance:none;width:42px;height:23px;border-radius:20px;background:#173440;border:1px solid rgba(91,180,170,.35);position:relative;flex:0 0 auto;transition:.2s}
    .vp23-toggle input:after{content:"";position:absolute;width:17px;height:17px;border-radius:50%;left:2px;top:2px;background:#78979b;transition:.2s}.vp23-toggle input:checked{background:#1b765c;border-color:#62efad}.vp23-toggle input:checked:after{left:21px;background:#86ffd0}
    @media(max-width:700px){.vp23-grid{grid-template-columns:1fr}.vp23-profile-card{grid-column:1}}
  `;
  document.head.appendChild(style);
  const footer = layout.querySelector(".foot");
  layout.insertBefore(section, footer || null);

  const profileHints = {
    eco: "Úsporný: stav Defenderu přibližně po 15 min, automatický SHA-256 do 32 MB. Nejnižší režie.",
    balanced: "Vyvážený: stav Defenderu přibližně po 5 min, automatický SHA-256 do 128 MB. Doporučený režim.",
    maximum: "Maximální: stav Defenderu přibližně každou minutu, automatický SHA-256 do 512 MB. Vyšší aktivita na disku/CPU."
  };
  let saveTimer = null;

  const flashSaved = (text = "Nastavení uloženo.") => {
    const n = document.getElementById("vp23Saved");
    if (!n) return;
    n.textContent = text;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => { n.textContent = "Nastavení se ukládá lokálně do profilu Windows."; }, 2200);
  };

  function setPatch(patch) {
    try {
      console.log("__VOXARIO_PROTECT_PREF__" + JSON.stringify(patch));
      flashSaved();
    } catch {
      flashSaved("Nastavení se nepodařilo uložit.");
    }
  }

  function render(prefs) {
    const profiles = document.getElementById("vp23Profiles");
    profiles.innerHTML = "";
    (prefs.profiles || []).forEach((profile) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "vp23-profile" + (prefs.profile === profile.id ? " active" : "");
      b.textContent = profile.label;
      b.title = "Kontrola stavu: " + profile.defenderRefreshMinutes + " min · SHA-256 do " + profile.maxAutoHashMb + " MB";
      b.onclick = () => setPatch({ profile: profile.id });
      profiles.appendChild(b);
    });
    const active = (prefs.profiles || []).find((p) => p.id === prefs.profile);
    document.getElementById("vp23ProfileLabel").textContent = active?.label || prefs.profile;
    document.getElementById("vp23ProfileHint").textContent = profileHints[prefs.profile] || profileHints.balanced;
    document.getElementById("vp23Minimize").checked = prefs.minimizeToTray !== false;
    document.getElementById("vp23CloseTray").checked = prefs.closeAction !== "close";
    document.getElementById("vp23Startup").checked = prefs.startWithWindows !== false;
    document.getElementById("vp23Notifications").checked = prefs.notifications !== false;
    document.getElementById("vp23Downloads").checked = prefs.monitorDownloads !== false;
  }

  document.getElementById("vp23Minimize").onchange = (e) => setPatch({ minimizeToTray: e.target.checked });
  document.getElementById("vp23CloseTray").onchange = (e) => setPatch({ closeAction: e.target.checked ? "tray" : "close" });
  document.getElementById("vp23Startup").onchange = (e) => setPatch({ startWithWindows: e.target.checked });
  document.getElementById("vp23Notifications").onchange = (e) => setPatch({ notifications: e.target.checked });
  document.getElementById("vp23Downloads").onchange = (e) => setPatch({ monitorDownloads: e.target.checked });

  render(prefs);
}

function injectProtectSettings(win) {
  if (!win || win.isDestroyed()) return;
  const prefs = publicProtectPreferences();
  win.webContents.executeJavaScript(`(${protectSettingsInjection.toString()})(${JSON.stringify(prefs)})`, true).catch(() => {});
}

function bindProtectWindowLifecycle(win) {
  if (!win || win.isDestroyed() || win.__voxarioProtectLifecycleBound) return;
  win.__voxarioProtectLifecycleBound = true;

  win.webContents.on("console-message", (_event, _level, message) => {
    const marker = "__VOXARIO_PROTECT_PREF__";
    if (typeof message !== "string" || !message.startsWith(marker)) return;
    try {
      const patch = JSON.parse(message.slice(marker.length));
      saveProtectPreferences(app, patch && typeof patch === "object" ? patch : {});
      configureProtectLoginItem();
      injectProtectSettings(win);
    } catch {}
  });

  win.on("close", (event) => {
    if (appIsQuitting) return;
    const prefs = loadProtectPreferences(app);
    if (prefs.closeAction === "tray") {
      event.preventDefault();
      win.hide();
    }
  });

  win.on("minimize", (event) => {
    const prefs = loadProtectPreferences(app);
    if (prefs.minimizeToTray) {
      event.preventDefault();
      win.hide();
    }
  });

  win.webContents.on("did-finish-load", () => injectProtectSettings(win));
}

function watchForProtectWindows() {
  app.on("browser-window-created", (_event, win) => {
    const detect = () => {
      try {
        const url = win.webContents.getURL();
        const title = win.getTitle();
        if (url.endsWith("/protect.html") || url.includes("protect.html") || title === "VoxarioProtect") {
          bindProtectWindowLifecycle(win);
          injectProtectSettings(win);
        }
      } catch {}
    };
    win.webContents.on("did-finish-load", detect);
    win.on("ready-to-show", detect);
  });
}

if (protectBackgroundMode) {
  require("./protect-background.cjs");
} else {
  watchForProtectWindows();
  app.on("before-quit", () => { appIsQuitting = true; });

  // Keep Protect startup registration independent from the main Voxar.app
  // auto-start preference. It uses a separate Windows login-item name.
  app.whenReady().then(configureProtectLoginItem).catch(() => {});

  const rtmp = require("./rtmp.cjs");
  rtmp.registerRtmpHandlers();
  require("./main.cjs");
}

"use strict";

const PARTITION = "persist:voxario";
const networkByContents = new Map();
const sampleByContents = new Map();
const gpuCache = new Map();
let installed = false;
let webRequestInstalled = false;

function finite(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(finite(value) * 10) / 10));
}

function headerValue(headers, wanted) {
  const key = Object.keys(headers || {}).find((name) => name.toLowerCase() === String(wanted).toLowerCase());
  if (!key) return "";
  const value = headers[key];
  if (Array.isArray(value)) return value[0] || "";
  return String(value || "");
}

function responseBytes(details) {
  const raw = headerValue(details?.responseHeaders, "content-length");
  const n = Number.parseInt(String(raw || "").replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function resetNetwork(id) {
  const key = Number(id);
  if (!Number.isFinite(key) || key <= 0) return;
  networkByContents.set(key, { receivedBytes: 0, responses: 0, startedAt: Date.now() });
  sampleByContents.delete(key);
}

function addNetwork(details) {
  const id = Number(details?.webContentsId);
  if (!Number.isFinite(id) || id <= 0) return;
  const row = networkByContents.get(id) || { receivedBytes: 0, responses: 0, startedAt: Date.now() };
  row.receivedBytes += responseBytes(details);
  row.responses += 1;
  networkByContents.set(id, row);
}

function networkSnapshot(id) {
  const key = Number(id);
  const row = networkByContents.get(key) || { receivedBytes: 0, responses: 0, startedAt: Date.now() };
  const now = Date.now();
  const previous = sampleByContents.get(key);
  const deltaBytes = previous ? Math.max(0, row.receivedBytes - previous.bytes) : 0;
  const deltaMs = previous ? Math.max(1, now - previous.at) : 0;
  sampleByContents.set(key, { bytes: row.receivedBytes, at: now });
  return {
    receivedBytes: row.receivedBytes,
    receivedBytesPerSec: deltaMs ? Math.round((deltaBytes * 1000) / deltaMs) : 0,
    responses: row.responses,
    since: row.startedAt,
    approximate: true,
  };
}

function gpuPercentForPid(pid) {
  const targetPid = Math.max(0, Math.trunc(finite(pid)));
  if (!targetPid || process.platform !== "win32") return Promise.resolve(null);
  const cached = gpuCache.get(targetPid);
  if (cached && Date.now() - cached.at < 6000) return Promise.resolve(cached.value);
  if (cached?.pending) return cached.pending;

  const { spawn } = require("child_process");
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$pidTarget=${targetPid}`,
    "$sum=(Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine | Where-Object { $_.Name -like ('pid_'+$pidTarget+'_luid_*') } | Measure-Object -Property UtilizationPercentage -Sum).Sum",
    "if($null -eq $sum){$sum=0}",
    "[Math]::Round([double]$sum,1)",
  ].join("; ");

  const pending = new Promise((resolve) => {
    let output = "";
    let settled = false;
    let child;
    const done = (value) => {
      if (settled) return;
      settled = true;
      const clean = value == null ? null : clampPercent(value);
      gpuCache.set(targetPid, { at: Date.now(), value: clean, pending: null });
      resolve(clean);
    };
    try {
      child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "ignore"],
      });
    } catch {
      done(null);
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      done(null);
    }, 2800);
    timer.unref?.();
    child.stdout?.on("data", (chunk) => { output += String(chunk); });
    child.once("error", () => { clearTimeout(timer); done(null); });
    child.once("close", () => {
      clearTimeout(timer);
      const parsed = Number.parseFloat(output.trim());
      done(Number.isFinite(parsed) ? parsed : null);
    });
  });
  gpuCache.set(targetPid, { at: cached?.at || 0, value: cached?.value ?? null, pending });
  return pending;
}

async function statsForWebContents(app, webContents, id) {
  const target = webContents.fromId(Number(id));
  if (!target || target.isDestroyed?.()) return { ok: false, error: "Aktivní web už neběží." };
  let type = "unknown";
  try { type = target.getType?.() || type; } catch {}
  if (type !== "webview" && type !== "window") return { ok: false, error: "Neplatný webový proces." };

  let pid = 0;
  try { pid = target.getOSProcessId?.() || target.getProcessId?.() || 0; } catch {}
  let metrics = [];
  try { metrics = app.getAppMetrics(); } catch {}
  const metric = metrics.find((item) => Number(item?.pid) === Number(pid));
  const cpuPercent = Math.max(0, Math.round(finite(metric?.cpu?.percentCPUUsage) * 10) / 10);
  const ramMB = Math.max(0, Math.round((finite(metric?.memory?.workingSetSize) / 1024) * 10) / 10);
  const gpuPercent = await gpuPercentForPid(pid);
  const network = networkSnapshot(Number(id));

  let url = "";
  try { url = target.getURL() || ""; } catch {}
  return {
    ok: true,
    webContentsId: Number(id),
    pid,
    url,
    cpuPercent,
    ramMB,
    gpuPercent,
    gpuApproximate: true,
    network,
    sampledAt: Date.now(),
  };
}

function browserHudRenderer() {
  if (window.__voxarioResourceHudV1) return;
  window.__voxarioResourceHudV1 = true;
  const { ipcRenderer } = require("electron");

  const style = document.createElement("style");
  style.id = "voxario-resource-hud-style";
  style.textContent = `
    /* VOXARIO_BROWSER_COMPACT_UI_V1: chrome only; web page zoom is untouched. */
    .dock{width:54px!important;flex-basis:54px!important;padding:8px 0!important;gap:6px!important}
    .dock .brand{width:31px!important;height:31px!important;font-size:14px!important;margin-bottom:6px!important}
    .dockbtn{width:35px!important;height:35px!important;font-size:15px!important}
    .tabbar{gap:3px!important;padding:5px 7px 0!important}
    .tab{min-width:124px!important;max-width:208px!important;gap:7px!important;padding:6px 9px!important;font-size:11px!important}
    .newtab{padding:0 10px!important;font-size:15px!important}
    .wctl button{width:34px!important;height:26px!important;font-size:12px!important}
    .navbar{gap:5px!important;padding:6px 7px!important}
    .navbtn{width:30px!important;height:30px!important;font-size:13px!important}
    .urlwrap{gap:7px!important;padding:5px 12px!important}
    #url{font-size:12px!important}
    .bmbar{padding:3px 7px!important}.bmbar .chip{font-size:10px!important;padding:3px 8px!important}
    .panel{padding:16px 20px!important}.card{padding:12px!important;margin-bottom:10px!important}
    .setnav{width:180px!important;flex-basis:180px!important}.setnav button{font-size:10px!important;padding:8px 10px!important}
    .pbtn{font-size:10px!important;padding:6px 11px!important}.opt{padding:7px 0!important}
    #vbResourceHud{display:flex;align-items:center;gap:4px;flex:0 0 auto;white-space:nowrap;margin-left:1px;cursor:pointer}
    #vbResourceHud .vb-r{min-width:51px;height:24px;display:flex;align-items:center;justify-content:center;gap:4px;padding:0 6px;border:1px solid rgba(34,211,238,.18);background:rgba(6,11,20,.82);color:#7f9aa9;font-size:9px;border-radius:5px}
    #vbResourceHud .vb-r b{color:#c7e9ed;font-size:9.5px;font-weight:700}.vb-r.gpu b{color:#f4cf65}.vb-r.net b{color:#70e5bd}
    #vbResourceHud.busy{opacity:.7}
    .vbPerfGrid{display:grid;grid-template-columns:repeat(4,minmax(115px,1fr));gap:8px;width:100%}
    .vbPerfCard{padding:10px;border:1px solid rgba(34,211,238,.2);background:rgba(6,11,20,.62)}
    .vbPerfCard small{display:block;color:#718a99;font-size:9px;letter-spacing:.08em}.vbPerfCard strong{display:block;color:#d9f6f5;font-size:16px;margin-top:4px}.vbPerfCard span{display:block;color:#718a99;font-size:9px;margin-top:4px}
    @media(max-width:1180px){#vbResourceHud .vb-r{min-width:45px;padding:0 4px}#vbResourceHud .vb-r span{display:none}.vbPerfGrid{grid-template-columns:1fr 1fr}}
    @media(max-width:920px){#vbResourceHud{display:none}}
  `;
  document.head.appendChild(style);

  const navbar = document.querySelector(".navbar");
  const anchor = document.getElementById("btnStar");
  if (!navbar || !anchor) return;
  const hud = document.createElement("div");
  hud.id = "vbResourceHud";
  hud.title = "Živé využití aktivního webu. Kliknutím otevřeš Výkon & síť.";
  hud.innerHTML = `
    <div class="vb-r cpu"><span>CPU</span><b id="vbHudCpu">—</b></div>
    <div class="vb-r ram"><span>RAM</span><b id="vbHudRam">—</b></div>
    <div class="vb-r gpu"><span>GPU</span><b id="vbHudGpu">—</b></div>
    <div class="vb-r net"><span>SÍŤ</span><b id="vbHudNet">—</b></div>`;
  navbar.insertBefore(hud, anchor);

  const text = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  const formatBytes = (bytes) => {
    const n = Math.max(0, Number(bytes) || 0);
    if (n < 1024) return `${Math.round(n)} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
    return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
  };

  function activeWebview() {
    return Array.from(document.querySelectorAll("webview")).find((wv) => {
      try {
        const visible = wv.style.display !== "none" && getComputedStyle(wv).display !== "none";
        const url = wv.getURL?.() || wv.src || "";
        return visible && url && url !== "about:blank";
      } catch { return false; }
    }) || null;
  }

  function renderSettings(stats) {
    const meters = document.getElementById("perfMeters");
    if (!meters) return;
    const total = stats?.network?.receivedBytes || 0;
    const rate = stats?.network?.receivedBytesPerSec || 0;
    meters.innerHTML = `<div class="vbPerfGrid">
      <div class="vbPerfCard"><small>CPU · AKTIVNÍ WEB</small><strong>${stats.cpuPercent.toFixed(1)} %</strong><span>renderer PID ${stats.pid || "—"}</span></div>
      <div class="vbPerfCard"><small>RAM · AKTIVNÍ WEB</small><strong>${stats.ramMB.toFixed(1)} MB</strong><span>working set rendereru</span></div>
      <div class="vbPerfCard"><small>GPU · AKTIVNÍ WEB</small><strong>${stats.gpuPercent == null ? "—" : stats.gpuPercent.toFixed(1) + " %"}</strong><span>Windows odhad rendereru</span></div>
      <div class="vbPerfCard"><small>SÍŤ · AKTIVNÍ WEB</small><strong>${formatBytes(rate)}/s</strong><span>≈ ${formatBytes(total)} od načtení</span></div>
    </div>`;
  }

  hud.onclick = () => {
    try { document.getElementById("btnMenu")?.click(); } catch {}
    setTimeout(() => document.querySelector('.setnav [data-sec="perf"]')?.click(), 40);
  };

  let running = false;
  async function refresh() {
    if (running || document.hidden) return;
    const wv = activeWebview();
    if (!wv) {
      text("vbHudCpu", "—"); text("vbHudRam", "—"); text("vbHudGpu", "—"); text("vbHudNet", "—");
      return;
    }
    let id = 0;
    try { id = Number(wv.getWebContentsId?.()) || 0; } catch {}
    if (!id) return;
    running = true;
    hud.classList.add("busy");
    try {
      const stats = await ipcRenderer.invoke("vb:tab-resource-stats", id);
      if (!stats?.ok) return;
      text("vbHudCpu", `${stats.cpuPercent.toFixed(1)}%`);
      text("vbHudRam", `${stats.ramMB < 100 ? stats.ramMB.toFixed(1) : Math.round(stats.ramMB)}M`);
      text("vbHudGpu", stats.gpuPercent == null ? "—" : `${stats.gpuPercent.toFixed(1)}%`);
      text("vbHudNet", `${formatBytes(stats.network?.receivedBytesPerSec || 0)}/s`);
      hud.title = `Aktivní web\nCPU ${stats.cpuPercent.toFixed(1)} %\nRAM ${stats.ramMB.toFixed(1)} MB\nGPU ${stats.gpuPercent == null ? "nedostupné" : stats.gpuPercent.toFixed(1) + " % (odhad)"}\nSíť ≈ ${formatBytes(stats.network?.receivedBytes || 0)} od načtení`;
      renderSettings(stats);
    } catch {} finally {
      running = false;
      hud.classList.remove("busy");
    }
  }

  const timer = setInterval(refresh, 1800);
  timer.unref?.();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });
  window.addEventListener("beforeunload", () => clearInterval(timer), { once: true });
  refresh();
}

function installBrowserResourceMonitor() {
  if (installed) return;
  installed = true;
  const { app, ipcMain, session, webContents } = require("electron");

  ipcMain.handle("vb:tab-resource-stats", (_event, id) => statsForWebContents(app, webContents, id));

  app.on("web-contents-created", (_event, contents) => {
    let type = "";
    try { type = contents.getType?.() || ""; } catch {}
    if (type !== "webview") return;
    const id = contents.id;
    resetNetwork(id);
    contents.on("did-start-navigation", (_e, _url, _inPlace, isMainFrame) => {
      if (isMainFrame) resetNetwork(id);
    });
    contents.once("destroyed", () => {
      networkByContents.delete(id);
      sampleByContents.delete(id);
    });
  });

  app.whenReady().then(() => {
    if (webRequestInstalled) return;
    webRequestInstalled = true;
    const ses = session.fromPartition(PARTITION);
    ses.webRequest.onCompleted({ urls: ["http://*/*", "https://*/*"] }, addNetwork);
  }).catch(() => {});

  app.on("browser-window-created", (_event, win) => {
    const inject = () => {
      let url = "";
      try { url = win.webContents.getURL() || ""; } catch {}
      if (!/browser\.html(?:$|[?#])/i.test(url)) return;
      win.webContents.executeJavaScript(`(${browserHudRenderer.toString()})()`, true).catch(() => {});
    };
    win.webContents.on("did-finish-load", inject);
    win.webContents.on("dom-ready", inject);
    setTimeout(inject, 700).unref?.();
  });
}

module.exports = {
  installBrowserResourceMonitor,
  clampPercent,
  responseBytes,
  networkSnapshot,
};

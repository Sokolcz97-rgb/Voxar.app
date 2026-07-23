// StudioVoxario custom launcher-updater
// Fetches a JSON manifest and offers to install a newer version.
const { app, dialog, shell, Notification, BrowserWindow, ipcMain } = require("electron");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { execFile } = require("child_process");
const pinning = require("./pinning.cjs");

const MANIFEST_URL =
  process.env.STUDIOVOXARIO_UPDATE_URL ||
  "https://studiovoxario.com/desktop-version.json";

function fetchJson(url, { bustCache = false } = {}) {
  return new Promise((resolve, reject) => {
    // Cache-bust: přidej ?t=<ts>, aby CDN/prohlížeč nevrátil starý manifest při
    // ručním „Zkontrolovat aktualizace" — jinak by uživatel nikdy neviděl novou verzi.
    let finalUrl = url;
    if (bustCache) {
      const sep = url.includes("?") ? "&" : "?";
      finalUrl = `${url}${sep}t=${Date.now()}`;
    }
    const lib = finalUrl.startsWith("https") ? https : http;
    const req = lib.get(finalUrl, {
      headers: {
        "User-Agent": "StudioVoxario-Launcher",
        "Cache-Control": "no-cache, no-store, max-age=0",
        "Pragma": "no-cache",
      },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location, { bustCache: false }));
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
      });
    });
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("timeout")));
  });
}

// Držíme referenci na běžící download request, ať ho lze zvenčí zrušit.
let activeDownload = null;

// Idle-timeout mezi chunky — když socket zamrzne, celý pokus spadne rychle.
const DOWNLOAD_IDLE_TIMEOUT_MS = 30_000;
// Tvrdý strop na celkovou dobu stahování jednoho pokusu.
const DOWNLOAD_HARD_TIMEOUT_MS = 15 * 60_000;

/**
 * Smaže všechny staré/dočasné soubory StudioVoxario v tmpdir.
 * Volá se před každým novým pokusem, aby se předešlo loopu s poškozenými
 * částečnými soubory a aby se disk nezaplňoval.
 */
function purgeStaleTempFiles(keepPath = null) {
  try {
    const tmp = os.tmpdir();
    for (const name of fs.readdirSync(tmp)) {
      if (!/^StudioVoxario-/.test(name)) continue;
      // Nemažeme běžící watchdog script (StudioVoxario-update-*.cmd) —
      // ten se stará o instalaci a musí přežít.
      if (/^StudioVoxario-update-.*\.cmd$/i.test(name)) continue;
      const full = path.join(tmp, name);
      if (keepPath && path.resolve(full) === path.resolve(keepPath)) continue;
      try { fs.unlinkSync(full); } catch {}
    }
  } catch {}
}

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    // Stagujeme do .part souboru, na finální cestu přejmenujeme až po dokončení.
    // Tím zajistíme, že installer/watchdog nikdy nedostane nekompletní binárku.
    const partPath = dest + ".part";
    try { fs.unlinkSync(partPath); } catch {}

    const lib = url.startsWith("https") ? https : http;
    let settled = false;
    let idleTimer = null;
    let hardTimer = null;

    const cleanupTimers = () => {
      if (idleTimer) { clearTimeout(idleTimer); idleTimer = null; }
      if (hardTimer) { clearTimeout(hardTimer); hardTimer = null; }
    };
    const fail = (err) => {
      if (settled) return;
      settled = true;
      cleanupTimers();
      activeDownload = null;
      try { req.destroy(); } catch {}
      try { fs.unlinkSync(partPath); } catch {}
      reject(err);
    };

    const req = lib.get(url, {
      headers: { "User-Agent": "StudioVoxario-Launcher" },
      timeout: DOWNLOAD_IDLE_TIMEOUT_MS,
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        cleanupTimers();
        settled = true; // předáváme rekurzi
        return resolve(downloadFile(res.headers.location, dest, onProgress));
      }
      if (res.statusCode !== 200) return fail(new Error("HTTP " + res.statusCode));
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      const startTs = Date.now();
      let lastEmit = 0;
      const hash = crypto.createHash("sha256");
      const file = fs.createWriteStream(partPath);
      activeDownload = { req, dest: partPath };

      const bumpIdle = () => {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => fail(new Error(`timeout: no data for ${DOWNLOAD_IDLE_TIMEOUT_MS} ms`)), DOWNLOAD_IDLE_TIMEOUT_MS);
      };
      hardTimer = setTimeout(() => fail(new Error("timeout: hard limit reached")), DOWNLOAD_HARD_TIMEOUT_MS);
      bumpIdle();

      res.on("data", (chunk) => {
        received += chunk.length;
        hash.update(chunk);
        bumpIdle();
        const now = Date.now();
        if (onProgress && (now - lastEmit > 200 || (total && received === total))) {
          lastEmit = now;
          const elapsed = (now - startTs) / 1000;
          const speedBps = elapsed > 0 ? received / elapsed : 0;
          const etaSec = total && speedBps > 0 ? (total - received) / speedBps : null;
          try {
            onProgress({
              received, total,
              pct: total ? received / total : 0,
              speedBps, etaSec,
            });
          } catch {}
        }
      });
      res.pipe(file);
      file.on("finish", () =>
        file.close((closeErr) => {
          if (settled) return;
          if (closeErr) return fail(closeErr);
          if (total && received !== total) {
            return fail(new Error(`incomplete download: ${received}/${total} B`));
          }
          try {
            try { fs.unlinkSync(dest); } catch {}
            fs.renameSync(partPath, dest);
          } catch (e) { return fail(e); }
          settled = true;
          cleanupTimers();
          if (activeDownload && activeDownload.req === req) activeDownload = null;
          resolve({ path: dest, sha256: hash.digest("hex"), size: received });
        })
      );
      file.on("error", fail);
      res.on("error", fail);
      res.on("aborted", () => fail(new Error("stream aborted")));
    });
    req.on("error", fail);
    req.on("timeout", () => fail(new Error("timeout: socket idle")));
  });
}

/** Zruší běžící stahování — jádro pro tlačítko „Zrušit" v launcheru. */
function cancelActiveDownload() {
  if (!activeDownload) return false;
  const { req, dest } = activeDownload;
  activeDownload = null;
  try { req.destroy(new Error("canceled")); } catch {}
  setTimeout(() => {
    try { fs.unlinkSync(dest); } catch {}
    try { fs.unlinkSync(String(dest).replace(/\.part$/, "")); } catch {}
  }, 50);
  return true;
}


// -------- Authenticode / codesign verification --------
// Windows: PowerShell Get-AuthenticodeSignature. macOS: codesign. Linux: skipped.
function verifyCodeSignature(filePath) {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      const ps =
        `$ErrorActionPreference='Stop';` +
        `$s = Get-AuthenticodeSignature -LiteralPath '${filePath.replace(/'/g, "''")}';` +
        `$o = [ordered]@{` +
          `status = [string]$s.Status;` +
          `statusMessage = [string]$s.StatusMessage;` +
          `subject = if ($s.SignerCertificate) { [string]$s.SignerCertificate.Subject } else { $null };` +
          `issuer = if ($s.SignerCertificate) { [string]$s.SignerCertificate.Issuer } else { $null };` +
          `thumbprint = if ($s.SignerCertificate) { [string]$s.SignerCertificate.Thumbprint } else { $null };` +
          `notAfter = if ($s.SignerCertificate) { [string]$s.SignerCertificate.NotAfter } else { $null };` +
          `timeStamperCert = if ($s.TimeStamperCertificate) { [string]$s.TimeStamperCertificate.Subject } else { $null }` +
        `};` +
        `$o | ConvertTo-Json -Compress`;
      execFile(
        "powershell.exe",
        ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", ps],
        { timeout: 20000, windowsHide: true },
        (err, stdout, stderr) => {
          if (err) return resolve({ supported: true, ok: false, status: "error", error: String(stderr || err.message) });
          try {
            const info = JSON.parse(stdout);
            resolve({
              supported: true,
              ok: info.status === "Valid",
              status: info.status,
              statusMessage: info.statusMessage,
              subject: info.subject,
              issuer: info.issuer,
              thumbprint: info.thumbprint,
              notAfter: info.notAfter,
              timestamped: !!info.timeStamperCert,
            });
          } catch (e) {
            resolve({ supported: true, ok: false, status: "parse-error", error: String(e), raw: stdout });
          }
        }
      );
      return;
    }
    if (process.platform === "darwin") {
      execFile(
        "codesign",
        ["--verify", "--deep", "--strict", "--verbose=2", filePath],
        { timeout: 20000 },
        (err, _stdout, stderr) => {
          if (err) return resolve({ supported: true, ok: false, status: "invalid", error: String(stderr || err.message) });
          // Fetch authority for display
          execFile("codesign", ["-dv", "--verbose=4", filePath], { timeout: 20000 }, (_e, _o, info) => {
            const authority = /Authority=(.+)/.exec(info || "")?.[1] || null;
            resolve({ supported: true, ok: true, status: "Valid", subject: authority });
          });
        }
      );
      return;
    }
    resolve({ supported: false, ok: true, status: "unsupported-platform" });
  });
}

// Semver-lite: "1.2.3" > "1.2.0"
function isNewer(remote, current) {
  const parse = (v) => String(v).replace(/^v/, "").split(".").map((n) => parseInt(n, 10) || 0);
  const a = parse(remote);
  const b = parse(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = a[i] || 0, y = b[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false;
}

let checking = false;
// Globální zámek proti smyčce: když už jednou spustíme instalační pipeline
// (stahování/ověření/instalace), další volání (např. z FAB nebo intervalu)
// hned vrátí busy, dokud pipeline neskončí nebo se aplikace nerestartuje.
let installing = false;


// Persistent diagnostics — snapshot of the last update check for the launcher UI.
const diagnostics = {
  manifestUrl: MANIFEST_URL,
  currentVersion: null,
  manifest: null,
  remoteVersion: null,
  installerUrl: null,
  expectedSha256: null,
  expectedSize: null,
  downloadedSha256: null,
  downloadedSize: null,
  expectedPublisher: null,
  signatureStatus: null,
  signatureSubject: null,
  signatureThumbprint: null,
  signatureTimestamped: null,
  pinTrust: null,           // "pinned" | "tofu" | "pin-mismatch" | "no-thumbprint"
  pinnedThumbprints: [],    // aktuálně důvěryhodné piny
  pinRotation: null,        // { changed, reason, before, after }
  status: "idle",
  lastError: null,
  lastCheckAt: null,
  // Retry / backoff diagnostika
  retryAttempts: 0,
  retryMaxAttempts: 0,
  retryLastError: null,
  retryLastErrorAt: null,
  retryNextDelayMs: null,
  retryNextAt: null,
  retryPhase: null, // "manifest" | "download"
  // Živý průběh stahování / instalace pro launcher UI
  progress: {
    phase: null,          // "download" | "verify" | "signature" | "installing" | "done" | "canceled"
    label: null,
    received: 0,
    total: 0,
    pct: 0,
    speedBps: 0,
    etaSec: null,
    canceled: false,
    startedAt: null,
    updatedAt: null,
  },
  logs: [],
};

function broadcast(channel, payload) {
  try {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send(channel, payload);
    });
  } catch {}
}

function updateProgress(patch) {
  diagnostics.progress = { ...diagnostics.progress, ...patch, updatedAt: new Date().toISOString() };
  broadcast("launcher:progress", diagnostics.progress);
}

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  diagnostics.logs.push(line);
  if (diagnostics.logs.length > 200) diagnostics.logs.splice(0, diagnostics.logs.length - 200);
  try { console.log(line); } catch {}
  // Broadcast to any listening launcher window
  try {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed()) w.webContents.send("launcher:log", line);
    });
  } catch {}
}

function getDiagnostics() {
  return { ...diagnostics, logs: diagnostics.logs.slice() };
}

// ------- Retry s exponenciálním backoffem pro síťové operace -------
const RETRYABLE_PATTERNS = [
  /ETIMEDOUT/i, /ENETUNREACH/i, /ENOTFOUND/i, /ECONNRESET/i, /ECONNREFUSED/i,
  /EAI_AGAIN/i, /EPIPE/i, /socket hang up/i, /network/i, /timeout/i,
  /HTTP 5\d\d/i, /HTTP 408/i, /HTTP 429/i,
];
function isRetryable(err) {
  const msg = String(err?.message || err || "");
  return RETRYABLE_PATTERNS.some((r) => r.test(msg));
}
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/**
 * Zabalí async operaci do retry smyčky s exponenciálním backoffem + jitterem.
 * Aktualizuje diagnostiku (retryAttempts, retryNextDelayMs, retryLastError, …)
 * a broadcastuje log, aby to launcher UI viděl v reálném čase.
 */
async function withRetry(fn, { phase, label, maxAttempts = 5, baseDelayMs = 1500, maxDelayMs = 60_000 } = {}) {
  diagnostics.retryPhase = phase;
  diagnostics.retryMaxAttempts = maxAttempts;
  diagnostics.retryAttempts = 0;
  diagnostics.retryLastError = null;
  diagnostics.retryLastErrorAt = null;
  diagnostics.retryNextDelayMs = null;
  diagnostics.retryNextAt = null;

  let attempt = 0;
  let lastErr;
  while (attempt < maxAttempts) {
    attempt += 1;
    diagnostics.retryAttempts = attempt;
    try {
      const result = await fn(attempt);
      if (attempt > 1) log(`${label}: úspěch na ${attempt}. pokus.`);
      diagnostics.retryNextDelayMs = null;
      diagnostics.retryNextAt = null;
      return result;
    } catch (err) {
      lastErr = err;
      const retryable = isRetryable(err) && attempt < maxAttempts;
      diagnostics.retryLastError = String(err?.message || err);
      diagnostics.retryLastErrorAt = new Date().toISOString();
      if (!retryable) {
        log(`${label}: pokus ${attempt}/${maxAttempts} selhal (nelze opakovat) — ${diagnostics.retryLastError}`);
        throw err;
      }
      const expo = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
      const jitter = Math.round(expo * (0.5 + Math.random() * 0.5)); // 50–100 % okno
      diagnostics.retryNextDelayMs = jitter;
      diagnostics.retryNextAt = new Date(Date.now() + jitter).toISOString();
      log(`${label}: pokus ${attempt}/${maxAttempts} selhal (${diagnostics.retryLastError}). Nový pokus za ${Math.round(jitter / 1000)} s.`);
      await sleep(jitter);
    }
  }
  throw lastErr;
}

// ---- UI bridge: umožní směrovat dotazy/notifikace do launcheru místo nativního OS dialogu.
// Nastavuje se z main.cjs. Když není nastaveno (nebo bridge vrátí null), padáme zpět na
// interní tmavý modal (žádné klasické Windows okno).
let uiBridge = null;
function setUiBridge(fn) { uiBridge = typeof fn === "function" ? fn : null; }

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

let modalSeq = 0;
function showInAppModal(parentWindow, { type = "info", title, message, detail, buttons }) {
  return new Promise((resolve) => {
    const btns = (buttons && buttons.length ? buttons : ["OK"]);
    const win = new BrowserWindow({
      width: 480,
      height: 300,
      resizable: false,
      minimizable: false,
      maximizable: false,
      frame: false,
      alwaysOnTop: true,
      modal: !!(parentWindow && !parentWindow.isDestroyed()),
      parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
      backgroundColor: "#0a0a0f",
      show: false,
      title: title || "StudioVoxario",
      webPreferences: { nodeIntegration: true, contextIsolation: false },
    });
    const channel = `sv-modal-response-${++modalSeq}`;
    const accent = type === "error" ? "#ef4444" : type === "warning" ? "#f59e0b" : "#22d3ee";
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html,body{margin:0;padding:0;background:#0a0a0f;color:#e5e7eb;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;overflow:hidden}
      .wrap{padding:20px 22px;height:calc(100vh - 40px);display:flex;flex-direction:column;box-sizing:border-box}
      .titlebar{-webkit-app-region:drag;font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.08em;margin-bottom:10px}
      h3{margin:0 0 8px;font-size:15px;font-weight:600;color:${accent}}
      .msg{font-size:14px;font-weight:600;color:#f1f5f9;margin-bottom:6px}
      .detail{font-size:12.5px;color:#cbd5e1;white-space:pre-wrap;line-height:1.5;flex:1;overflow:auto;-webkit-app-region:no-drag;padding-right:4px}
      .row{display:flex;gap:8px;justify-content:flex-end;margin-top:14px;-webkit-app-region:no-drag}
      button{cursor:pointer;padding:8px 16px;border-radius:8px;border:1px solid #334155;background:#111827;color:#e5e7eb;font-size:13px;font-family:inherit}
      button:hover{background:#1f2937}
      button.primary{background:linear-gradient(90deg,#06b6d4,#22d3ee);border-color:transparent;color:#0a0a0f;font-weight:600}
      button.primary:hover{filter:brightness(1.08)}
    </style></head><body>
      <div class="wrap">
        <div class="titlebar">StudioVoxario</div>
        <h3>${escapeHtml(title || "StudioVoxario")}</h3>
        ${message ? `<div class="msg">${escapeHtml(message)}</div>` : ""}
        <div class="detail">${escapeHtml(detail || "")}</div>
        <div class="row">${btns.map((b,i) => `<button data-i="${i}" class="${i===0?'primary':''}">${escapeHtml(b)}</button>`).join("")}</div>
      </div>
      <script>
        const { ipcRenderer } = require("electron");
        document.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
          ipcRenderer.send(${JSON.stringify(channel)}, parseInt(b.dataset.i,10));
        }));
        document.addEventListener("keydown", (e) => {
          if (e.key === "Escape") ipcRenderer.send(${JSON.stringify(channel)}, ${btns.length - 1});
          if (e.key === "Enter") ipcRenderer.send(${JSON.stringify(channel)}, 0);
        });
      </script>
    </body></html>`;
    win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
    win.once("ready-to-show", () => { try { win.show(); win.focus(); } catch {} });
    const onResp = (_e, i) => { done(i); };
    const done = (i) => {
      ipcMain.removeListener(channel, onResp);
      try { if (!win.isDestroyed()) win.close(); } catch {}
      resolve(typeof i === "number" ? i : -1);
    };
    ipcMain.once(channel, onResp);
    win.on("closed", () => { ipcMain.removeListener(channel, onResp); resolve(-1); });
  });
}

async function askUser({ parentWindow, title, message, detail, buttons, defaultId = 0, cancelId = 1 }) {
  if (uiBridge) {
    try {
      const r = await uiBridge({ kind: "question", title, message, detail, buttons, defaultId, cancelId });
      if (r && typeof r.response === "number") return r.response;
    } catch (e) { log(`UI bridge selhal (${e.message || e}) — fallback na in-app modal.`); }
  }
  const idx = await showInAppModal(parentWindow, { type: "info", title, message, detail, buttons });
  return idx < 0 ? cancelId : idx;
}
async function notifyUser({ parentWindow, type = "info", title, message, detail }) {
  if (uiBridge) {
    try {
      const r = await uiBridge({ kind: "notice", type, title, message, detail });
      if (r && r.ok) return;
    } catch (e) { log(`UI bridge selhal (${e.message || e}) — fallback na in-app modal.`); }
  }
  await showInAppModal(parentWindow, { type, title, message, detail, buttons: ["OK"] });
}

/**
 * Persistentní modal „Instaluji aktualizaci..." — po vybalení installeru
 * a před quitem appky. Nemá tlačítka, zavírá se sám za ~6 s (kdy volá app.quit).
 * Preferuje UI bridge (integrovaný launcher UI), aby to nikdy nebyl OS pop-up.
 */
async function showInstallingModal(parentWindow, version) {
  const title = "Instaluji aktualizaci";
  const message = `StudioVoxario ${version}`;
  const detail =
    "Nová verze se právě instaluje na pozadí.\n" +
    "Aplikace se za chvíli sama zavře a znovu spustí.\n\n" +
    "Nezavírejte prosím počítač.";
  if (uiBridge) {
    try {
      await uiBridge({ kind: "installing", title, message, detail, version });
      return;
    } catch (e) { log(`UI bridge (installing) selhal (${e.message || e}) — fallback na in-app modal.`); }
  }
  // In-process modal bez tlačítek — auto-close za 5.5 s.
  const win = new BrowserWindow({
    width: 460, height: 220, resizable: false, minimizable: false, maximizable: false,
    frame: false, alwaysOnTop: true, backgroundColor: "#0a0a0f", show: false,
    parent: parentWindow && !parentWindow.isDestroyed() ? parentWindow : undefined,
    webPreferences: { nodeIntegration: true, contextIsolation: false },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;background:#0a0a0f;color:#e5e7eb;font-family:-apple-system,'Segoe UI',Roboto,sans-serif;overflow:hidden}
    .wrap{padding:22px 24px}
    h3{margin:0 0 6px;font-size:15px;color:#22d3ee}
    .msg{font-size:14px;font-weight:600;margin-bottom:8px}
    .detail{font-size:12.5px;color:#cbd5e1;white-space:pre-wrap;line-height:1.55}
    .bar{margin-top:14px;height:6px;background:#1f2937;border-radius:6px;overflow:hidden;position:relative}
    .bar::after{content:'';position:absolute;left:-40%;top:0;bottom:0;width:40%;background:linear-gradient(90deg,transparent,#22d3ee,transparent);animation:l 1.4s infinite}
    @keyframes l{to{left:100%}}
  </style></head><body><div class="wrap">
    <h3>${escapeHtml(title)}</h3>
    <div class="msg">${escapeHtml(message)}</div>
    <div class="detail">${escapeHtml(detail)}</div>
    <div class="bar"></div>
  </div></body></html>`;
  win.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));
  win.once("ready-to-show", () => { try { win.show(); win.focus(); } catch {} });
  setTimeout(() => { try { if (!win.isDestroyed()) win.close(); } catch {} }, 5500);
}

function q(s) {
  return String(s).replace(/"/g, '""');
}

/**
 * Windows update watchdog. Runs outside Electron, waits until this process exits,
 * installs silently, then starts the installed app again.
 */
function runWindowsInstallAndRelaunch(installerPath, version) {
  const exePath = app.getPath("exe");
  const logPath = path.join(app.getPath("userData"), "last-update-install.log");
  const scriptPath = path.join(os.tmpdir(), `StudioVoxario-update-${Date.now()}.cmd`);
  const content = [
    "@echo off",
    "setlocal EnableExtensions",
    `set "SV_PID=${process.pid}"`,
    `set "SV_INSTALLER=${installerPath}"`,
    `set "SV_EXE=${exePath}"`,
    `set "SV_LOG=${logPath}"`,
    "echo [%date% %time%] StudioVoxario update helper started > \"%SV_LOG%\"",
    `echo Target version: ${q(version || "unknown")} >> "%SV_LOG%"`,
    ":wait_old",
    "tasklist /FI \"PID eq %SV_PID%\" 2>NUL | find /I \"%SV_PID%\" >NUL",
    "if not errorlevel 1 (",
    "  timeout /t 1 /nobreak >NUL",
    "  goto wait_old",
    ")",
    "echo [%date% %time%] Old app exited, running installer >> \"%SV_LOG%\"",
    "\"%SV_INSTALLER%\" /S >> \"%SV_LOG%\" 2>&1",
    "set \"SV_CODE=%ERRORLEVEL%\"",
    "echo [%date% %time%] Installer exit code: %SV_CODE% >> \"%SV_LOG%\"",
    "timeout /t 2 /nobreak >NUL",
    "if exist \"%SV_EXE%\" (",
    "  echo [%date% %time%] Relaunching %SV_EXE% >> \"%SV_LOG%\"",
    "  start \"\" \"%SV_EXE%\"",
    ") else (",
    "  echo [%date% %time%] Installed exe not found: %SV_EXE% >> \"%SV_LOG%\"",
    ")",
    "endlocal",
    "exit /b 0",
    "",
  ].join("\r\n");
  fs.writeFileSync(scriptPath, content, "utf8");
  const { spawn } = require("child_process");
  const child = spawn("cmd.exe", ["/d", "/c", scriptPath], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
  return { scriptPath, logPath };
}




// Vybere blok z manifestu podle kanálu (stable / beta).
// Když v manifestu žádné `channels` nejsou, chová se zpětně kompatibilně a
// vezme kořen manifestu. Beta zabalí do stable, když ještě neexistuje.
function pickChannel(manifest, channel = "stable") {
  if (!manifest || typeof manifest !== "object") return manifest;
  const channels = manifest.channels;
  if (channels && typeof channels === "object") {
    const primary = channels[channel] || channels.stable || channels.beta;
    if (primary) {
      // Merge: kořenové hodnoty (např. publisher) fungují jako defaults.
      return { ...manifest, ...primary };
    }
  }
  return manifest;
}

async function checkForUpdates({ silent = true, parentWindow = null, channel = "stable" } = {}) {
  if (checking) return { status: "busy" };
  if (installing) return { status: "busy" };
  checking = true;

  diagnostics.status = "checking";
  diagnostics.lastError = null;
  diagnostics.currentVersion = app.getVersion();
  diagnostics.channel = channel;
  diagnostics.lastCheckAt = new Date().toISOString();
  log(`Kontrola aktualizací — aktuální verze ${diagnostics.currentVersion} (kanál: ${channel})`);
  log(`Stahuji manifest: ${MANIFEST_URL}`);
  try {
    const rawManifest = await withRetry(() => fetchJson(MANIFEST_URL, { bustCache: true }), { phase: "manifest", label: "Manifest" });
    const manifest = pickChannel(rawManifest, channel);
    diagnostics.manifest = manifest;
    const current = app.getVersion();
    const remote = manifest.version;
    diagnostics.remoteVersion = remote;
    log(`Manifest OK — vzdálená verze ${remote}`);
    if (!remote || !isNewer(remote, current)) {
      diagnostics.status = "up-to-date";
      log(`Není novější verze (${current} ≥ ${remote}).`);
      if (!silent) {
        await notifyUser({
          parentWindow, type: "info",
          title: "StudioVoxario",
          message: "Máte nejnovější verzi",
          detail: `Aktuální verze: ${current}`,
        });
      }

      return { status: "up-to-date", current };
    }

    const platform = process.platform;
    const asset =
      (manifest.platforms && manifest.platforms[platform]) ||
      (platform === "win32" ? { installerUrl: manifest.installerUrl } : null);

    if (!asset || !asset.installerUrl) {
      diagnostics.status = "no-asset";
      log(`Manifest neobsahuje installer pro platformu ${platform}.`);
      return { status: "no-asset" };
    }
    diagnostics.installerUrl = asset.installerUrl;
    diagnostics.expectedSha256 = (asset.sha256 || manifest.sha256 || null);
    diagnostics.expectedSize = Number(asset.size || manifest.size || 0) || null;
    log(`Vybraný installer: ${asset.installerUrl}`);
    if (diagnostics.expectedSha256) log(`Očekávaný SHA-256: ${diagnostics.expectedSha256}`);

    const response = await askUser({
      parentWindow,
      title: "Nová verze StudioVoxario",
      message: `Je k dispozici verze ${remote}`,
      detail:
        `Aktuální verze: ${current}\nNová verze: ${remote}\n\n` +
        (manifest.notes ? `Poznámky:\n${manifest.notes}\n\n` : "") +
        `Chcete stáhnout a nainstalovat?`,
      buttons: ["Stáhnout a nainstalovat", "Později"],
      defaultId: 0,
      cancelId: 1,
    });

    if (response !== 0) {
      diagnostics.status = "postponed";
      log("Uživatel odložil aktualizaci.");
      return { status: "postponed" };
    }

    if (installing) {
      log("Instalace už běží — druhý pokus zamítnut, aby nedošlo ke smyčce.");
      return { status: "busy" };
    }
    installing = true;

    // Progress window
    const progressWin = new BrowserWindow({
      width: 420,
      height: 180,
      resizable: false,
      minimizable: false,
      maximizable: false,
      autoHideMenuBar: true,
      backgroundColor: "#0a0a0f",
      title: "Stahování aktualizace",
      parent: parentWindow || undefined,
      modal: false,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0f;color:#e5e7eb;padding:24px}
      h3{margin:0 0 12px;font-weight:600}
      .bar{height:10px;background:#1f2937;border-radius:8px;overflow:hidden;margin-top:8px}
      .fill{height:100%;width:0%;background:linear-gradient(90deg,#06b6d4,#22d3ee);transition:width .2s}
      .pct{margin-top:8px;font-size:12px;color:#94a3b8;text-align:right}
    </style></head><body>
      <h3>Stahuji StudioVoxario ${remote}…</h3>
      <div class="bar"><div class="fill" id="f"></div></div>
      <div class="pct" id="p">0 %</div>
    </body></html>`;
    progressWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));

    const ext = platform === "win32" ? ".exe" : platform === "darwin" ? ".dmg" : ".AppImage";
    const dest = path.join(os.tmpdir(), `StudioVoxario-${remote}${ext}`);
    // Vyčisti staré/částečné soubory — bez toho se pipeline zacyklila,
    // když předchozí pokus nechal `.part` nebo poškozený `.exe` v tmpdir.
    purgeStaleTempFiles(dest);
    try { fs.unlinkSync(dest); } catch {}
    try { fs.unlinkSync(dest + ".part"); } catch {}
    log(`Stahování zahájeno → ${dest}`);
    diagnostics.status = "downloading";
    updateProgress({
      phase: "download", label: `Stahuji StudioVoxario ${remote}`,
      received: 0, total: 0, pct: 0, speedBps: 0, etaSec: null,
      canceled: false, startedAt: new Date().toISOString(),
    });

    // Bez retry — jeden pokus, aby fail nezpůsobil smyčku.
    const download = await withRetry(() => downloadFile(asset.installerUrl, dest, (s) => {
      updateProgress({
        phase: "download", label: `Stahuji StudioVoxario ${remote}`,
        received: s.received, total: s.total, pct: s.pct,
        speedBps: s.speedBps, etaSec: s.etaSec,
      });
      const pct = Math.round(s.pct * 100);
      progressWin.webContents
        .executeJavaScript(
          `document.getElementById('f').style.width='${pct}%';document.getElementById('p').textContent='${pct} %';`
        )
        .catch(() => {});
    }), { phase: "download", label: "Stažení instalátoru", maxAttempts: 1 });


    progressWin.close();
    diagnostics.downloadedSha256 = download.sha256;
    diagnostics.downloadedSize = download.size;
    log(`Staženo ${download.size} B, SHA-256=${download.sha256}`);

    // Integrity verification — SHA-256 must match the manifest (and size if provided).
    const expectedHash = String(asset.sha256 || manifest.sha256 || "").toLowerCase().trim();
    const expectedSize = Number(asset.size || manifest.size || 0);
    if (!expectedHash) {
      try { fs.unlinkSync(dest); } catch {}
      diagnostics.status = "no-hash";
      diagnostics.lastError = "Manifest neobsahuje SHA-256.";
      log("CHYBA: manifest bez SHA-256, aktualizace zamítnuta.");
      await notifyUser({ parentWindow, type: "error",
        title: "Aktualizace zamítnuta",
        message: "Chybí kontrolní součet",
        detail:
          "Manifest neobsahuje SHA-256 hash instalátoru, takže integritu nelze ověřit. " +
          "Aktualizace byla z bezpečnostních důvodů zrušena." });
      return { status: "no-hash" };
    }
    if (expectedSize && download.size !== expectedSize) {
      try { fs.unlinkSync(dest); } catch {}
      diagnostics.status = "size-mismatch";
      diagnostics.lastError = `Velikost ${download.size} ≠ ${expectedSize}`;
      log(`CHYBA: nesouhlasí velikost (${download.size} vs ${expectedSize}).`);
      await notifyUser({ parentWindow, type: "error",
        title: "Aktualizace zamítnuta",
        message: "Neplatná velikost souboru",
        detail: `Očekáváno ${expectedSize} B, staženo ${download.size} B. Soubor byl smazán.` });
      return { status: "size-mismatch" };
    }
    if (download.sha256.toLowerCase() !== expectedHash) {
      try { fs.unlinkSync(dest); } catch {}
      diagnostics.status = "hash-mismatch";
      diagnostics.lastError = `SHA-256 neshoda (očekáváno ${expectedHash}, získáno ${download.sha256})`;
      log("CHYBA: neshoda SHA-256, instalátor smazán.");
      await notifyUser({ parentWindow, type: "error",
        title: "Aktualizace zamítnuta",
        message: "Ověření integrity selhalo",
        detail:
          `Kontrolní součet staženého instalátoru neodpovídá manifestu.\n\n` +
          `Očekáváno: ${expectedHash}\n` +
          `Získáno:   ${download.sha256}\n\n` +
          `Soubor mohl být poškozen při přenosu nebo podvržen. Byl smazán a nespustí se.` });
      return { status: "hash-mismatch" };
    }

    // Authenticode / codesign verification — chrání i proti platnému hashi z podvrženého manifestu,
    // pokud útočník nemá platný certifikát vydavatele.
    const expectedPublisher = (asset.publisher || manifest.publisher || process.env.STUDIOVOXARIO_EXPECTED_PUBLISHER || null);
    const allowUnsigned = Boolean(asset.allowUnsigned ?? manifest.allowUnsigned ?? false);
    diagnostics.expectedPublisher = expectedPublisher;
    diagnostics.allowUnsigned = allowUnsigned;
    log("Ověřuji digitální podpis instalátoru…");
    const sig = await verifyCodeSignature(dest);
    diagnostics.signatureStatus = sig.status || null;
    diagnostics.signatureSubject = sig.subject || null;
    diagnostics.signatureThumbprint = sig.thumbprint || null;
    diagnostics.signatureTimestamped = sig.timestamped ?? null;

    if (!sig.supported) {
      log(`Podpis nelze ověřit na této platformě (${process.platform}) — přeskočeno.`);
    } else if (!sig.ok) {
      if (allowUnsigned) {
        log(`VAROVÁNÍ: instalátor není digitálně podepsán (${sig.status}). Manifest povoluje allowUnsigned — pokračuji na základě ověřeného SHA-256.`);
        diagnostics.signatureWarning = `Nepodepsáno (${sig.status}) — povoleno manifestem (alpha).`;
      } else {
        try { fs.unlinkSync(dest); } catch {}
        diagnostics.status = "signature-invalid";
        diagnostics.lastError = `Neplatný podpis: ${sig.status}${sig.error ? " — " + sig.error : ""}`;
        log(`CHYBA: neplatný digitální podpis (${sig.status}). Instalátor smazán.`);
        await notifyUser({ parentWindow, type: "error",
          title: "Aktualizace zamítnuta",
          message: "Ověření podpisu selhalo",
          detail:
            `Digitální podpis instalátoru je neplatný nebo chybí.\n\n` +
            `Stav: ${sig.status}\n` +
            (sig.statusMessage ? `Zpráva: ${sig.statusMessage}\n` : "") +
            (sig.subject ? `Podepsáno: ${sig.subject}\n` : "") +
            `\nSoubor byl smazán a nespustí se.` });
        return { status: "signature-invalid" };
      }
    } else {
      log(`Podpis OK — ${sig.subject || "(neznámý subjekt)"} [${sig.thumbprint || "-"}]`);
      if (expectedPublisher && sig.subject && !sig.subject.toLowerCase().includes(String(expectedPublisher).toLowerCase())) {
        try { fs.unlinkSync(dest); } catch {}
        diagnostics.status = "publisher-mismatch";
        diagnostics.lastError = `Vydavatel "${sig.subject}" ≠ očekávaný "${expectedPublisher}"`;
        log(`CHYBA: podpis platný, ale vydavatel neodpovídá. Instalátor smazán.`);
        await notifyUser({ parentWindow, type: "error",
          title: "Aktualizace zamítnuta",
          message: "Neočekávaný vydavatel",
          detail:
            `Instalátor je podepsaný, ale jiným subjektem, než uvádí manifest.\n\n` +
            `Očekáváno: ${expectedPublisher}\n` +
            `Nalezeno:  ${sig.subject}\n\n` +
            `Soubor byl smazán a nespustí se.` });
        return { status: "publisher-mismatch" };
      }

      // ---- Certificate pinning ----
      // Vždy ověř thumbprint proti uloženému seznamu pinů. Pinning běží NAVÍC
      // vedle publisher/hash kontroly — nelze ho z manifestu vypnout.
      const pinCheck = pinning.verifyAgainstPins(sig.thumbprint);
      diagnostics.pinTrust = pinCheck.reason;
      diagnostics.pinnedThumbprints = pinCheck.pins || pinning.loadPins().thumbprints;
      if (!pinCheck.trusted) {
        try { fs.unlinkSync(dest); } catch {}
        diagnostics.status = "pin-mismatch";
        diagnostics.lastError = `Thumbprint ${pinCheck.actual || "?"} není mezi pinovanými certifikáty.`;
        log(`CHYBA: certificate pinning selhal (${pinCheck.reason}). Instalátor smazán.`);
        await notifyUser({ parentWindow, type: "error",
          title: "Aktualizace zamítnuta",
          message: "Neznámý podepisující certifikát",
          detail:
            `Instalátor je podepsaný certifikátem, který není v seznamu pinovaných ` +
            `otisků aplikace.\n\n` +
            `Nalezený otisk: ${pinCheck.actual || "-"}\n` +
            `Pinované otisky: ${(pinCheck.pins || []).join(", ") || "(žádné)"}\n\n` +
            `Soubor byl smazán a nespustí se.` });
        return { status: "pin-mismatch" };
      }
      log(`Pinning OK — ${pinCheck.reason}${pinCheck.reason === "tofu" ? " (uložen nový pin)" : ""}.`);

      // Bezpečná rotace pinů z manifestu — jen když aktuální podpis je už mezi
      // důvěryhodnými piny (útočník s pouhým manifestem nemůže přidat vlastní).
      const manifestPins = asset.pinnedThumbprints || manifest.pinnedThumbprints;
      const pinMode = (asset.pinMode || manifest.pinMode) === "replace" ? "replace" : "add";
      if (Array.isArray(manifestPins) && manifestPins.length) {
        const rot = pinning.applyManifestPinUpdate({
          manifestPins,
          mode: pinMode,
          currentTrustedThumbprint: sig.thumbprint,
        });
        diagnostics.pinRotation = rot;
        if (rot.changed) {
          diagnostics.pinnedThumbprints = rot.after;
          log(`Piny aktualizovány (${pinMode}): ${rot.before.length} → ${rot.after.length}.`);
        } else {
          log(`Rotace pinů přeskočena: ${rot.reason}.`);
        }
      }
    }

    diagnostics.status = "installing";
    updateProgress({ phase: "installing", label: `Spouštím instalátor ${remote}`, pct: 1 });
    log("Integrita, podpis i pinning OK, spouštím instalátor.");


    if (platform === "win32") {
      try {
        const helper = runWindowsInstallAndRelaunch(dest, remote);
        log(`Update helper spuštěn: ${helper.scriptPath}; log: ${helper.logPath}`);
      } catch (e) {
        log(`Nepodařilo se spustit update helper (${e.message}), zkouším fallback installeru.`);
        const { spawn } = require("child_process");
        const child = spawn(dest, ["/S"], { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
      }
      // Persistentní in-app modal (auto-close). Použije launcher UI bridge,
      // jinak fallback na interní tmavý modal — nikdy nativní Windows okno.
      showInstallingModal(parentWindow, remote).catch(() => {});
      setTimeout(() => app.quit(), 2500);
    } else {
      await notifyUser({ parentWindow, type: "info",
        title: "Aktualizace stažena",
        message: "Instalátor byl stažen a ověřen",
        detail: `${dest}\n\nSHA-256: ${download.sha256}` });
      shell.showItemInFolder(dest);
    }
    return { status: "installing", version: remote };
  } catch (err) {
    console.error("update check failed", err);
    const msg = String(err.message || err);
    const canceled = /canceled/i.test(msg);
    diagnostics.status = canceled ? "canceled" : "error";
    diagnostics.lastError = canceled ? "Zrušeno uživatelem" : msg;
    updateProgress({ phase: canceled ? "canceled" : "error", canceled, label: canceled ? "Zrušeno" : "Chyba" });
    try { progressWin && !progressWin.isDestroyed() && progressWin.close(); } catch {}
    log(canceled ? "Stahování zrušeno uživatelem." : `CHYBA: ${diagnostics.lastError}`);
    // Uklidíme jakékoli částečné/dočasné soubory, ať další pokus začíná čistě.
    purgeStaleTempFiles();
    installing = false;
    if (!silent && !canceled) {
      await notifyUser({ parentWindow, type: "error",
        title: "Aktualizace selhala",
        message: "Nepodařilo se stáhnout aktualizaci",
        detail: msg + "\n\nDočasné soubory byly smazány. Zkuste to prosím znovu ručně." });
    }
    return { status: "error", error: String(err.message || err) };
  } finally {
    checking = false;
  }
}

/**
 * Stáhne installer z asset.installerUrl, ověří SHA-256 + Authenticode
 * a spustí ho. Sdílená cesta pro update i rollback.
 */
async function installVerified({ asset, version, parentWindow = null, label = "install" }) {
  if (!asset || !asset.installerUrl) return { status: "no-asset" };
  if (installing) {
    log(`${label}: pipeline už běží (busy), druhý pokus zamítnut.`);
    return { status: "busy" };
  }
  installing = true;
  const platform = process.platform;
  const ext = platform === "win32" ? ".exe" : platform === "darwin" ? ".dmg" : ".AppImage";
  const dest = path.join(os.tmpdir(), `StudioVoxario-${version || "asset"}${ext}`);
  // Před každým pokusem uklidíme staré .exe / .part v tmpdir — jinak by mohl
  // watchdog spustit korupt exe z předchozího neúspěšného pokusu.
  purgeStaleTempFiles(dest);
  try { fs.unlinkSync(dest); } catch {}
  try { fs.unlinkSync(dest + ".part"); } catch {}
  log(`${label}: stahuji ${asset.installerUrl} → ${dest}`);

  const progressWin = new BrowserWindow({
    width: 420, height: 180, resizable: false, minimizable: false, maximizable: false,
    autoHideMenuBar: true, backgroundColor: "#0a0a0f",
    title: label, parent: parentWindow || undefined, modal: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false },
  });
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#0a0a0f;color:#e5e7eb;padding:24px}
    h3{margin:0 0 12px;font-weight:600}
    .bar{height:10px;background:#1f2937;border-radius:8px;overflow:hidden;margin-top:8px}
    .fill{height:100%;width:0%;background:linear-gradient(90deg,#f59e0b,#f97316);transition:width .2s}
    .pct{margin-top:8px;font-size:12px;color:#94a3b8;text-align:right}
  </style></head><body>
    <h3>${label} — StudioVoxario ${version || ""}</h3>
    <div class="bar"><div class="fill" id="f"></div></div>
    <div class="pct" id="p">0 %</div>
  </body></html>`;
  progressWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));

  let launching = false;
  try {
    updateProgress({
      phase: "download", label: `${label} — stahuji ${version || ""}`,
      received: 0, total: 0, pct: 0, speedBps: 0, etaSec: null,
      canceled: false, startedAt: new Date().toISOString(),
    });
    // maxAttempts: 1 — žádné auto-retry (uživatel může kliknout znovu).
    const download = await withRetry(() => downloadFile(asset.installerUrl, dest, (s) => {
      updateProgress({
        phase: "download", label: `${label} — stahuji ${version || ""}`,
        received: s.received, total: s.total, pct: s.pct,
        speedBps: s.speedBps, etaSec: s.etaSec,
      });
      const pct = Math.round(s.pct * 100);
      progressWin.webContents
        .executeJavaScript(`document.getElementById('f').style.width='${pct}%';document.getElementById('p').textContent='${pct} %';`)
        .catch(() => {});
    }), { phase: "download", label: `${label}: stažení`, maxAttempts: 1 });
    try { progressWin.close(); } catch {}
    log(`${label}: staženo ${download.size} B, SHA-256=${download.sha256}`);

    const expectedHash = String(asset.sha256 || "").toLowerCase().trim();
    const expectedSize = Number(asset.size || 0);
    if (!expectedHash) { try { fs.unlinkSync(dest); } catch {} return { status: "no-hash" }; }
    if (expectedSize && download.size !== expectedSize) { try { fs.unlinkSync(dest); } catch {} return { status: "size-mismatch" }; }
    if (download.sha256.toLowerCase() !== expectedHash) { try { fs.unlinkSync(dest); } catch {} return { status: "hash-mismatch" }; }

    const sig = await verifyCodeSignature(dest);
    const allowUnsigned = Boolean(asset.allowUnsigned);
    if (sig.supported && !sig.ok && !allowUnsigned) { try { fs.unlinkSync(dest); } catch {} return { status: "signature-invalid", sig }; }
    const expectedPublisher = asset.publisher || process.env.STUDIOVOXARIO_EXPECTED_PUBLISHER || null;
    if (sig.supported && expectedPublisher && sig.subject && !sig.subject.toLowerCase().includes(String(expectedPublisher).toLowerCase())) {
      try { fs.unlinkSync(dest); } catch {}
      return { status: "publisher-mismatch", sig };
    }
    if (sig.supported && sig.ok && sig.thumbprint) {
      const pinCheck = pinning.verifyAgainstPins(sig.thumbprint);
      if (!pinCheck.trusted) {
        try { fs.unlinkSync(dest); } catch {}
        log(`${label}: pin-mismatch (${pinCheck.reason}), instalátor zamítnut.`);
        return { status: "pin-mismatch", sig, pinCheck };
      }
    }
    log(`${label}: ověřeno (podpis + pin), spouštím instalátor.`);
    updateProgress({ phase: "installing", label: `${label} — instalace`, pct: 1 });

    if (platform === "win32") {
      try {
        const helper = runWindowsInstallAndRelaunch(dest, version);
        log(`${label}: update helper spuštěn: ${helper.scriptPath}; log: ${helper.logPath}`);
      } catch {
        const { spawn } = require("child_process");
        const child = spawn(dest, ["/S"], { detached: true, stdio: "ignore", windowsHide: true });
        child.unref();
      }
      launching = true;
      new Notification({ title: "StudioVoxario", body: `${label}: tichá instalace probíhá, aplikace se restartuje.` }).show();
      showInstallingModal(parentWindow, version).catch(() => {});
      setTimeout(() => app.quit(), 2500);
    } else {
      shell.showItemInFolder(dest);
    }
    return { status: "installing", version, path: dest };
  } catch (err) {
    try { progressWin.close(); } catch {}
    const msg = String(err.message || err);
    const canceled = /canceled/i.test(msg);
    updateProgress({ phase: canceled ? "canceled" : "error", canceled, label: canceled ? "Zrušeno" : "Chyba" });
    log(`${label}: ${canceled ? "zrušeno uživatelem" : "chyba — " + msg}`);
    purgeStaleTempFiles();
    return { status: canceled ? "canceled" : "error", error: msg };
  } finally {
    // Pokud instalace nevyskočila do watchdogu, uvolni zámek pro další pokus.
    if (!launching) installing = false;
  }
}

/** Pouze stáhne manifest — využívá rollback, aby nemusel duplikovat URL. */
async function fetchManifest() {
  return withRetry(() => fetchJson(MANIFEST_URL, { bustCache: true }), { phase: "manifest", label: "Manifest" });
}

/**
 * Tichá kontrola — vrátí strukturovanou info o dostupnosti aktualizace,
 * bez jakéhokoli dialogu. Slouží live indikátoru v rendereru:
 * když je `available: true`, renderer zobrazí ikonku stahování.
 */
async function checkForUpdatesQuiet({ channel = "stable" } = {}) {
  try {
    const rawManifest = await fetchJson(MANIFEST_URL, { bustCache: true });
    const manifest = pickChannel(rawManifest, channel);
    const current = app.getVersion();
    const remote = manifest.version;
    const platform = process.platform;
    const asset =
      (manifest.platforms && manifest.platforms[platform]) ||
      (platform === "win32" ? { installerUrl: manifest.installerUrl } : null);
    const available = !!(remote && isNewer(remote, current) && asset && asset.installerUrl);
    diagnostics.currentVersion = current;
    diagnostics.remoteVersion = remote;
    diagnostics.manifest = manifest;
    if (available) diagnostics.installerUrl = asset.installerUrl;
    const payload = { available, current, remote: remote || null, notes: manifest.notes || null, asset: available ? asset : null, channel };
    // Broadcast do všech oken, aby renderer mohl aktualizovat ikonku.
    broadcast("update:availability", payload);
    return payload;
  } catch (e) {
    const payload = { available: false, error: String(e?.message || e) };
    broadcast("update:availability", payload);
    return payload;
  }
}

/**
 * Provede update přímo z rendereru (kliknutí na ikonku „stáhnout aktualizaci").
 * Použije už načtený manifest z poslední quiet kontroly nebo znovu.
 */
async function installUpdateFromRenderer({ parentWindow = null, channel = "stable" } = {}) {
  const info = await checkForUpdatesQuiet({ channel });
  if (!info.available || !info.asset) return { status: "up-to-date" };
  const res = await installVerified({
    asset: info.asset,
    version: info.remote,
    parentWindow,
    label: "update",
  });
  return res;
}

function getPinState() { return pinning.loadPins(); }
function resetPinState() { return pinning.resetPins(); }

module.exports = {
  checkForUpdates, getDiagnostics, installVerified, fetchManifest,
  cancelActiveDownload, getPinState, resetPinState, setUiBridge,
  checkForUpdatesQuiet, installUpdateFromRenderer,
};



// StudioVoxario custom launcher-updater
// Fetches a JSON manifest and offers to install a newer version.
const { app, dialog, shell, Notification, BrowserWindow } = require("electron");
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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "StudioVoxario-Launcher" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(fetchJson(res.headers.location));
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

function downloadFile(url, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? https : http;
    const req = lib.get(url, { headers: { "User-Agent": "StudioVoxario-Launcher" } }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return resolve(downloadFile(res.headers.location, dest, onProgress));
      }
      if (res.statusCode !== 200) return reject(new Error("HTTP " + res.statusCode));
      const total = parseInt(res.headers["content-length"] || "0", 10);
      let received = 0;
      const startTs = Date.now();
      let lastEmit = 0;
      const hash = crypto.createHash("sha256");
      const file = fs.createWriteStream(dest);
      activeDownload = { req, dest };
      res.on("data", (chunk) => {
        received += chunk.length;
        hash.update(chunk);
        const now = Date.now();
        if (onProgress && (now - lastEmit > 200 || (total && received === total))) {
          lastEmit = now;
          const elapsed = (now - startTs) / 1000;
          const speedBps = elapsed > 0 ? received / elapsed : 0;
          const etaSec = total && speedBps > 0 ? (total - received) / speedBps : null;
          try {
            onProgress({
              received,
              total,
              pct: total ? received / total : 0,
              speedBps,
              etaSec,
            });
          } catch {}
        }
      });
      res.pipe(file);
      file.on("finish", () =>
        file.close(() => {
          if (activeDownload && activeDownload.req === req) activeDownload = null;
          resolve({ path: dest, sha256: hash.digest("hex"), size: received });
        })
      );
      file.on("error", (e) => { activeDownload = null; reject(e); });
      res.on("error", (e) => { activeDownload = null; reject(e); });
    });
    req.on("error", (e) => { activeDownload = null; reject(e); });
  });
}

/** Zruší běžící stahování — jádro pro tlačítko „Zrušit" v launcheru. */
function cancelActiveDownload() {
  if (!activeDownload) return false;
  const { req, dest } = activeDownload;
  activeDownload = null;
  try { req.destroy(new Error("canceled")); } catch {}
  setTimeout(() => { try { fs.unlinkSync(dest); } catch {} }, 50);
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


async function checkForUpdates({ silent = true, parentWindow = null } = {}) {
  if (checking) return { status: "busy" };
  checking = true;
  diagnostics.status = "checking";
  diagnostics.lastError = null;
  diagnostics.currentVersion = app.getVersion();
  diagnostics.lastCheckAt = new Date().toISOString();
  log(`Kontrola aktualizací — aktuální verze ${diagnostics.currentVersion}`);
  log(`Stahuji manifest: ${MANIFEST_URL}`);
  try {
    const manifest = await withRetry(() => fetchJson(MANIFEST_URL), { phase: "manifest", label: "Manifest" });
    diagnostics.manifest = manifest;
    const current = app.getVersion();
    const remote = manifest.version;
    diagnostics.remoteVersion = remote;
    log(`Manifest OK — vzdálená verze ${remote}`);
    if (!remote || !isNewer(remote, current)) {
      diagnostics.status = "up-to-date";
      log(`Není novější verze (${current} ≥ ${remote}).`);
      if (!silent) {
        await dialog.showMessageBox(parentWindow, {
          type: "info",
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

    const { response } = await dialog.showMessageBox(parentWindow, {
      type: "question",
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
    log(`Stahování zahájeno → ${dest}`);
    diagnostics.status = "downloading";
    updateProgress({
      phase: "download", label: `Stahuji StudioVoxario ${remote}`,
      received: 0, total: 0, pct: 0, speedBps: 0, etaSec: null,
      canceled: false, startedAt: new Date().toISOString(),
    });

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
    }), { phase: "download", label: "Stažení instalátoru" });

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
      await dialog.showMessageBox(parentWindow, {
        type: "error",
        title: "Aktualizace zamítnuta",
        message: "Chybí kontrolní součet",
        detail:
          "Manifest neobsahuje SHA-256 hash instalátoru, takže integritu nelze ověřit. " +
          "Aktualizace byla z bezpečnostních důvodů zrušena.",
      });
      return { status: "no-hash" };
    }
    if (expectedSize && download.size !== expectedSize) {
      try { fs.unlinkSync(dest); } catch {}
      diagnostics.status = "size-mismatch";
      diagnostics.lastError = `Velikost ${download.size} ≠ ${expectedSize}`;
      log(`CHYBA: nesouhlasí velikost (${download.size} vs ${expectedSize}).`);
      await dialog.showMessageBox(parentWindow, {
        type: "error",
        title: "Aktualizace zamítnuta",
        message: "Neplatná velikost souboru",
        detail: `Očekáváno ${expectedSize} B, staženo ${download.size} B. Soubor byl smazán.`,
      });
      return { status: "size-mismatch" };
    }
    if (download.sha256.toLowerCase() !== expectedHash) {
      try { fs.unlinkSync(dest); } catch {}
      diagnostics.status = "hash-mismatch";
      diagnostics.lastError = `SHA-256 neshoda (očekáváno ${expectedHash}, získáno ${download.sha256})`;
      log("CHYBA: neshoda SHA-256, instalátor smazán.");
      await dialog.showMessageBox(parentWindow, {
        type: "error",
        title: "Aktualizace zamítnuta",
        message: "Ověření integrity selhalo",
        detail:
          `Kontrolní součet staženého instalátoru neodpovídá manifestu.\n\n` +
          `Očekáváno: ${expectedHash}\n` +
          `Získáno:   ${download.sha256}\n\n` +
          `Soubor mohl být poškozen při přenosu nebo podvržen. Byl smazán a nespustí se.`,
      });
      return { status: "hash-mismatch" };
    }

    // Authenticode / codesign verification — chrání i proti platnému hashi z podvrženého manifestu,
    // pokud útočník nemá platný certifikát vydavatele.
    const expectedPublisher = (asset.publisher || manifest.publisher || process.env.STUDIOVOXARIO_EXPECTED_PUBLISHER || null);
    diagnostics.expectedPublisher = expectedPublisher;
    log("Ověřuji digitální podpis instalátoru…");
    const sig = await verifyCodeSignature(dest);
    diagnostics.signatureStatus = sig.status || null;
    diagnostics.signatureSubject = sig.subject || null;
    diagnostics.signatureThumbprint = sig.thumbprint || null;
    diagnostics.signatureTimestamped = sig.timestamped ?? null;

    if (!sig.supported) {
      log(`Podpis nelze ověřit na této platformě (${process.platform}) — přeskočeno.`);
    } else if (!sig.ok) {
      try { fs.unlinkSync(dest); } catch {}
      diagnostics.status = "signature-invalid";
      diagnostics.lastError = `Neplatný podpis: ${sig.status}${sig.error ? " — " + sig.error : ""}`;
      log(`CHYBA: neplatný digitální podpis (${sig.status}). Instalátor smazán.`);
      await dialog.showMessageBox(parentWindow, {
        type: "error",
        title: "Aktualizace zamítnuta",
        message: "Ověření podpisu selhalo",
        detail:
          `Digitální podpis instalátoru je neplatný nebo chybí.\n\n` +
          `Stav: ${sig.status}\n` +
          (sig.statusMessage ? `Zpráva: ${sig.statusMessage}\n` : "") +
          (sig.subject ? `Podepsáno: ${sig.subject}\n` : "") +
          `\nSoubor byl smazán a nespustí se.`,
      });
      return { status: "signature-invalid" };
    } else {
      log(`Podpis OK — ${sig.subject || "(neznámý subjekt)"} [${sig.thumbprint || "-"}]`);
      if (expectedPublisher && sig.subject && !sig.subject.toLowerCase().includes(String(expectedPublisher).toLowerCase())) {
        try { fs.unlinkSync(dest); } catch {}
        diagnostics.status = "publisher-mismatch";
        diagnostics.lastError = `Vydavatel "${sig.subject}" ≠ očekávaný "${expectedPublisher}"`;
        log(`CHYBA: podpis platný, ale vydavatel neodpovídá. Instalátor smazán.`);
        await dialog.showMessageBox(parentWindow, {
          type: "error",
          title: "Aktualizace zamítnuta",
          message: "Neočekávaný vydavatel",
          detail:
            `Instalátor je podepsaný, ale jiným subjektem, než uvádí manifest.\n\n` +
            `Očekáváno: ${expectedPublisher}\n` +
            `Nalezeno:  ${sig.subject}\n\n` +
            `Soubor byl smazán a nespustí se.`,
        });
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
        await dialog.showMessageBox(parentWindow, {
          type: "error",
          title: "Aktualizace zamítnuta",
          message: "Neznámý podepisující certifikát",
          detail:
            `Instalátor je podepsaný certifikátem, který není v seznamu pinovaných ` +
            `otisků aplikace.\n\n` +
            `Nalezený otisk: ${pinCheck.actual || "-"}\n` +
            `Pinované otisky: ${(pinCheck.pins || []).join(", ") || "(žádné)"}\n\n` +
            `Soubor byl smazán a nespustí se.`,
        });
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
      await shell.openPath(dest);
      new Notification({
        title: "StudioVoxario",
        body: "Integrita ověřena. Instalátor se spouští, aplikace se ukončí.",
      }).show();
      setTimeout(() => app.quit(), 1500);
    } else {
      await dialog.showMessageBox(parentWindow, {
        type: "info",
        title: "Aktualizace stažena",
        message: "Instalátor byl stažen a ověřen",
        detail: `${dest}\n\nSHA-256: ${download.sha256}`,
      });
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
    if (!silent && !canceled) {
      await dialog.showMessageBox(parentWindow, {
        type: "error",
        title: "Aktualizace selhala",
        message: "Nepodařilo se zkontrolovat aktualizace",
        detail: msg,
      });
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
  const platform = process.platform;
  const ext = platform === "win32" ? ".exe" : platform === "darwin" ? ".dmg" : ".AppImage";
  const dest = path.join(os.tmpdir(), `StudioVoxario-${version || "asset"}${ext}`);
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

  try {
    updateProgress({
      phase: "download", label: `${label} — stahuji ${version || ""}`,
      received: 0, total: 0, pct: 0, speedBps: 0, etaSec: null,
      canceled: false, startedAt: new Date().toISOString(),
    });
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
    }), { phase: "download", label: `${label}: stažení` });
    progressWin.close();
    log(`${label}: staženo ${download.size} B, SHA-256=${download.sha256}`);

    const expectedHash = String(asset.sha256 || "").toLowerCase().trim();
    const expectedSize = Number(asset.size || 0);
    if (!expectedHash) { try { fs.unlinkSync(dest); } catch {} return { status: "no-hash" }; }
    if (expectedSize && download.size !== expectedSize) { try { fs.unlinkSync(dest); } catch {} return { status: "size-mismatch" }; }
    if (download.sha256.toLowerCase() !== expectedHash) { try { fs.unlinkSync(dest); } catch {} return { status: "hash-mismatch" }; }

    const sig = await verifyCodeSignature(dest);
    if (sig.supported && !sig.ok) { try { fs.unlinkSync(dest); } catch {} return { status: "signature-invalid", sig }; }
    const expectedPublisher = asset.publisher || process.env.STUDIOVOXARIO_EXPECTED_PUBLISHER || null;
    if (sig.supported && expectedPublisher && sig.subject && !sig.subject.toLowerCase().includes(String(expectedPublisher).toLowerCase())) {
      try { fs.unlinkSync(dest); } catch {}
      return { status: "publisher-mismatch", sig };
    }
    if (sig.supported) {
      const pinCheck = pinning.verifyAgainstPins(sig.thumbprint);
      if (!pinCheck.trusted) {
        try { fs.unlinkSync(dest); } catch {}
        log(`${label}: pin-mismatch (${pinCheck.reason}), instalátor zamítnut.`);
        return { status: "pin-mismatch", sig, pinCheck };
      }
      // Rollback NEROTUJE piny — jen ověří.
    }
    log(`${label}: ověřeno (podpis + pin), spouštím instalátor.`);
    updateProgress({ phase: "installing", label: `${label} — instalace`, pct: 1 });

    if (platform === "win32") {
      await shell.openPath(dest);
      new Notification({ title: "StudioVoxario", body: `${label}: instalátor se spouští, aplikace se ukončí.` }).show();
      setTimeout(() => app.quit(), 1500);
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
    return { status: canceled ? "canceled" : "error", error: msg };
  }
}

/** Pouze stáhne manifest — využívá rollback, aby nemusel duplikovat URL. */
async function fetchManifest() {
  return withRetry(() => fetchJson(MANIFEST_URL), { phase: "manifest", label: "Manifest" });
}

module.exports = { checkForUpdates, getDiagnostics, installVerified, fetchManifest, cancelActiveDownload };


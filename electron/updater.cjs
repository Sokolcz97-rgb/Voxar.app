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
      const hash = crypto.createHash("sha256");
      const file = fs.createWriteStream(dest);
      res.on("data", (chunk) => {
        received += chunk.length;
        hash.update(chunk);
        if (onProgress && total) onProgress(received / total);
      });
      res.pipe(file);
      file.on("finish", () =>
        file.close(() => resolve({ path: dest, sha256: hash.digest("hex"), size: received }))
      );
      file.on("error", reject);
    });
    req.on("error", reject);
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
  status: "idle",
  lastError: null,
  lastCheckAt: null,
  logs: [],
};

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
    const manifest = await fetchJson(MANIFEST_URL);
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

    const download = await downloadFile(asset.installerUrl, dest, (p) => {
      const pct = Math.round(p * 100);
      progressWin.webContents
        .executeJavaScript(
          `document.getElementById('f').style.width='${pct}%';document.getElementById('p').textContent='${pct} %';`
        )
        .catch(() => {});
    });

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

    diagnostics.status = "installing";
    log("Integrita OK, spouštím instalátor.");

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
    diagnostics.status = "error";
    diagnostics.lastError = String(err.message || err);
    log(`CHYBA: ${diagnostics.lastError}`);
    if (!silent) {
      await dialog.showMessageBox(parentWindow, {
        type: "error",
        title: "Aktualizace selhala",
        message: "Nepodařilo se zkontrolovat aktualizace",
        detail: String(err.message || err),
      });
    }
    return { status: "error", error: String(err.message || err) };
  } finally {
    checking = false;
  }
}

module.exports = { checkForUpdates, getDiagnostics };

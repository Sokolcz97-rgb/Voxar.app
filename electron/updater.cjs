// StudioVoxario custom launcher-updater
// Fetches a JSON manifest and offers to install a newer version.
const { app, dialog, shell, Notification, BrowserWindow } = require("electron");
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");

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
      const file = fs.createWriteStream(dest);
      res.on("data", (chunk) => {
        received += chunk.length;
        if (onProgress && total) onProgress(received / total);
      });
      res.pipe(file);
      file.on("finish", () => file.close(() => resolve(dest)));
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

async function checkForUpdates({ silent = true, parentWindow = null } = {}) {
  if (checking) return { status: "busy" };
  checking = true;
  try {
    const manifest = await fetchJson(MANIFEST_URL);
    const current = app.getVersion();
    const remote = manifest.version;
    if (!remote || !isNewer(remote, current)) {
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
      return { status: "no-asset" };
    }

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
    if (response !== 0) return { status: "postponed" };

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
      <script>
        const { ipcRenderer } = require ? require('electron') : { ipcRenderer: null };
      </script>
    </body></html>`;
    progressWin.loadURL("data:text/html;charset=utf-8," + encodeURIComponent(html));

    const ext = platform === "win32" ? ".exe" : platform === "darwin" ? ".dmg" : ".AppImage";
    const dest = path.join(os.tmpdir(), `StudioVoxario-${remote}${ext}`);

    await downloadFile(asset.installerUrl, dest, (p) => {
      const pct = Math.round(p * 100);
      progressWin.webContents
        .executeJavaScript(
          `document.getElementById('f').style.width='${pct}%';document.getElementById('p').textContent='${pct} %';`
        )
        .catch(() => {});
    });

    progressWin.close();

    if (platform === "win32") {
      await shell.openPath(dest);
      new Notification({
        title: "StudioVoxario",
        body: "Instalátor se spouští. Aplikace se ukončí.",
      }).show();
      setTimeout(() => app.quit(), 1500);
    } else {
      await dialog.showMessageBox(parentWindow, {
        type: "info",
        title: "Aktualizace stažena",
        message: "Instalátor byl stažen",
        detail: dest,
      });
      shell.showItemInFolder(dest);
    }
    return { status: "installing", version: remote };
  } catch (err) {
    console.error("update check failed", err);
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

module.exports = { checkForUpdates };

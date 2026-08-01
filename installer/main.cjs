/*
 * Voxar.app custom installer — Electron main process.
 *
 * Cíle:
 *  - Žádné volání cmd.exe / .bat / .cmd / powershell.exe.
 *  - Instalace user-scope do %LOCALAPPDATA%\StudioVoxario (žádné UAC).
 *  - Zápis Uninstall registry přes `winreg` (čistý Node).
 *  - Shortcuts přes `windows-shortcuts` (LNK přes ffi/native, bez shellu).
 *  - Rozbalení payloadu (resources/app.7z) přes `node-7z` + přiložený 7za.
 *  - Finální launch aplikace: spawn(exe, [], { detached, windowsHide, stdio: 'ignore' }).unref().
 *  - Uninstall: stejný binary s `--uninstall`, rovněž bez shellu.
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { spawn } = require("child_process");
const Seven = require("node-7z");
const sevenBin = require("7zip-bin");
const Winreg = require("winreg");
const ws = require("windows-shortcuts");

const APP_NAME = "Voxar.app";
const APP_EXE = "Voxar.app.exe";
const DEFAULT_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), APP_NAME);
const REG_UNINSTALL = `\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}`;

const isUninstall = process.argv.includes("--uninstall");

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 760,
    height: 500,
    frame: false,
    transparent: true,
    resizable: false,
    backgroundColor: "#00000000",
    icon: path.join(__dirname, "assets", "icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.setMenu(null);
  win.loadFile(path.join(__dirname, "ui", "index.html"), {
    query: { mode: isUninstall ? "uninstall" : "install" },
  });
  // win.webContents.openDevTools({ mode: "detach" });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ---------- IPC ----------
ipcMain.handle("installer:defaults", () => ({
  appName: APP_NAME,
  version: app.getVersion(),
  defaultDir: DEFAULT_DIR,
  mode: isUninstall ? "uninstall" : "install",
}));

ipcMain.handle("installer:pick-dir", async (_e, current) => {
  const { dialog } = require("electron");
  const res = await dialog.showOpenDialog(win, {
    title: "Zvolte složku instalace",
    defaultPath: current || DEFAULT_DIR,
    properties: ["openDirectory", "createDirectory"],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return path.join(res.filePaths[0], APP_NAME);
});

ipcMain.handle("installer:close", () => {
  app.quit();
});

ipcMain.handle("installer:launch", (_e, dir) => {
  const exe = path.join(dir, APP_EXE);
  if (!fs.existsSync(exe)) throw new Error("Aplikace nebyla nalezena po instalaci");
  const child = spawn(exe, [], { detached: true, windowsHide: true, stdio: "ignore" });
  child.unref();
  setTimeout(() => app.quit(), 300);
});

// ---------- INSTALL ----------
ipcMain.handle("installer:install", async (_e, opts) => {
  const dir = opts?.dir || DEFAULT_DIR;
  const channel = opts?.channel === "beta" ? "beta" : "stable";
  const createDesktopShortcut = opts?.desktopShortcut !== false;

  send("log", `Instaluji do: ${dir}`);
  send("log", `Kanál aktualizací: ${channel}`);

  fs.mkdirSync(dir, { recursive: true });

  // 1) Rozbalit payload. (jediný krok, který smí instalaci zabít)
  const payload = path.join(process.resourcesPath || __dirname, "app.7z");
  if (!fs.existsSync(payload)) throw new Error(`Payload nenalezen: ${payload}`);

  try {
    await extract(payload, dir, (p) => send("progress", { phase: "extract", pct: p }));
  } catch (err) {
    throw new Error(`Rozbalení selhalo: ${err?.message || err}`);
  }

  const exePath = path.join(dir, APP_EXE);
  if (!fs.existsSync(exePath)) {
    throw new Error(`Po rozbalení chybí ${APP_EXE} v ${dir}. Archiv je poškozený nebo neúplný.`);
  }

  // 2) Zapsat channel.json.
  try {
    fs.writeFileSync(
      path.join(dir, "channel.json"),
      JSON.stringify({ channel, chosenAt: new Date().toISOString() }, null, 2),
    );
  } catch (err) {
    send("log", `! channel.json se nepodařilo zapsat: ${err?.message || err}`);
  }

  // 3) Zkratky — selhání nesmí shodit instalaci.
  send("progress", { phase: "shortcuts", pct: 0.9 });
  try {
    await createShortcuts(dir, createDesktopShortcut);
  } catch (err) {
    send("log", `! Zkratky se nepodařilo vytvořit: ${err?.message || err}`);
  }

  // 4) Registry Uninstall — rovněž nefatální.
  send("progress", { phase: "registry", pct: 0.95 });
  try {
    await writeUninstallRegistry(dir);
  } catch (err) {
    send("log", `! Zápis do registru selhal: ${err?.message || err}`);
  }


  // 5) Uložit instalační meta pro uninstaller.
  fs.writeFileSync(
    path.join(dir, "installer.json"),
    JSON.stringify(
      {
        version: app.getVersion(),
        installedAt: new Date().toISOString(),
        installDir: dir,
        desktopShortcut: createDesktopShortcut,
      },
      null,
      2,
    ),
  );

  send("progress", { phase: "done", pct: 1 });
  return { ok: true, dir };
});

// ---------- UNINSTALL ----------
ipcMain.handle("installer:uninstall", async (_e, opts) => {
  const dir = opts?.dir || DEFAULT_DIR;
  send("log", `Odinstalace: ${dir}`);
  await removeShortcuts();
  await removeUninstallRegistry();
  await removeDir(dir, (p) => send("progress", { phase: "remove", pct: p }));
  send("progress", { phase: "done", pct: 1 });
  return { ok: true };
});

// ---------- helpers ----------
function send(event, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(`installer:${event}`, payload);
}

function extract(archive, dest, onProgress) {
  return new Promise((resolve, reject) => {
    const sevenZipBinary = getRunnableSevenZipBinary();
    const stream = Seven.extractFull(archive, dest, {
      $bin: sevenZipBinary,
      $progress: true,
      overwrite: "a",
    });
    stream.on("progress", (p) => {
      const pct = Math.max(0, Math.min(0.85, (Number(p.percent) || 0) / 100 * 0.85));
      onProgress(pct);
    });
    stream.on("end", () => resolve());
    stream.on("error", (err) => reject(err));
  });
}

function getRunnableSevenZipBinary() {
  const candidates = [
    path.join(process.resourcesPath || __dirname, "7za.exe"),
    path.join(__dirname, "resources", "7za.exe"),
    path.join(process.resourcesPath || __dirname, "app", "node_modules", "7zip-bin", "win", "x64", "7za.exe"),
    sevenBin.path7za.replace("app.asar", "app.asar.unpacked"),
    sevenBin.path7za,
  ];
  const found = candidates.find((candidate) => !candidate.includes("app.asar" + path.sep) && fs.existsSync(candidate));
  if (!found) throw new Error(`7-Zip binárka nebyla nalezena: ${candidates.join(" | ")}`);
  return found;
}

function createShortcuts(dir, desktop) {
  const exe = path.join(dir, APP_EXE);
  const startMenu = path.join(process.env.APPDATA || os.homedir(), "Microsoft", "Windows", "Start Menu", "Programs", APP_NAME);
  fs.mkdirSync(startMenu, { recursive: true });

  const tasks = [
    { path: path.join(startMenu, `${APP_NAME}.lnk`), target: exe, icon: exe, desc: "Otevřít Voxar.app" },
  ];
  if (desktop) {
    const desktopDir = path.join(os.homedir(), "Desktop");
    tasks.push({ path: path.join(desktopDir, `${APP_NAME}.lnk`), target: exe, icon: exe, desc: "Otevřít Voxar.app" });
  }
  return Promise.all(
    tasks.map(
      (t) =>
        new Promise((resolve, reject) =>
          ws.create(t.path, { target: t.target, icon: t.icon, desc: t.desc, workingDir: dir }, (err) => (err ? reject(err) : resolve())),
        ),
    ),
  );
}

function removeShortcuts() {
  const startMenu = path.join(process.env.APPDATA || os.homedir(), "Microsoft", "Windows", "Start Menu", "Programs", APP_NAME);
  const desktop = path.join(os.homedir(), "Desktop", `${APP_NAME}.lnk`);
  try { fs.rmSync(startMenu, { recursive: true, force: true }); } catch {}
  try { fs.rmSync(desktop, { force: true }); } catch {}
  return Promise.resolve();
}

function writeUninstallRegistry(dir) {
  const reg = new Winreg({ hive: Winreg.HKCU, key: REG_UNINSTALL });
  const uninstallExe = path.join(dir, "Uninstall.exe");
  // Zkopírovat aktuální installer jako Uninstall.exe.
  try { fs.copyFileSync(process.execPath, uninstallExe); } catch {}

  return new Promise((resolve) => {
    reg.create(() => {
      const entries = [
        ["DisplayName", "REG_SZ", APP_NAME],
        ["DisplayIcon", "REG_SZ", path.join(dir, APP_EXE)],
        ["DisplayVersion", "REG_SZ", app.getVersion()],
        ["Publisher", "REG_SZ", "StudioVoxario"],
        ["InstallLocation", "REG_SZ", dir],
        ["UninstallString", "REG_SZ", `"${uninstallExe}" --uninstall`],
        ["NoModify", "REG_DWORD", "1"],
        ["NoRepair", "REG_DWORD", "1"],
      ];
      let remaining = entries.length;
      entries.forEach(([k, t, v]) => reg.set(k, t, v, () => { if (--remaining === 0) resolve(); }));
    });
  });
}

function removeUninstallRegistry() {
  const reg = new Winreg({ hive: Winreg.HKCU, key: REG_UNINSTALL });
  return new Promise((resolve) => reg.destroy(() => resolve()));
}

async function removeDir(dir, onProgress) {
  try {
    onProgress(0.1);
    fs.rmSync(dir, { recursive: true, force: true });
    onProgress(1);
  } catch (err) {
    throw err;
  }
}

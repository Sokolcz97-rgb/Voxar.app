/*
 * Voxar.app custom installer — Electron main process.
 *
 * JEDEN instalátor pro oba produkty:
 *   - Voxar.app (hlavní aplikace + rozcestník)
 *   - VoxarioBrowser (modul — stejný payload, spouští se s `--browser`)
 * Uživatel si v kroku „Komponenty" vybere aplikaci, prohlížeč nebo obojí.
 *
 * Cíle:
 *  - Žádné volání cmd.exe / .bat / .cmd / powershell.exe.
 *  - Instalace user-scope do %LOCALAPPDATA%\Voxar.app (žádné UAC).
 *  - Zápis Uninstall registry přes `winreg` (čistý Node).
 *  - Shortcuts přes `windows-shortcuts` (LNK přes native, bez shellu).
 *  - Rozbalení payloadu (resources/app.7z) přes `node-7z` + přiložený 7za.
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
const BROWSER_NAME = "VoxarioBrowser";
const DEFAULT_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), APP_NAME);
const UNINSTALL_DIR = path.join(process.env.LOCALAPPDATA || os.homedir(), ".StudioVoxario-uninstaller");
const REG_UNINSTALL = `\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\${APP_NAME}`;

const isUninstall = process.argv.includes("--uninstall");
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const uninstallTarget = targetArg ? decodeURIComponent(targetArg.slice("--target=".length)) : DEFAULT_DIR;

let win;

function createWindow() {
  win = new BrowserWindow({
    width: 760,
    height: 520,
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
  const installerUi = path.join(__dirname, "ui", "index.html");
  if (!fs.existsSync(installerUi)) {
    console.error(`Installer UI nebylo nalezeno: ${installerUi}`);
    return require("electron").dialog.showErrorBox("StudioVoxario Installer", `Chybí soubor uživatelského rozhraní:\n${installerUi}`);
  }
  win.loadFile(installerUi, {
    query: { mode: isUninstall ? "uninstall" : "install" },
  });
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ---------- IPC ----------
ipcMain.handle("installer:defaults", () => ({
  appName: APP_NAME,
  version: app.getVersion(),
  defaultDir: isUninstall ? uninstallTarget : DEFAULT_DIR,
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

ipcMain.handle("installer:minimize", () => {
  try { win?.minimize(); } catch {}
});

ipcMain.handle("installer:close", () => {
  app.quit();
});

ipcMain.handle("installer:launch", (_e, payload) => {
  const dir = typeof payload === "string" ? payload : payload?.dir;
  const target = typeof payload === "object" ? payload?.target : "app";
  const exe = path.join(dir || DEFAULT_DIR, APP_EXE);
  if (!fs.existsSync(exe)) throw new Error("Aplikace nebyla nalezena po instalaci");
  const args = target === "browser" ? ["--browser"] : [];
  const child = spawn(exe, args, { detached: true, windowsHide: true, stdio: "ignore" });
  child.unref();
  setTimeout(() => app.quit(), 300);
});

// ---------- INSTALL ----------
ipcMain.handle("installer:install", async (_e, opts) => {
  const dir = opts?.dir || DEFAULT_DIR;
  const channel = opts?.channel === "beta" ? "beta" : "stable";
  const createDesktopShortcut = opts?.desktopShortcut !== false;
  const components = {
    app: opts?.components?.app !== false,
    browser: !!opts?.components?.browser,
  };
  if (!components.app && !components.browser) components.app = true;
  assertSafeInstallDir(dir);

  send("log", `Instaluji do: ${dir}`);
  send("log", `Komponenty: ${[components.app && APP_NAME, components.browser && BROWSER_NAME].filter(Boolean).join(" + ")}`);
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

  // 1b) modules.json — launcher podle něj pozná, jestli je modul prohlížeče
  //     nainstalovaný (a případně nabídne doinstalování).
  writeJson(path.join(dir, "modules.json"), {
    browser: { installed: !!components.browser, installedAt: components.browser ? new Date().toISOString() : null },
  });

  // 2) Zapsat channel.json.
  writeJson(path.join(dir, "channel.json"), { channel, chosenAt: new Date().toISOString() });

  // 3) Zkratky — selhání nesmí shodit instalaci.
  send("progress", { phase: "shortcuts", pct: 0.9 });
  try {
    await createShortcuts(dir, createDesktopShortcut, components);
  } catch (err) {
    send("log", `! Zkratky se nepodařilo vytvořit: ${err?.message || err}`);
  }

  // 4) Samostatný runtime odinstalátoru + záznam ve Windows.
  send("progress", { phase: "registry", pct: 0.95 });
  try {
    installUninstallerRuntime();
    await writeUninstallRegistry(dir);
  } catch (err) {
    throw new Error(`Vytvoření odinstalátoru selhalo: ${err?.message || err}`);
  }

  // 5) Uložit instalační meta pro uninstaller.
  writeJson(path.join(dir, "installer.json"), {
    version: app.getVersion(),
    installedAt: new Date().toISOString(),
    installDir: dir,
    desktopShortcut: createDesktopShortcut,
    components,
  });

  send("progress", { phase: "done", pct: 1 });
  return { ok: true, dir, components };
});

// ---------- UNINSTALL ----------
ipcMain.handle("installer:uninstall", async (_e, opts) => {
  const dir = opts?.dir || DEFAULT_DIR;
  assertSafeInstallDir(dir);
  send("log", `Odinstalace: ${dir}`);
  await removeDir(dir, (p) => send("progress", { phase: "remove", pct: p }));
  await removeShortcuts();
  await removeUninstallRegistry();
  send("progress", { phase: "done", pct: 1 });
  return { ok: true };
});

// ---------- helpers ----------
function send(event, payload) {
  if (win && !win.isDestroyed()) win.webContents.send(`installer:${event}`, payload);
}

function writeJson(file, data) {
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } catch (err) {
    send("log", `! ${path.basename(file)} se nepodařilo zapsat: ${err?.message || err}`);
  }
}

function assertSafeInstallDir(dir) {
  const resolved = path.resolve(String(dir || ""));
  const root = path.parse(resolved).root;
  const home = path.resolve(os.homedir());
  if (!resolved || resolved === root || resolved === home || resolved.length < root.length + 8) {
    throw new Error("Zvolené umístění není bezpečné pro instalaci nebo odinstalaci.");
  }
}

function copyRuntimeTree(source, destination) {
  const sourceStat = fs.statSync(source);
  if (!sourceStat.isDirectory()) throw new Error(`Runtime instalátoru není složka: ${source}`);
  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(destination, { recursive: true });

  // fs.cpSync(source, destination, { recursive: true }) může v dočasné složce
  // vytvořené 7-Zip SFX na Windows skončit ENOTDIR. Projdeme proto runtime sami
  // a do odinstalátoru nekopírujeme velký instalační payload app.7z.
  const pending = [{ from: source, to: destination, relative: "" }];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const entry of fs.readdirSync(current.from, { withFileTypes: true })) {
      const relative = current.relative ? `${current.relative}/${entry.name}` : entry.name;
      if (relative === "resources/app.7z" || relative.startsWith("resources/app.7z/")) continue;

      const from = path.join(current.from, entry.name);
      const to = path.join(current.to, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(to, { recursive: true });
        pending.push({ from, to, relative });
      } else if (entry.isFile()) {
        fs.copyFileSync(from, to);
      } else if (entry.isSymbolicLink()) {
        const realSource = fs.realpathSync(from);
        const realStat = fs.statSync(realSource);
        if (realStat.isDirectory()) {
          fs.mkdirSync(to, { recursive: true });
          pending.push({ from: realSource, to, relative });
        } else if (realStat.isFile()) {
          fs.copyFileSync(realSource, to);
        }
      }
    }
  }
}

function installUninstallerRuntime() {
  const runtimeDir = path.dirname(process.execPath);
  copyRuntimeTree(runtimeDir, UNINSTALL_DIR);
  const exe = path.join(UNINSTALL_DIR, path.basename(process.execPath));
  if (!fs.existsSync(exe)) throw new Error(`Chybí runtime odinstalátoru: ${exe}`);
  return exe;
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

function createShortcuts(dir, desktop, components) {
  const exe = path.join(dir, APP_EXE);
  const startMenu = path.join(process.env.APPDATA || os.homedir(), "Microsoft", "Windows", "Start Menu", "Programs", APP_NAME);
  fs.mkdirSync(startMenu, { recursive: true });
  const desktopDir = path.join(os.homedir(), "Desktop");

  const tasks = [];
  if (components.app) {
    tasks.push({ path: path.join(startMenu, `${APP_NAME}.lnk`), args: "", desc: `Otevřít ${APP_NAME}` });
    if (desktop) tasks.push({ path: path.join(desktopDir, `${APP_NAME}.lnk`), args: "", desc: `Otevřít ${APP_NAME}` });
  }
  if (components.browser) {
    tasks.push({ path: path.join(startMenu, `${BROWSER_NAME}.lnk`), args: "--browser", desc: `Otevřít ${BROWSER_NAME}` });
    if (desktop) tasks.push({ path: path.join(desktopDir, `${BROWSER_NAME}.lnk`), args: "--browser", desc: `Otevřít ${BROWSER_NAME}` });
  }

  return Promise.all(
    tasks.map(
      (t) =>
        new Promise((resolve, reject) =>
          ws.create(t.path, { target: exe, args: t.args, icon: exe, desc: t.desc, workingDir: dir }, (err) => (err ? reject(err) : resolve())),
        ),
    ),
  );
}

function removeShortcuts() {
  const startMenu = path.join(process.env.APPDATA || os.homedir(), "Microsoft", "Windows", "Start Menu", "Programs", APP_NAME);
  const desktopDir = path.join(os.homedir(), "Desktop");
  try { fs.rmSync(startMenu, { recursive: true, force: true }); } catch {}
  for (const name of [APP_NAME, BROWSER_NAME]) {
    try { fs.rmSync(path.join(desktopDir, `${name}.lnk`), { force: true }); } catch {}
  }
  return Promise.resolve();
}

function writeUninstallRegistry(dir) {
  const reg = new Winreg({ hive: Winreg.HKCU, key: REG_UNINSTALL });
  const uninstallExe = path.join(UNINSTALL_DIR, path.basename(process.execPath));
  if (!fs.existsSync(uninstallExe)) throw new Error("Odinstalátor nebyl správně vytvořen.");
  const uninstallCommand = `"${uninstallExe}" --uninstall --target=${encodeURIComponent(dir)}`;
  const installedSizeKb = Math.min(0x7fffffff, Math.ceil(directorySize(dir) / 1024));
  const installDate = new Date().toISOString().slice(0, 10).replaceAll("-", "");

  return new Promise((resolve) => {
    reg.create(() => {
      const entries = [
        ["DisplayName", "REG_SZ", APP_NAME],
        ["DisplayIcon", "REG_SZ", path.join(dir, APP_EXE)],
        ["DisplayVersion", "REG_SZ", app.getVersion()],
        ["Publisher", "REG_SZ", "StudioVoxario"],
        ["InstallLocation", "REG_SZ", dir],
        ["InstallDate", "REG_SZ", installDate],
        ["UninstallString", "REG_SZ", uninstallCommand],
        ["QuietUninstallString", "REG_SZ", uninstallCommand],
        ["EstimatedSize", "REG_DWORD", String(installedSizeKb)],
        ["NoModify", "REG_DWORD", "1"],
        ["NoRepair", "REG_DWORD", "1"],
      ];
      let remaining = entries.length;
      entries.forEach(([k, t, v]) => reg.set(k, t, v, () => { if (--remaining === 0) resolve(); }));
    });
  });
}

function directorySize(dir) {
  let total = 0;
  const pending = [dir];
  while (pending.length) {
    const current = pending.pop();
    if (!current) continue;
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const itemPath = path.join(current, item.name);
      if (item.isDirectory()) pending.push(itemPath);
      else if (item.isFile()) total += fs.statSync(itemPath).size;
    }
  }
  return total;
}

function removeUninstallRegistry() {
  const reg = new Winreg({ hive: Winreg.HKCU, key: REG_UNINSTALL });
  return new Promise((resolve) => reg.destroy(() => resolve()));
}

async function removeDir(dir, onProgress) {
  onProgress(0.1);
  fs.rmSync(dir, { recursive: true, force: true });
  onProgress(1);
}

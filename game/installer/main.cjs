"use strict";

const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawn } = require("node:child_process");
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
const Seven = require("node-7z");
const sevenBin = require("7zip-bin");
const Winreg = require("winreg");
const shortcuts = require("windows-shortcuts");

let rawFs = fs;
try { rawFs = require("original-fs"); } catch {}

const PRODUCT_NAME = "Ashes of Eryon";
const LAUNCHER_EXE = "Ashes of Eryon Launcher.exe";
const DEFAULT_ROOT = path.join(process.env.LOCALAPPDATA || os.homedir(), "StudioVoxario", "Ashes of Eryon");
const UNINSTALL_RUNTIME = path.join(process.env.LOCALAPPDATA || os.homedir(), "StudioVoxario", "AshesOfEryon-Uninstaller");
const REG_KEY = "\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\StudioVoxario.AshesOfEryon";

const isUninstall = process.argv.includes("--uninstall");
const targetArg = process.argv.find((arg) => arg.startsWith("--target="));
const uninstallTarget = targetArg ? decodeURIComponent(targetArg.slice("--target=".length)) : DEFAULT_ROOT;

let mainWindow = null;
let installInProgress = false;

function resourcePath(name) {
  const packaged = path.join(process.resourcesPath || __dirname, name);
  const dev = path.join(__dirname, "resources", name);
  return fs.existsSync(packaged) ? packaged : dev;
}

function payloadPath() {
  return resourcePath("launcher.7z");
}

function sevenZipPath() {
  const bundled = resourcePath("7za.exe");
  if (fs.existsSync(bundled)) return bundled;
  const unpacked = sevenBin.path7za.replace("app.asar", "app.asar.unpacked");
  if (fs.existsSync(unpacked)) return unpacked;
  return sevenBin.path7za;
}

function safeTarget(value) {
  const resolved = path.resolve(String(value || ""));
  const root = path.parse(resolved).root;
  const home = path.resolve(os.homedir());

  if (!resolved || resolved === root || resolved === home || resolved.length < root.length + 8) {
    throw new Error("Zvolené umístění není bezpečné pro instalaci.");
  }

  return resolved;
}

function findExistingParent(target) {
  let current = path.resolve(target);
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return current;
}

function getDiskInfo(target) {
  try {
    const probe = findExistingParent(target || DEFAULT_ROOT);
    const stat = fs.statfsSync(probe);
    const freeBytes = Number(stat.bavail) * Number(stat.bsize);
    const totalBytes = Number(stat.blocks) * Number(stat.bsize);
    return { freeBytes, totalBytes };
  } catch {
    return { freeBytes: null, totalBytes: null };
  }
}

function archiveSize() {
  try { return fs.statSync(payloadPath()).size; } catch { return 0; }
}

function directorySize(dir) {
  if (!fs.existsSync(dir)) return 0;
  let total = 0;
  const pending = [dir];

  while (pending.length) {
    const current = pending.pop();
    let entries = [];
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }

    for (const entry of entries) {
      const file = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) pending.push(file);
        else if (entry.isFile()) total += fs.statSync(file).size;
      } catch {}
    }
  }
  return total;
}

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, payload);
  }
}

function log(message) {
  send("installer:log", String(message));
}

function progress(phase, pct, detail = "") {
  send("installer:progress", {
    phase,
    pct: Math.max(0, Math.min(1, Number(pct) || 0)),
    detail
  });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 720,
    minWidth: 1120,
    minHeight: 720,
    maxWidth: 1120,
    maxHeight: 720,
    resizable: false,
    frame: false,
    show: false,
    backgroundColor: "#06090d",
    title: isUninstall ? "Ashes of Eryon — Odinstalace" : "Ashes of Eryon — Instalace",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      devTools: !app.isPackaged
    }
  });

  mainWindow.setMenu(null);
  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"), {
    query: { mode: isUninstall ? "uninstall" : "install" }
  });

  mainWindow.once("ready-to-show", () => mainWindow?.show());

  mainWindow.on("close", (event) => {
    if (installInProgress) {
      event.preventDefault();
      send("installer:log", "Instalaci nelze zavřít během zápisu souborů.");
    }
  });

  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    const current = mainWindow?.webContents.getURL();
    if (current && url !== current) event.preventDefault();
  });
}

function extractLauncher(archive, destination) {
  return new Promise((resolve, reject) => {
    const task = Seven.extractFull(archive, destination, {
      $bin: sevenZipPath(),
      $progress: true,
      overwrite: "a"
    });

    task.on("progress", (value) => {
      progress("extract", (Number(value.percent) || 0) / 100 * 0.72, "Rozbalování launcheru");
    });
    task.on("end", resolve);
    task.on("error", reject);
  });
}

function createShortcut(file, target, description) {
  return new Promise((resolve, reject) => {
    shortcuts.create(file, {
      target,
      icon: target,
      desc: description,
      workingDir: path.dirname(target)
    }, (error) => error ? reject(error) : resolve());
  });
}

async function createSelectedShortcuts(root, options) {
  const exe = path.join(root, "Launcher", LAUNCHER_EXE);
  const tasks = [];

  if (options.desktopShortcut) {
    tasks.push(createShortcut(
      path.join(os.homedir(), "Desktop", "Ashes of Eryon.lnk"),
      exe,
      "Spustit Ashes of Eryon"
    ));
  }

  if (options.startShortcut) {
    const startDir = path.join(
      process.env.APPDATA || os.homedir(),
      "Microsoft", "Windows", "Start Menu", "Programs", "Ashes of Eryon"
    );
    fs.mkdirSync(startDir, { recursive: true });
    tasks.push(createShortcut(
      path.join(startDir, "Ashes of Eryon.lnk"),
      exe,
      "Spustit Ashes of Eryon"
    ));
  }

  await Promise.all(tasks);
}

function removeShortcuts() {
  try {
    fs.rmSync(path.join(os.homedir(), "Desktop", "Ashes of Eryon.lnk"), { force: true });
  } catch {}

  try {
    fs.rmSync(
      path.join(process.env.APPDATA || os.homedir(), "Microsoft", "Windows", "Start Menu", "Programs", "Ashes of Eryon"),
      { recursive: true, force: true }
    );
  } catch {}
}

function copyRuntimeTree(source, destination) {
  const previousNoAsar = process.noAsar;
  process.noAsar = true;

  try {
    rawFs.rmSync(destination, { recursive: true, force: true });
    rawFs.mkdirSync(destination, { recursive: true });

    const pending = [{ from: source, to: destination, relative: "" }];
    while (pending.length) {
      const current = pending.pop();
      const entries = rawFs.readdirSync(current.from, { withFileTypes: true });

      for (const entry of entries) {
        const relative = current.relative ? `${current.relative}/${entry.name}` : entry.name;
        if (relative.replaceAll("\\", "/") === "resources/launcher.7z") continue;

        const from = path.join(current.from, entry.name);
        const to = path.join(current.to, entry.name);
        const asar = entry.name.toLowerCase().endsWith(".asar");

        if (entry.isDirectory() && !asar) {
          rawFs.mkdirSync(to, { recursive: true });
          pending.push({ from, to, relative });
        } else if (entry.isFile() || asar) {
          rawFs.copyFileSync(from, to);
        }
      }
    }
  } finally {
    process.noAsar = previousNoAsar;
  }
}

function installUninstallerRuntime() {
  const runtimeDir = path.dirname(process.execPath);
  copyRuntimeTree(runtimeDir, UNINSTALL_RUNTIME);

  const exe = path.join(UNINSTALL_RUNTIME, path.basename(process.execPath));
  if (!fs.existsSync(exe)) throw new Error("Nepodařilo se vytvořit odinstalátor.");
  return exe;
}

function setRegistryValue(reg, name, type, value) {
  return new Promise((resolve) => reg.set(name, type, String(value), () => resolve()));
}

async function writeUninstallRegistry(root) {
  const exe = installUninstallerRuntime();
  const reg = new Winreg({ hive: Winreg.HKCU, key: REG_KEY });
  const command = `"${exe}" --uninstall --target=${encodeURIComponent(root)}`;
  const sizeKb = Math.min(0x7fffffff, Math.ceil(directorySize(root) / 1024));

  await new Promise((resolve) => reg.create(resolve));
  await Promise.all([
    setRegistryValue(reg, "DisplayName", "REG_SZ", PRODUCT_NAME),
    setRegistryValue(reg, "DisplayVersion", "REG_SZ", app.getVersion()),
    setRegistryValue(reg, "Publisher", "REG_SZ", "StudioVoxario"),
    setRegistryValue(reg, "InstallLocation", "REG_SZ", root),
    setRegistryValue(reg, "DisplayIcon", "REG_SZ", path.join(root, "Launcher", LAUNCHER_EXE)),
    setRegistryValue(reg, "UninstallString", "REG_SZ", command),
    setRegistryValue(reg, "QuietUninstallString", "REG_SZ", command),
    setRegistryValue(reg, "EstimatedSize", "REG_DWORD", sizeKb),
    setRegistryValue(reg, "NoModify", "REG_DWORD", 1),
    setRegistryValue(reg, "NoRepair", "REG_DWORD", 1)
  ]);
}

function removeUninstallRegistry() {
  const reg = new Winreg({ hive: Winreg.HKCU, key: REG_KEY });
  return new Promise((resolve) => reg.destroy(() => resolve()));
}

async function installLauncher(options = {}) {
  const root = safeTarget(options.target || DEFAULT_ROOT);
  const launcherDir = path.join(root, "Launcher");
  const parent = path.dirname(root);
  const staging = path.join(parent, `.AshesOfEryon-staging-${process.pid}`);
  const backup = path.join(parent, `.AshesOfEryon-backup-${process.pid}`);
  const archive = payloadPath();

  if (!fs.existsSync(archive)) throw new Error("Instalační balíček launcheru není dostupný.");

  const disk = getDiskInfo(root);
  const required = Math.max(archiveSize() * 2.4, 350 * 1024 * 1024);
  if (disk.freeBytes !== null && disk.freeBytes < required) {
    throw new Error("Na zvoleném disku není dostatek volného místa.");
  }

  installInProgress = true;
  try {
    log(`Cíl instalace: ${root}`);
    progress("prepare", 0.03, "Příprava instalace");

    fs.mkdirSync(parent, { recursive: true });
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(backup, { recursive: true, force: true });
    fs.mkdirSync(staging, { recursive: true });

    await extractLauncher(archive, staging);

    const stagedExe = path.join(staging, LAUNCHER_EXE);
    if (!fs.existsSync(stagedExe)) {
      throw new Error(`Po rozbalení chybí ${LAUNCHER_EXE}.`);
    }

    progress("commit", 0.78, "Aktivace launcheru");
    fs.mkdirSync(root, { recursive: true });

    if (fs.existsSync(launcherDir)) fs.renameSync(launcherDir, backup);
    try {
      fs.renameSync(staging, launcherDir);
    } catch (error) {
      if (fs.existsSync(backup) && !fs.existsSync(launcherDir)) fs.renameSync(backup, launcherDir);
      throw error;
    }
    fs.rmSync(backup, { recursive: true, force: true });

    progress("shortcuts", 0.86, "Vytváření zástupců");
    try {
      await createSelectedShortcuts(root, {
        desktopShortcut: options.desktopShortcut !== false,
        startShortcut: options.startShortcut !== false
      });
    } catch (error) {
      log(`Zástupce se nepodařilo vytvořit: ${error?.message || error}`);
    }

    writeJson(path.join(root, "installer.json"), {
      product: "ashes-of-eryon",
      version: app.getVersion(),
      installedAt: new Date().toISOString(),
      installRoot: root,
      launcher: {
        path: launcherDir,
        executable: LAUNCHER_EXE
      },
      options: {
        desktopShortcut: options.desktopShortcut !== false,
        startShortcut: options.startShortcut !== false,
        autoUpdate: options.autoUpdate !== false,
        diagnostics: Boolean(options.diagnostics)
      }
    });

    progress("registry", 0.94, "Registrace odinstalace");
    try {
      await writeUninstallRegistry(root);
    } catch (error) {
      log(`Odinstalační záznam se nepodařilo vytvořit: ${error?.message || error}`);
    }

    progress("done", 1, "Instalace dokončena");
    return {
      ok: true,
      root,
      launcherExe: path.join(launcherDir, LAUNCHER_EXE)
    };
  } finally {
    installInProgress = false;
    fs.rmSync(staging, { recursive: true, force: true });
    fs.rmSync(backup, { recursive: true, force: true });
  }
}

async function uninstallProduct(options = {}) {
  const root = safeTarget(options.target || uninstallTarget);
  installInProgress = true;

  try {
    progress("remove", 0.15, "Odstraňování launcheru");
    fs.rmSync(path.join(root, "Launcher"), { recursive: true, force: true });

    progress("shortcuts", 0.55, "Odstraňování zástupců");
    removeShortcuts();

    progress("registry", 0.72, "Odstraňování systémového záznamu");
    await removeUninstallRegistry();

    const preserve = ["UserData", "Saves", "Screenshots"];
    if (options.removeUserData) {
      for (const name of preserve) {
        fs.rmSync(path.join(root, name), { recursive: true, force: true });
      }
    }

    fs.rmSync(path.join(root, "installer.json"), { force: true });

    try {
      const remaining = fs.readdirSync(root);
      if (!remaining.length) fs.rmdirSync(root);
    } catch {}

    progress("done", 1, "Odinstalace dokončena");
    return { ok: true, root };
  } finally {
    installInProgress = false;
  }
}

function registerIpc() {
  ipcMain.handle("installer:defaults", () => {
    const target = isUninstall ? uninstallTarget : DEFAULT_ROOT;
    const disk = getDiskInfo(target);
    return {
      productName: PRODUCT_NAME,
      version: app.getVersion(),
      mode: isUninstall ? "uninstall" : "install",
      defaultTarget: target,
      payloadBytes: archiveSize(),
      requiredBytes: Math.max(archiveSize() * 2.4, 350 * 1024 * 1024),
      freeBytes: disk.freeBytes,
      totalBytes: disk.totalBytes
    };
  });

  ipcMain.handle("installer:pick-directory", async (_event, current) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      title: "Vyberte cílovou složku",
      defaultPath: current || DEFAULT_ROOT,
      properties: ["openDirectory", "createDirectory"]
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle("installer:disk-info", (_event, target) => getDiskInfo(target || DEFAULT_ROOT));
  ipcMain.handle("installer:install", (_event, options) => installLauncher(options));
  ipcMain.handle("installer:uninstall", (_event, options) => uninstallProduct(options));

  ipcMain.handle("installer:launch", (_event, target) => {
    const root = safeTarget(target || DEFAULT_ROOT);
    const exe = path.join(root, "Launcher", LAUNCHER_EXE);
    if (!fs.existsSync(exe)) throw new Error("Launcher nebyl nalezen.");
    const child = spawn(exe, [], { detached: true, windowsHide: true, stdio: "ignore" });
    child.unref();
    return { ok: true };
  });

  ipcMain.handle("installer:open-folder", async (_event, target) => {
    const root = safeTarget(target || DEFAULT_ROOT);
    await shell.openPath(root);
    return { ok: true };
  });

  ipcMain.handle("installer:window:minimize", () => mainWindow?.minimize());
  ipcMain.handle("installer:window:close", () => {
    if (installInProgress) return { ok: false, reason: "busy" };
    mainWindow?.close();
    return { ok: true };
  });
}

app.whenReady().then(() => {
  registerIpc();
  createMainWindow();
});

app.on("window-all-closed", () => app.quit());

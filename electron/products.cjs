/*
 * StudioVoxario product registry.
 *
 * The launcher must describe installed products from the file system, not from
 * a UI toggle.  This module deliberately contains no Electron window code so
 * it can be exercised independently and extended with further products.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const PRODUCT_IDS = Object.freeze(["app", "browser"]);

function localAppData() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
}

function productDefinitions() {
  return {
    app: {
      id: "app",
      name: "Voxar.app",
      executable: "Voxar.app.exe",
      installDirectories: [path.join(localAppData(), "Voxar.app")],
      downloadUrl: "https://github.com/Sokolcz97-rgb/Voxar.app/releases/latest/download/StudioVoxarioSetup.exe",
    },
    browser: {
      id: "browser",
      name: "VoxarioBrowser",
      executable: "VoxarioBrowser.exe",
      installDirectories: [
        path.join(localAppData(), "VoxarioBrowser"),
        path.join(localAppData(), "Programs", "VoxarioBrowser"),
      ],
      downloadUrl: "https://github.com/Sokolcz97-rgb/Voxar.app/releases/latest/download/VoxarioBrowserSetup.exe",
    },
  };
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return null; }
}

function installedVersion(executablePath) {
  const installDir = path.dirname(executablePath);
  const candidates = [
    path.join(installDir, "installer.json"),
    path.join(installDir, "resources", "app", "package.json"),
    path.join(installDir, "resources", "app", "product.json"),
  ];
  for (const file of candidates) {
    const value = readJson(file);
    const version = value?.version || value?.appVersion;
    if (typeof version === "string" && version.trim()) return version.trim();
  }
  return null;
}

function inspectProduct(id, { currentExecutable = null, currentVersion = null, browserOnly = false } = {}) {
  const definition = productDefinitions()[id];
  if (!definition) throw new Error(`Unknown StudioVoxario product: ${id}`);

  const candidates = definition.installDirectories.map((dir) => path.join(dir, definition.executable));
  if ((id === "app" && !browserOnly) || (id === "browser" && browserOnly)) {
    if (currentExecutable) candidates.unshift(currentExecutable);
  }

  const executablePath = candidates.find((candidate) => {
    try { return fs.statSync(candidate).isFile(); } catch { return false; }
  }) || null;
  const version = executablePath
    ? (currentExecutable && path.resolve(executablePath) === path.resolve(currentExecutable) ? currentVersion : installedVersion(executablePath))
    : null;

  return {
    id,
    name: definition.name,
    installed: !!executablePath,
    executablePath,
    installDirectory: executablePath ? path.dirname(executablePath) : null,
    version: version || null,
    downloadUrl: definition.downloadUrl,
  };
}

function inspectProducts(context) {
  return Object.fromEntries(PRODUCT_IDS.map((id) => [id, inspectProduct(id, context)]));
}

function launchProduct(product) {
  if (!product?.installed || !product.executablePath) {
    return { ok: false, error: "Produkt není nainstalovaný." };
  }
  try {
    const child = spawn(product.executablePath, [], {
      cwd: product.installDirectory || path.dirname(product.executablePath),
      detached: true,
      windowsHide: true,
      stdio: "ignore",
    });
    child.unref();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error?.message || String(error) };
  }
}

module.exports = { PRODUCT_IDS, productDefinitions, inspectProduct, inspectProducts, launchProduct };

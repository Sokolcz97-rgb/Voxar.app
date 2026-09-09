/*
 * Sbalí HOTOVÝ electron-builder payload (electron/release/win-unpacked)
 * do resources/app.7z a z něj vytvoří vlastní HUD/Electron instalátor.
 *
 * Důležité:
 * - uživatel při první instalaci vidí POUZE vlastní StudioVoxario UI;
 * - technický NSIS balíček StudioVoxarioUpdate-<ver>.exe je určen jen pro
 *   tiché electron-updater aktualizace a není primární download pro web;
 * - win-unpacked už obsahuje resources/app-update.yml, takže custom instalace
 *   je od první verze připravená na auto-update.
 */
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const Seven = require("node-7z");
const sevenBin = require("7zip-bin");

const ROOT = __dirname;
const RESOURCES = path.join(ROOT, "resources");
const OUT_ARCHIVE = path.join(RESOURCES, "app.7z");
const OUT_7ZA = path.join(RESOURCES, "7za.exe");
const productId = process.argv.includes("--product=browser") ? "browser" : "app";
const PRODUCT = productId === "browser"
  ? {
      id: "browser", name: "VoxarioBrowser", executable: "VoxarioBrowser.exe",
      installDirName: "VoxarioBrowser", payload: path.join(ROOT, "..", "electron", "release", "browser", "win-unpacked"),
      installerName: "VoxarioBrowserInstaller", browserOnly: true,
    }
  : {
      id: "app", name: "Voxar.app", executable: "Voxar.app.exe",
      installDirName: "Voxar.app", payload: path.join(ROOT, "..", "electron", "release", "win-unpacked"),
      installerName: "StudioVoxarioInstaller", browserOnly: false,
    };

async function main() {
  if (!fs.existsSync(PRODUCT.payload)) {
    console.error(`✗ Payload nenalezen: ${PRODUCT.payload}`);
    console.error("Nejdříve musí proběhnout electron-builder Windows build.");
    process.exit(1);
  }

  const appExe = path.join(PRODUCT.payload, PRODUCT.executable);
  const updaterConfig = path.join(PRODUCT.payload, "resources", "app-update.yml");
  if (!fs.existsSync(appExe)) {
    console.error(`✗ V payloadu chybí aplikace: ${appExe}`);
    process.exit(1);
  }
  if (!fs.existsSync(updaterConfig)) {
    console.error(`✗ V payloadu chybí updater config: ${updaterConfig}`);
    console.error("Custom instalátor by pak neuměl automatické aktualizace.");
    process.exit(1);
  }

  fs.mkdirSync(RESOURCES, { recursive: true });
  if (fs.existsSync(OUT_ARCHIVE)) fs.rmSync(OUT_ARCHIVE);
  fs.writeFileSync(path.join(RESOURCES, "product.json"), JSON.stringify(PRODUCT, null, 2));
  fs.copyFileSync(sevenBin.path7za, OUT_7ZA);

  console.log(`→ Balím ${PRODUCT.name} payload do vlastního instalátoru:`, PRODUCT.payload);
  await new Promise((resolve, reject) => {
    // `dir\\*` bez -r zachová správnou adresářovou strukturu.
    const s = Seven.add(OUT_ARCHIVE, path.join(PRODUCT.payload, "*"), {
      $bin: sevenBin.path7za,
      method: ["x=9"],
    });
    s.on("end", resolve);
    s.on("error", reject);
    s.on("progress", (p) => process.stdout.write(`\r  komprese ${p.percent}%   `));
  });

  console.log("\n✓ app.7z:", (fs.statSync(OUT_ARCHIVE).size / 1e6).toFixed(1), "MB");
  console.log("→ Balím vlastní HUD installer runtime");

  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "@electron/packager", ".", PRODUCT.installerName,
      "--platform=win32", "--arch=x64",
      "--out=dist", "--overwrite",
      "--icon=assets/icon.ico",
      "--extra-resource=resources/app.7z",
      "--extra-resource=resources/7za.exe",
      "--extra-resource=resources/product.json",
    ],
    { stdio: "inherit", cwd: ROOT, shell: process.platform === "win32" },
  );

  const exe = path.join(ROOT, "dist", `${PRODUCT.installerName}-win32-x64`, `${PRODUCT.installerName}.exe`);
  if (!fs.existsSync(exe)) {
    console.error(`✗ Vlastní installer.exe nebyl vytvořen: ${exe}`);
    process.exit(1);
  }
  console.log(`\n✓ Vlastní HUD instalátor: ${exe}`);
}

main().catch((e) => { console.error(e); process.exit(1); });

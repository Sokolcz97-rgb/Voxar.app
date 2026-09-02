/*
 * Sbalí Voxar.app payload (dist app z electron-release/) do resources/app.7z
 * a spustí @electron/packager --platform=win32 pro vytvoření JEDNOHO instalátoru
 *   dist/StudioVoxarioInstaller-win32-x64/StudioVoxarioInstaller.exe
 *
 * Instalátor umí nainstalovat aplikaci Voxar.app, modul VoxarioBrowser
 * nebo obojí — payload je stejný, prohlížeč se spouští s `--browser`.
 *
 * Použití:
 *   1) Vyrob desktop build:  cd /dev-server && npx vite build && \
 *        npx @electron/packager electron Voxar.app --platform=win32 --arch=x64 \
 *        --out=electron-release --overwrite
 *   2) V této složce:        npm install && node build.cjs
 */
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const Seven = require("node-7z");
const sevenBin = require("7zip-bin");

const ROOT = __dirname;
const RESOURCES = path.join(ROOT, "resources");
const PAYLOAD = path.join(ROOT, "..", "electron-release", "Voxar.app-win32-x64");
const OUT_ARCHIVE = path.join(RESOURCES, "app.7z");
const OUT_7ZA = path.join(RESOURCES, "7za.exe");
const INSTALLER_NAME = "StudioVoxarioInstaller";

async function main() {
  if (!fs.existsSync(PAYLOAD)) {
    console.error(`✗ Payload nenalezen: ${PAYLOAD}`);
    console.error("Nejdříve vyrob Windows build aplikace (viz komentář v build.cjs).");
    process.exit(1);
  }
  fs.mkdirSync(RESOURCES, { recursive: true });
  if (fs.existsSync(OUT_ARCHIVE)) fs.rmSync(OUT_ARCHIVE);
  // Starý per-produkt soubor už se nepoužívá — jeden instalátor pro obojí.
  try { fs.rmSync(path.join(RESOURCES, "product.json"), { force: true }); } catch {}
  fs.copyFileSync(sevenBin.path7za, OUT_7ZA);

  console.log("→ Balím payload:", PAYLOAD);
  await new Promise((resolve, reject) => {
    // Pozor: `-r` (recursive) s wildcardem v 7-Zip rozbíjí strukturu složek —
    // `dir\*` bez -r zabalí obsah včetně podsložek se správnými cestami.
    const s = Seven.add(OUT_ARCHIVE, path.join(PAYLOAD, "*"), { $bin: sevenBin.path7za, method: ["x=9"] });
    s.on("end", resolve); s.on("error", reject);
    s.on("progress", (p) => process.stdout.write(`\r  komprese ${p.percent}%   `));
  });
  console.log("\n✓ Vytvořeno:", OUT_ARCHIVE, "(", (fs.statSync(OUT_ARCHIVE).size / 1e6).toFixed(1), "MB )");

  console.log("→ Balím installer.exe");
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "@electron/packager", ".", INSTALLER_NAME,
      "--platform=win32", "--arch=x64",
      "--out=dist", "--overwrite",
      "--icon=assets/icon.ico",
      "--extra-resource=resources/app.7z",
      "--extra-resource=resources/7za.exe",
    ],
    { stdio: "inherit", cwd: ROOT, shell: process.platform === "win32" },
  );
  console.log(`\n✓ Hotovo: dist/${INSTALLER_NAME}-win32-x64/${INSTALLER_NAME}.exe`);
}

main().catch((e) => { console.error(e); process.exit(1); });

/*
 * Sbalí StudioVoxario payload (dist app z electron-release/) do resources/app.7z
 * a spustí @electron/packager --platform=win32 pro vytvoření
 *   dist/StudioVoxarioInstaller-win32-x64/StudioVoxarioInstaller.exe
 *
 * Použití:
 *   1) Vyrob desktop build:  cd /dev-server && npx vite build && \
 *        npx @electron/packager electron StudioVoxario --platform=win32 --arch=x64 \
 *        --out=electron-release --overwrite
 *   2) V této složce:        npm install && node build.cjs
 *
 * Výsledek: dist/StudioVoxarioInstaller-win32-x64/StudioVoxarioInstaller.exe
 * lze přejmenovat na StudioVoxarioSetup-0.0.9-alpha.exe a nahrát jako CDN asset:
 *   lovable-assets create --file dist/StudioVoxarioInstaller-win32-x64/StudioVoxarioInstaller.exe \
 *     --filename StudioVoxarioSetup-0.0.9-alpha.exe > \
 *     src/assets/downloads/windows-installer.asset.json
 */
const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");
const Seven = require("node-7z");
const sevenBin = require("7zip-bin");

const ROOT = __dirname;
const RESOURCES = path.join(ROOT, "resources");
const PAYLOAD = path.join(ROOT, "..", "electron-release", "StudioVoxario-win32-x64");
const OUT_ARCHIVE = path.join(RESOURCES, "app.7z");

async function main() {
  if (!fs.existsSync(PAYLOAD)) {
    console.error(`✗ Payload nenalezen: ${PAYLOAD}`);
    console.error("Nejdříve vyrob Windows build aplikace (viz komentář v build.cjs).");
    process.exit(1);
  }
  fs.mkdirSync(RESOURCES, { recursive: true });
  if (fs.existsSync(OUT_ARCHIVE)) fs.rmSync(OUT_ARCHIVE);

  console.log("→ Balím payload:", PAYLOAD);
  await new Promise((resolve, reject) => {
    const s = Seven.add(OUT_ARCHIVE, path.join(PAYLOAD, "*"), { $bin: sevenBin.path7za, recursive: true, method: ["x=9"] });
    s.on("end", resolve); s.on("error", reject);
    s.on("progress", (p) => process.stdout.write(`\r  komprese ${p.percent}%   `));
  });
  console.log("\n✓ Vytvořeno:", OUT_ARCHIVE, "(", (fs.statSync(OUT_ARCHIVE).size / 1e6).toFixed(1), "MB )");

  console.log("→ Balím installer.exe");
  execFileSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    [
      "@electron/packager", ".", "StudioVoxarioInstaller",
      "--platform=win32", "--arch=x64",
      "--out=dist", "--overwrite",
      "--icon=assets/icon.ico",
      "--extra-resource=resources/app.7z",
    ],
    { stdio: "inherit", cwd: ROOT, shell: process.platform === "win32" },
  );
  console.log("\n✓ Hotovo: dist/StudioVoxarioInstaller-win32-x64/StudioVoxarioInstaller.exe");
}

main().catch((e) => { console.error(e); process.exit(1); });

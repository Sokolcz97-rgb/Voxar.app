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
const PAYLOAD = path.join(ROOT, "..", "electron-release", "Voxar.app-win32-x64");
const OUT_ARCHIVE = path.join(RESOURCES, "app.7z");
const OUT_7ZA = path.join(RESOURCES, "7za.exe");
const OUT_PRODUCT = path.join(RESOURCES, "product.json");

// Který produkt balíme? Stejný payload (build Voxar.app) slouží oběma:
//   PRODUCT=app     → Voxar.app (rozcestník)
//   PRODUCT=browser → VoxarioBrowser (spustí se rovnou prohlížeč)
const PRODUCTS = {
  app: { id: "voxar-app", name: "Voxar.app", exe: "Voxar.app.exe", args: [], browserOnly: false, installerName: "StudioVoxarioInstaller" },
  browser: { id: "voxario-browser", name: "VoxarioBrowser", exe: "Voxar.app.exe", args: ["--browser"], browserOnly: true, installerName: "VoxarioBrowserInstaller" },
};
const PRODUCT = PRODUCTS[process.env.PRODUCT || "app"];
if (!PRODUCT) { console.error(`✗ Neznámý PRODUCT: ${process.env.PRODUCT}`); process.exit(1); }

async function main() {
  if (!fs.existsSync(PAYLOAD)) {
    console.error(`✗ Payload nenalezen: ${PAYLOAD}`);
    console.error("Nejdříve vyrob Windows build aplikace (viz komentář v build.cjs).");
    process.exit(1);
  }
  fs.mkdirSync(RESOURCES, { recursive: true });
  if (fs.existsSync(OUT_ARCHIVE)) fs.rmSync(OUT_ARCHIVE);
  fs.copyFileSync(sevenBin.path7za, OUT_7ZA);
  fs.writeFileSync(OUT_PRODUCT, JSON.stringify(PRODUCT, null, 2));
  console.log("→ Produkt:", PRODUCT.name);

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
  console.log(`\n✓ Hotovo: dist/${PRODUCT.installerName}-win32-x64/${PRODUCT.installerName}.exe`);
}

main().catch((e) => { console.error(e); process.exit(1); });

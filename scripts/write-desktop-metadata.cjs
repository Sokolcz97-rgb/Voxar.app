#!/usr/bin/env node
/*
 * Zapíše metadata pro webovou download stránku a kompatibilní bootstrap feed
 * pro STARÉ instalace (0.0.13 a podobné), které ještě používají generic feed
 * https://studiovoxario.com/latest.yml.
 *
 * Nové instalace používají výhradně GitHub provider z app-update.yml, který
 * generuje electron-builder (electron/package.json -> build.publish).
 * public/latest.yml a public/beta.yml jsou pouze migrační most, aby starý
 * klient dokázal jednou přejít na nový NSIS/electron-builder balíček.
 *
 * Použití:
 *   node scripts/write-desktop-metadata.cjs <version> <owner/repo> [releaseDir]
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const version = process.argv[2] || require(path.join(root, "electron", "package.json")).version;
const repo = process.argv[3] || "Sokolcz97-rgb/Voxar.app";
const releaseDir = path.resolve(process.argv[4] || path.join(root, "electron", "release"));

const filename = `StudioVoxarioSetup-${version}.exe`;
const exePath = path.join(releaseDir, filename);
const releaseBaseUrl = `https://github.com/${repo}/releases/download/v${version}/`;
const url = `${releaseBaseUrl}${filename}`;

let size = 0;
let sha256 = "";
if (fs.existsSync(exePath)) {
  const buf = fs.readFileSync(exePath);
  size = buf.length;
  sha256 = crypto.createHash("sha256").update(buf).digest("hex");
}

const manifest = {
  _comment: "Informativní metadata pro web. Nové instalace používají latest.yml v GitHub Release.",
  version,
  notes: `StudioVoxario ${version}`,
  url,
  sha256,
  size,
  filename,
  channels: {
    stable: { version, url },
    beta: { version, url },
  },
  updated_at: new Date().toISOString(),
};

const publicDir = path.join(root, "public");
fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, "desktop-version.json"), JSON.stringify(manifest, null, 2) + "\n");

const assetDir = path.join(root, "src", "assets", "downloads");
fs.mkdirSync(assetDir, { recursive: true });
fs.writeFileSync(
  path.join(assetDir, "windows-installer.asset.json"),
  JSON.stringify(
    {
      version: 1,
      url,
      original_filename: filename,
      size,
      sha256,
      content_type: "application/x-msdownload",
      source: "github-release",
      tag: `v${version}`,
      updated_at: new Date().toISOString(),
    },
    null,
    2,
  ) + "\n",
);

// ---------------------------------------------------------------------------
// Legacy bootstrap feed
// ---------------------------------------------------------------------------
// Staré instalace StudioVoxario/VoxarioBrowseru používaly generic provider
// s base URL https://studiovoxario.com/. Takový klient vždy hledá /latest.yml
// (nebo /beta.yml). Vygenerovaný electron-builder feed proto zkopírujeme do
// Vite public/ a cesty k instalátoru změníme na absolutní GitHub Release URL.
//
// Po první úspěšné migraci už nová instalace čte app-update.yml z balíčku a
// další aktualizace jdou přímo přes GitHub provider. Webový bootstrap tedy
// není druhý updater mechanismus pro nové verze, jen kompatibilita se starými.
const sourceLatestYml = path.join(releaseDir, "latest.yml");
if (!fs.existsSync(sourceLatestYml)) {
  throw new Error(`Chybí ${sourceLatestYml}; nelze vytvořit legacy bootstrap feed.`);
}

function stripYamlQuotes(value) {
  const trimmed = String(value || "").trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function absoluteReleaseAsset(value) {
  const clean = stripYamlQuotes(value);
  if (/^https?:\/\//i.test(clean)) return clean;
  return `${releaseBaseUrl}${clean.replace(/^\.\//, "")}`;
}

let legacyYml = fs.readFileSync(sourceLatestYml, "utf8");

// Moderní files[] metadata.
legacyYml = legacyYml.replace(/^(\s*-\s+url:\s*)(.+)$/gm, (_match, prefix, value) => {
  return `${prefix}${absoluteReleaseAsset(value)}`;
});

// Legacy top-level path metadata (electron-builder 24 ho stále generuje).
legacyYml = legacyYml.replace(/^(path:\s*)(.+)$/m, (_match, prefix, value) => {
  return `${prefix}${absoluteReleaseAsset(value)}`;
});

fs.writeFileSync(path.join(publicDir, "latest.yml"), legacyYml);
// Staré beta klienty musí mít také platný feed. Do migrace používají stejnou
// aktuální stabilní verzi; po přechodu už kanál řeší GitHub/app-update.yml.
fs.writeFileSync(path.join(publicDir, "beta.yml"), legacyYml);

console.log(`✓ Metadata pro ${version} zapsána (${url})`);
console.log("✓ Legacy bootstrap feed: public/latest.yml + public/beta.yml");

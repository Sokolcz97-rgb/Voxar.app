#!/usr/bin/env node
/*
 * Zapíše metadata pro webovou download stránku a kompatibilní bootstrap feed
 * pro STARÉ instalace (0.0.13 a podobné), které ještě používají generic feed
 * https://studiovoxario.com/latest.yml.
 *
 * Webový download používá STÁLÝ alias:
 *   /releases/latest/download/StudioVoxarioSetup.exe
 * takže kvůli každé nové desktop verzi není nutné znovu publikovat web.
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

const versionedFilename = `StudioVoxarioSetup-${version}.exe`;
const publicFilename = "StudioVoxarioSetup.exe";
const exePath = path.join(releaseDir, versionedFilename);
const releaseBaseUrl = `https://github.com/${repo}/releases/download/v${version}/`;
const stableWebUrl = `https://github.com/${repo}/releases/latest/download/${publicFilename}`;

let size = 0;
let sha256 = "";
if (fs.existsSync(exePath)) {
  const buf = fs.readFileSync(exePath);
  size = buf.length;
  sha256 = crypto.createHash("sha256").update(buf).digest("hex");
}

const manifest = {
  _comment: "Informativní metadata pro web. Stálý URL alias vždy stáhne nejnovější vlastní Setup; auto-update používá latest.yml.",
  version,
  notes: `StudioVoxario ${version}`,
  url: stableWebUrl,
  sha256,
  size,
  filename: publicFilename,
  versioned_filename: versionedFilename,
  channels: {
    stable: { version, url: stableWebUrl },
    beta: { version, url: stableWebUrl },
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
      app_version: version,
      url: stableWebUrl,
      original_filename: publicFilename,
      versioned_filename: versionedFilename,
      size,
      sha256,
      content_type: "application/x-msdownload",
      source: "github-release-latest",
      tag: "latest",
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
// Vite public/ a cesty k technickému update instalátoru změníme na absolutní
// URL konkrétního version releasu.
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

legacyYml = legacyYml.replace(/^(\s*-\s+url:\s*)(.+)$/gm, (_match, prefix, value) => {
  return `${prefix}${absoluteReleaseAsset(value)}`;
});

legacyYml = legacyYml.replace(/^(path:\s*)(.+)$/m, (_match, prefix, value) => {
  return `${prefix}${absoluteReleaseAsset(value)}`;
});

fs.writeFileSync(path.join(publicDir, "latest.yml"), legacyYml);
fs.writeFileSync(path.join(publicDir, "beta.yml"), legacyYml);

console.log(`✓ Web metadata pro ${version}: ${stableWebUrl}`);
console.log("✓ Legacy bootstrap feed: public/latest.yml + public/beta.yml");

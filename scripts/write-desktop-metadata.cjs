#!/usr/bin/env node
/*
 * Zapíše POUZE informativní metadata pro web (download stránka).
 * NENÍ to update feed — electron-updater používá výhradně latest.yml
 * z GitHub Release (provider: github, viz electron/package.json → build.publish).
 *
 * Použití: node scripts/write-desktop-metadata.cjs <version> <owner/repo> [releaseDir]
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
const url = `https://github.com/${repo}/releases/download/v${version}/${filename}`;

let size = 0;
let sha256 = "";
if (fs.existsSync(exePath)) {
  const buf = fs.readFileSync(exePath);
  size = buf.length;
  sha256 = crypto.createHash("sha256").update(buf).digest("hex");
}

const manifest = {
  _comment: "Informativní metadata pro web. Update feed je latest.yml v GitHub Release.",
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

fs.mkdirSync(path.join(root, "public"), { recursive: true });
fs.writeFileSync(path.join(root, "public", "desktop-version.json"), JSON.stringify(manifest, null, 2) + "\n");

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

console.log(`✓ Metadata pro ${version} zapsána (${url})`);

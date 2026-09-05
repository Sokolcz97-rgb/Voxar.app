#!/usr/bin/env node
/*
 * Ověří technický electron-updater feed.
 * Viditelný vlastní instalátor se jmenuje StudioVoxarioSetup-<version>.exe,
 * ale latest.yml MUSÍ odkazovat na skrytý technický NSIS balíček
 * StudioVoxarioUpdate-<version>.exe.
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = path.resolve(__dirname, "..");
const version = process.argv[2] || require(path.join(root, "electron", "package.json")).version;
const releaseDir = path.resolve(process.argv[3] || path.join(root, "electron", "release"));

const fail = (m) => { console.error(`✗ ${m}`); process.exitCode = 1; };
const ok = (m) => console.log(`✓ ${m}`);

if (!fs.existsSync(releaseDir)) {
  console.error(`✗ Release adresář neexistuje: ${releaseDir}`);
  process.exit(1);
}

const files = fs.readdirSync(releaseDir);
console.log(`Release dir: ${releaseDir}`);
console.log(files.map((f) => `  - ${f}`).join("\n"));

const exeName = `StudioVoxarioUpdate-${version}.exe`;
const exePath = path.join(releaseDir, exeName);
if (!fs.existsSync(exePath)) fail(`chybí updater NSIS balíček ${exeName}`); else ok(`Updater NSIS balíček ${exeName}`);

const isPrerelease = /-/.test(version);
const ymlName = isPrerelease ? "beta.yml" : "latest.yml";
const ymlPath = path.join(releaseDir, ymlName);
if (!fs.existsSync(ymlPath)) {
  fail(`chybí ${ymlName} — electron-updater feed je nekompletní`);
} else {
  ok(`${ymlName} vygenerováno`);
  const yml = fs.readFileSync(ymlPath, "utf8");
  console.log(yml.split("\n").map((l) => `    ${l}`).join("\n"));

  const ymlVersion = (yml.match(/^version:\s*(.+)$/m) || [])[1]?.trim();
  if (ymlVersion !== version) fail(`${ymlName} version=${ymlVersion}, očekáváno ${version}`);
  else ok(`${ymlName} version == ${version}`);

  const ymlPathField = (yml.match(/^path:\s*(.+)$/m) || [])[1]?.trim();
  if (ymlPathField !== exeName) fail(`${ymlName} path=${ymlPathField}, očekáváno ${exeName}`);
  else ok(`${ymlName} path == ${exeName}`);

  const ymlSha = (yml.match(/^\s*sha512:\s*(.+)$/m) || [])[1]?.trim();
  if (fs.existsSync(exePath) && ymlSha) {
    const actual = crypto.createHash("sha512").update(fs.readFileSync(exePath)).digest("base64");
    if (actual !== ymlSha) fail(`sha512 v ${ymlName} neodpovídá updater .exe`);
    else ok("sha512 checksum updateru souhlasí");
  }
}

const blockmap = files.find((f) => f.endsWith(".exe.blockmap"));
if (blockmap) ok(`blockmap ${blockmap}`);
else console.log("· blockmap nevygenerován (differentialPackage vypnutý) — volitelné");

if (process.exitCode) {
  console.error("\n✗ Electron-updater feed není kompletní.");
} else {
  console.log("\n✓ Kompletní electron-updater feed.");
}

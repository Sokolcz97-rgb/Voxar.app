"use strict";

/**
 * Připraví aktualizaci launcheru pro bucket `game-updates`.
 *
 *   node make-update.cjs <složka resources z win-unpacked> <výstup>
 *
 * Výstup: <výstup>/latest.json + <výstup>/<verze>/… (app.asar a launcher-ui).
 * Obsah výstupu se nahraje do game-updates/launcher/ (latest.json jako poslední).
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const pkg = require("./package.json");

const [, , resourcesDir, outDir] = process.argv;
if (!resourcesDir || !outDir) {
  console.error("Použití: node make-update.cjs <resources> <výstup>");
  process.exit(1);
}

const version = pkg.version;
const electron = String(pkg.devDependencies.electron).replace(/^[^0-9]*/, "");
const files = [];

function add(rel) {
  const src = path.join(resourcesDir, ...rel.split("/"));
  const data = fs.readFileSync(src);
  const target = path.join(outDir, version, ...rel.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, data);
  files.push({
    path: `resources/${rel}`,
    url: `${version}/${rel}`,
    sha256: crypto.createHash("sha256").update(data).digest("hex"),
    size: data.length,
  });
}

process.noAsar = true;
add("app.asar");
const ui = path.join(resourcesDir, "launcher-ui");
const walk = (dir, prefix) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), rel);
    else add(`launcher-ui/${rel}`);
  }
};
walk(ui, "");

const manifest = { version, electron, publishedAt: new Date().toISOString(), files };
fs.writeFileSync(path.join(outDir, "latest.json"), JSON.stringify(manifest, null, 2));
console.log(`Aktualizace ${version} (Electron ${electron}): ${files.length} souborů`);

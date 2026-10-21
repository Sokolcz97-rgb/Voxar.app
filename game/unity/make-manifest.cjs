#!/usr/bin/env node
"use strict";

/**
 * Připraví Unity sestavení k nahrání do bucketu game-builds/unity:
 *   node game/unity/make-manifest.cjs <složka sestavení> <výstup> <verze>
 * Výstup: <výstup>/<verze>/<soubory> (velké soubory rozdělené na .partN) a <výstup>/latest.json.
 */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const PART = 45 * 1024 * 1024;
const [src, out, version] = process.argv.slice(2);
if (!src || !out || !version) {
  console.error("Použití: make-manifest.cjs <build> <out> <verze>");
  process.exit(1);
}

const skip = /(_BurstDebugInformation_DoNotShip|_BackUpThisFolder_ButDontShipItWithYourGame)/;
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (skip.test(p)) continue;
    if (e.isDirectory()) walk(p);
    else files.push(p);
  }
})(src);

const exe = files.map((f) => path.relative(src, f)).find((f) => /^[^/\\]+\.exe$/i.test(f) && !/UnityCrashHandler/i.test(f));
if (!exe) throw new Error("Ve složce není .exe hry");

const manifest = { version, exe, publishedAt: new Date().toISOString(), files: [] };
for (const file of files) {
  const rel = path.relative(src, file).split(path.sep).join("/");
  const data = fs.readFileSync(file);
  const url = `${version}/${rel}`;
  const target = path.join(out, ...url.split("/"));
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const parts = Math.ceil(data.length / PART) || 1;
  if (parts > 1) {
    for (let i = 0; i < parts; i += 1) fs.writeFileSync(`${target}.part${i + 1}`, data.subarray(i * PART, (i + 1) * PART));
  } else {
    fs.writeFileSync(target, data);
  }
  manifest.files.push({ path: rel, url, size: data.length, sha256: crypto.createHash("sha256").update(data).digest("hex"), ...(parts > 1 ? { parts } : {}) });
}
fs.writeFileSync(path.join(out, "latest.json"), JSON.stringify(manifest, null, 2));
const total = manifest.files.reduce((a, f) => a + f.size, 0);
console.log(`${manifest.files.length} souborů, ${(total / 1048576).toFixed(1)} MB, exe ${exe}`);

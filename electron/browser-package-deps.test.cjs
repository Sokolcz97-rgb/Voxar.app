"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const builder = JSON.parse(fs.readFileSync(path.join(root, "browser-builder.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const files = new Set(builder.files || []);

assert.equal(builder.extraMetadata?.browserOnly, true, "Standalone Browser package must keep browserOnly metadata");
assert.equal(pkg.main, "assets/bootstrap-secure.cjs", "Secure Browser bootstrap must stay the packaged main entrypoint");
assert.ok(files.has("assets/**/*"), "Browser package must include secure bootstrap assets");
assert.ok(files.has("bootstrap-utf8.cjs"), "Browser package must include bootstrap-utf8.cjs");
assert.ok(files.has("bootstrap.cjs"), "Browser package must include bootstrap.cjs");

function normalizeRelative(value) {
  return value.split(path.sep).join("/");
}

function isPackaged(rel) {
  const normalized = normalizeRelative(rel);
  if (files.has(normalized)) return true;
  for (const entry of files) {
    if (!entry.endsWith("/**/*")) continue;
    const prefix = entry.slice(0, -4);
    if (normalized === prefix.slice(0, -1) || normalized.startsWith(prefix)) return true;
  }
  return false;
}

function resolveLocalRequire(fromRel, request) {
  if (!request.startsWith(".")) return null;
  const base = path.resolve(root, path.dirname(fromRel), request);
  const candidates = [
    base,
    `${base}.cjs`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    path.join(base, "index.cjs"),
    path.join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (!candidate.startsWith(root + path.sep) && candidate !== root) continue;
    try {
      if (fs.statSync(candidate).isFile()) return normalizeRelative(path.relative(root, candidate));
    } catch {}
  }
  return null;
}

// Walk the static relative require() graph that can execute during Browser
// startup. This catches the whole dependency chain, not just the first missing
// file. It would have caught both v0.0.64 (protect-firewall.cjs) and v0.0.65
// (protect-preferences.cjs) before publishing the installer.
const roots = [pkg.main, "preload.cjs", "settings-preload.cjs"];
const queue = [...roots];
const visited = new Set();
const missingFromPackage = [];
const unresolvedLocalRequires = [];

while (queue.length) {
  const rel = normalizeRelative(queue.shift());
  if (visited.has(rel)) continue;
  visited.add(rel);

  const abs = path.join(root, rel);
  assert.ok(fs.existsSync(abs), `Startup dependency is missing from source: ${rel}`);
  assert.ok(isPackaged(rel), `browser-builder.json must package startup dependency: ${rel}`);

  if (!/\.(?:cjs|mjs|js)$/i.test(rel)) continue;
  const source = fs.readFileSync(abs, "utf8");
  const requireRe = /require\(\s*["']([^"']+)["']\s*\)/g;
  for (const match of source.matchAll(requireRe)) {
    const request = match[1];
    if (!request.startsWith(".")) continue;
    const resolved = resolveLocalRequire(rel, request);
    if (!resolved) {
      unresolvedLocalRequires.push(`${rel} -> ${request}`);
      continue;
    }
    if (!isPackaged(resolved)) missingFromPackage.push(`${rel} -> ${resolved}`);
    queue.push(resolved);
  }
}

assert.deepEqual(
  unresolvedLocalRequires,
  [],
  `Local startup require() could not be resolved:\n${unresolvedLocalRequires.join("\n")}`,
);
assert.deepEqual(
  missingFromPackage,
  [],
  `Standalone Browser ASAR would miss startup dependencies:\n${missingFromPackage.join("\n")}`,
);

// Explicit product-security guardrails on top of the dependency walker.
for (const required of [
  "protect-firewall.cjs",
  "protect-preferences.cjs",
  "protect-background.cjs",
  "protect-trust-engine.cjs",
  "protect-layered-engine.cjs",
  "protect-version.cjs",
]) {
  assert.ok(files.has(required), `Standalone Browser package must include ${required}`);
}

const secureBootstrap = fs.readFileSync(path.join(root, "assets", "bootstrap-secure.cjs"), "utf8");
assert.match(secureBootstrap, /require\(["']\.\/browser-password-security\.cjs["']\)/, "Secure bootstrap must load password security first");
assert.match(secureBootstrap, /require\(["']\.\.\/bootstrap-utf8\.cjs["']\)/, "Secure bootstrap must continue into the desktop bootstrap");

console.log(`✓ VoxarioBrowser startup dependency closure is packaged (${visited.size} local files checked)`);

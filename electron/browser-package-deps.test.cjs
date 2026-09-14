"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const builder = JSON.parse(fs.readFileSync(path.join(root, "browser-builder.json"), "utf8"));
const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const bootstrapUtf8 = fs.readFileSync(path.join(root, "bootstrap-utf8.cjs"), "utf8");
const secureBootstrap = fs.readFileSync(path.join(root, "assets", "bootstrap-secure.cjs"), "utf8");
const files = new Set(builder.files || []);

assert.equal(builder.extraMetadata?.browserOnly, true, "Standalone Browser package must keep browserOnly metadata");
assert.equal(pkg.main, "assets/bootstrap-secure.cjs", "Secure Browser bootstrap must stay the packaged main entrypoint");
assert.ok(files.has("assets/**/*"), "Browser package must include secure bootstrap assets");
assert.ok(files.has("bootstrap-utf8.cjs"), "Browser package must include bootstrap-utf8.cjs");
assert.ok(files.has("bootstrap.cjs"), "Browser package must include bootstrap.cjs");

// Regression for v0.0.64: bootstrap-utf8.cjs loads the Protect firewall bridge
// before main.cjs. Electron Builder does not fail when that runtime dependency
// is omitted, so the installed Browser crashed with MODULE_NOT_FOUND at launch.
if (/require\(["']\.\/protect-firewall\.cjs["']\)/.test(bootstrapUtf8)) {
  assert.ok(
    files.has("protect-firewall.cjs"),
    "browser-builder.json must package protect-firewall.cjs because bootstrap-utf8.cjs requires it at startup",
  );
}

assert.match(secureBootstrap, /require\(["']\.\/browser-password-security\.cjs["']\)/, "Secure bootstrap must load password security first");
assert.match(secureBootstrap, /require\(["']\.\.\/bootstrap-utf8\.cjs["']\)/, "Secure bootstrap must continue into the desktop bootstrap");
assert.ok(fs.existsSync(path.join(root, "protect-firewall.cjs")), "Protect firewall runtime dependency must exist in source");
assert.ok(fs.existsSync(path.join(root, "assets", "browser-password-security.cjs")), "Secure password runtime must exist in source");

console.log("✓ VoxarioBrowser packaged startup dependencies are complete");

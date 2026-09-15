"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "browser.html"), "utf8");
const monitor = fs.readFileSync(path.join(root, "assets", "browser-resource-monitor.cjs"), "utf8");
const bootstrap = fs.readFileSync(path.join(root, "assets", "bootstrap-secure.cjs"), "utf8");
const css = fs.readFileSync(path.join(root, "assets", "browser-unified.css"), "utf8");

for (const selector of ["class=\"dock\"", "class=\"tabbar\"", "class=\"navbar\"", "class=\"bookmark-shell\"", "class=\"viewport\""]) {
  assert.ok(html.includes(selector), `Browser UI must retain ${selector}`);
}
assert.match(monitor, /navbar\.insertBefore\(hud, anchor\)/, "HUD must be injected into navbar before its anchor");
assert.doesNotMatch(monitor, /\.tabbar\s*\{/, "HUD injection must not restyle or replace the tabbar");
assert.match(monitor, /document\.getElementById\("vbResourceHud"\)/, "HUD injection must be idempotent");
assert.match(monitor, /document\.getElementById\("voxario-resource-hud-style"\)/, "HUD styles must be idempotent");
assert.match(bootstrap, /require\(["']\.\/browser-resource-monitor\.cjs["']\)/, "Secure bootstrap must load the resource monitor");
assert.match(css, /--vb-sidebar-width:84px/, "Sidebar width must have one central 84px token");

console.log("✓ VoxarioBrowser UI shell and HUD injection structure passed");

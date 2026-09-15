"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const html = fs.readFileSync(path.join(root, "browser.html"), "utf8");
const monitor = fs.readFileSync(path.join(root, "assets", "browser-resource-monitor.cjs"), "utf8");
const chromeFit = fs.readFileSync(path.join(root, "assets", "browser-chrome-fit.cjs"), "utf8");
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
assert.match(bootstrap, /require\(["']\.\/browser-chrome-fit\.cjs["']\)/, "Secure bootstrap must load browser chrome fit");
assert.match(chromeFit, /\.navbar\{[\s\S]*height:46px!important/, "Top navigation must stay compact");
assert.match(chromeFit, /\.newtab\{[\s\S]*position:sticky!important[\s\S]*right:112px!important/, "New-tab control must stay visible next to overflowing tabs");
assert.match(chromeFit, /\.tabbar\{padding-right:116px!important\}/, "Tab strip must reserve only the Windows control area");
assert.doesNotMatch(chromeFit, /zoom\s*:/i, "Chrome fit must never zoom loaded web pages");
assert.match(css, /--vb-sidebar-width:84px/, "Sidebar width must have one central 84px token");

console.log("✓ VoxarioBrowser UI shell, compact chrome and HUD injection structure passed");

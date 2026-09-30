"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const ui = fs.readFileSync(path.join(root, "assets", "protect-ui-v27.js"), "utf8");
const html = fs.readFileSync(path.join(root, "protect.html"), "utf8");
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const preload = fs.readFileSync(path.join(root, "preload.cjs"), "utf8");
const version = require("./protect-version.cjs");

assert.equal(version.version, "2.7");
assert.match(html, /assets\/protect-ui-v27\.js/);
assert.doesNotMatch(html, /VoxarioProtect v2\.4/);
assert.match(ui, /Stabilita \/ životnost/);
assert.match(ui, /ŽIVOTNOST \/ UPTIME/);
assert.match(ui, /AKTUALIZACE/);
assert.match(ui, /protectGetRuntimeHealth/);
assert.match(ui, /checkUpdatesQuiet/);
assert.match(preload, /protectGetRuntimeHealth: \(\) => ipcRenderer\.invoke\("protect:runtime-health"\)/);
assert.match(main, /ipcMain\.handle\("protect:runtime-health"/);
assert.match(main, /parentWindow: mainWindow \|\| protectWindow \|\| launcherWindow/);
assert.match(main, /Protect may be the only visible StudioVoxario surface/);
assert.match(main, /Background-only Protect must also receive releases/);

console.log("VoxarioProtect v2.7 visible UI + lifetime/update regression tests passed");

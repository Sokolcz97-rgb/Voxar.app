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

assert.equal(version.version, "2.8");
// Supervisor běží z MutationObserveru: žádný nepodmíněný zápis textu, jinak
// okno Protectu zamrzne v nekonečné smyčce (regrese z v2.7).
assert.doesNotMatch(ui, /heroText\.textContent\s*=/);
assert.doesNotMatch(ui, /(strong|paragraph|tag)\.textContent\s*=\s*"/);
assert.match(ui, /if \(document\.title !== title\)/);
// Guard UI a jeho API.
const guardUi = fs.readFileSync(path.join(root, "assets", "protect-guard-ui.js"), "utf8");
assert.match(html, /assets\/protect-guard-ui\.js/);
for (const id of ["voxarioGuard", "voxarioWatch", "vgItems", "vgBlocked", "vwPending", "vwRemoved", "vgSummary"]) assert.match(html, new RegExp(`id="${id}"`));
for (const fn of ["protectGuardState", "protectGuardHarden", "protectGuardRevert", "protectGuardUpdateSignatures", "protectGuardBlocked", "protectGuardAllow", "protectWatchApprove", "protectWatchRemove", "protectWatchRestore"]) {
  assert.match(preload, new RegExp(`${fn}:`), `preload must expose ${fn}`);
  assert.match(guardUi, new RegExp(`api\\.${fn}\\(`), `Guard UI must use ${fn}`);
}
for (const channel of ["guard-state", "guard-check", "guard-harden", "guard-revert", "guard-update-signatures", "guard-blocked", "guard-allow", "watch-approve", "watch-remove", "watch-restore"]) {
  assert.match(main, new RegExp(`ipcMain\\.handle\\("protect:${channel}"`), `main must handle protect:${channel}`);
}
assert.doesNotMatch(guardUi, /innerHTML/, "Guard UI renders Windows-provided strings only via textContent");
// Panely mají explicitní kategorii, aby je přestavba záložek nepřeházela.
assert.equal((html.match(/<(section|aside) class="panel[^"]*"(?![^>]*data-vp-tab-panel)/g) || []).length, 0, "Every Protect panel declares data-vp-tab-panel");
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

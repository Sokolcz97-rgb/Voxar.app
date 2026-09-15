"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const main = fs.readFileSync(path.join(root, "main.cjs"), "utf8");
const updater = fs.readFileSync(path.join(root, "updater.cjs"), "utf8");
const builder = fs.readFileSync(path.join(root, "browser-builder.json"), "utf8");

assert.match(main, /setTimeout\(\(\) => runBrowserAutoUpdate\(\).*?3_000\)/s, "VoxarioBrowser must check for updates after every browser start");
assert.match(main, /scheduleBrowserAutoUpdate\(\)/, "VoxarioBrowser must keep periodic update checks while open");
assert.match(updater, /if \(isStandaloneBrowser\(\)\) return ["']browser["']/, "standalone browser must consume only the browser update channel");
assert.match(updater, /autoUpdater\.quitAndInstall\(true, true\)/, "downloaded browser update must install in place and relaunch");
assert.match(builder, /"channel"\s*:\s*"browser"/, "browser release must publish dedicated browser updater metadata");
assert.match(builder, /"extraResources"[\s\S]*"browser-app-update\.yml"[\s\S]*"app-update\.yml"/, "standalone browser must package its own update feed metadata");

console.log("✓ VoxarioBrowser in-place auto-update regression guard passed");

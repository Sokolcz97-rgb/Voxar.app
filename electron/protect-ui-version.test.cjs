"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { version } = require("./protect-version.cjs");

const html = fs.readFileSync(path.join(__dirname, "protect.html"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
const protectUi = fs.readFileSync(path.join(__dirname, "assets", "protect-ui-v27.js"), "utf8");
const packageConfig = JSON.parse(fs.readFileSync(path.join(__dirname, "package.json"), "utf8"));
const browserBuilder = JSON.parse(fs.readFileSync(path.join(__dirname, "browser-builder.json"), "utf8"));

assert.equal(version, "2.7", "VoxarioProtect canonical version must be 2.7");
assert.match(html, /id="protectVersion"/, "Protect UI must render the canonical version slot");
assert.match(html, /api\?\.protectVersion/, "Protect UI must read the version from preload");
assert.doesNotMatch(html, /VoxarioProtect v2\.[12]/, "Protect UI contains a stale v2.1/v2.2 label");
assert.match(preload, /protectVersion/, "Preload must expose Protect version to the renderer");
assert.match(preload, /protectFirewallGetStatus/, "Preload must expose the Firewall companion API");
assert.match(html, /assets\/protect-ui-v27\.js/, "protect.html must load the canonical v2.7 renderer");
assert.match(protectUi, /"firewall", "Firewall"/, "Renderer must expose the Firewall category");
assert.match(protectUi, /"stability", "Stabilita/, "Renderer must expose the Stability category");
assert.match(protectUi, /MutationObserver/, "Renderer must survive Protect tab-bar rebuilds");
assert.match(protectUi, /voxarioProtectStabilityV27/, "Stability panel must use the v2.7 canonical ID");
assert.match(protectUi, /voxarioProtectFirewallV27/, "Firewall panel must use the v2.7 canonical ID");
assert.ok(packageConfig.build.files.includes("assets/**/*"), "Windows package must include the Protect renderer asset");
assert.ok(browserBuilder.files.includes("assets/**/*"), "Browser package must include the Protect renderer asset");

console.log(`âś“ VoxarioProtect UI supervisor is synchronized at v${version}`);


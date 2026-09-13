"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { version } = require("./protect-version.cjs");

const html = fs.readFileSync(path.join(__dirname, "protect.html"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
const bootstrapUtf8 = fs.readFileSync(path.join(__dirname, "bootstrap-utf8.cjs"), "utf8");

assert.equal(version, "2.6", "VoxarioProtect canonical version must be 2.6");
assert.match(html, /id="protectVersion"/, "Protect UI must render the canonical version slot");
assert.match(html, /api\?\.protectVersion/, "Protect UI must read the version from preload");
assert.doesNotMatch(html, /VoxarioProtect v2\.[12]/, "Protect UI contains a stale v2.1/v2.2 label");
assert.match(preload, /protectVersion/, "Preload must expose Protect version to the renderer");
assert.match(preload, /protectFirewallGetStatus/, "Preload must expose the Firewall companion API");
assert.match(bootstrapUtf8, /protectUiSupervisorV26/, "Packaged entrypoint must install the persistent Protect UI supervisor");
assert.match(bootstrapUtf8, /"firewall", "Firewall"/, "Persistent supervisor must expose the Firewall category");
assert.match(bootstrapUtf8, /"stability", "Stabilita"/, "Persistent supervisor must expose the Stability category");
assert.match(bootstrapUtf8, /MutationObserver/, "Persistent supervisor must survive Protect tab-bar rebuilds");
assert.match(bootstrapUtf8, /voxarioProtectStabilityV26/, "Stability panel must be present in the packaged UI supervisor");
assert.doesNotMatch(bootstrapUtf8, /__voxarioFirewallFallbackV25/, "One-shot v2.5 firewall fallback must not return");

console.log(`✓ VoxarioProtect UI supervisor is synchronized at v${version}`);

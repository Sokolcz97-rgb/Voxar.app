"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { version } = require("./protect-version.cjs");

const html = fs.readFileSync(path.join(__dirname, "protect.html"), "utf8");
const preload = fs.readFileSync(path.join(__dirname, "preload.cjs"), "utf8");
const bootstrap = fs.readFileSync(path.join(__dirname, "bootstrap-utf8.cjs"), "utf8");

assert.equal(version, "2.5", "VoxarioProtect canonical version must be 2.5");
assert.match(html, /id="protectVersion"/, "Protect UI must render the canonical version slot");
assert.match(html, /api\?\.protectVersion/, "Protect UI must read the version from preload");
assert.doesNotMatch(html, /VoxarioProtect v2\.[12]/, "Protect UI contains a stale v2.1/v2.2 label");
assert.match(preload, /protectVersion/, "Preload must expose Protect version to the renderer");
assert.match(preload, /protectFirewallGetStatus/, "Preload must expose the Firewall companion API");
assert.match(bootstrap, /data-tab=\\?['\"]firewall\\?['\"]|dataset\.tab\s*=\s*['\"]firewall['\"]/, "Packaged Protect UI must create a visible Firewall tab");
assert.match(bootstrap, /protectFirewallGetStatus/, "Packaged Protect UI must render live Firewall state");
assert.match(bootstrap, /protectFirewallSelectProgram/, "Packaged Protect UI must expose user-confirmed program blocking");

console.log(`✓ VoxarioProtect UI is synchronized at v${version} with visible Firewall category`);

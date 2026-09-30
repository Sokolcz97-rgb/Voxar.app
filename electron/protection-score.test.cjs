"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeDefenderStatus } = require("./protect-status.cjs");

const complete = normalizeDefenderStatus({
  AntivirusEnabled: true,
  RealTimeProtectionEnabled: true,
  BehaviorMonitorEnabled: true,
  IoavProtectionEnabled: true,
  AntivirusSignatureAge: 0,
  AccessLimited: false,
});

assert.equal(complete.scoreAvailable, true, "complete Get-MpComputerStatus data must make the score available");
assert.equal(complete.protectionScore, 100, "healthy complete Defender data must produce the canonical score");
assert.equal(complete.diagnostic, null);
assert.equal(complete.AccessLimited, false);

const limited = normalizeDefenderStatus({
  AntivirusEnabled: true,
  RealTimeProtectionEnabled: null,
  AccessLimited: true,
});

assert.equal(limited.AccessLimited, true, "SecurityCenter fallback must retain AccessLimited");
assert.equal(limited.scoreAvailable, false, "limited fallback must not offer a score");
assert.equal(limited.protectionScore, null, "limited fallback must not fabricate a score");
assert.match(limited.diagnostic, /omezený|neúplný/i);
assert.equal(limited.BehaviorMonitorEnabled, null, "missing Defender booleans must be normalized to null");

const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
assert.match(main, /require\(["']\.\/protect-status\.cjs["']\)/, "main process must import the executable normalizer");
assert.match(main, /ok: true, status: normalizeDefenderStatus\(/, "valid Defender JSON must return ok:true after normalization");

console.log("Protection Score normalizer and main-process Defender status regression passed");

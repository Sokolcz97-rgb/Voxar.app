"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { calculateProtectionScore } = require("./protect-trust-engine.cjs");

const healthy = {
  AntivirusEnabled: true,
  RealTimeProtectionEnabled: true,
  BehaviorMonitorEnabled: true,
  IoavProtectionEnabled: true,
  AntivirusSignatureAge: 0,
};

assert.equal(calculateProtectionScore(healthy), 100, "a complete healthy Defender status must score 100");
assert.equal(calculateProtectionScore({ ...healthy, RealTimeProtectionEnabled: false }), 75, "real-time protection must affect the system score");
assert.equal(calculateProtectionScore({ ...healthy, AntivirusSignatureAge: 4 }), 90, "old signatures must not receive the freshness bonus");

const main = fs.readFileSync(path.join(__dirname, "main.cjs"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "protect.html"), "utf8");
assert.match(main, /scoreAvailable = complete/, "main must mark incomplete Defender data as unavailable");
assert.match(main, /protectionScore = complete \? calculateProtectionScore/, "main must calculate the canonical score before IPC");
assert.match(html, /status\.protectionScore/, "renderer must render the score returned by IPC");
assert.match(html, /scoreAvailable===false/, "renderer must show a diagnostic rather than fabricate a score");

console.log("Protection Score calculation and unavailable-Defender contract passed");


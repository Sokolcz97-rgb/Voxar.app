"use strict";

const assert = require("node:assert/strict");
const monitor = require("./browser-resource-monitor.cjs");

assert.equal(monitor.clampPercent(-4), 0);
assert.equal(monitor.clampPercent(14.27), 14.3);
assert.equal(monitor.clampPercent(104), 100);
assert.equal(monitor.responseBytes({ responseHeaders: { "Content-Length": ["4096"] } }), 4096);
assert.equal(monitor.responseBytes({ responseHeaders: { "content-length": "1024" } }), 1024);
assert.equal(monitor.responseBytes({ responseHeaders: {} }), 0);

const snap = monitor.networkSnapshot(987654);
assert.equal(snap.receivedBytes, 0);
assert.equal(snap.receivedBytesPerSec, 0);
assert.equal(snap.approximate, true);

console.log("✓ VoxarioBrowser resource monitor helpers passed");

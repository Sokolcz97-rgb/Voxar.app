"use strict";

const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  SECURE_FILES,
  PREFS_FILE,
  LEGACY_FILE,
  recoverSecurePair,
  mirrorSecurePair,
  restorePrefsIfMissing,
} = require("./browser-profile-recovery.cjs");

const root = fs.mkdtempSync(path.join(os.tmpdir(), "voxario-vault-recovery-"));
const current = path.join(root, "current");
const old = path.join(root, "old-profile");
const recovery = path.join(root, "recovery");
fs.mkdirSync(current, { recursive: true });
fs.mkdirSync(old, { recursive: true });

const vault = { version: 2, entries: [{ id: "encrypted-only", ciphertext: "abc" }] };
const key = { version: 2, wrappedKey: "dpapi-bound-value" };
fs.writeFileSync(path.join(old, SECURE_FILES[0]), JSON.stringify(vault));
fs.writeFileSync(path.join(old, SECURE_FILES[1]), JSON.stringify(key));
fs.writeFileSync(path.join(old, PREFS_FILE), JSON.stringify({ autofillPasswords: true }));

let result = recoverSecurePair({ currentDir: current, recoveryDir: recovery, candidateDirs: [old] });
assert.equal(result.securePair, true);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(current, SECURE_FILES[0]), "utf8")), vault);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(current, SECURE_FILES[1]), "utf8")), key);

assert.equal(mirrorSecurePair(current, recovery).ok, true);
assert.equal(fs.existsSync(path.join(recovery, SECURE_FILES[0])), true);
assert.equal(fs.existsSync(path.join(recovery, SECURE_FILES[1])), true);
assert.equal(fs.existsSync(path.join(recovery, LEGACY_FILE)), false, "legacy vault must never be mirrored into durable recovery");

fs.writeFileSync(path.join(current, PREFS_FILE), JSON.stringify({ requireWindowsHelloForAutofill: true }));
assert.equal(mirrorSecurePair(current, recovery).ok, true);
fs.rmSync(path.join(current, PREFS_FILE), { force: true });
assert.equal(restorePrefsIfMissing(current, recovery), true);
assert.equal(JSON.parse(fs.readFileSync(path.join(current, PREFS_FILE), "utf8")).requireWindowsHelloForAutofill, true);

// Simulate a partially damaged/current profile after an updater/product-name
// transition: the vault survived but its DPAPI-wrapped key is only in the old
// profile. Matching by the encrypted vault hash recovers only the paired key.
const partial = path.join(root, "partial");
fs.mkdirSync(partial, { recursive: true });
fs.copyFileSync(path.join(old, SECURE_FILES[0]), path.join(partial, SECURE_FILES[0]));
result = recoverSecurePair({ currentDir: partial, recoveryDir: path.join(root, "none"), candidateDirs: [old] });
assert.equal(result.securePair, true);
assert.equal(fs.existsSync(path.join(partial, SECURE_FILES[1])), true);

// Legacy recovery is allowed only as a one-time bridge into the current profile;
// the recovery mirror remains free of potentially plaintext legacy records.
const legacyCurrent = path.join(root, "legacy-current");
const legacyOld = path.join(root, "legacy-old");
const legacyMirror = path.join(root, "legacy-mirror");
fs.mkdirSync(legacyCurrent, { recursive: true });
fs.mkdirSync(legacyOld, { recursive: true });
fs.writeFileSync(path.join(legacyOld, LEGACY_FILE), JSON.stringify([{ origin: "https://example.com", password: "legacy-value" }]));
result = recoverSecurePair({ currentDir: legacyCurrent, recoveryDir: legacyMirror, candidateDirs: [legacyOld] });
assert.equal(result.legacyPresent, true);
assert.equal(fs.existsSync(path.join(legacyMirror, LEGACY_FILE)), false);

fs.rmSync(root, { recursive: true, force: true });
console.log("✓ VoxarioBrowser secure vault recovery passed");

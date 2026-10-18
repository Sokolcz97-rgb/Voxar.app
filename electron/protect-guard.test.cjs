"use strict";

// Unit testy VoxarioProtect Guard (posílení, hlídání, sdílený stav).
// Běží na libovolném OS – PowerShell se zde nespouští.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const guard = require("./protect-guard.cjs");
const watch = require("./protect-watch.cjs");
const { createGuardService, isSuspiciousExisting } = require("./protect-guard-service.cjs");

// ---------------------------------------------------------------- katalog

const ids = guard.HARDENING_ITEMS.map((item) => item.id);
assert.equal(new Set(ids).size, ids.length, "Hardening item ids must be unique");
for (const item of guard.HARDENING_ITEMS) {
  assert.ok(item.title && item.description, `${item.id} needs user-facing copy`);
  assert.ok(item.prefs || item.asr || item.firewall, `${item.id} must change something`);
  for (const rule of item.asr || []) {
    assert.match(rule.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, `${item.id} has invalid ASR GUID`);
    assert.ok([guard.ACTION.block, guard.ACTION.warn].includes(rule.action), `${item.id} must block or warn`);
  }
}
// LSASS a Office injection pravidla nepodporují režim Warn.
for (const item of guard.HARDENING_ITEMS) {
  for (const rule of item.asr || []) {
    if ([guard.ASR.lsass, guard.ASR.officeInjection].includes(rule.id)) assert.equal(rule.action, guard.ACTION.block);
  }
}
assert.equal(guard.HARDENING_ITEMS.find((item) => item.id === "folders").recommended, false, "Controlled Folder Access must stay opt-in (breaks game saves)");

// ---------------------------------------------------------------- vyhodnocení

const raw = {
  prefs: {
    DisableRealtimeMonitoring: false, DisableBehaviorMonitoring: false, DisableIOAVProtection: false, DisableScriptScanning: false,
    PUAProtection: 0, MAPSReporting: 2, SubmitSamplesConsent: 1, DisableBlockAtFirstSeen: false, CloudBlockLevel: 0, CloudExtendedTimeout: 0,
    EnableNetworkProtection: 1, EnableControlledFolderAccess: 0, EnableLowCpuPriority: false, ScanAvgCPULoadFactor: 50, ScanOnlyIfIdleEnabled: true,
    SignatureUpdateInterval: 0, CheckForSignaturesBeforeRunningScan: false,
  },
  asr: [
    { id: guard.ASR.vulnerableDrivers.toUpperCase(), action: 1 },
    { id: guard.ASR.lsass, action: 1 },
    { id: guard.ASR.wmiPersistence, action: 2 },
    { id: guard.ASR.scriptDownloaded, action: 1 },
    { id: guard.ASR.obfuscatedScripts, action: 6 },
    { id: guard.ASR.usbUnsigned, action: 1 },
  ],
  firewall: [
    { name: "Domain", Enabled: "True", DefaultInboundAction: "Block" },
    { name: "Private", Enabled: "True", DefaultInboundAction: "NotConfigured" },
    { name: "Public", Enabled: "False", DefaultInboundAction: "Block" },
  ],
  computer: { AMServiceEnabled: true, RealTimeProtectionEnabled: true, IsTamperProtected: true, AMRunningMode: "Normal", AntivirusSignatureAge: 3 },
};
const status = guard.evaluateStatus(raw);
const stateOf = (id) => status.items.find((item) => item.id === id).state;
assert.equal(stateOf("realtime"), "ok");
assert.equal(stateOf("pua"), "off");
assert.equal(stateOf("cloud"), "off", "CloudBlockLevel 0 is not hardened");
assert.equal(stateOf("network"), "ok");
assert.equal(stateOf("asrCore"), "off", "Audit mode must not count as protection");
assert.equal(stateOf("asrScripts"), "ok", "Block counts as stronger than requested Warn");
assert.equal(stateOf("asrRansomware"), "off");
assert.equal(stateOf("firewallOn"), "off");
assert.equal(stateOf("firewallInbound"), "off", "NotConfigured inbound action is not Block");
assert.equal(stateOf("lowImpact"), "off");
assert.equal(status.defender.signaturesStale, true);
assert.equal(status.recommendedTotal, guard.HARDENING_ITEMS.filter((item) => item.recommended).length);
assert.equal(guard.evaluateStatus(null).items.every((item) => item.state === "unknown"), true);
assert.deepEqual(guard.detectDrift(["network", "pua", "realtime"], status), ["pua"]);

// ---------------------------------------------------------------- skripty

const apply = guard.applyScript(["pua", "asrCore", "firewallInbound", "lowImpact", "neexistuje"]);
assert.match(apply, /Set-MpPreference -PUAProtection 1/);
assert.match(apply, /Set-MpPreference -EnableLowCpuPriority \$true -ScanAvgCPULoadFactor 30 -ScanOnlyIfIdleEnabled \$true/);
assert.match(apply, new RegExp(`Add-MpPreference -AttackSurfaceReductionRules_Ids ${guard.ASR.vulnerableDrivers},${guard.ASR.lsass},${guard.ASR.wmiPersistence} -AttackSurfaceReductionRules_Actions 1,1,1`));
assert.doesNotMatch(apply, /Set-MpPreference -AttackSurfaceReductionRules/, "Set-MpPreference would overwrite the user's other ASR rules");
assert.match(apply, /Set-NetFirewallProfile -Profile Domain,Private,Public -DefaultInboundAction Block/);
assert.match(apply, /\$beforePrefs=/);
assert.match(apply, /\$result=/);
assert.throws(() => guard.applyScript(["neexistuje"]), /žádná známá položka/);

const backup = {
  prefs: { PUAProtection: 0, EnableLowCpuPriority: false, ScanAvgCPULoadFactor: 50, ScanOnlyIfIdleEnabled: true },
  asr: [{ id: guard.ASR.lsass, action: 2 }],
  firewall: [{ name: "Public", Enabled: "True", DefaultInboundAction: "NotConfigured" }],
};
const revert = guard.revertScript(["pua", "asrCore", "firewallInbound", "lowImpact"], backup);
assert.match(revert, /Set-MpPreference -PUAProtection 0/);
assert.match(revert, /-EnableLowCpuPriority \$false -ScanAvgCPULoadFactor 50 -ScanOnlyIfIdleEnabled \$true/);
assert.match(revert, new RegExp(`Add-MpPreference -AttackSurfaceReductionRules_Ids ${guard.ASR.lsass} -AttackSurfaceReductionRules_Actions 2`), "Previously configured ASR rule returns to its old action");
assert.match(revert, new RegExp(`Remove-MpPreference -AttackSurfaceReductionRules_Ids ${guard.ASR.vulnerableDrivers}`), "Rule that did not exist before is removed again");
assert.match(revert, /Set-NetFirewallProfile -Profile Public -DefaultInboundAction NotConfigured/);
assert.throws(() => guard.revertScript(["pua"], null), /záloha/);
const injected = guard.revertScript(["firewallInbound"], { firewall: [{ name: "Public;rm", DefaultInboundAction: "Block'; Remove-Item" }] });
assert.doesNotMatch(injected, /Remove-Item|;rm/, "Firewall backup values are sanitised before reaching PowerShell");

const merged = guard.mergeBackup(
  { prefs: { PUAProtection: 0 }, asr: [{ id: guard.ASR.lsass, action: 2 }], firewall: [{ name: "Public" }] },
  { prefs: { PUAProtection: 1, CloudBlockLevel: 0 }, asr: [{ id: guard.ASR.lsass, action: 1 }, { id: guard.ASR.ransomware, action: 5 }], firewall: [{ name: "Domain" }] },
);
assert.equal(merged.prefs.PUAProtection, 0, "The first backup (true original) is never overwritten");
assert.equal(merged.prefs.CloudBlockLevel, 0);
assert.equal(merged.asr.find((row) => row.id === guard.ASR.lsass).action, 2);
assert.equal(merged.asr.length, 2);
assert.equal(merged.firewall[0].name, "Public");

assert.match(guard.signatureUpdateScript(), /Update-MpSignature/);
assert.match(guard.signatureUpdateScript(), /-SignatureUpdate -MMPC/);
assert.match(guard.signatureUpdateScript(), /Windows Defender\\MpCmdRun\.exe/, "Backslash must survive in the MpCmdRun path");
assert.match(guard.blockedEventsScript(500), /AddDays\(-60\)/, "Event window is clamped");

// ---------------------------------------------------------------- blokace

const blocked = guard.summarizeBlockedEvents([
  { record: "1", eventId: 1121, time: "2026-10-17T10:00:00Z", path: String.raw`file:_C:\Games\game.exe`, process: String.raw`C:\Windows\explorer.exe`, rule: guard.ASR.usbUnsigned.toUpperCase() },
  { record: "2", eventId: 1123, time: "2026-10-17T10:00:00Z", path: String.raw`C:\Users\a\Documents\save.dat`, process: String.raw`C:\Games\game.exe` },
  { record: "3", eventId: 1116, threat: "Trojan:Win32/Test", path: String.raw`file:_C:\x.exe; process:_pid:12`, category: "Trojan", action: "Quarantine" },
  { record: "4", eventId: 5007, setting: "HKLM\\SOFTWARE\\Microsoft\\Windows Defender\\Real-Time Protection\\DisableRealtimeMonitoring = 0x1" },
]);
assert.equal(blocked[0].kind, "asr");
assert.equal(blocked[0].target, String.raw`C:\Games\game.exe`);
assert.match(blocked[0].title, /USB/);
assert.equal(blocked[0].canAllow, true);
assert.equal(blocked[1].kind, "folders");
assert.equal(blocked[1].canAllow, true);
assert.equal(blocked[2].kind, "threat");
assert.equal(blocked[2].target, String.raw`C:\x.exe`);
assert.equal(blocked[2].canAllow, false, "Real threats are never allowed from Protect");
assert.equal(blocked[3].kind, "config");

assert.throws(() => guard.allowScript("asr", String.raw`C:\Games\*`), /konkrétní soubor/);
assert.throws(() => guard.allowScript("asr", "relative.exe"), /konkrétní soubor/);
const allow = guard.allowScript("folders", String.raw`C:\Games\it's.exe`, false);
assert.match(allow, /Add-MpPreference -ControlledFolderAccessAllowedApplications \$target/);
assert.match(allow, /'C:\\Games\\it''s\.exe'/, "Single quotes are escaped for PowerShell");
assert.match(allow, /-not \$false/, "Unsigned programs are refused unless confirmed");
assert.match(guard.allowScript("asr", String.raw`C:\a.exe`, true), /AttackSurfaceReductionOnlyExclusions/);

// ---------------------------------------------------------------- hlídání

assert.match(watch.COLLECT_SCRIPT, /'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'/, "Registry paths keep their backslashes");
assert.match(watch.COLLECT_SCRIPT, /Image File Execution Options/);
assert.match(watch.COLLECT_SCRIPT, /Get-NetFirewallRule -Direction Inbound -Action Allow/);

const runEntry = { kind: "run", location: String.raw`HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`, name: "Updater", value: String.raw`"C:\Users\a\AppData\Roaming\upd.exe" /s`, target: String.raw`C:\Users\a\AppData\Roaming\upd.exe`, exists: true, signature: "NotSigned", signer: null };
const signedRun = { ...runEntry, name: "Steam", value: "steam.exe -silent", signature: "Valid", signer: "CN=Valve Corp., O=Valve Corp." };
const hklmRun = { ...runEntry, location: String.raw`HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run` };
assert.equal(watch.severityOf(runEntry, "added"), "medium");
assert.equal(watch.severityOf(signedRun, "added"), "low");
assert.equal(watch.severityOf({ kind: "exclusion" }, "added"), "high");
assert.equal(watch.severityOf({ kind: "dns" }, "changed"), "info");
assert.equal(watch.needsElevation(runEntry), false, "HKCU entries do not need UAC");
assert.equal(watch.needsElevation(hklmRun), true);
assert.equal(watch.removalFor({ kind: "winlogon", name: "Shell", value: "explorer.exe" }), null, "Default Winlogon shell is never offered for removal");
assert.equal(watch.removalFor({ kind: "winlogon", name: "Shell", value: "explorer.exe, evil.exe" }), "reset");
assert.equal(watch.removalFor({ kind: "dns", name: "Wi-Fi", value: "1.1.1.1" }), null);
assert.equal(watch.removalFor({ kind: "task" }), "disable");

const baseline = {};
const first = watch.normalizeEntries([runEntry, signedRun, { kind: "unknown", name: "x" }]);
assert.equal(first.length, 2, "Unknown kinds are dropped");
for (const entry of first) baseline[watch.entryKey(entry)] = watch.entryValueHash(entry);
const changedEntry = { ...signedRun, value: "steam.exe -silent -evil" };
const diff = watch.diffEntries(baseline, watch.normalizeEntries([runEntry, changedEntry, hklmRun]));
assert.deepEqual(diff.findings.map((row) => row.change).sort(), ["added", "changed"]);
const finding = watch.toFinding(diff.findings.find((row) => row.change === "added"), new Date("2026-10-18T00:00:00Z"));
assert.equal(finding.kind, "run");
assert.equal(finding.action, "remove");
assert.equal(finding.elevate, true);
assert.match(finding.title, /^Nové/);
assert.equal(watch.toFinding(diff.findings[0]).id, watch.toFinding(diff.findings[0]).id, "Finding id is stable");

const removal = watch.removalScript(runEntry, String.raw`C:\q`);
assert.match(removal, /Remove-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name 'Updater'/);
assert.match(removal, /DoNotExpandEnvironmentNames/, "Backup keeps unexpanded REG_EXPAND_SZ values");
assert.match(watch.removalScript({ kind: "startup", location: String.raw`C:\Users\a\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup`, name: "x.lnk" }, String.raw`C:\q`), /Move-Item/);
assert.match(watch.removalScript({ kind: "fwrule", location: "Any", name: "{ABC}", value: "Evil" }), /Disable-NetFirewallRule -Name '\{ABC\}'/);
assert.match(watch.removalScript({ kind: "exclusion", location: "Path", name: "C:\\", value: "C:\\" }), /Remove-MpPreference -ExclusionPath 'C:\\'/);
assert.throws(() => watch.removalScript({ kind: "exclusion", location: "Evil", value: "x" }), /Neznámý typ/);
assert.match(watch.removalScript({ kind: "winlogon", location: "HKLM:\\x", name: "Userinit", value: "a" }), /'C:\\Windows\\system32\\userinit\.exe,'/);

assert.match(watch.restoreScript({ type: "registry", location: runEntry.location, name: "Updater", valueKind: "ExpandString", value: "%APPDATA%\\upd.exe" }), /-PropertyType ExpandString -Value '%APPDATA%\\upd\.exe'/);
assert.match(watch.restoreScript({ type: "registry", location: "HKLM:\\x", name: "n", valueKind: "DWord", value: "1" }), /-PropertyType DWord -Value 1 /);
assert.match(watch.restoreScript({ type: "registry", location: "HKLM:\\x", name: "n", valueKind: "MultiString", value: ["a", "b"] }), /-Value @\('a','b'\)/);
assert.match(watch.restoreScript({ type: "registry", location: "HKLM:\\x", name: "n", valueKind: "Evil; rm", value: "a" }), /-PropertyType String/, "Unknown value kinds fall back to String");
assert.throws(() => watch.restoreScript({ type: "exclusion", param: "Evil", value: "x" }), /Neplatná/);
assert.equal(watch.restoreNeedsElevation({ type: "registry", location: "HKCU:\\x" }), false);
assert.equal(watch.restoreNeedsElevation({ type: "task" }), true);

assert.equal(isSuspiciousExisting({ kind: "ifeo", location: "x", name: "Debugger", value: "x" }), true);
assert.equal(isSuspiciousExisting({ kind: "policy", location: "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender", name: "DisableAntiSpyware", value: "1" }), true);
assert.equal(isSuspiciousExisting({ kind: "policy", location: "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender", name: "DisableAntiSpyware", value: "0" }), false);
assert.equal(isSuspiciousExisting({ kind: "policy", location: "HKLM:\\SOFTWARE\\Policies\\Microsoft\\Windows Defender\\Exclusions\\Paths", name: "C:\\", value: "0" }), true);
assert.equal(isSuspiciousExisting({ kind: "run", location: "x", name: "a", value: "b" }), false);

// ---------------------------------------------------------------- služba (sdílený stav)

async function serviceTests() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vp-guard-"));
  const originals = {
    readStatus: guard.readStatus, applyHardening: guard.applyHardening, revertHardening: guard.revertHardening,
    collect: watch.collect, removeEntry: watch.removeEntry, restoreEntry: watch.restoreEntry,
  };
  let currentRaw = JSON.parse(JSON.stringify(raw));
  let entries = [runEntry, signedRun, { kind: "ifeo", location: "HKLM:\\x\\sethc.exe", name: "Debugger", value: "cmd.exe", target: null }];
  const calls = [];
  guard.readStatus = async () => ({ ok: true, status: guard.evaluateStatus(currentRaw), raw: currentRaw });
  guard.applyHardening = async (wanted) => {
    calls.push(["apply", wanted]);
    const before = { prefs: { PUAProtection: currentRaw.prefs.PUAProtection }, asr: [], firewall: [] };
    if (wanted.includes("pua")) currentRaw.prefs.PUAProtection = 1;
    return { ok: true, before, errors: [] };
  };
  guard.revertHardening = async (wanted, backupArg) => {
    calls.push(["revert", wanted, backupArg]);
    currentRaw.prefs.PUAProtection = backupArg.prefs.PUAProtection;
    return { ok: true, errors: [] };
  };
  watch.collect = async () => ({ ok: true, entries: watch.normalizeEntries(entries) });
  watch.removeEntry = async (entry) => { calls.push(["remove", entry.name]); return { ok: true, data: { type: "registry", location: entry.location, name: entry.name, valueKind: "String", value: entry.value } }; };
  watch.restoreEntry = async (backupArg) => { calls.push(["restore", backupArg.name]); return { ok: true, data: { restored: true } }; };

  try {
    const toasts = [];
    const activities = [];
    let clock = new Date("2026-10-18T08:00:00Z");
    const make = () => createGuardService({ userDataDir: dir, notify: (...args) => toasts.push(args), addActivity: (entry) => activities.push(entry), now: () => clock });
    const service = make();

    const firstCheck = await service.check();
    assert.equal(firstCheck.ok, true);
    assert.equal(firstCheck.state.watch.ready, true);
    assert.deepEqual(firstCheck.state.watch.pending.map((row) => row.kind), ["ifeo"], "First run only reports already-suspicious entries");
    assert.equal(firstCheck.state.watch.pending[0].change, "existing");
    assert.ok(toasts.some(([, body]) => /staré 3 dní/.test(body)), "Stale signatures are announced");
    assert.ok(toasts.some(([, body]) => /IFEO/.test(body)));

    const skipped = await make().check();
    assert.equal(skipped.skipped, true, "A second Protect process does not repeat a fresh check");

    const hardened = await service.harden(["pua", "bogus"]);
    assert.equal(hardened.ok, true);
    assert.deepEqual(calls.at(-1), ["apply", ["pua"]]);
    assert.deepEqual(hardened.state.applied, ["pua"]);
    assert.equal(hardened.state.canRevert, true);
    assert.equal(hardened.state.status.items.find((item) => item.id === "pua").state, "ok");

    // Windows Update vrátí PUA → drift + jedna notifikace.
    currentRaw.prefs.PUAProtection = 0;
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    toasts.length = 0;
    const drifted = await service.check();
    assert.deepEqual(drifted.state.drift, ["pua"]);
    assert.equal(toasts.filter(([, body]) => /Blokovat nechtěné/.test(body)).length, 1);
    assert.equal(toasts.filter(([, body]) => /staré/.test(body)).length, 0, "Signature warning is shown once per day");
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    toasts.length = 0;
    await service.check();
    assert.equal(toasts.length, 0, "Drift and existing findings are not re-announced");

    // Obnovit = znovu použít; původní záloha zůstává 0.
    await service.harden(["pua"]);
    assert.equal(service.load().backup.prefs.PUAProtection, 0, "Re-applying after drift keeps the original backup");
    const reverted = await service.revert();
    assert.equal(reverted.ok, true);
    assert.equal(calls.at(-1)[0], "revert");
    assert.equal(currentRaw.prefs.PUAProtection, 0);
    assert.deepEqual(reverted.state.applied, []);

    // Nová položka autostartu → nález → odebrání → vrácení.
    entries = [...entries, hklmRun];
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    toasts.length = 0;
    const found = await service.check();
    const newRun = found.state.watch.pending.find((row) => row.kind === "run");
    assert.ok(newRun, "New autostart entry is reported");
    assert.equal(newRun.entry, undefined, "Raw entries are not sent to the renderer");
    assert.equal(toasts.length, 1);
    const removed = await service.removeFinding(newRun.id);
    assert.equal(removed.ok, true);
    assert.equal(removed.state.watch.removed.length, 1);
    assert.equal(removed.state.watch.removed[0].backup, undefined, "Backups stay in the main process");
    entries = entries.filter((entry) => entry !== hklmRun);
    const restored = await service.restoreRemoved(removed.state.watch.removed[0].id);
    assert.equal(restored.ok, true);
    assert.deepEqual(calls.at(-1), ["restore", "Updater"]);
    entries = [...entries, hklmRun];
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    const afterRestore = await service.check();
    assert.equal(afterRestore.state.watch.pending.some((row) => row.kind === "run"), false, "Restored entry is trusted again");

    // Ponechat = přidat do baseline.
    const ifeo = afterRestore.state.watch.pending.find((row) => row.kind === "ifeo");
    const approved = service.approve(ifeo.id);
    assert.equal(approved.ok, true);
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    const clean = await service.check();
    assert.equal(clean.state.watch.pending.length, 0);

    // Výpadek čtení jednoho druhu nesmaže jeho baseline (žádné falešné poplachy).
    const savedEntries = entries;
    entries = entries.filter((entry) => entry.kind !== "ifeo");
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    await service.check();
    entries = savedEntries;
    clock = new Date(clock.getTime() + 10 * 60 * 1000);
    const back = await service.check();
    assert.equal(back.state.watch.pending.length, 0, "Entries of a temporarily unreadable kind are not re-reported");

    assert.ok(activities.length > 0);
    assert.equal(fs.existsSync(path.join(dir, "voxario-protect-guard.json")), true);
  } finally {
    Object.assign(guard, { readStatus: originals.readStatus, applyHardening: originals.applyHardening, revertHardening: originals.revertHardening });
    Object.assign(watch, { collect: originals.collect, removeEntry: originals.removeEntry, restoreEntry: originals.restoreEntry });
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

serviceTests().then(
  () => console.log("✓ VoxarioProtect Guard hardening, watch and shared-state tests passed"),
  (error) => { console.error(error); process.exit(1); },
);

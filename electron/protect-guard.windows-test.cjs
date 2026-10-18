"use strict";

// Integrační test VoxarioProtect Guard na skutečném Windows (CI runner).
// 1) Všechny generované PowerShell skripty musí projít parserem PowerShellu.
// 2) Čtení stavu Defenderu/Firewallu a sběr dat hlídání běží naostro.
// 3) Odebrání a vrácení položky HKCU Run proběhne skutečně v registru.
// 4) Zapnutí a vrácení jedné položky posílení přes UAC cestu (soft-check –
//    Defender na runneru může být v pasivním režimu).

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

if (process.platform !== "win32") {
  console.log("VoxarioProtect Guard Windows integration test skipped (not Windows).");
  process.exit(0);
}

const guard = require("./protect-guard.cjs");
const watch = require("./protect-watch.cjs");
const { runElevatedJson, runPowerShellJson } = require("./protect-windows.cjs");

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vp-guard-win-"));
const warnings = [];

function parsePowerShell(scripts) {
  const files = Object.entries(scripts).map(([name, script], index) => {
    const file = path.join(tmp, `script-${index}.ps1`);
    fs.writeFileSync(file, `\ufeff${script}`, "utf8");
    return { name, file };
  });
  const list = path.join(tmp, "list.json");
  fs.writeFileSync(list, JSON.stringify(files));
  const checker = path.join(tmp, "check.ps1");
  fs.writeFileSync(checker, [
    "$ErrorActionPreference='Stop'",
    "$items = Get-Content -LiteralPath $args[0] -Raw | ConvertFrom-Json",
    "$bad = @()",
    "foreach ($item in $items) {",
    "  $tokens = $null; $errors = $null",
    "  [System.Management.Automation.Language.Parser]::ParseFile($item.file, [ref]$tokens, [ref]$errors) | Out-Null",
    "  foreach ($e in $errors) { $bad += ($item.name + ': ' + $e.Message + ' @' + $e.Extent.StartLineNumber) }",
    "}",
    "$bad -join \"`n\"",
  ].join("\n"));
  return execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", checker, list], { encoding: "utf8" }).trim();
}

async function main() {
  const allIds = guard.HARDENING_ITEMS.map((item) => item.id);
  const fakeBackup = {
    prefs: { PUAProtection: 0, MAPSReporting: 1, EnableLowCpuPriority: false, ScanAvgCPULoadFactor: 50 },
    asr: [{ id: guard.ASR.lsass, action: 2 }],
    firewall: [{ name: "Public", Enabled: "True", DefaultInboundAction: "NotConfigured" }],
  };
  const sample = { kind: "run", location: String.raw`HKCU:\Software\Microsoft\Windows\CurrentVersion\Run`, name: "x", value: "y" };
  const scripts = {
    status: guard.statusScript(),
    apply: guard.applyScript(allIds),
    revert: guard.revertScript(allIds, fakeBackup),
    signatures: guard.signatureUpdateScript(),
    blocked: guard.blockedEventsScript(14),
    allow: guard.allowScript("asr", String.raw`C:\Windows\notepad.exe`, false),
    allowFolders: guard.allowScript("folders", String.raw`C:\Windows\notepad.exe`, true),
    unallow: guard.removeAllowScript("asr", String.raw`C:\Windows\notepad.exe`),
    collect: watch.COLLECT_SCRIPT,
    removeRun: watch.removalScript(sample, tmp),
    removeIfeo: watch.removalScript({ ...sample, kind: "ifeo" }, tmp),
    removePolicy: watch.removalScript({ ...sample, kind: "policy" }, tmp),
    resetWinlogon: watch.removalScript({ ...sample, kind: "winlogon", name: "Shell" }, tmp),
    quarantine: watch.removalScript({ ...sample, kind: "startup", location: tmp }, tmp),
    disableTask: watch.removalScript({ ...sample, kind: "task", location: "\\", name: "t" }, tmp),
    disableRule: watch.removalScript({ ...sample, kind: "fwrule" }, tmp),
    removeExclusion: watch.removalScript({ ...sample, kind: "exclusion", location: "Process", value: "a.exe" }, tmp),
    removeHosts: watch.removalScript({ ...sample, kind: "hosts", location: "C:\\hosts", value: "0.0.0.0 x" }, tmp),
    restoreRegistry: watch.restoreScript({ type: "registry", location: sample.location, name: "x", valueKind: "MultiString", value: ["a", "b"] }),
    restoreBinary: watch.restoreScript({ type: "registry", location: sample.location, name: "x", valueKind: "Binary", value: [1, 2, 3] }),
    restoreFile: watch.restoreScript({ type: "file", source: "C:\\a", quarantine: "C:\\b" }),
    restoreTask: watch.restoreScript({ type: "task", taskPath: "\\", taskName: "t" }),
    restoreRule: watch.restoreScript({ type: "fwrule", name: "r" }),
    restoreExclusion: watch.restoreScript({ type: "exclusion", param: "ExclusionPath", value: "C:\\x" }),
    restoreHosts: watch.restoreScript({ type: "hosts", path: "C:\\hosts", line: "0.0.0.0 x" }),
  };
  const parseErrors = parsePowerShell(scripts);
  assert.equal(parseErrors, "", `Generated PowerShell has syntax errors:\n${parseErrors}`);
  console.log(`✓ ${Object.keys(scripts).length} generated PowerShell scripts parse cleanly`);

  // Chyba skriptu se musí vrátit jako čitelná chyba, ne pád.
  const failing = await runElevatedJson("throw 'zkušební chyba'", { elevate: false, timeoutMs: 60_000 });
  assert.equal(failing.ok, false);
  assert.match(failing.error, /zkušební chyba/, "Script errors (incl. UTF-8) are reported back");
  const echo = await runElevatedJson("$result=[pscustomobject]@{text='Příliš žluťoučký kůň';path='C:\\a\\b'}", { elevate: false, timeoutMs: 60_000 });
  assert.equal(echo.ok, true, echo.error);
  assert.equal(echo.data.text, "Příliš žluťoučký kůň");
  assert.equal(echo.data.path, "C:\\a\\b");
  console.log("✓ Result channel keeps UTF-8 text and backslashes");

  const status = await guard.readStatus();
  if (status.ok) {
    assert.equal(status.status.items.length, guard.HARDENING_ITEMS.length);
    console.log(`✓ Defender/Firewall status read: ${status.status.recommendedDone}/${status.status.recommendedTotal} recommended, mode ${status.status.defender.runningMode}`);
    assert.ok(status.status.items.filter((item) => item.group === "firewall").every((item) => item.state !== "unknown"), "Firewall profiles are readable");
  } else {
    warnings.push(`Defender status not readable on this runner: ${status.error}`);
  }

  const collected = await watch.collect();
  assert.equal(collected.ok, true, collected.error);
  const kinds = new Set(collected.entries.map((entry) => entry.kind));
  assert.ok(kinds.has("winlogon"), "Winlogon values are collected");
  assert.ok(kinds.has("fwrule") || kinds.has("policy"), "Firewall rules or policies are collected");
  console.log(`✓ Watch collected ${collected.entries.length} entries (${[...kinds].join(", ")})`);

  // HKCU Run: přidat → najít → odebrat → vrátit.
  const name = `VoxarioProtectCiTest${process.pid}`;
  const value = String.raw`"%SystemRoot%\System32\notepad.exe" /ci-test`;
  execFileSync("reg.exe", ["add", String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", name, "/t", "REG_EXPAND_SZ", "/d", value, "/f"]);
  try {
    const again = await watch.collect();
    const entry = again.entries.find((row) => row.kind === "run" && row.name === name);
    assert.ok(entry, "New HKCU Run value is detected");
    assert.equal(entry.signature, "Valid", `notepad.exe target is resolved and its signature verified: ${JSON.stringify(entry)}`);
    assert.equal(watch.needsElevation(entry), false);
    const removed = await watch.removeEntry(entry, tmp);
    assert.equal(removed.ok, true, removed.error);
    assert.equal(removed.data.valueKind, "ExpandString");
    assert.equal(removed.data.value, value, "Backup keeps the unexpanded value");
    const gone = await runPowerShellJson(`(Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run' -Name '${name}' -ErrorAction SilentlyContinue) -ne $null | ConvertTo-Json`);
    assert.equal(gone.data, false, "Value is removed from the registry");
    const restored = await watch.restoreEntry(removed.data);
    assert.equal(restored.ok, true, restored.error);
    const back = execFileSync("reg.exe", ["query", String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", name], { encoding: "utf8" });
    assert.match(back, /REG_EXPAND_SZ/);
    assert.ok(back.includes("%SystemRoot%"), "Restored value is identical");
    console.log("✓ HKCU Run remove/restore round trip works");
  } finally {
    try { execFileSync("reg.exe", ["delete", String.raw`HKCU\Software\Microsoft\Windows\CurrentVersion\Run`, "/v", name, "/f"], { stdio: "ignore" }); } catch {}
  }

  const blocked = await guard.readBlocked(14);
  if (blocked.ok) console.log(`✓ Defender block history read (${blocked.items.length} records)`);
  else warnings.push(`Defender block history not readable: ${blocked.error}`);

  // Posílení přes UAC cestu (runner je správce bez výzvy).
  if (status.ok) {
    const applied = await guard.applyHardening(["lowImpact", "freshSignatures"]);
    if (applied.ok) {
      const after = await guard.readStatus();
      const low = after.ok ? after.status.items.find((item) => item.id === "freshSignatures") : null;
      console.log(`✓ Elevated apply finished (freshSignatures: ${low?.state || "?"}, errors: ${applied.errors.length})`);
      if (applied.errors.length) warnings.push(`Apply reported: ${applied.errors.map((row) => `${row.item}: ${row.error}`).join("; ")}`);
      const reverted = await guard.revertHardening(["lowImpact", "freshSignatures"], applied.before);
      if (reverted.ok) console.log("✓ Elevated revert finished");
      else warnings.push(`Revert failed: ${reverted.error}`);
    } else {
      warnings.push(`Elevated apply not possible on this runner: ${applied.error}`);
    }
  }

  for (const warning of warnings) console.log(`::warning::VoxarioProtect Guard: ${warning}`);
  console.log("✓ VoxarioProtect Guard Windows integration test passed");
}

main()
  .catch((error) => { console.error(error); process.exitCode = 1; })
  .finally(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch {} });

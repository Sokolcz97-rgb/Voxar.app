"use strict";

// VoxarioProtect Watch – hlídání míst, kam se malware usazuje.
//
// Při prvním běhu se uloží výchozí stav (baseline). Každá další kontrola
// porovná aktuální stav s baseline a nové nebo změněné položky nahlásí.
// Uživatel pak rozhodne: Ponechat (přidá se do baseline), Odebrat (záloha
// a odstranění) nebo později Vrátit (obnova ze zálohy). Nic se neodstraňuje
// automaticky.

const crypto = require("crypto");
const { psLiteral, runPowerShellJson, runElevatedJson } = require("./protect-windows.cjs");

const KIND_LABELS = Object.freeze({
  run: "Spouštění po startu (registr)",
  winlogon: "Přihlášení do Windows (Winlogon)",
  ifeo: "Přesměrování programu (IFEO)",
  startup: "Složka Po spuštění",
  task: "Naplánovaná úloha",
  policy: "Zásada zabezpečení",
  exclusion: "Výjimka Defenderu",
  hosts: "Soubor hosts",
  fwrule: "Povolené příchozí pravidlo firewallu",
  dns: "DNS server",
});

// Sběr dat. Celý skript je String.raw, aby zpětná lomítka v cestách
// registru zůstala zachovaná.
const COLLECT_SCRIPT = String.raw`
$entries = New-Object System.Collections.Generic.List[object]
function Add-Entry($kind, $location, $name, $value, $target) {
  $entries.Add([pscustomobject]@{ kind=$kind; location=[string]$location; name=[string]$name; value=[string]$value; target=[string]$target })
}
function Get-Target([string]$command) {
  if (-not $command) { return $null }
  $c = [Environment]::ExpandEnvironmentVariables($command.Trim())
  if ($c.StartsWith('"')) { $end = $c.IndexOf('"', 1); if ($end -gt 1) { return $c.Substring(1, $end - 1) } }
  $m = [regex]::Match($c, '^(.+?\.(exe|com|bat|cmd|ps1|vbs|js|dll|scr|lnk))(\s|,|$)', 'IgnoreCase')
  if ($m.Success) { return $m.Groups[1].Value }
  return ($c -split '\s+')[0]
}

$runKeys = @(
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run',
  'HKCU:\Software\Microsoft\Windows\CurrentVersion\RunOnce',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\RunOnce',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\Run',
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\Windows\CurrentVersion\RunOnce'
)
foreach ($key in $runKeys) {
  $item = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue
  if (-not $item) { continue }
  foreach ($prop in $item.PSObject.Properties) {
    if ($prop.Name -like 'PS*') { continue }
    Add-Entry 'run' $key $prop.Name $prop.Value (Get-Target ([string]$prop.Value))
  }
}

$winlogon = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -ErrorAction SilentlyContinue
if ($winlogon) {
  Add-Entry 'winlogon' 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' 'Shell' $winlogon.Shell $null
  Add-Entry 'winlogon' 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' 'Userinit' $winlogon.Userinit $null
}

Get-ChildItem -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options' -ErrorAction SilentlyContinue | ForEach-Object {
  $dbg = (Get-ItemProperty -LiteralPath $_.PSPath -Name Debugger -ErrorAction SilentlyContinue).Debugger
  if ($dbg) { Add-Entry 'ifeo' ('HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Image File Execution Options\' + $_.PSChildName) 'Debugger' $dbg (Get-Target ([string]$dbg)) }
}

foreach ($folder in @([Environment]::GetFolderPath('Startup'), [Environment]::GetFolderPath('CommonStartup'))) {
  if (-not $folder -or -not (Test-Path -LiteralPath $folder)) { continue }
  Get-ChildItem -LiteralPath $folder -File -Force -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' } | ForEach-Object {
    $target = $_.FullName
    if ($_.Extension -eq '.lnk') {
      try { $target = (New-Object -ComObject WScript.Shell).CreateShortcut($_.FullName).TargetPath } catch {}
    }
    Add-Entry 'startup' $folder $_.Name ($_.Length.ToString() + ':' + $_.LastWriteTimeUtc.Ticks) $target
  }
}

try {
  Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskPath -notlike '\Microsoft\*' -and $_.State -ne 'Disabled' } | ForEach-Object {
    $exec = @($_.Actions | Where-Object { $_.Execute } | ForEach-Object { ([string]$_.Execute + ' ' + [string]$_.Arguments).Trim() }) -join ' | '
    $first = @($_.Actions | Where-Object { $_.Execute } | Select-Object -First 1)
    $target = $null
    if ($first.Count) { $target = Get-Target ([string]$first[0].Execute) }
    Add-Entry 'task' $_.TaskPath $_.TaskName $exec $target
  }
} catch {}

$policyRoots = @(
  'HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender',
  'HKLM:\SOFTWARE\Policies\Microsoft\WindowsFirewall',
  'HKLM:\SOFTWARE\Policies\Microsoft\Windows Defender Security Center'
)
foreach ($root in $policyRoots) {
  if (-not (Test-Path -LiteralPath $root)) { continue }
  $keys = @(Get-Item -LiteralPath $root -ErrorAction SilentlyContinue) + @(Get-ChildItem -LiteralPath $root -Recurse -ErrorAction SilentlyContinue)
  foreach ($k in $keys) {
    if (-not $k) { continue }
    foreach ($valueName in $k.GetValueNames()) {
      $location = $k.Name -replace '^HKEY_LOCAL_MACHINE', 'HKLM:'
      Add-Entry 'policy' $location $valueName ([string]$k.GetValue($valueName)) $null
    }
  }
}
$uac = Get-ItemProperty -LiteralPath 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' -ErrorAction SilentlyContinue
if ($uac) {
  foreach ($n in @('EnableLUA', 'ConsentPromptBehaviorAdmin', 'PromptOnSecureDesktop')) {
    if ($null -ne $uac.$n) { Add-Entry 'policy' 'HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System' $n ([string]$uac.$n) $null }
  }
}

try {
  $mp = Get-MpPreference -ErrorAction Stop
  foreach ($pair in @(@('Path', $mp.ExclusionPath), @('Process', $mp.ExclusionProcess), @('Extension', $mp.ExclusionExtension))) {
    foreach ($v in @($pair[1])) {
      if (-not $v -or ([string]$v) -like 'N/A*') { continue }
      Add-Entry 'exclusion' $pair[0] ([string]$v) ([string]$v) $null
    }
  }
} catch {}

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
if (Test-Path -LiteralPath $hostsPath) {
  Get-Content -LiteralPath $hostsPath -ErrorAction SilentlyContinue | ForEach-Object {
    $line = ([string]$_).Trim()
    if ($line -and -not $line.StartsWith('#')) { Add-Entry 'hosts' $hostsPath $line $line $null }
  }
}

try {
  Get-DnsClientServerAddress -AddressFamily IPv4 -ErrorAction Stop | Where-Object { $_.ServerAddresses.Count } | ForEach-Object {
    Add-Entry 'dns' 'IPv4' $_.InterfaceAlias (($_.ServerAddresses | Sort-Object) -join ', ') $null
  }
} catch {}

try {
  Get-NetFirewallRule -Direction Inbound -Action Allow -Enabled True -ErrorAction Stop | ForEach-Object {
    Add-Entry 'fwrule' ([string]$_.Profile) ([string]$_.Name) ([string]$_.DisplayName) $null
  }
} catch {}

$sigCache = @{}
$rows = foreach ($e in $entries) {
  $status = $null; $signer = $null; $exists = $null
  if ($e.target) {
    $t = $e.target
    if (-not [IO.Path]::IsPathRooted($t)) {
      $found = Get-Command $t -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($found) { $t = $found.Source }
    }
    $exists = [bool](Test-Path -LiteralPath $t -PathType Leaf -ErrorAction SilentlyContinue)
    if ($exists) {
      if (-not $sigCache.ContainsKey($t)) {
        try { $s = Get-AuthenticodeSignature -LiteralPath $t -ErrorAction Stop; $sigCache[$t] = @([string]$s.Status, $(if ($s.SignerCertificate) { $s.SignerCertificate.Subject } else { $null })) }
        catch { $sigCache[$t] = @('Unknown', $null) }
      }
      $status = $sigCache[$t][0]; $signer = $sigCache[$t][1]
    }
    $e.target = $t
  }
  [pscustomobject]@{ kind=$e.kind; location=$e.location; name=$e.name; value=$e.value; target=$e.target; exists=$exists; signature=$status; signer=$signer }
}
@($rows) | ConvertTo-Json -Depth 4 -Compress
`;

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function entryKey(entry) {
  return `${entry.kind}|${String(entry.location || "").toLowerCase()}|${String(entry.name || "").toLowerCase()}`;
}

function entryValueHash(entry) {
  return crypto.createHash("sha256").update(`${entry.value ?? ""}`).digest("hex").slice(0, 16);
}

function normalizeEntries(rows) {
  return asArray(rows)
    .filter((row) => row && KIND_LABELS[row.kind])
    .map((row) => ({
      kind: row.kind,
      location: String(row.location || ""),
      name: String(row.name || ""),
      value: String(row.value ?? ""),
      target: row.target ? String(row.target) : null,
      exists: row.exists ?? null,
      signature: row.signature || null,
      signer: row.signer || null,
    }));
}

function isMicrosoftSigner(signer) {
  return /O=Microsoft Corporation/i.test(String(signer || ""));
}

function severityOf(entry, change) {
  switch (entry.kind) {
    case "policy":
    case "ifeo":
    case "winlogon":
    case "exclusion":
      return "high";
    case "hosts":
    case "fwrule":
      return "medium";
    case "dns":
      return "info";
    default: {
      if (entry.signature === "Valid") return "low";
      if (entry.exists === false && change === "changed") return "medium";
      return "medium";
    }
  }
}

function describe(entry) {
  switch (entry.kind) {
    case "run":
      return `${entry.name} → ${entry.value}`;
    case "winlogon":
      return `${entry.name} = ${entry.value}`;
    case "ifeo":
      return `${entry.location.split("\\").pop()} je přesměrován na ${entry.value}`;
    case "startup":
      return `${entry.name}${entry.target && entry.target !== entry.name ? ` → ${entry.target}` : ""}`;
    case "task":
      return `${entry.location}${entry.name} → ${entry.value}`;
    case "policy":
      return `${entry.location.replace(/^HKLM:\\SOFTWARE\\/i, "")} · ${entry.name} = ${entry.value}`;
    case "exclusion":
      return `${entry.location}: ${entry.value}`;
    case "fwrule":
      return `${entry.value} (${entry.location})`;
    case "dns":
      return `${entry.name}: ${entry.value}`;
    default:
      return entry.value;
  }
}

// Akce, kterou lze u nálezu nabídnout.
function removalFor(entry) {
  switch (entry.kind) {
    case "run":
    case "ifeo":
    case "policy":
    case "exclusion":
    case "hosts":
      return "remove";
    case "winlogon": {
      const defaults = { shell: "explorer.exe", userinit: "C:\\Windows\\system32\\userinit.exe," };
      const def = defaults[entry.name.toLowerCase()];
      return def && entry.value.trim().toLowerCase() !== def.toLowerCase() ? "reset" : null;
    }
    case "startup":
      return "quarantine";
    case "task":
    case "fwrule":
      return "disable";
    default:
      return null;
  }
}

function needsElevation(entry) {
  if (entry.kind === "run") return !/^HKCU:/i.test(entry.location);
  if (entry.kind === "startup") return !/\\AppData\\Roaming\\/i.test(entry.location);
  return true;
}

// Porovnání s baseline. Vrací nové a změněné položky; zmizelé položky jen
// odebere z baseline (odstranění není pro bezpečnost podezřelé).
function diffEntries(baseline, entries, { ignored = {} } = {}) {
  const base = baseline && typeof baseline === "object" ? baseline : {};
  const next = {};
  const findings = [];
  for (const entry of entries) {
    const key = entryKey(entry);
    const hash = entryValueHash(entry);
    next[key] = hash;
    if (ignored[key] === hash) continue;
    if (!(key in base)) findings.push({ key, hash, change: "added", entry });
    else if (base[key] !== hash) findings.push({ key, hash, change: "changed", entry });
  }
  return { findings, current: next };
}

function toFinding(raw, now = new Date()) {
  const { entry } = raw;
  return {
    id: crypto.createHash("sha256").update(`${raw.key}|${raw.hash}`).digest("hex").slice(0, 20),
    key: raw.key,
    hash: raw.hash,
    change: raw.change,
    kind: entry.kind,
    kindLabel: KIND_LABELS[entry.kind],
    severity: severityOf(entry, raw.change),
    title: `${raw.change === "added" ? "Nové" : "Změněné"}: ${KIND_LABELS[entry.kind]}`,
    detail: describe(entry),
    target: entry.target,
    signature: entry.signature,
    signer: entry.signer,
    trustedPublisher: entry.signature === "Valid",
    microsoft: isMicrosoftSigner(entry.signer),
    action: removalFor(entry),
    elevate: needsElevation(entry),
    entry,
    detectedAt: now.toISOString(),
  };
}

async function collect() {
  const result = await runPowerShellJson(COLLECT_SCRIPT, 90_000);
  if (!result.ok) return { ok: false, unsupported: !!result.unsupported, error: result.error };
  return { ok: true, entries: normalizeEntries(result.data) };
}

// ----------------------------------------------------------------- akce

function removalScript(entry, quarantineDir) {
  const loc = psLiteral(entry.location);
  const name = psLiteral(entry.name);
  switch (entry.kind) {
    case "run":
    case "ifeo":
    case "policy":
      return [
        `$item=Get-Item -LiteralPath ${loc}`,
        `$kind=[string]$item.GetValueKind(${name})`,
        `$value=$item.GetValue(${name}, $null, 'DoNotExpandEnvironmentNames')`,
        `if($null -eq $value){ throw 'Hodnota už v registru není.' }`,
        `Remove-ItemProperty -LiteralPath ${loc} -Name ${name}`,
        `$result=[pscustomobject]@{type='registry';location=${loc};name=${name};valueKind=$kind;value=$(if($value -is [array]){@($value | ForEach-Object {[string]$_})}else{[string]$value})}`,
      ].join("\n");
    case "winlogon": {
      const def = entry.name.toLowerCase() === "shell" ? "explorer.exe" : String.raw`C:\Windows\system32\userinit.exe,`;
      return [
        `$old=(Get-ItemProperty -LiteralPath ${loc} -Name ${name}).${entry.name.replace(/[^A-Za-z]/g, "")}`,
        `Set-ItemProperty -LiteralPath ${loc} -Name ${name} -Value ${psLiteral(def)}`,
        `$result=[pscustomobject]@{type='registry-set';location=${loc};name=${name};valueKind='String';value=[string]$old}`,
      ].join("\n");
    }
    case "startup":
      return [
        `$src=Join-Path ${loc} ${name}`,
        `$dir=${psLiteral(quarantineDir)}`,
        "New-Item -ItemType Directory -Force -Path $dir | Out-Null",
        `$dest=Join-Path $dir ((Get-Date).ToString('yyyyMMdd-HHmmss') + '-' + ${name})`,
        "Move-Item -LiteralPath $src -Destination $dest",
        "$result=[pscustomobject]@{type='file';source=$src;quarantine=$dest}",
      ].join("\n");
    case "task":
      return [
        `Disable-ScheduledTask -TaskPath ${loc} -TaskName ${name} | Out-Null`,
        `$result=[pscustomobject]@{type='task';taskPath=${loc};taskName=${name}}`,
      ].join("\n");
    case "fwrule":
      return [
        `Disable-NetFirewallRule -Name ${name}`,
        `$result=[pscustomobject]@{type='fwrule';name=${name}}`,
      ].join("\n");
    case "exclusion": {
      const param = { Path: "ExclusionPath", Process: "ExclusionProcess", Extension: "ExclusionExtension" }[entry.location];
      if (!param) throw new Error("Neznámý typ výjimky.");
      return [
        `Remove-MpPreference -${param} ${psLiteral(entry.value)}`,
        `$result=[pscustomobject]@{type='exclusion';param=${psLiteral(param)};value=${psLiteral(entry.value)}}`,
      ].join("\n");
    }
    case "hosts":
      return [
        `$path=${loc}`,
        `$line=${psLiteral(entry.value)}`,
        "$lines=@(Get-Content -LiteralPath $path)",
        "$kept=@($lines | Where-Object { ([string]$_).Trim() -ne $line })",
        "if($kept.Count -eq $lines.Count){ throw 'Řádek už v souboru hosts není.' }",
        "Set-Content -LiteralPath $path -Value $kept -Encoding ASCII",
        "$result=[pscustomobject]@{type='hosts';path=$path;line=$line}",
      ].join("\n");
    default:
      throw new Error("Tuto položku nelze odebrat.");
  }
}

const VALUE_KINDS = new Set(["String", "ExpandString", "DWord", "QWord", "MultiString", "Binary"]);

function restoreScript(backup) {
  if (!backup || typeof backup !== "object") throw new Error("Chybí záloha.");
  switch (backup.type) {
    case "registry":
    case "registry-set": {
      const kind = VALUE_KINDS.has(backup.valueKind) ? backup.valueKind : "String";
      const values = asArray(backup.value).map((v) => psLiteral(v));
      let valueExpr = values[0] || "''";
      if (kind === "MultiString") valueExpr = `@(${values.join(",")})`;
      if (kind === "DWord" || kind === "QWord") valueExpr = String(Number(backup.value) || 0);
      if (kind === "Binary") valueExpr = `[byte[]]@(${asArray(backup.value).map((v) => Number(v) & 255).join(",")})`;
      return [
        `if(-not (Test-Path -LiteralPath ${psLiteral(backup.location)})){ New-Item -Path ${psLiteral(backup.location)} -Force | Out-Null }`,
        `New-ItemProperty -LiteralPath ${psLiteral(backup.location)} -Name ${psLiteral(backup.name)} -PropertyType ${kind} -Value ${valueExpr} -Force | Out-Null`,
        "$result=[pscustomobject]@{restored=$true}",
      ].join("\n");
    }
    case "file":
      return [
        `if(Test-Path -LiteralPath ${psLiteral(backup.source)}){ throw 'Na původním místě už soubor existuje.' }`,
        `Move-Item -LiteralPath ${psLiteral(backup.quarantine)} -Destination ${psLiteral(backup.source)}`,
        "$result=[pscustomobject]@{restored=$true}",
      ].join("\n");
    case "task":
      return `Enable-ScheduledTask -TaskPath ${psLiteral(backup.taskPath)} -TaskName ${psLiteral(backup.taskName)} | Out-Null\n$result=[pscustomobject]@{restored=$true}`;
    case "fwrule":
      return `Enable-NetFirewallRule -Name ${psLiteral(backup.name)}\n$result=[pscustomobject]@{restored=$true}`;
    case "exclusion":
      if (!["ExclusionPath", "ExclusionProcess", "ExclusionExtension"].includes(backup.param)) throw new Error("Neplatná záloha výjimky.");
      return `Add-MpPreference -${backup.param} ${psLiteral(backup.value)}\n$result=[pscustomobject]@{restored=$true}`;
    case "hosts":
      return `Add-Content -LiteralPath ${psLiteral(backup.path)} -Value ${psLiteral(backup.line)} -Encoding ASCII\n$result=[pscustomobject]@{restored=$true}`;
    default:
      throw new Error("Neznámý typ zálohy.");
  }
}

function restoreNeedsElevation(backup) {
  if (backup?.type === "registry" || backup?.type === "registry-set") return !/^HKCU:/i.test(String(backup.location));
  if (backup?.type === "file") return !/\\AppData\\Roaming\\/i.test(String(backup.source));
  return true;
}

async function removeEntry(entry, quarantineDir) {
  return runElevatedJson(removalScript(entry, quarantineDir), { elevate: needsElevation(entry) });
}

async function restoreEntry(backup) {
  return runElevatedJson(restoreScript(backup), { elevate: restoreNeedsElevation(backup) });
}

module.exports = {
  KIND_LABELS,
  COLLECT_SCRIPT,
  entryKey,
  entryValueHash,
  normalizeEntries,
  severityOf,
  describe,
  removalFor,
  needsElevation,
  diffEntries,
  toFinding,
  collect,
  removalScript,
  restoreScript,
  restoreNeedsElevation,
  removeEntry,
  restoreEntry,
};

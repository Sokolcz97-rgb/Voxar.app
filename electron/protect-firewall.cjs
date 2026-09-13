"use strict";

// Windows Defender Firewall companion helpers.
// VoxarioProtect never disables the firewall, never changes default profile
// policy and never creates broad allow rules. It can only inspect profile
// state and create/remove its own per-program outbound BLOCK rules.

const crypto = require("crypto");
const path = require("path");

const RULE_GROUP = "VoxarioProtect";
const RULE_PREFIX = "VoxarioProtect.Block.";

function normalizedProgramPath(filePath) {
  return path.resolve(String(filePath || ""));
}

function ruleIdForPath(filePath) {
  const normalized = normalizedProgramPath(filePath).toLowerCase();
  const suffix = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 20);
  return `${RULE_PREFIX}${suffix}`;
}

function firewallStatusScript() {
  return [
    "$ErrorActionPreference='Stop'",
    "$rows=Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction",
    "$rows | ConvertTo-Json -Compress",
  ].join("; ");
}

function blockProgramScript() {
  return [
    "$ErrorActionPreference='Stop'",
    "$target=$env:VOXARIO_PROTECT_TARGET",
    "$rule=$env:VOXARIO_PROTECT_RULE",
    "if([string]::IsNullOrWhiteSpace($target)){throw 'Missing target'}",
    "if(-not (Test-Path -LiteralPath $target -PathType Leaf)){throw 'Target file does not exist'}",
    "$existing=Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue",
    "if(-not $existing){New-NetFirewallRule -Name $rule -DisplayName ('VoxarioProtect: '+[IO.Path]::GetFileName($target)) -Group 'VoxarioProtect' -Direction Outbound -Action Block -Program $target -Profile Any -Enabled True | Out-Null}",
    "[pscustomobject]@{Ok=$true;Rule=$rule;Direction='Outbound';Action='Block'} | ConvertTo-Json -Compress",
  ].join("; ");
}

function removeProgramBlockScript() {
  return [
    "$ErrorActionPreference='Stop'",
    "$rule=$env:VOXARIO_PROTECT_RULE",
    "$existing=Get-NetFirewallRule -Name $rule -ErrorAction SilentlyContinue",
    "if($existing){$existing | Remove-NetFirewallRule}",
    "[pscustomobject]@{Ok=$true;Rule=$rule;Removed=[bool]$existing} | ConvertTo-Json -Compress",
  ].join("; ");
}

function summarizeFirewallProfiles(rows) {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const normalized = list.map((row) => ({
    name: String(row?.Name || "Unknown"),
    enabled: row?.Enabled === true,
    defaultInboundAction: String(row?.DefaultInboundAction ?? "Unknown"),
    defaultOutboundAction: String(row?.DefaultOutboundAction ?? "Unknown"),
  }));
  return {
    available: normalized.length > 0,
    allEnabled: normalized.length > 0 && normalized.every((row) => row.enabled),
    profiles: normalized,
  };
}

module.exports = {
  RULE_GROUP,
  RULE_PREFIX,
  ruleIdForPath,
  firewallStatusScript,
  blockProgramScript,
  removeProgramBlockScript,
  summarizeFirewallProfiles,
};

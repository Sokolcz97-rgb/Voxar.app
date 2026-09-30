"use strict";

// Canonical Defender status normalization for the Electron main process.
// This module is pure: it neither invokes PowerShell nor changes any Windows
// security setting. A Protection Score is emitted only when all mandatory
// Defender signals came from a complete Get-MpComputerStatus response.
const { calculateProtectionScore } = require("./protect-trust-engine.cjs");

const REQUIRED_BOOLEAN_FIELDS = Object.freeze([
  "AntivirusEnabled",
  "RealTimeProtectionEnabled",
  "BehaviorMonitorEnabled",
  "IoavProtectionEnabled",
]);

function normalizeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function normalizeSignatureAge(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function normalizeDefenderStatus(input = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const accessLimited = raw.AccessLimited === true;
  const status = { ...raw, AccessLimited: accessLimited };

  for (const field of REQUIRED_BOOLEAN_FIELDS) status[field] = normalizeBoolean(raw[field]);
  status.AntivirusSignatureAge = normalizeSignatureAge(raw.AntivirusSignatureAge);

  const complete = !accessLimited && REQUIRED_BOOLEAN_FIELDS.every((field) => typeof status[field] === "boolean");
  status.scoreAvailable = complete;
  status.protectionScore = complete ? calculateProtectionScore(status) : null;
  status.diagnostic = complete
    ? null
    : "Windows poskytl pouze omezený nebo neúplný stav Microsoft Defenderu; Protection Score se záměrně nezobrazuje.";

  return status;
}

module.exports = {
  REQUIRED_BOOLEAN_FIELDS,
  normalizeDefenderStatus,
};

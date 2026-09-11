"use strict";

// Pure local scoring engine for VoxarioProtect.
// It does not execute commands, change Defender settings, create exclusions,
// restore quarantine items, delete files, or access the network.

const path = require("path");

const SIGNABLE_EXTENSIONS = new Set([".exe", ".msi", ".msix", ".com", ".scr", ".ps1", ".dll"]);
const EXECUTABLE_EXTENSIONS = new Set([".exe", ".msi", ".msix", ".com", ".scr", ".bat", ".cmd", ".ps1", ".js", ".jse", ".vbs", ".vbe", ".dll"]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizeExtension(fileNameOrExtension) {
  const value = String(fileNameOrExtension || "").trim().toLowerCase();
  if (!value) return "";
  return value.startsWith(".") && !value.includes("/") && !value.includes("\\")
    ? value
    : path.extname(value).toLowerCase();
}

function calculateProtectionScore(status = {}) {
  if (status.AccessLimited === true) return 55;
  let score = 20;
  if (status.AntivirusEnabled === true) score += 20;
  if (status.RealTimeProtectionEnabled === true) score += 25;
  if (status.BehaviorMonitorEnabled === true) score += 15;
  if (status.IoavProtectionEnabled === true) score += 10;
  const signatureAge = Number(status.AntivirusSignatureAge);
  if (Number.isFinite(signatureAge)) {
    if (signatureAge <= 1) score += 10;
    else if (signatureAge <= 3) score += 5;
  }
  return clamp(Math.round(score), 0, 100);
}

function calculateFileTrust(input = {}) {
  const extension = normalizeExtension(input.extension || input.fileName);
  const signature = input.signature || null;
  const defenderDetected = input.defenderDetected === true;
  const defenderStatus = input.defenderStatus || {};
  const size = Number(input.size || 0);
  const modifiedAt = input.modifiedAt ? new Date(input.modifiedAt).getTime() : NaN;

  let score = 50;
  const reasons = [];

  if (signature?.valid === true || signature?.Status === "Valid" || signature?.Status === 0) {
    score += 25;
    reasons.push({ kind: "positive", code: "valid_signature", text: "Platný digitální podpis." });
  } else if (SIGNABLE_EXTENSIONS.has(extension) && signature) {
    score -= 15;
    reasons.push({ kind: "warning", code: "invalid_signature", text: "Podpis není potvrzen jako platný." });
  } else if (SIGNABLE_EXTENSIONS.has(extension)) {
    score -= 8;
    reasons.push({ kind: "warning", code: "unsigned", text: "Spustitelný soubor nemá potvrzený platný podpis." });
  }

  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    score -= 4;
    reasons.push({ kind: "info", code: "executable", text: "Soubor může spouštět kód a vyžaduje zvýšenou opatrnost." });
  }

  if (defenderDetected) {
    score -= 55;
    reasons.push({ kind: "danger", code: "defender_detection", text: "Microsoft Defender eviduje související detekci." });
  }

  if (defenderStatus.RealTimeProtectionEnabled === false) {
    score -= 15;
    reasons.push({ kind: "warning", code: "realtime_off", text: "Real-time ochrana Microsoft Defenderu je vypnutá." });
  }
  if (defenderStatus.BehaviorMonitorEnabled === false) {
    score -= 8;
    reasons.push({ kind: "warning", code: "behavior_off", text: "Behavior Monitor Microsoft Defenderu je vypnutý." });
  }

  if (size > 0 && size < 4096 && EXECUTABLE_EXTENSIONS.has(extension)) {
    score -= 5;
    reasons.push({ kind: "warning", code: "tiny_executable", text: "Neobvykle malý spustitelný soubor." });
  }

  if (Number.isFinite(modifiedAt) && Date.now() - modifiedAt < 5 * 60 * 1000) {
    reasons.push({ kind: "info", code: "recent_file", text: "Soubor je čerstvě vytvořený nebo stažený." });
  }

  score = clamp(Math.round(score), 0, 100);
  let verdict = "review";
  if (defenderDetected || score < 30) verdict = "risk";
  else if (score >= 75) verdict = "trusted-signal";

  return {
    score,
    verdict,
    reasons,
    policy: {
      automaticAllow: false,
      automaticExclusion: false,
      automaticQuarantineRestore: false,
      defenderRemainsAuthoritative: true,
    },
  };
}

function summarizeActivities(items = []) {
  const list = Array.isArray(items) ? items : [];
  const isThreat = (item) => item?.status === "threat" || item?.severity === "high";
  const isWarning = (item) => item?.status === "warning" || item?.severity === "medium";
  return {
    total: list.length,
    trustedSignals: list.filter((item) => item?.type === "file" && ["ready", "complete"].includes(item?.status)).length,
    warningSignals: list.filter(isWarning).length,
    defenderDetections: list.filter((item) => item?.type === "defender" && isThreat(item)).length,
    highPriority: list.filter(isThreat).length,
  };
}

module.exports = {
  calculateProtectionScore,
  calculateFileTrust,
  summarizeActivities,
  normalizeExtension,
  constants: { SIGNABLE_EXTENSIONS, EXECUTABLE_EXTENSIONS },
};

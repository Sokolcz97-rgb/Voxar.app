"use strict";

// Pure local second-opinion engine for VoxarioProtect.
// It never executes the inspected file, never disables Microsoft Defender,
// never creates Defender exclusions and never accesses the network.

const path = require("path");

const SCRIPT_EXTENSIONS = new Set([".ps1", ".bat", ".cmd", ".js", ".jse", ".vbs", ".vbe", ".wsf", ".hta"]);
const EXECUTABLE_EXTENSIONS = new Set([".exe", ".msi", ".msix", ".com", ".scr", ".dll", ...SCRIPT_EXTENSIONS]);
const DECOY_EXTENSIONS = new Set([".pdf", ".doc", ".docx", ".xls", ".xlsx", ".jpg", ".jpeg", ".png", ".gif", ".txt", ".rtf", ".mp3", ".mp4", ".zip"]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function normalizedExtension(fileName) {
  return path.extname(String(fileName || "")).toLowerCase();
}

function hasDoubleExtensionLure(fileName) {
  const base = path.basename(String(fileName || "")).toLowerCase();
  const parts = base.split(".").filter(Boolean);
  if (parts.length < 3) return false;
  const finalExt = `.${parts.at(-1)}`;
  const previousExt = `.${parts.at(-2)}`;
  return EXECUTABLE_EXTENSIONS.has(finalExt) && DECOY_EXTENSIONS.has(previousExt);
}

function analyzeScriptText(text) {
  const value = String(text || "");
  if (!value) return [];
  const rules = [
    { code: "encoded_command", points: 25, re: /(?:-enc(?:odedcommand)?\b|frombase64string\s*\()/i, text: "Skript obsahuje kódování příkazu nebo Base64 dekódování." },
    { code: "dynamic_execution", points: 22, re: /(?:invoke-expression\b|\biex\s*\()/i, text: "Skript používá dynamické spouštění příkazů." },
    { code: "download_payload", points: 22, re: /(?:downloadstring\s*\(|downloadfile\s*\(|invoke-webrequest\b|\biwr\b|curl(?:\.exe)?\s+https?:\/\/|wget(?:\.exe)?\s+https?:\/\/)/i, text: "Skript se pokouší stáhnout další obsah ze sítě." },
    { code: "hidden_shell", points: 16, re: /(?:windowstyle\s+hidden|-w\s+hidden|createobject\s*\(\s*["']wscript\.shell)/i, text: "Skript se snaží spustit skrytý shell nebo proces." },
    { code: "persistence", points: 24, re: /(?:currentversion\\run\b|schtasks(?:\.exe)?\s+\/create\b|startup\\|new-scheduledtask\b)/i, text: "Skript obsahuje indikátor persistence po restartu." },
    { code: "defender_tamper", points: 40, re: /(?:disablerealtimemonitoring|disablebehaviormonitoring|disableioavprotection|disableantispyware|disableantivirus|add-mppreference\s+[^\r\n]*exclusion|set-mppreference\s+[^\r\n]*disable)/i, text: "Skript obsahuje pokus o oslabení Microsoft Defenderu nebo přidání výjimky." },
    { code: "lolbin_remote", points: 32, re: /(?:mshta(?:\.exe)?\s+https?:\/\/|regsvr32(?:\.exe)?\s+[^\r\n]*\/i:https?:\/\/|rundll32(?:\.exe)?\s+javascript:|certutil(?:\.exe)?\s+[^\r\n]*-urlcache)/i, text: "Skript používá systémový nástroj způsobem typickým pro načítání vzdáleného kódu." },
  ];
  return rules.filter((rule) => rule.re.test(value)).map(({ code, points, text }) => ({ code, points, text }));
}

function calculateLayeredRisk(input = {}) {
  const fileName = String(input.fileName || "");
  const extension = normalizedExtension(fileName || input.extension);
  const signatureValid = input.signatureValid === true;
  const trustScore = Number(input.trustScore);
  const scriptSignals = SCRIPT_EXTENSIONS.has(extension) ? analyzeScriptText(input.scriptText) : [];
  const reasons = [];
  let score = 0;

  if (hasDoubleExtensionLure(fileName)) {
    score += 45;
    reasons.push({ kind: "danger", code: "double_extension_lure", text: "Název maskuje spustitelný soubor jako dokument nebo médium." });
  }

  for (const signal of scriptSignals) {
    score += signal.points;
    reasons.push({ kind: signal.points >= 30 ? "danger" : "warning", code: signal.code, text: signal.text });
  }

  if (Number.isFinite(trustScore)) {
    if (trustScore < 30) {
      score += 32;
      reasons.push({ kind: "danger", code: "low_trust_score", text: "Lokální Trust Engine vyhodnotil soubor jako vysoce rizikový." });
    } else if (trustScore < 45) {
      score += 16;
      reasons.push({ kind: "warning", code: "reduced_trust_score", text: "Lokální Trust Engine našel více varovných signálů." });
    }
  }

  if (input.hashChanged === true) {
    score += 50;
    reasons.push({ kind: "danger", code: "hash_changed", text: "Soubor se mezi první a druhou kontrolou změnil." });
  }

  if (input.size > 0 && input.size < 4096 && EXECUTABLE_EXTENSIONS.has(extension)) {
    score += 8;
    reasons.push({ kind: "warning", code: "tiny_executable", text: "Neobvykle malý spustitelný soubor." });
  }

  // A valid signature is a useful signal, but never an unconditional allow.
  if (signatureValid) {
    score -= 15;
    reasons.push({ kind: "positive", code: "valid_signature", text: "Platný Authenticode podpis snižuje riziko, ale nepřepisuje ostatní signály." });
  }

  score = clamp(Math.round(score), 0, 100);
  let severity = "low";
  if (score >= 90) severity = "critical";
  else if (score >= 70) severity = "high";
  else if (score >= 45) severity = "medium";

  const strongSignals = reasons.filter((r) => r.kind === "danger").length;
  return {
    score,
    severity,
    reasons,
    shouldEscalateDefender: score >= 45,
    // Automatic containment is intentionally strict to reduce false positives.
    shouldContainNetwork: score >= 90 && !signatureValid && strongSignals >= 2,
  };
}

function reconcileVerdicts({ firstPass, secondPass, defenderDetected = false } = {}) {
  if (defenderDetected) {
    return {
      verdict: "defender-confirmed",
      severity: "critical",
      action: "defender-authoritative",
      message: "Microsoft Defender hrozbu potvrdil. Protect ponechává nápravu Defenderu.",
    };
  }

  const secondScore = Number(secondPass?.score || 0);
  if (secondScore >= 90 && secondPass?.shouldContainNetwork) {
    return {
      verdict: "protect-only-critical",
      severity: "critical",
      action: "contain-and-review",
      message: "Defender nic nenašel, ale dvě lokální kontroly Protectu se shodly na kritickém riziku.",
    };
  }
  if (secondScore >= 70) {
    return {
      verdict: "protect-only-high",
      severity: "high",
      action: "warn-and-review",
      message: "Defender nic nenašel, ale Protect stále vidí významné rizikové signály.",
    };
  }
  if (Number(firstPass?.score || 0) >= 45) {
    return {
      verdict: "reduced-after-rescan",
      severity: "medium",
      action: "monitor",
      message: "Druhá kontrola snížila riziko. Soubor zůstává k ručnímu ověření bez automatického povolení.",
    };
  }
  return {
    verdict: "no-strong-signal",
    severity: "low",
    action: "monitor",
    message: "Protect ani Defender nenašly silný indikátor hrozby.",
  };
}

module.exports = {
  analyzeScriptText,
  calculateLayeredRisk,
  reconcileVerdicts,
  hasDoubleExtensionLure,
  normalizedExtension,
  constants: { SCRIPT_EXTENSIONS, EXECUTABLE_EXTENSIONS, DECOY_EXTENSIONS },
};

"use strict";

// Společné spouštění PowerShellu pro VoxarioProtect Guard.
// - runPowerShellJson: běžná práva (jen čtení stavu).
// - runElevatedJson: jedna UAC výzva, skript zapíše výsledek do dočasného
//   JSON souboru, který si pak přečteme (Start-Process -Verb RunAs jinak
//   výstup nevrací).
// Skripty se předávají přes -EncodedCommand, takže uvozovky ani lomítka
// se po cestě nemění.

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { spawn } = require("child_process");

const IS_WINDOWS = process.platform === "win32";

function psLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function encode(script) {
  return Buffer.from(String(script), "utf16le").toString("base64");
}

// Příkazová řádka Windows má limit 32 767 znaků. Delší skript se uloží do
// dočasného souboru a krátký zavaděč ho spustí až po ověření SHA-256, takže
// soubor nejde mezi zápisem a spuštěním (např. se zvýšenými právy) podvrhnout.
const MAX_INLINE_ENCODED = 12_000;

function stageScript(script) {
  const text = String(script);
  if (encode(text).length <= MAX_INLINE_ENCODED) return { command: text, cleanup: () => {} };
  const file = path.join(os.tmpdir(), `voxario-protect-${crypto.randomBytes(8).toString("hex")}.ps1`);
  fs.writeFileSync(file, text, "utf8");
  const hash = crypto.createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex").toUpperCase();
  const loader = [
    `$__file=${psLiteral(file)}`,
    "$__bytes=[IO.File]::ReadAllBytes($__file)",
    "$__hash=-join ([Security.Cryptography.SHA256]::Create().ComputeHash($__bytes) | ForEach-Object { $_.ToString('X2') })",
    `if($__hash -ne '${hash}'){ throw 'Skript VoxarioProtect byl změněn – akce zrušena.' }`,
    ". ([ScriptBlock]::Create([Text.Encoding]::UTF8.GetString($__bytes)))",
  ].join("\n");
  return { command: loader, cleanup: () => { try { fs.rmSync(file, { force: true }); } catch {} } };
}

function runPowerShell(script, timeoutMs = 20_000) {
  if (!IS_WINDOWS) return Promise.resolve({ ok: false, unsupported: true, error: "Dostupné pouze ve Windows." });
  const staged = stageScript(script);
  return runPowerShellInline(staged.command, timeoutMs).finally(staged.cleanup);
}

function runPowerShellInline(script, timeoutMs) {
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let settled = false;
    let child;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    };
    try {
      child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encode(script)], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ ok: false, error: error?.message || "PowerShell se nepodařilo spustit." });
      return;
    }
    const timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ ok: false, timeout: true, error: "Operace Windows překročila časový limit." });
    }, timeoutMs);
    timer.unref?.();
    child.stdout?.setEncoding("utf8");
    child.stderr?.setEncoding("utf8");
    child.stdout?.on("data", (chunk) => { out += chunk; });
    child.stderr?.on("data", (chunk) => { err += chunk; });
    child.once("error", (error) => finish({ ok: false, error: error?.message || "PowerShell se nepodařilo spustit." }));
    child.once("close", (code) => {
      if (code !== 0) return finish({ ok: false, code, error: err.trim() || `PowerShell vrátil kód ${code}.` });
      finish({ ok: true, output: out.trim(), stderr: err.trim() });
    });
  });
}

function parseJson(text, fallback = null) {
  const value = String(text || "").trim();
  if (!value) return fallback;
  try { return JSON.parse(value); } catch { return undefined; }
}

async function runPowerShellJson(script, timeoutMs = 20_000) {
  const wrapped = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[Text.Encoding]::UTF8; ${script}`;
  const result = await runPowerShell(wrapped, timeoutMs);
  if (!result.ok) return { ...result, data: null };
  const data = parseJson(result.output);
  if (data === undefined) return { ok: false, error: "Windows vrátil nečitelná data.", data: null };
  return { ...result, data };
}

// Skript musí do proměnné $result přiřadit objekt; ten se uloží jako JSON.
// Chyby skriptu se zachytí a vrátí jako { ok:false, error }.
async function runElevatedJson(script, { timeoutMs = 120_000, elevate = true } = {}) {
  if (!IS_WINDOWS) return { ok: false, unsupported: true, error: "Dostupné pouze ve Windows." };
  const outFile = path.join(os.tmpdir(), `voxario-protect-${crypto.randomBytes(6).toString("hex")}.json`);
  const body = [
    "$ErrorActionPreference='Stop'",
    `$__out=${psLiteral(outFile)}`,
    "try {",
    "  $result=$null",
    script,
    "  $payload=[pscustomobject]@{ok=$true;data=$result}",
    "} catch {",
    "  $payload=[pscustomobject]@{ok=$false;error=[string]$_.Exception.Message}",
    "}",
    "$payload | ConvertTo-Json -Depth 8 -Compress | Set-Content -LiteralPath $__out -Encoding UTF8",
  ].join("\n");

  let launch;
  let staged = { cleanup: () => {} };
  if (elevate) {
    // Start-Process čeká na dokončení; zrušená UAC výzva vyhodí výjimku.
    staged = stageScript(body);
    launch = [
      "$ErrorActionPreference='Stop'",
      `$p=Start-Process -FilePath 'powershell.exe' -Verb RunAs -WindowStyle Hidden -Wait -PassThru -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-EncodedCommand','${encode(staged.command)}')`,
      "'exit:' + $p.ExitCode",
    ].join("; ");
  } else {
    launch = body;
  }

  const run = await runPowerShell(launch, timeoutMs).finally(staged.cleanup);
  let payload = null;
  try {
    if (fs.existsSync(outFile)) payload = parseJson(fs.readFileSync(outFile, "utf8").replace(/^\uFEFF/, ""));
  } catch {}
  try { fs.rmSync(outFile, { force: true }); } catch {}

  if (!run.ok && !payload) {
    if (/canceled|cancelled|zrušen|zru.en|1223|operation was canceled/i.test(String(run.error || ""))) {
      return { ok: false, canceled: true, error: "Potvrzení správce (UAC) bylo zrušeno." };
    }
    return { ok: false, error: run.error || "Akci se nepodařilo provést." };
  }
  if (!payload) return { ok: false, error: "Akce neskončila výsledkem. Zkus to prosím znovu." };
  if (!payload.ok) return { ok: false, error: payload.error || "Windows akci odmítl." };
  return { ok: true, data: payload.data };
}

module.exports = {
  IS_WINDOWS,
  psLiteral,
  runPowerShell,
  runPowerShellJson,
  runElevatedJson,
};

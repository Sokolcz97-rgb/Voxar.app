"use strict";

// VoxarioProtect Guard – posílení Microsoft Defenderu a Windows Firewallu.
//
// Zásady:
// - Defender a Firewall zůstávají autoritou; Guard jen zapíná jejich
//   vestavěné ochrany, které Windows ve výchozím stavu nechává vypnuté.
// - Každá změna proběhne až po potvrzení uživatele (UAC) a před změnou se
//   uloží původní hodnoty, takže jde vše vrátit.
// - Guard nikdy nic nevypíná, nepřidává výjimky bez výslovné žádosti
//   uživatele a neobnovuje položky z karantény.
//
// Hodnoty podle Microsoft Learn:
// - ASR akce: 0 Disabled, 1 Block, 2 Audit, 5 NotConfigured, 6 Warn.
// - ID pravidel ASR: "Attack surface reduction rules reference".

const { psLiteral, runPowerShellJson, runElevatedJson } = require("./protect-windows.cjs");

const ASR = Object.freeze({
  vulnerableDrivers: "56a863a9-875e-4185-98a7-b882c64b5ce5",
  lsass: "9e6c4e1f-7d60-472f-ba1a-a39ef669e4b2",
  wmiPersistence: "e6db77e5-3df2-4cf1-b95a-636979351e5b",
  officeChild: "d4f940ab-401b-4efc-aadc-ad5f3c50688a",
  officeExecutable: "3b576869-a4ec-4529-8536-b80a7769e899",
  officeInjection: "75668c1f-73b5-4cf0-bb93-3ecf5cb7cc84",
  officeMacroWin32: "92e97fa1-2edf-4476-bdd6-9dd0b4dddc7b",
  emailExecutable: "be9ba2d9-53ea-4cdc-84e5-9b1eeee46550",
  scriptDownloaded: "d3e037e1-3eb8-44c8-a917-57927947596d",
  obfuscatedScripts: "5beb7efe-fd9a-4556-801d-275e5ffc04cc",
  usbUnsigned: "b2b3f03d-6a65-4f7b-a9c7-1c7ef74a9ba4",
  ransomware: "c1db55ab-c21a-4637-bb3f-a12568109d35",
});

const ASR_NAMES = Object.freeze({
  [ASR.vulnerableDrivers]: "Zneužití zranitelných podepsaných ovladačů",
  [ASR.lsass]: "Krádež přihlašovacích údajů z LSASS",
  [ASR.wmiPersistence]: "Usazení přes WMI odběr událostí",
  [ASR.officeChild]: "Office spouští další programy",
  [ASR.officeExecutable]: "Office vytváří spustitelné soubory",
  [ASR.officeInjection]: "Office vkládá kód do jiných procesů",
  [ASR.officeMacroWin32]: "Win32 volání z maker Office",
  [ASR.emailExecutable]: "Spustitelný obsah z e-mailu",
  [ASR.scriptDownloaded]: "JavaScript/VBScript spouští stažené programy",
  [ASR.obfuscatedScripts]: "Zamaskované skripty",
  [ASR.usbUnsigned]: "Nepodepsané programy z USB",
  [ASR.ransomware]: "Pokročilá ochrana proti ransomwaru",
});

const ACTION = Object.freeze({ disabled: 0, block: 1, audit: 2, notConfigured: 5, warn: 6 });

// Položky posílení. `prefs` = parametry Set-MpPreference s cílovou hodnotou
// a podmínkou, kdy je stav v pořádku. `asr` = pravidla a akce.
const HARDENING_ITEMS = Object.freeze([
  {
    id: "realtime",
    group: "defender",
    recommended: true,
    title: "Plná ochrana v reálném čase",
    description: "Zapne kontrolu v reálném čase, sledování chování, kontrolu stažených souborů a skriptů, pokud je něco vypnulo.",
    prefs: {
      DisableRealtimeMonitoring: { value: false, ok: (v) => v === false },
      DisableBehaviorMonitoring: { value: false, ok: (v) => v === false },
      DisableIOAVProtection: { value: false, ok: (v) => v === false },
      DisableScriptScanning: { value: false, ok: (v) => v === false },
    },
  },
  {
    id: "pua",
    group: "defender",
    recommended: true,
    title: "Blokovat nechtěné aplikace (PUA)",
    description: "Zastaví adware, přibalené toolbary, těžaře kryptoměn a podobné „skoro viry“, které Defender ve výchozím stavu pouští.",
    prefs: { PUAProtection: { value: 1, ok: (v) => Number(v) === 1 } },
  },
  {
    id: "cloud",
    group: "defender",
    recommended: true,
    title: "Silnější cloudová ochrana",
    description: "Neznámé soubory ověří Microsoft cloud dřív, než se spustí (vysoká úroveň blokování, delší čas na ověření).",
    prefs: {
      MAPSReporting: { value: 2, ok: (v) => Number(v) >= 1 },
      SubmitSamplesConsent: { value: 1, ok: (v) => [1, 3].includes(Number(v)) },
      DisableBlockAtFirstSeen: { value: false, ok: (v) => v === false },
      CloudBlockLevel: { value: 2, ok: (v) => Number(v) >= 2 },
      CloudExtendedTimeout: { value: 50, ok: (v) => Number(v) >= 20 },
    },
  },
  {
    id: "network",
    group: "internet",
    recommended: true,
    title: "Síťová ochrana na internetu",
    description: "Defender zablokuje připojení na podvodné a škodlivé weby ve všech aplikacích, nejen v prohlížeči Edge.",
    prefs: { EnableNetworkProtection: { value: 1, ok: (v) => Number(v) === 1 } },
  },
  {
    id: "asrCore",
    group: "defender",
    recommended: true,
    title: "Ochrana systému (ASR – standard)",
    description: "Pravidla, která Microsoft doporučuje zapnout rovnou: ochrana hesel ve Windows, zranitelné ovladače a usazení přes WMI.",
    asr: [
      { id: ASR.vulnerableDrivers, action: ACTION.block },
      { id: ASR.lsass, action: ACTION.block },
      { id: ASR.wmiPersistence, action: ACTION.block },
    ],
  },
  {
    id: "asrOffice",
    group: "defender",
    recommended: true,
    title: "Ochrana proti makrům a e-mailům",
    description: "Dokumenty Office a e-maily nesmí spouštět programy, vytvářet spustitelné soubory ani vkládat kód do jiných aplikací.",
    asr: [
      { id: ASR.officeChild, action: ACTION.block },
      { id: ASR.officeExecutable, action: ACTION.block },
      { id: ASR.officeInjection, action: ACTION.block },
      { id: ASR.officeMacroWin32, action: ACTION.block },
      { id: ASR.emailExecutable, action: ACTION.block },
    ],
  },
  {
    id: "asrScripts",
    group: "defender",
    recommended: true,
    title: "Ochrana proti skriptům a USB",
    description: "Zastaví zamaskované skripty a skripty stahující programy (s možností pokračovat) a nepodepsané programy z USB.",
    asr: [
      { id: ASR.scriptDownloaded, action: ACTION.warn },
      { id: ASR.obfuscatedScripts, action: ACTION.warn },
      { id: ASR.usbUnsigned, action: ACTION.block },
    ],
  },
  {
    id: "asrRansomware",
    group: "defender",
    recommended: true,
    title: "Pokročilá ochrana proti ransomwaru",
    description: "Cloudová heuristika zastaví programy podobné vyděračským virům. Při podezření se zobrazí varování s možností pokračovat.",
    asr: [{ id: ASR.ransomware, action: ACTION.warn }],
  },
  {
    id: "folders",
    group: "defender",
    recommended: false,
    title: "Ochrana složek (Controlled Folder Access)",
    description: "Neznámé programy nesmí měnit Dokumenty, Obrázky a Plochu. Silná ochrana proti ransomwaru, ale může blokovat ukládání některých her – povolené aplikace pak přidáš v přehledu blokování.",
    prefs: { EnableControlledFolderAccess: { value: 1, ok: (v) => Number(v) === 1 } },
  },
  {
    id: "lowImpact",
    group: "updates",
    recommended: true,
    title: "Méně zátěže během aktualizací",
    description: "Kontroly Defenderu poběží s nízkou prioritou, max. 30 % procesoru a plánované kontroly jen při nečinnosti počítače.",
    prefs: {
      EnableLowCpuPriority: { value: true, ok: (v) => v === true },
      ScanAvgCPULoadFactor: { value: 30, ok: (v) => Number(v) >= 5 && Number(v) <= 30 },
      ScanOnlyIfIdleEnabled: { value: true, ok: (v) => v === true },
    },
  },
  {
    id: "freshSignatures",
    group: "updates",
    recommended: true,
    title: "Čerstvé definice",
    description: "Definice se kontrolují každé 4 hodiny a vždy před každou kontrolou, takže Defender nepracuje se zastaralou databází.",
    prefs: {
      SignatureUpdateInterval: { value: 4, ok: (v) => Number(v) >= 1 && Number(v) <= 8 },
      CheckForSignaturesBeforeRunningScan: { value: true, ok: (v) => v === true },
    },
  },
  {
    id: "firewallOn",
    group: "firewall",
    recommended: true,
    title: "Firewall zapnutý ve všech sítích",
    description: "Zapne Windows Defender Firewall pro domácí, firemní i veřejné sítě, pokud je některý profil vypnutý.",
    firewall: { Enabled: "True" },
  },
  {
    id: "firewallInbound",
    group: "firewall",
    recommended: true,
    title: "Blokovat nevyžádaná příchozí spojení",
    description: "Výchozí akce pro příchozí spojení bude „Blokovat“ ve všech profilech. Povolená pravidla (hry, sdílení) dál fungují.",
    firewall: { DefaultInboundAction: "Block" },
  },
]);

const PREF_NAMES = [...new Set(HARDENING_ITEMS.flatMap((item) => Object.keys(item.prefs || {})))];
const ITEM_BY_ID = new Map(HARDENING_ITEMS.map((item) => [item.id, item]));

// ----------------------------------------------------------------- čtení stavu

function statusScript() {
  const pick = PREF_NAMES.map((name) => `${name}=$p.${name}`).join(";");
  return [
    "$p=Get-MpPreference",
    "$s=Get-MpComputerStatus",
    "$ids=@($p.AttackSurfaceReductionRules_Ids)",
    "$acts=@($p.AttackSurfaceReductionRules_Actions)",
    "$asr=@(); for($i=0;$i -lt [Math]::Min($ids.Count,$acts.Count);$i++){ if($ids[$i]){ $asr+=[pscustomobject]@{id=([string]$ids[$i]).ToLowerInvariant();action=[int]$acts[$i]} } }",
    "$fw=@(Get-NetFirewallProfile | ForEach-Object { [pscustomobject]@{name=[string]$_.Name;Enabled=[string]$_.Enabled;DefaultInboundAction=[string]$_.DefaultInboundAction} })",
    `[pscustomobject]@{prefs=[pscustomobject]@{${pick}};asr=$asr;firewall=$fw;computer=[pscustomobject]@{AMServiceEnabled=$s.AMServiceEnabled;AntivirusEnabled=$s.AntivirusEnabled;RealTimeProtectionEnabled=$s.RealTimeProtectionEnabled;IsTamperProtected=$s.IsTamperProtected;AMRunningMode=[string]$s.AMRunningMode;AntivirusSignatureAge=$s.AntivirusSignatureAge;AntivirusSignatureVersion=[string]$s.AntivirusSignatureVersion;AntivirusSignatureLastUpdated=$(if($s.AntivirusSignatureLastUpdated){$s.AntivirusSignatureLastUpdated.ToString('o')}else{$null})}} | ConvertTo-Json -Depth 6 -Compress`,
  ].join("\n");
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function evaluateItem(item, raw) {
  if (!raw) return { state: "unknown", details: [] };
  const details = [];
  if (item.prefs) {
    for (const [name, rule] of Object.entries(item.prefs)) {
      const current = raw.prefs ? raw.prefs[name] : undefined;
      details.push({ name, current: current ?? null, target: rule.value, ok: current !== undefined && current !== null && rule.ok(current) });
    }
  }
  if (item.asr) {
    const map = new Map(asArray(raw.asr).map((row) => [String(row.id).toLowerCase(), Number(row.action)]));
    for (const rule of item.asr) {
      const current = map.has(rule.id) ? map.get(rule.id) : null;
      // Blokování je silnější než varování – obojí bereme jako zapnuté.
      const ok = current === ACTION.block || (rule.action === ACTION.warn && current === ACTION.warn);
      details.push({ name: ASR_NAMES[rule.id] || rule.id, asrId: rule.id, current, target: rule.action, ok });
    }
  }
  if (item.firewall) {
    const profiles = asArray(raw.firewall);
    for (const [name, target] of Object.entries(item.firewall)) {
      for (const profile of profiles) {
        const current = profile[name] ?? null;
        details.push({ name: `${profile.name}: ${name}`, current, target, ok: String(current).toLowerCase() === String(target).toLowerCase() });
      }
    }
  }
  if (!details.length) return { state: "unknown", details };
  return { state: details.every((d) => d.ok) ? "ok" : "off", details };
}

function evaluateStatus(raw) {
  const items = HARDENING_ITEMS.map((item) => {
    const evaluation = evaluateItem(item, raw);
    return {
      id: item.id,
      group: item.group,
      recommended: item.recommended,
      title: item.title,
      description: item.description,
      state: evaluation.state,
      details: evaluation.details,
    };
  });
  const recommended = items.filter((item) => item.recommended);
  const done = recommended.filter((item) => item.state === "ok").length;
  const computer = raw?.computer || {};
  const signatureAge = Number.isFinite(Number(computer.AntivirusSignatureAge)) ? Number(computer.AntivirusSignatureAge) : null;
  return {
    items,
    score: recommended.length ? Math.round((done / recommended.length) * 100) : 0,
    recommendedDone: done,
    recommendedTotal: recommended.length,
    defender: {
      available: computer.AMServiceEnabled !== false && raw != null,
      realtime: computer.RealTimeProtectionEnabled ?? null,
      tamperProtected: computer.IsTamperProtected ?? null,
      runningMode: computer.AMRunningMode || null,
      signatureAge,
      signatureVersion: computer.AntivirusSignatureVersion || null,
      signatureUpdated: computer.AntivirusSignatureLastUpdated || null,
      signaturesStale: signatureAge !== null && signatureAge >= 2,
    },
  };
}

async function readStatus() {
  const result = await runPowerShellJson(statusScript(), 30_000);
  if (!result.ok) return { ok: false, unsupported: !!result.unsupported, error: result.error };
  return { ok: true, status: evaluateStatus(result.data), raw: result.data };
}

// ----------------------------------------------------------------- změny

function psValue(value) {
  if (typeof value === "boolean") return value ? "$true" : "$false";
  if (typeof value === "number") return String(value);
  return psLiteral(value);
}

function selectedItems(ids) {
  const unique = [...new Set(asArray(ids))];
  const items = unique.map((id) => ITEM_BY_ID.get(id)).filter(Boolean);
  if (!items.length) throw new Error("Nebyla vybrána žádná známá položka posílení.");
  return items;
}

// Skript, který uloží původní hodnoty ($before), provede změny a přečte nový
// stav. Každá položka se provádí zvlášť, aby chyba jedné nezastavila ostatní.
function applyScript(ids) {
  const items = selectedItems(ids);
  const lines = [
    "$errors=@()",
    "$p=Get-MpPreference",
    `$beforePrefs=[pscustomobject]@{${PREF_NAMES.map((n) => `${n}=$p.${n}`).join(";")}}`,
    "$ids=@($p.AttackSurfaceReductionRules_Ids); $acts=@($p.AttackSurfaceReductionRules_Actions)",
    "$beforeAsr=@(); for($i=0;$i -lt [Math]::Min($ids.Count,$acts.Count);$i++){ if($ids[$i]){ $beforeAsr+=[pscustomobject]@{id=([string]$ids[$i]).ToLowerInvariant();action=[int]$acts[$i]} } }",
    "$beforeFw=@(Get-NetFirewallProfile | ForEach-Object { [pscustomobject]@{name=[string]$_.Name;Enabled=[string]$_.Enabled;DefaultInboundAction=[string]$_.DefaultInboundAction} })",
  ];
  for (const item of items) {
    if (item.prefs) {
      const args = Object.entries(item.prefs).map(([name, rule]) => `-${name} ${psValue(rule.value)}`).join(" ");
      lines.push(`try { Set-MpPreference ${args} } catch { $errors+=[pscustomobject]@{item=${psLiteral(item.id)};error=[string]$_.Exception.Message} }`);
    }
    if (item.asr) {
      const idsArg = item.asr.map((rule) => rule.id).join(",");
      const actsArg = item.asr.map((rule) => rule.action).join(",");
      lines.push(`try { Add-MpPreference -AttackSurfaceReductionRules_Ids ${idsArg} -AttackSurfaceReductionRules_Actions ${actsArg} } catch { $errors+=[pscustomobject]@{item=${psLiteral(item.id)};error=[string]$_.Exception.Message} }`);
    }
    if (item.firewall) {
      const args = Object.entries(item.firewall).map(([name, value]) => `-${name} ${value}`).join(" ");
      lines.push(`try { Set-NetFirewallProfile -Profile Domain,Private,Public ${args} } catch { $errors+=[pscustomobject]@{item=${psLiteral(item.id)};error=[string]$_.Exception.Message} }`);
    }
  }
  lines.push("$result=[pscustomobject]@{before=[pscustomobject]@{prefs=$beforePrefs;asr=$beforeAsr;firewall=$beforeFw};errors=$errors}");
  return lines.join("\n");
}

// Vrácení položek na hodnoty uložené před posílením.
function revertScript(ids, backup) {
  const items = selectedItems(ids);
  if (!backup || typeof backup !== "object") throw new Error("Chybí záloha původního nastavení.");
  const beforeAsr = new Map(asArray(backup.asr).map((row) => [String(row.id).toLowerCase(), Number(row.action)]));
  const lines = ["$errors=@()"];
  for (const item of items) {
    if (item.prefs) {
      const parts = [];
      for (const name of Object.keys(item.prefs)) {
        const old = backup.prefs ? backup.prefs[name] : undefined;
        if (old === undefined || old === null) continue;
        parts.push(`-${name} ${psValue(typeof old === "boolean" ? old : Number(old))}`);
      }
      if (parts.length) lines.push(`try { Set-MpPreference ${parts.join(" ")} } catch { $errors+=[pscustomobject]@{item=${psLiteral(item.id)};error=[string]$_.Exception.Message} }`);
    }
    if (item.asr) {
      for (const rule of item.asr) {
        if (beforeAsr.has(rule.id)) {
          lines.push(`try { Add-MpPreference -AttackSurfaceReductionRules_Ids ${rule.id} -AttackSurfaceReductionRules_Actions ${beforeAsr.get(rule.id)} } catch { $errors+=[pscustomobject]@{item=${psLiteral(item.id)};error=[string]$_.Exception.Message} }`);
        } else {
          lines.push(`try { Remove-MpPreference -AttackSurfaceReductionRules_Ids ${rule.id} } catch { $errors+=[pscustomobject]@{item=${psLiteral(item.id)};error=[string]$_.Exception.Message} }`);
        }
      }
    }
    if (item.firewall) {
      for (const profile of asArray(backup.firewall)) {
        const parts = Object.keys(item.firewall)
          .filter((name) => profile[name])
          .map((name) => `-${name} ${String(profile[name]).replace(/[^A-Za-z]/g, "")}`);
        if (parts.length) lines.push(`try { Set-NetFirewallProfile -Profile ${String(profile.name).replace(/[^A-Za-z]/g, "")} ${parts.join(" ")} } catch { $errors+=[pscustomobject]@{item=${psLiteral(item.id)};error=[string]$_.Exception.Message} }`);
      }
    }
  }
  lines.push("$result=[pscustomobject]@{errors=$errors}");
  return lines.join("\n");
}

// Sloučení zálohy: první záloha hodnoty se už nepřepisuje (aby „Obnovit“ po
// driftu nesmazalo opravdu původní stav).
function mergeBackup(previous, next) {
  const prev = previous && typeof previous === "object" ? previous : {};
  const prefs = { ...(next?.prefs || {}), ...(prev.prefs || {}) };
  const asr = new Map(asArray(next?.asr).map((row) => [String(row.id).toLowerCase(), row]));
  for (const row of asArray(prev.asr)) asr.set(String(row.id).toLowerCase(), row);
  const firewall = asArray(prev.firewall).length ? asArray(prev.firewall) : asArray(next?.firewall);
  return { prefs, asr: [...asr.values()], firewall };
}

async function applyHardening(ids) {
  const result = await runElevatedJson(applyScript(ids));
  if (!result.ok) return result;
  return { ok: true, before: result.data?.before || null, errors: asArray(result.data?.errors) };
}

async function revertHardening(ids, backup) {
  const result = await runElevatedJson(revertScript(ids, backup));
  if (!result.ok) return result;
  return { ok: true, errors: asArray(result.data?.errors) };
}

// ----------------------------------------------------------------- definice

function signatureUpdateScript() {
  return [
    "$method='Update-MpSignature'",
    "try { Update-MpSignature -UpdateSource MicrosoftUpdateServer -ErrorAction Stop }",
    "catch {",
    "  $method='MpCmdRun (MMPC)'",
    "  $cmd=Join-Path $env:ProgramFiles 'Windows Defender\\MpCmdRun.exe'",
    "  if(-not (Test-Path -LiteralPath $cmd)){ throw 'Microsoft Defender nástroj MpCmdRun nebyl nalezen.' }",
    "  & $cmd -SignatureUpdate -MMPC | Out-Null",
    "  if($LASTEXITCODE -ne 0){ throw ('Aktualizace definic selhala (kód ' + $LASTEXITCODE + '). Zkontroluj připojení k internetu a Windows Update.') }",
    "}",
    "$s=Get-MpComputerStatus",
    "$result=[pscustomobject]@{method=$method;age=$s.AntivirusSignatureAge;version=[string]$s.AntivirusSignatureVersion}",
  ].join("\n");
}

async function updateSignatures() {
  return runElevatedJson(signatureUpdateScript(), { timeoutMs: 240_000 });
}

// ----------------------------------------------------------------- co Defender zablokoval

// 1116/1117 hrozby, 1121 blokace ASR, 1123 blokace ochrany složek,
// 5007 změna nastavení Defenderu.
function blockedEventsScript(days = 14) {
  const since = Math.max(1, Math.min(60, Number(days) || 14));
  return [
    `$since=(Get-Date).AddDays(-${since})`,
    "$events=@(Get-WinEvent -FilterHashtable @{LogName='Microsoft-Windows-Windows Defender/Operational';Id=1116,1117,1121,1123,5007;StartTime=$since} -MaxEvents 80 -ErrorAction SilentlyContinue)",
    "$rows=@(); foreach($e in $events){",
    "  $d=@{}; try { ([xml]$e.ToXml()).Event.EventData.Data | ForEach-Object { $d[[string]$_.Name]=[string]$_.'#text' } } catch {}",
    "  $rows+=[pscustomobject]@{record=[string]$e.RecordId;eventId=$e.Id;time=$e.TimeCreated.ToString('o');path=$d['Path'];process=$d['Process Name'];rule=$d['ID'];threat=$d['Threat Name'];action=$d['Action Name'];category=$d['Category Name'];setting=$d['New Value']}",
    "}",
    "$rows | ConvertTo-Json -Depth 4 -Compress",
  ].join("\n");
}

function cleanEventPath(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  // Defender používá formát "file:_C:\cesta" nebo více zdrojů oddělených ";".
  const first = text.split(/;\s*/)[0];
  return first.replace(/^(file|process|containerfile|webfile|regkey):_/i, "").trim() || null;
}

function summarizeBlockedEvents(rows) {
  return asArray(rows).map((row) => {
    const eventId = Number(row.eventId);
    const rule = String(row.rule || "").toLowerCase();
    const base = { id: String(row.record || `${eventId}:${row.time}`), eventId, time: row.time || null };
    if (eventId === 1121) {
      return { ...base, kind: "asr", title: `Blokováno pravidlem: ${ASR_NAMES[rule] || "Ochrana ASR"}`, target: cleanEventPath(row.path), process: cleanEventPath(row.process), rule, canAllow: !!cleanEventPath(row.path) };
    }
    if (eventId === 1123) {
      return { ...base, kind: "folders", title: "Ochrana složek zastavila zápis", target: cleanEventPath(row.path), process: cleanEventPath(row.process), canAllow: !!cleanEventPath(row.process) };
    }
    if (eventId === 5007) {
      return { ...base, kind: "config", title: "Nastavení Defenderu se změnilo", target: null, detail: String(row.setting || "").slice(0, 240), canAllow: false };
    }
    return { ...base, kind: "threat", title: row.threat ? `Hrozba: ${row.threat}` : "Defender zachytil hrozbu", target: cleanEventPath(row.path), detail: [row.category, row.action].filter(Boolean).join(" · "), canAllow: false };
  });
}

async function readBlocked(days) {
  const result = await runPowerShellJson(blockedEventsScript(days), 30_000);
  if (!result.ok) return { ok: false, error: result.error, unsupported: !!result.unsupported };
  return { ok: true, items: summarizeBlockedEvents(result.data) };
}

// Povolení konkrétní aplikace po falešném poplachu. Jen konkrétní existující
// soubor (žádné složky ani zástupné znaky). Nepodepsané soubory jen pokud to
// uživatel výslovně potvrdil.
function allowScript(kind, filePath, allowUnsigned) {
  const target = String(filePath || "").trim();
  if (!/^[A-Za-z]:\\/.test(target) || /[*?]/.test(target)) throw new Error("Povolit lze jen konkrétní soubor na disku.");
  const cmdlet = kind === "folders" ? "ControlledFolderAccessAllowedApplications" : "AttackSurfaceReductionOnlyExclusions";
  return [
    `$target=${psLiteral(target)}`,
    "if(-not (Test-Path -LiteralPath $target -PathType Leaf)){ throw 'Soubor už na disku není.' }",
    "$sig=Get-AuthenticodeSignature -LiteralPath $target",
    `if($sig.Status -ne 'Valid' -and -not ${allowUnsigned ? "$true" : "$false"}){ throw 'Soubor není platně podepsaný. Povolení vyžaduje výslovné potvrzení.' }`,
    `Add-MpPreference -${cmdlet} $target`,
    "$result=[pscustomobject]@{path=$target;signer=$(if($sig.SignerCertificate){$sig.SignerCertificate.Subject}else{$null});signature=[string]$sig.Status}",
  ].join("\n");
}

function removeAllowScript(kind, filePath) {
  const cmdlet = kind === "folders" ? "ControlledFolderAccessAllowedApplications" : "AttackSurfaceReductionOnlyExclusions";
  return `Remove-MpPreference -${cmdlet} ${psLiteral(filePath)}\n$result=[pscustomobject]@{removed=$true}`;
}

async function allowBlocked(kind, filePath, allowUnsigned = false) {
  return runElevatedJson(allowScript(kind, filePath, allowUnsigned));
}

async function removeAllowed(kind, filePath) {
  return runElevatedJson(removeAllowScript(kind, filePath));
}

// ----------------------------------------------------------------- drift

// Položky, které uživatel posílil, ale teď už nejsou v pořádku.
function detectDrift(appliedIds, status) {
  const applied = new Set(asArray(appliedIds));
  return asArray(status?.items).filter((item) => applied.has(item.id) && item.state === "off").map((item) => item.id);
}

module.exports = {
  ASR,
  ASR_NAMES,
  ACTION,
  HARDENING_ITEMS,
  statusScript,
  evaluateItem,
  evaluateStatus,
  readStatus,
  applyScript,
  revertScript,
  mergeBackup,
  applyHardening,
  revertHardening,
  signatureUpdateScript,
  updateSignatures,
  blockedEventsScript,
  summarizeBlockedEvents,
  readBlocked,
  allowScript,
  removeAllowScript,
  allowBlocked,
  removeAllowed,
  detectDrift,
};

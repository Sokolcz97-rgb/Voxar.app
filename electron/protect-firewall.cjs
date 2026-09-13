"use strict";

// Windows Defender Firewall companion helpers.
// VoxarioProtect never disables the firewall, never changes default profile
// policy and never creates broad allow rules. It can inspect profile state and,
// after explicit user confirmation, create/remove only its own per-program
// outbound BLOCK rules.

const crypto = require("crypto");
const path = require("path");

const RULE_GROUP = "VoxarioProtect";
const RULE_PREFIX = "VoxarioProtect.Block.";
const BLOCKABLE_EXTENSIONS = new Set([".exe", ".com", ".scr"]);
const selectionTokens = new Map();
let foregroundBridgeInstalled = false;

function normalizedProgramPath(filePath) {
  return path.resolve(String(filePath || ""));
}

function ruleIdForPath(filePath) {
  const normalized = normalizedProgramPath(filePath).toLowerCase();
  const suffix = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 20);
  return `${RULE_PREFIX}${suffix}`;
}

function isManagedRuleName(value) {
  return /^VoxarioProtect\.Block\.[0-9a-f]{20}$/i.test(String(value || ""));
}

function firewallStatusScript() {
  return [
    "$ErrorActionPreference='Stop'",
    "$rows=Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction",
    "$rows | ConvertTo-Json -Compress",
  ].join("; ");
}

function firewallDashboardScript() {
  return [
    "$ErrorActionPreference='Stop'",
    "$profiles=@(Get-NetFirewallProfile | Select-Object Name,Enabled,DefaultInboundAction,DefaultOutboundAction)",
    "$service=Get-Service -Name mpssvc -ErrorAction SilentlyContinue",
    "$connections=@(Get-NetConnectionProfile -ErrorAction SilentlyContinue | Select-Object Name,NetworkCategory,IPv4Connectivity,IPv6Connectivity)",
    `$rules=@(Get-NetFirewallRule -Name '${RULE_PREFIX}*' -ErrorAction SilentlyContinue | ForEach-Object {`,
    "  $rule=$_",
    "  $app=$rule | Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue",
    "  [pscustomobject]@{Name=$rule.Name;DisplayName=$rule.DisplayName;Enabled=[string]$rule.Enabled;Direction=[string]$rule.Direction;Action=[string]$rule.Action;Program=$app.Program}",
    "})",
    "[pscustomobject]@{Profiles=$profiles;ServiceRunning=($service.Status -eq 'Running');Connections=$connections;Rules=$rules} | ConvertTo-Json -Depth 6 -Compress",
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
    `if(-not $existing){New-NetFirewallRule -Name $rule -DisplayName ('VoxarioProtect: '+[IO.Path]::GetFileName($target)) -Group '${RULE_GROUP}' -Direction Outbound -Action Block -Program $target -Profile Any -Enabled True | Out-Null}`,
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

function powershellLiteral(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function runPowerShell(script, timeoutMs = 15_000) {
  if (process.platform !== "win32") {
    return Promise.resolve({ ok: false, error: "VoxarioProtect Firewall je dostupný pouze ve Windows." });
  }
  const { spawn } = require("child_process");
  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let settled = false;
    let child;
    let timer = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      resolve(value);
    };
    try {
      child = spawn("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", script], {
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      resolve({ ok: false, error: error?.message || "PowerShell se nepodařilo spustit." });
      return;
    }
    timer = setTimeout(() => {
      try { child.kill(); } catch {}
      finish({ ok: false, error: "Operace Windows Firewall překročila časový limit." });
    }, timeoutMs);
    timer.unref?.();
    child.stdout?.on("data", (chunk) => { out += String(chunk); });
    child.stderr?.on("data", (chunk) => { err += String(chunk); });
    child.once("error", (error) => finish({ ok: false, error: error?.message || "PowerShell se nepodařilo spustit." }));
    child.once("close", (code) => {
      if (code !== 0) return finish({ ok: false, error: err.trim() || `PowerShell vrátil kód ${code}.` });
      finish({ ok: true, output: out.trim() });
    });
  });
}

async function runPowerShellJson(script, timeoutMs = 15_000) {
  const result = await runPowerShell(script, timeoutMs);
  if (!result.ok) return { ...result, data: null };
  try {
    return { ...result, data: JSON.parse(result.output || "null") };
  } catch {
    return { ok: false, error: "Windows Firewall vrátil nečitelná data.", data: null };
  }
}

async function runElevatedFirewallScript(script, timeoutMs = 45_000) {
  const encoded = Buffer.from(String(script), "utf16le").toString("base64");
  const launcher = [
    "$ErrorActionPreference='Stop'",
    `$p=Start-Process -FilePath 'powershell.exe' -Verb RunAs -ArgumentList @('-NoLogo','-NoProfile','-NonInteractive','-EncodedCommand','${encoded}') -Wait -PassThru`,
    "if($p.ExitCode -ne 0){throw ('Elevated firewall action failed: '+$p.ExitCode)}",
    "'ok'",
  ].join("; ");
  const result = await runPowerShell(launcher, timeoutMs);
  if (!result.ok && /canceled|cancelled|zru|1223/i.test(String(result.error || ""))) {
    return { ok: false, canceled: true, error: "UAC potvrzení bylo zrušeno." };
  }
  return result;
}

function isProtectedSystemProgram(filePath) {
  const normalized = normalizedProgramPath(filePath).toLowerCase();
  const own = normalizedProgramPath(process.execPath).toLowerCase();
  if (normalized === own) return true;
  const winDir = String(process.env.WINDIR || process.env.SystemRoot || "").trim();
  if (winDir) {
    const normalizedWin = normalizedProgramPath(winDir).toLowerCase();
    if (normalized === normalizedWin || normalized.startsWith(normalizedWin + path.sep)) return true;
  }
  return false;
}

function backgroundStatePath(app) {
  return path.join(app.getPath("userData"), "voxario-protect-background.json");
}

function readBackgroundSummary(app) {
  try {
    const payload = JSON.parse(require("fs").readFileSync(backgroundStatePath(app), "utf8"));
    const activities = Array.isArray(payload?.activities) ? payload.activities : [];
    return {
      updatedAt: payload?.updatedAt || null,
      protectionScore: Number.isFinite(Number(payload?.protectionScore)) ? Number(payload.protectionScore) : null,
      profile: String(payload?.profile || "balanced"),
      firewallStatus: payload?.firewallStatus && typeof payload.firewallStatus === "object" ? payload.firewallStatus : null,
      crossChecks: activities
        .filter((item) => ["protect", "cross-check", "defender", "firewall"].includes(String(item?.type || "")))
        .slice(0, 8)
        .map((item) => ({
          at: item?.at || item?.createdAt || null,
          type: String(item?.type || "protect"),
          status: String(item?.status || "info"),
          severity: String(item?.severity || "info"),
          title: String(item?.title || "Bezpečnostní událost").slice(0, 140),
          detail: String(item?.detail || "").slice(0, 260),
          fileName: item?.fileName ? String(item.fileName).slice(0, 180) : null,
          protectRiskScore: Number.isFinite(Number(item?.protectRiskScore)) ? Number(item.protectRiskScore) : null,
        })),
    };
  } catch {
    return { updatedAt: null, protectionScore: null, profile: "balanced", firewallStatus: null, crossChecks: [] };
  }
}

async function getFirewallDashboard(app) {
  const result = await runPowerShellJson(firewallDashboardScript(), 20_000);
  if (!result.ok || !result.data) return result;
  const data = result.data;
  const firewall = summarizeFirewallProfiles(data.Profiles);
  const rawRules = Array.isArray(data.Rules) ? data.Rules : data.Rules ? [data.Rules] : [];
  const rules = rawRules
    .filter((rule) => isManagedRuleName(rule?.Name))
    .map((rule) => ({
      name: String(rule.Name),
      displayName: String(rule.DisplayName || rule.Name),
      enabled: String(rule.Enabled || "").toLowerCase() !== "false",
      direction: String(rule.Direction || "Outbound"),
      action: String(rule.Action || "Block"),
      program: Array.isArray(rule.Program) ? String(rule.Program[0] || "") : String(rule.Program || ""),
    }));
  const rawConnections = Array.isArray(data.Connections) ? data.Connections : data.Connections ? [data.Connections] : [];
  return {
    ok: true,
    firewall: {
      ...firewall,
      serviceRunning: data.ServiceRunning === true,
      connections: rawConnections.map((item) => ({
        name: String(item?.Name || "Síť"),
        category: String(item?.NetworkCategory || "Unknown"),
        ipv4: String(item?.IPv4Connectivity || "Unknown"),
        ipv6: String(item?.IPv6Connectivity || "Unknown"),
      })),
    },
    rules,
    background: readBackgroundSummary(app),
    capabilities: {
      globalPolicyReadOnly: true,
      canCreateAllowRules: false,
      canOpenPorts: false,
      canBlockSelectedProgramOutbound: true,
      requiresElevationForRuleChanges: true,
      defenderAuthoritative: true,
    },
  };
}

function pruneSelectionTokens() {
  const now = Date.now();
  for (const [token, selected] of selectionTokens) {
    if (!selected || selected.expiresAt < now) selectionTokens.delete(token);
  }
}

async function chooseProgramForBlock(dialog, BrowserWindow, event) {
  const parent = BrowserWindow.fromWebContents(event.sender) || undefined;
  const result = await dialog.showOpenDialog(parent, {
    title: "Vybrat aplikaci pro odchozí blokaci VoxarioProtect",
    properties: ["openFile"],
    filters: [
      { name: "Aplikace", extensions: ["exe", "com", "scr"] },
      { name: "Všechny soubory", extensions: ["*"] },
    ],
  });
  if (result.canceled || !result.filePaths?.[0]) return { ok: false, canceled: true };
  const target = normalizedProgramPath(result.filePaths[0]);
  const extension = path.extname(target).toLowerCase();
  if (!BLOCKABLE_EXTENSIONS.has(extension)) {
    return { ok: false, error: "Windows Firewall může v Protectu blokovat jen spustitelnou aplikaci (.exe, .com, .scr)." };
  }
  if (isProtectedSystemProgram(target)) {
    return { ok: false, error: "Protect z bezpečnostních důvodů neblokuje vlastní proces ani binární soubory ve složce Windows." };
  }
  const token = crypto.randomBytes(24).toString("hex");
  selectionTokens.set(token, { target, expiresAt: Date.now() + 5 * 60 * 1000 });
  pruneSelectionTokens();
  return {
    ok: true,
    token,
    fileName: path.basename(target),
    path: target,
    expiresInSeconds: 300,
  };
}

async function blockSelectedProgram(app, token) {
  pruneSelectionTokens();
  const selected = selectionTokens.get(String(token || ""));
  if (!selected) return { ok: false, error: "Výběr aplikace vypršel. Vyber ji znovu." };
  selectionTokens.delete(String(token));
  const target = selected.target;
  try {
    const stat = require("fs").statSync(target);
    if (!stat.isFile()) throw new Error("not file");
  } catch {
    return { ok: false, error: "Vybraná aplikace už na původním místě neexistuje." };
  }
  if (isProtectedSystemProgram(target)) {
    return { ok: false, error: "Tuto systémovou aplikaci Protect blokovat nebude." };
  }
  const rule = ruleIdForPath(target);
  const elevatedScript = [
    `$env:VOXARIO_PROTECT_TARGET=${powershellLiteral(target)}`,
    `$env:VOXARIO_PROTECT_RULE=${powershellLiteral(rule)}`,
    blockProgramScript(),
  ].join("; ");
  const action = await runElevatedFirewallScript(elevatedScript);
  if (!action.ok) return action;
  const verify = await runPowerShellJson(
    `$r=Get-NetFirewallRule -Name ${powershellLiteral(rule)} -ErrorAction SilentlyContinue; [pscustomobject]@{Exists=($null -ne $r);Enabled=$(if($r){[string]$r.Enabled}else{'False'});Action=$(if($r){[string]$r.Action}else{''});Direction=$(if($r){[string]$r.Direction}else{''})} | ConvertTo-Json -Compress`,
  );
  if (!verify.ok || verify.data?.Exists !== true) {
    return { ok: false, error: "Windows nepotvrdil vytvoření pravidla. Zkontroluj oprávnění správce a Windows Firewall." };
  }
  return {
    ok: true,
    rule,
    fileName: path.basename(target),
    path: target,
    action: "Block",
    direction: "Outbound",
  };
}

async function removeManagedRule(ruleName) {
  const rule = String(ruleName || "");
  if (!isManagedRuleName(rule)) return { ok: false, error: "Protect odmítl změnit cizí firewall pravidlo." };
  const elevatedScript = [
    `$env:VOXARIO_PROTECT_RULE=${powershellLiteral(rule)}`,
    removeProgramBlockScript(),
  ].join("; ");
  const action = await runElevatedFirewallScript(elevatedScript);
  if (!action.ok) return action;
  const verify = await runPowerShellJson(
    `$r=Get-NetFirewallRule -Name ${powershellLiteral(rule)} -ErrorAction SilentlyContinue; [pscustomobject]@{Exists=($null -ne $r)} | ConvertTo-Json -Compress`,
  );
  if (!verify.ok) return verify;
  return verify.data?.Exists === false
    ? { ok: true, removed: true, rule }
    : { ok: false, error: "Pravidlo je ve Windows Firewallu stále aktivní." };
}

function firewallUiInjection() {
  if (window.__voxarioProtectFirewallV25) return;
  window.__voxarioProtectFirewallV25 = true;
  const api = window.studioVoxarioDesktop;
  if (!api?.protectFirewallGetStatus) return;

  const ensureStyle = () => {
    if (document.getElementById("voxarioProtectFirewallStyle")) return;
    const style = document.createElement("style");
    style.id = "voxarioProtectFirewallStyle";
    style.textContent = `
      .vpfw-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
      .vpfw-card{border:1px solid rgba(71,167,161,.2);background:rgba(1,16,27,.52);padding:14px;min-width:0}
      .vpfw-card small{display:block;color:#78979b;font-size:9px;letter-spacing:.08em}.vpfw-card strong{display:block;margin-top:5px;font-size:14px;color:#d7f7ef}
      .vpfw-card p{margin:8px 0 0;color:#87a8aa;font-size:10px;line-height:1.5}.vpfw-card.good{border-color:rgba(98,239,173,.4)}.vpfw-card.bad{border-color:rgba(251,127,145,.55)}
      .vpfw-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.vpfw-button{padding:9px 12px;border:1px solid rgba(86,185,177,.38);background:rgba(5,48,59,.78);color:#c7eee4;font-size:10px}
      .vpfw-button.primary{border-color:#62efad;background:linear-gradient(135deg,#62efad,#3cc59a);color:#052418;font-weight:800}.vpfw-button.danger{border-color:rgba(251,127,145,.55);color:#ffb7c1;background:rgba(80,19,31,.45)}
      .vpfw-button:disabled{opacity:.55;cursor:wait}.vpfw-section{margin-top:18px}.vpfw-section h3{margin:0 0 9px;font-size:12px;color:#bde8df;letter-spacing:.05em}
      .vpfw-list{display:grid;gap:8px}.vpfw-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid rgba(71,167,161,.18);background:rgba(1,16,27,.48)}
      .vpfw-row b{font-size:11px;color:#d9f8f2}.vpfw-row span{display:block;margin-top:4px;color:#83a5a8;font-size:9px;line-height:1.45;overflow-wrap:anywhere}.vpfw-empty{color:#7f9fa4;font-size:10px;padding:10px 0}
      .vpfw-banner{padding:12px;border:1px solid rgba(98,239,173,.25);background:rgba(9,49,51,.42);color:#a9ceca;font-size:10px;line-height:1.55}
      .vpfw-banner.warn{border-color:rgba(243,201,108,.45);color:#efd796}.vpfw-cross{border-left:3px solid rgba(98,239,173,.5)}.vpfw-cross.high{border-left-color:#fb7f91}
      @media(max-width:900px){.vpfw-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.vpfw-grid{grid-template-columns:1fr}.vpfw-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  };

  const confirmAction = (title, text) => new Promise((resolve) => {
    const confirmDialog = document.getElementById("confirmDialog");
    const titleNode = document.getElementById("confirmTitle");
    const textNode = document.getElementById("confirmText");
    const accept = document.getElementById("confirmAccept");
    const cancel = document.getElementById("confirmCancel");
    if (!confirmDialog || !accept || !cancel) return resolve(window.confirm(`${title}\n\n${text}`));
    titleNode.textContent = title;
    textNode.textContent = text;
    confirmDialog.classList.add("on");
    const done = (value) => {
      confirmDialog.classList.remove("on");
      accept.onclick = null;
      cancel.onclick = null;
      resolve(value);
    };
    accept.onclick = () => done(true);
    cancel.onclick = () => done(false);
  });

  const activateFirewall = () => {
    document.body.dataset.voxarioProtectTab = "firewall";
    document.querySelectorAll("[data-vp-tab-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.vpTabPanel !== "firewall";
    });
    document.querySelectorAll("#voxarioProtectTabs .vp24-tab").forEach((button) => {
      const active = button.dataset.tab === "firewall";
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    void refreshFirewall();
  };

  const renderProfiles = (firewall) => {
    const container = document.getElementById("vpfwProfiles");
    if (!container) return;
    container.replaceChildren();
    const profiles = Array.isArray(firewall?.profiles) ? firewall.profiles : [];
    if (!profiles.length) {
      const empty = document.createElement("div");
      empty.className = "vpfw-empty";
      empty.textContent = "Stav profilů Windows Firewallu není dostupný.";
      container.appendChild(empty);
      return;
    }
    profiles.forEach((profile) => {
      const card = document.createElement("div");
      card.className = `vpfw-card ${profile.enabled ? "good" : "bad"}`;
      const title = document.createElement("small");
      title.textContent = `${profile.name || "PROFILE"} PROFILE`;
      const strong = document.createElement("strong");
      strong.textContent = profile.enabled ? "Aktivní" : "Vypnuto";
      const detail = document.createElement("p");
      detail.textContent = `Výchozí příchozí: ${profile.defaultInboundAction || "—"} · odchozí: ${profile.defaultOutboundAction || "—"}`;
      card.append(title, strong, detail);
      container.appendChild(card);
    });
  };

  const renderRules = (rules) => {
    const list = document.getElementById("vpfwRules");
    if (!list) return;
    list.replaceChildren();
    const values = Array.isArray(rules) ? rules : [];
    if (!values.length) {
      const empty = document.createElement("div");
      empty.className = "vpfw-empty";
      empty.textContent = "Protect zatím nevytvořil žádné vlastní blokovací pravidlo.";
      list.appendChild(empty);
      return;
    }
    values.forEach((rule) => {
      const row = document.createElement("div");
      row.className = "vpfw-row";
      const info = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = rule.displayName || "VoxarioProtect blokace";
      const detail = document.createElement("span");
      detail.textContent = `${rule.direction || "Outbound"} · ${rule.action || "Block"} · ${rule.enabled ? "aktivní" : "vypnuté"}${rule.program ? ` · ${rule.program}` : ""}`;
      info.append(title, detail);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "vpfw-button danger";
      remove.textContent = "Odblokovat";
      remove.onclick = async () => {
        const ok = await confirmAction("Odstranit blokaci?", "Protect odstraní pouze své vlastní odchozí BLOCK pravidlo. Globální Windows Firewall policy ani jiná pravidla se nezmění.");
        if (!ok) return;
        remove.disabled = true;
        const result = await api.protectFirewallRemoveRule(rule.name);
        const status = document.getElementById("vpfwStatus");
        if (status) status.textContent = result?.ok ? "Blokace byla odstraněna." : (result?.error || "Pravidlo se nepodařilo odstranit.");
        await refreshFirewall();
      };
      row.append(info, remove);
      list.appendChild(row);
    });
  };

  const renderCrossChecks = (items) => {
    const list = document.getElementById("vpfwCrossChecks");
    if (!list) return;
    list.replaceChildren();
    const values = Array.isArray(items) ? items : [];
    if (!values.length) {
      const empty = document.createElement("div");
      empty.className = "vpfw-empty";
      empty.textContent = "Zatím není žádný rozpor Protect ↔ Defender ani firewall událost.";
      list.appendChild(empty);
      return;
    }
    values.forEach((item) => {
      const row = document.createElement("div");
      row.className = `vpfw-row vpfw-cross ${["high","critical"].includes(item.severity) ? "high" : ""}`;
      const info = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = item.title || "Bezpečnostní událost";
      const detail = document.createElement("span");
      const score = Number.isFinite(Number(item.protectRiskScore)) ? ` · Protect ${item.protectRiskScore}/100` : "";
      detail.textContent = `${item.fileName ? item.fileName + " · " : ""}${item.detail || item.type || "událost"}${score}`;
      info.append(title, detail);
      row.appendChild(info);
      list.appendChild(row);
    });
  };

  async function refreshFirewall() {
    const status = document.getElementById("vpfwStatus");
    try {
      const result = await api.protectFirewallGetStatus();
      if (!result?.ok) {
        if (status) status.textContent = result?.error || "Stav Windows Firewallu se nepodařilo načíst.";
        return;
      }
      renderProfiles(result.firewall);
      renderRules(result.rules);
      renderCrossChecks(result.background?.crossChecks);
      const service = document.getElementById("vpfwService");
      const network = document.getElementById("vpfwNetwork");
      const count = document.getElementById("vpfwRuleCount");
      if (service) service.textContent = result.firewall?.serviceRunning ? "Služba běží" : "Služba neběží";
      if (count) count.textContent = `${(result.rules || []).length} pravidel Protect`;
      const connections = Array.isArray(result.firewall?.connections) ? result.firewall.connections : [];
      if (network) network.textContent = connections.length
        ? connections.map((c) => `${c.name}: ${c.category}`).join(" · ")
        : "Aktivní síťový profil nebyl zjištěn";
      if (status) {
        status.textContent = result.firewall?.allEnabled
          ? "Windows Defender Firewall je aktivní ve všech profilech. Protect ho doplňuje pouze vlastními odchozími BLOCK pravidly."
          : "Některý profil Windows Firewallu je vypnutý nebo nedostupný. Protect globální policy sám nemění.";
      }
    } catch (error) {
      if (status) status.textContent = error?.message || "Firewall diagnostika selhala.";
    }
  }

  const ensure = () => {
    ensureStyle();
    const tabs = document.getElementById("voxarioProtectTabs");
    const layout = document.querySelector(".layout");
    if (!tabs || !layout) return;

    let tab = document.querySelector('#voxarioProtectTabs .vp24-tab[data-tab="firewall"]');
    if (!tab) {
      tab = document.createElement("button");
      tab.className = "vp24-tab";
      tab.type = "button";
      tab.dataset.tab = "firewall";
      tab.textContent = "Firewall";
      const settings = tabs.querySelector('[data-tab="settings"]');
      tabs.insertBefore(tab, settings || null);
    }
    if (!tab.dataset.vpfwBound) {
      tab.dataset.vpfwBound = "1";
      tab.addEventListener("click", activateFirewall);
    }

    let section = document.getElementById("voxarioProtectFirewallV25");
    if (!section) {
      section = document.createElement("section");
      section.id = "voxarioProtectFirewallV25";
      section.className = "panel wide";
      section.dataset.vpTabPanel = "firewall";
      section.innerHTML = `
        <div class="panel-title"><span>VOXARIO FIREWALL</span><span class="muted">WINDOWS DEFENDER FIREWALL COMPANION</span></div>
        <div class="vpfw-banner" id="vpfwStatus">Načítám stav Windows Defender Firewallu…</div>
        <div class="vpfw-grid" id="vpfwProfiles"></div>
        <div class="vpfw-grid">
          <div class="vpfw-card"><small>WINDOWS FIREWALL SERVICE</small><strong id="vpfwService">—</strong><p>Protect službu nevypíná ani nenahrazuje.</p></div>
          <div class="vpfw-card"><small>AKTIVNÍ SÍŤ</small><strong id="vpfwNetwork">—</strong><p>Read-only informace z Windows Network Profile.</p></div>
          <div class="vpfw-card"><small>PRAVIDLA PROTECT</small><strong id="vpfwRuleCount">—</strong><p>Pouze per-program Outbound BLOCK. Žádné porty, allow pravidla ani globální policy.</p></div>
        </div>
        <div class="vpfw-actions">
          <button class="vpfw-button primary" id="vpfwBlockProgram" type="button">Vybrat aplikaci a zablokovat odchozí síť</button>
          <button class="vpfw-button" id="vpfwRefresh" type="button">Obnovit stav</button>
          <button class="vpfw-button" id="vpfwOpenWindows" type="button">Otevřít Windows Firewall</button>
          <button class="vpfw-button" id="vpfwOpenSecurity" type="button">Otevřít Windows Zabezpečení</button>
        </div>
        <p class="notice">Změna blokace vyžaduje potvrzení uživatele a UAC. Protect nikdy nevytváří ALLOW pravidla, neotevírá porty a nemění výchozí příchozí/odchozí policy Windows Firewallu.</p>
        <div class="vpfw-section"><h3>VLASTNÍ BLOKOVACÍ PRAVIDLA</h3><div class="vpfw-list" id="vpfwRules"></div></div>
        <div class="vpfw-section"><h3>PROTECT ↔ DEFENDER CROSS-CHECK</h3><div class="vpfw-list" id="vpfwCrossChecks"></div><p class="notice">Když Defender hrozbu potvrdí, nápravu a karanténu řídí Defender. Když Defender nic nenajde, ale dvě lokální kontroly Protectu zůstanou kritické, Protect upozorní a můžeš aplikaci odříznout od sítě. Protect nepředstírá Defender karanténu.</p></div>
      `;
      const footer = layout.querySelector(".foot");
      layout.insertBefore(section, footer || null);

      section.querySelector("#vpfwRefresh").onclick = refreshFirewall;
      section.querySelector("#vpfwOpenWindows").onclick = async () => {
        const result = await api.protectFirewallOpenWindows();
        const status = document.getElementById("vpfwStatus");
        if (!result?.ok && status) status.textContent = result?.error || "Windows Firewall se nepodařilo otevřít.";
      };
      section.querySelector("#vpfwOpenSecurity").onclick = async () => {
        const result = await api.protectOpenWindowsSecurity();
        const status = document.getElementById("vpfwStatus");
        if (!result?.ok && status) status.textContent = result?.error || "Windows Zabezpečení se nepodařilo otevřít.";
      };
      section.querySelector("#vpfwBlockProgram").onclick = async () => {
        const button = section.querySelector("#vpfwBlockProgram");
        const status = document.getElementById("vpfwStatus");
        button.disabled = true;
        try {
          const selected = await api.protectFirewallSelectProgram();
          if (!selected?.ok) {
            if (!selected?.canceled && status) status.textContent = selected?.error || "Aplikaci se nepodařilo vybrat.";
            return;
          }
          const confirmed = await confirmAction(
            "Zablokovat odchozí připojení?",
            `VoxarioProtect vytvoří ve Windows Defender Firewallu pouze jedno odchozí BLOCK pravidlo pro:\n${selected.path}\n\nNevypne Windows Firewall, nezmění globální policy a nevytvoří žádnou výjimku. Windows zobrazí UAC potvrzení.`,
          );
          if (!confirmed) return;
          if (status) status.textContent = "Čekám na UAC a vytvářím bezpečné odchozí BLOCK pravidlo…";
          const result = await api.protectFirewallBlockSelected(selected.token);
          if (status) status.textContent = result?.ok
            ? `${result.fileName || "Aplikace"} byla odříznuta od odchozí sítě přes Windows Defender Firewall.`
            : (result?.error || "Blokaci se nepodařilo vytvořit.");
          await refreshFirewall();
        } finally {
          button.disabled = false;
        }
      };
      void refreshFirewall();
    }

    const current = document.body.dataset.voxarioProtectTab || "overview";
    section.hidden = current !== "firewall";

    const firewallCard = Array.from(document.querySelectorAll(".capability")).find((card) =>
      /WINDOWS FIREWALL/i.test(card.querySelector("small")?.textContent || "")
    );
    if (firewallCard) {
      const strong = firewallCard.querySelector("strong");
      const paragraph = firewallCard.querySelector("p");
      const tag = firewallCard.querySelector(".tag");
      if (strong) strong.textContent = "Vlastní Firewall companion";
      if (paragraph) paragraph.textContent = "Protect sleduje profily Windows Defender Firewallu a po výslovném potvrzení umí vytvořit pouze odchozí BLOCK pravidlo pro vybranou aplikaci.";
      if (tag) tag.textContent = "USER-CONFIRMED BLOCK";
    }
  };

  ensure();
  const observer = new MutationObserver(() => ensure());
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

function injectFirewallUi(win) {
  if (!win || win.isDestroyed()) return;
  const run = () => win.webContents.executeJavaScript(`(${firewallUiInjection.toString()})()`, true).catch(() => {});
  setTimeout(run, 75);
  setTimeout(run, 350);
}

function installForegroundBridge() {
  if (foregroundBridgeInstalled || process.argv.slice(1).includes("--protect-background")) return;
  foregroundBridgeInstalled = true;
  const { app, ipcMain, dialog, shell, BrowserWindow } = require("electron");

  ipcMain.handle("protect:firewall-status", () => getFirewallDashboard(app));
  ipcMain.handle("protect:firewall-select-program", (event) => chooseProgramForBlock(dialog, BrowserWindow, event));
  ipcMain.handle("protect:firewall-block-selected", (_event, token) => blockSelectedProgram(app, typeof token === "string" ? token : ""));
  ipcMain.handle("protect:firewall-remove-rule", (_event, ruleName) => removeManagedRule(typeof ruleName === "string" ? ruleName : ""));
  ipcMain.handle("protect:firewall-open-windows", async () => {
    if (process.platform !== "win32") return { ok: false, error: "Windows Firewall je dostupný pouze ve Windows." };
    try {
      await shell.openExternal("windowsdefender://network");
      return { ok: true };
    } catch {
      try {
        const { spawn } = require("child_process");
        const child = spawn("control.exe", ["/name", "Microsoft.WindowsFirewall"], { detached: true, stdio: "ignore", windowsHide: false });
        child.unref();
        return { ok: true };
      } catch (error) {
        return { ok: false, error: error?.message || "Windows Firewall se nepodařilo otevřít." };
      }
    }
  });

  app.on("browser-window-created", (_event, win) => {
    const detect = () => {
      try {
        const url = win.webContents.getURL();
        const title = win.getTitle();
        if (url.endsWith("/protect.html") || url.includes("protect.html") || title === "VoxarioProtect") injectFirewallUi(win);
      } catch {}
    };
    win.webContents.on("did-finish-load", detect);
    win.on("ready-to-show", detect);
  });
}

module.exports = {
  RULE_GROUP,
  RULE_PREFIX,
  BLOCKABLE_EXTENSIONS,
  ruleIdForPath,
  isManagedRuleName,
  firewallStatusScript,
  firewallDashboardScript,
  blockProgramScript,
  removeProgramBlockScript,
  summarizeFirewallProfiles,
  installForegroundBridge,
};

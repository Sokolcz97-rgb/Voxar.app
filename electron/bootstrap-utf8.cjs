"use strict";

// Force Windows PowerShell output to UTF-8 before the real desktop bootstrap
// loads. Node decodes child-process stdout as UTF-8, while Windows PowerShell
// can otherwise emit the active legacy console code page when stdout is piped.
if (process.platform === "win32") {
  const childProcess = require("child_process");
  const originalSpawn = childProcess.spawn;
  const utf8Prelude = [
    "$__voxarioUtf8 = New-Object System.Text.UTF8Encoding($false)",
    "[Console]::OutputEncoding = $__voxarioUtf8",
    "$OutputEncoding = $__voxarioUtf8",
  ].join(";") + ";";

  childProcess.spawn = function voxarioUtf8Spawn(command, args, options) {
    const argv = Array.isArray(args) ? [...args] : args;
    const executable = String(command || "").replace(/^.*[\\/]/, "").toLowerCase();
    if ((executable === "powershell.exe" || executable === "powershell" || executable === "pwsh.exe" || executable === "pwsh") && Array.isArray(argv)) {
      const commandIndex = argv.findIndex((arg) => String(arg).toLowerCase() === "-command");
      if (commandIndex >= 0 && typeof argv[commandIndex + 1] === "string") {
        argv[commandIndex + 1] = utf8Prelude + argv[commandIndex + 1];
      }
    }
    return originalSpawn.call(childProcess, command, argv, options);
  };
}

// IPC + safe Windows Defender Firewall companion. The bridge itself owns only
// VoxarioProtect.Block.* outbound BLOCK rules and keeps Defender authoritative.
require("./protect-firewall.cjs").installForegroundBridge();

// Renderer-side supervisor for Protect-only UI. The previous v2.5 fallback ran
// only once and could lose its tab when bootstrap.cjs rebuilt the navigation.
// This supervisor is deliberately idempotent: it watches the final DOM and
// restores Firewall + Stability after every navigation/settings rebuild.
function protectUiSupervisorV26() {
  const api = window.studioVoxarioDesktop;
  if (!api) return;

  if (window.__voxarioProtectUiSupervisorV26?.ensure) {
    window.__voxarioProtectUiSupervisorV26.ensure();
    return;
  }

  let ensuring = false;
  let firewallBusy = false;
  let stabilityBusy = false;
  const protectVersion = String(api.protectVersion || "2.6");

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node && node.textContent !== String(value ?? "—")) node.textContent = String(value ?? "—");
  }

  function ensureStyle() {
    if (document.getElementById("voxarioProtectSupervisorStyleV26")) return;
    const style = document.createElement("style");
    style.id = "voxarioProtectSupervisorStyleV26";
    style.textContent = `
      .vp26-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}
      .vp26-card{border:1px solid rgba(71,167,161,.2);background:rgba(1,16,27,.52);padding:14px;min-width:0}
      .vp26-card.good{border-color:rgba(98,239,173,.42)}.vp26-card.warn{border-color:rgba(243,201,108,.48)}.vp26-card.bad{border-color:rgba(251,127,145,.58)}
      .vp26-card small{display:block;color:#78979b;font-size:9px;letter-spacing:.08em}.vp26-card strong{display:block;margin-top:5px;font-size:14px;color:#d7f7ef;overflow-wrap:anywhere}.vp26-card p{margin:8px 0 0;color:#87a8aa;font-size:10px;line-height:1.5}
      .vp26-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.vp26-button{padding:9px 12px;border:1px solid rgba(86,185,177,.38);background:rgba(5,48,59,.78);color:#c7eee4;font-size:10px}.vp26-button.primary{border-color:#62efad;background:linear-gradient(135deg,#62efad,#3cc59a);color:#052418;font-weight:800}.vp26-button.danger{border-color:rgba(251,127,145,.55);color:#ffb7c1;background:rgba(80,19,31,.45)}.vp26-button:disabled{opacity:.55;cursor:wait}
      .vp26-list{display:grid;gap:8px;margin-top:10px}.vp26-row{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:12px;align-items:center;padding:11px;border:1px solid rgba(71,167,161,.18);background:rgba(1,16,27,.48)}.vp26-row b{font-size:11px;color:#d9f8f2}.vp26-row span{display:block;margin-top:4px;color:#83a5a8;font-size:9px;line-height:1.45;overflow-wrap:anywhere}
      .vp26-banner{margin-top:12px;padding:12px;border:1px solid rgba(98,239,173,.25);background:rgba(9,49,51,.42);color:#a9ceca;font-size:10px;line-height:1.55}.vp26-banner.warn{border-color:rgba(243,201,108,.5);color:#efd796}.vp26-banner.bad{border-color:rgba(251,127,145,.55);color:#ffb7c1}
      .vp26-section{margin-top:18px}.vp26-section h3{margin:0 0 9px;font-size:12px;color:#bde8df;letter-spacing:.05em}
      @media(max-width:900px){.vp26-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.vp26-grid{grid-template-columns:1fr}.vp26-row{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function syncVersionCopy() {
    document.title = `VoxarioProtect v${protectVersion}`;
    setText("protectVersion", `v${protectVersion}`);
    setText("protectVersionMetric", `v${protectVersion}`);
    const heroText = document.querySelector(".hero p");
    if (heroText) heroText.textContent = heroText.textContent.replace(/VoxarioProtect v2\.\d+/g, `VoxarioProtect v${protectVersion}`);
    for (const node of document.querySelectorAll(".panel-title span,.capability .tag")) {
      if (/v2\.\d+/i.test(node.textContent || "")) node.textContent = node.textContent.replace(/v2\.\d+/gi, `v${protectVersion}`);
    }
    const firewallCard = Array.from(document.querySelectorAll(".capability")).find((card) => /WINDOWS FIREWALL/i.test(card.querySelector("small")?.textContent || ""));
    if (firewallCard) {
      const strong = firewallCard.querySelector("strong");
      const paragraph = firewallCard.querySelector("p");
      const tag = firewallCard.querySelector(".tag");
      if (strong) strong.textContent = "Vlastní Firewall companion";
      if (paragraph) paragraph.textContent = "Protect čte stav Windows Defender Firewallu a po výslovném potvrzení umí vytvořit pouze vlastní per-program Outbound BLOCK pravidlo.";
      if (tag) tag.textContent = "USER-CONFIRMED BLOCK";
    }
  }

  function activateTab(name) {
    document.body.dataset.voxarioProtectTab = name;
    document.querySelectorAll("[data-vp-tab-panel]").forEach((panel) => {
      panel.hidden = panel.dataset.vpTabPanel !== name;
    });
    document.querySelectorAll("#voxarioProtectTabs .vp24-tab").forEach((button) => {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.setAttribute("aria-current", active ? "page" : "false");
    });
    document.querySelector(".layout")?.scrollIntoView({ block: "start" });
    if (name === "firewall") void refreshFirewall();
    if (name === "stability") void refreshStability();
  }

  function ensureTab(tabs, name, label, beforeName = "settings") {
    let tab = tabs.querySelector(`.vp24-tab[data-tab="${name}"]`);
    if (!tab) {
      tab = document.createElement("button");
      tab.className = "vp24-tab";
      tab.type = "button";
      tab.dataset.tab = name;
      tab.textContent = label;
      const before = tabs.querySelector(`.vp24-tab[data-tab="${beforeName}"]`);
      tabs.insertBefore(tab, before || null);
    }
    if (!tab.dataset.vp26Bound) {
      tab.dataset.vp26Bound = "1";
      tab.addEventListener("click", () => activateTab(name));
    }
    return tab;
  }

  function ensureTabs() {
    const tabs = document.getElementById("voxarioProtectTabs");
    if (!tabs) return false;
    ensureTab(tabs, "firewall", "Firewall");
    ensureTab(tabs, "stability", "Stabilita");
    return true;
  }

  function insertSupervisorPanel(panel) {
    const layout = document.querySelector(".layout");
    if (!layout) return false;
    const footer = layout.querySelector(".foot");
    layout.insertBefore(panel, footer || null);
    return true;
  }

  async function confirmAction(title, text) {
    const dialog = document.getElementById("confirmDialog");
    const accept = document.getElementById("confirmAccept");
    const cancel = document.getElementById("confirmCancel");
    if (!dialog || !accept || !cancel) return window.confirm(`${title}\n\n${text}`);
    setText("confirmTitle", title);
    setText("confirmText", text);
    dialog.classList.add("on");
    return new Promise((resolve) => {
      const done = (value) => {
        dialog.classList.remove("on");
        accept.onclick = null;
        cancel.onclick = null;
        resolve(value);
      };
      accept.onclick = () => done(true);
      cancel.onclick = () => done(false);
    });
  }

  function ensureFirewallPanel() {
    const layout = document.querySelector(".layout");
    if (!layout || !api.protectFirewallGetStatus) return null;
    let panel = document.getElementById("voxarioProtectFirewallV25");
    if (!panel || panel.tagName !== "DIV") {
      const replacement = document.createElement("div");
      replacement.id = "voxarioProtectFirewallV25";
      replacement.className = "panel wide";
      replacement.dataset.vpTabPanel = "firewall";
      if (panel) panel.replaceWith(replacement);
      else insertSupervisorPanel(replacement);
      panel = replacement;
    }
    panel.dataset.vpTabPanel = "firewall";
    if (panel.dataset.vp26Built !== "1") {
      panel.dataset.vp26Built = "1";
      panel.innerHTML = `
        <div class="panel-title"><span>VOXARIO FIREWALL</span><span class="muted">WINDOWS DEFENDER FIREWALL COMPANION</span></div>
        <div class="vp26-banner" id="vpfwStatus">Načítám stav Windows Defender Firewallu…</div>
        <div class="vp26-grid" id="vpfwProfiles"></div>
        <div class="vp26-grid">
          <div class="vp26-card"><small>WINDOWS FIREWALL SERVICE</small><strong id="vpfwService">—</strong><p>Protect službu nevypíná ani nenahrazuje.</p></div>
          <div class="vp26-card"><small>AKTIVNÍ SÍŤ</small><strong id="vpfwNetwork">—</strong><p>Read-only informace z Windows Network Profile.</p></div>
          <div class="vp26-card"><small>PRAVIDLA PROTECT</small><strong id="vpfwRuleCount">—</strong><p>Pouze per-program Outbound BLOCK. Žádné ALLOW rules ani globální policy.</p></div>
        </div>
        <div class="vp26-actions">
          <button class="vp26-button primary" id="vpfwBlockProgram" type="button">Vybrat aplikaci a zablokovat odchozí síť</button>
          <button class="vp26-button" id="vpfwRefresh" type="button">Obnovit stav</button>
          <button class="vp26-button" id="vpfwOpenWindows" type="button">Otevřít Windows Firewall</button>
          <button class="vp26-button" id="vpfwOpenSecurity" type="button">Otevřít Windows Zabezpečení</button>
        </div>
        <p class="notice">Změna pravidla vyžaduje potvrzení uživatele a UAC. Protect nevypíná Windows Firewall, neotevírá porty, nevytváří ALLOW pravidla a nemaže cizí pravidla.</p>
        <div class="vp26-section"><h3>VLASTNÍ BLOKOVACÍ PRAVIDLA</h3><div class="vp26-list" id="vpfwRules"></div></div>
        <div class="vp26-section"><h3>PROTECT ↔ DEFENDER CROSS-CHECK</h3><div class="vp26-list" id="vpfwCrossChecks"></div><p class="notice">Když Defender hrozbu potvrdí, nápravu a karanténu řídí Defender. Protect nepředstírá Defender karanténu.</p></div>
      `;
      panel.querySelector("#vpfwRefresh").onclick = () => refreshFirewall();
      panel.querySelector("#vpfwOpenWindows").onclick = async () => {
        const result = await api.protectFirewallOpenWindows();
        if (!result?.ok) setText("vpfwStatus", result?.error || "Windows Firewall se nepodařilo otevřít.");
      };
      panel.querySelector("#vpfwOpenSecurity").onclick = async () => {
        const result = await api.protectOpenWindowsSecurity();
        if (!result?.ok) setText("vpfwStatus", result?.error || "Windows Zabezpečení se nepodařilo otevřít.");
      };
      panel.querySelector("#vpfwBlockProgram").onclick = async () => {
        const button = panel.querySelector("#vpfwBlockProgram");
        button.disabled = true;
        try {
          const selected = await api.protectFirewallSelectProgram();
          if (!selected?.ok) {
            if (!selected?.canceled) setText("vpfwStatus", selected?.error || "Aplikaci se nepodařilo vybrat.");
            return;
          }
          const confirmed = await confirmAction(
            "Zablokovat odchozí připojení?",
            `VoxarioProtect vytvoří ve Windows Defender Firewallu jedno odchozí BLOCK pravidlo pro:\n${selected.path}\n\nWindows zobrazí UAC.`,
          );
          if (!confirmed) return;
          setText("vpfwStatus", "Čekám na UAC a vytvářím odchozí BLOCK pravidlo…");
          const result = await api.protectFirewallBlockSelected(selected.token);
          setText("vpfwStatus", result?.ok ? `${result.fileName || "Aplikace"} byla odříznuta od odchozí sítě.` : (result?.error || "Blokaci se nepodařilo vytvořit."));
          await refreshFirewall();
        } finally {
          button.disabled = false;
        }
      };
    }
    return panel;
  }

  function renderFirewallRules(rules) {
    const list = document.getElementById("vpfwRules");
    if (!list) return;
    list.replaceChildren();
    const values = Array.isArray(rules) ? rules : [];
    setText("vpfwRuleCount", `${values.length} pravidel Protect`);
    if (!values.length) {
      const empty = document.createElement("div");
      empty.className = "notice";
      empty.textContent = "Protect zatím nevytvořil žádné vlastní blokovací pravidlo.";
      list.appendChild(empty);
      return;
    }
    for (const rule of values) {
      const row = document.createElement("div");
      row.className = "vp26-row";
      const info = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = rule.displayName || "VoxarioProtect blokace";
      const detail = document.createElement("span");
      detail.textContent = `${rule.direction || "Outbound"} · ${rule.action || "Block"} · ${rule.enabled ? "aktivní" : "vypnuté"}${rule.program ? ` · ${rule.program}` : ""}`;
      info.append(title, detail);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "vp26-button danger";
      remove.textContent = "Odblokovat";
      remove.onclick = async () => {
        const confirmed = await confirmAction("Odstranit blokaci?", "Protect odstraní pouze své vlastní Outbound BLOCK pravidlo.");
        if (!confirmed) return;
        remove.disabled = true;
        const result = await api.protectFirewallRemoveRule(rule.name);
        setText("vpfwStatus", result?.ok ? "Blokace byla odstraněna." : (result?.error || "Odblokování selhalo."));
        await refreshFirewall();
      };
      row.append(info, remove);
      list.appendChild(row);
    }
  }

  function renderCrossChecks(items) {
    const list = document.getElementById("vpfwCrossChecks");
    if (!list) return;
    list.replaceChildren();
    const values = Array.isArray(items) ? items : [];
    if (!values.length) {
      const empty = document.createElement("div");
      empty.className = "notice";
      empty.textContent = "Zatím není žádný Protect ↔ Defender rozpor ani firewall událost.";
      list.appendChild(empty);
      return;
    }
    for (const item of values) {
      const row = document.createElement("div");
      row.className = "vp26-row";
      const info = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = item.title || "Bezpečnostní událost";
      const detail = document.createElement("span");
      const score = Number.isFinite(Number(item.protectRiskScore)) ? ` · Protect ${item.protectRiskScore}/100` : "";
      detail.textContent = `${item.fileName ? `${item.fileName} · ` : ""}${item.detail || item.type || "událost"}${score}`;
      info.append(title, detail);
      row.appendChild(info);
      list.appendChild(row);
    }
  }

  async function refreshFirewall() {
    if (firewallBusy || !api.protectFirewallGetStatus) return;
    firewallBusy = true;
    try {
      const result = await api.protectFirewallGetStatus();
      if (!result?.ok) {
        setText("vpfwStatus", result?.error || "Stav Windows Firewallu se nepodařilo načíst.");
        return;
      }
      const profiles = document.getElementById("vpfwProfiles");
      if (profiles) {
        profiles.replaceChildren();
        for (const profile of (result.firewall?.profiles || [])) {
          const card = document.createElement("div");
          card.className = `vp26-card ${profile.enabled ? "good" : "bad"}`;
          const label = document.createElement("small");
          label.textContent = `${String(profile.name || "PROFILE").toUpperCase()} PROFILE`;
          const strong = document.createElement("strong");
          strong.textContent = profile.enabled ? "Aktivní" : "Vypnuto";
          const detail = document.createElement("p");
          detail.textContent = `Příchozí: ${profile.defaultInboundAction || "—"} · Odchozí: ${profile.defaultOutboundAction || "—"}`;
          card.append(label, strong, detail);
          profiles.appendChild(card);
        }
      }
      setText("vpfwService", result.firewall?.serviceRunning ? "Služba běží" : "Služba neběží");
      const connections = Array.isArray(result.firewall?.connections) ? result.firewall.connections : [];
      setText("vpfwNetwork", connections.length ? connections.map((c) => `${c.name}: ${c.category}`).join(" · ") : "Síťový profil nezjištěn");
      setText("vpfwStatus", result.firewall?.allEnabled ? "Windows Defender Firewall je aktivní ve všech profilech. Protect ho doplňuje vlastními pravidly." : "Některý profil Windows Firewallu je vypnutý nebo nedostupný.");
      renderFirewallRules(result.rules);
      renderCrossChecks(result.background?.crossChecks);
    } catch (error) {
      setText("vpfwStatus", error?.message || "Firewall diagnostika selhala.");
    } finally {
      firewallBusy = false;
    }
  }

  function ensureStabilityPanel() {
    const layout = document.querySelector(".layout");
    if (!layout) return null;
    let panel = document.getElementById("voxarioProtectStabilityV26");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "voxarioProtectStabilityV26";
      panel.className = "panel wide";
      panel.dataset.vpTabPanel = "stability";
      panel.innerHTML = `
        <div class="panel-title"><span>STABILITA VOXARIOPROTECT</span><span class="muted">LIVE SELF-CHECK · ODEMČENO</span></div>
        <div class="vp26-banner" id="vpstableStatus">Načítám diagnostiku stability…</div>
        <div class="vp26-grid">
          <div class="vp26-card"><small>UI SUPERVISOR</small><strong id="vpstableUi">Aktivní</strong><p>Hlídá, aby se kategorie po přestavbě UI neztratily.</p></div>
          <div class="vp26-card"><small>MICROSOFT DEFENDER</small><strong id="vpstableDefender">—</strong><p id="vpstableDefenderDetail">Čekám na stav.</p></div>
          <div class="vp26-card"><small>OCHRANA NA POZADÍ</small><strong id="vpstableBackground">—</strong><p id="vpstableBackgroundDetail">Čekám na stav.</p></div>
          <div class="vp26-card"><small>FIREWALL COMPANION</small><strong id="vpstableFirewall">—</strong><p id="vpstableFirewallDetail">Čekám na stav.</p></div>
          <div class="vp26-card"><small>INTEGRITA DESKTOPU</small><strong id="vpstableIntegrity">—</strong><p id="vpstableIntegrityDetail">Čekám na manifest.</p></div>
          <div class="vp26-card"><small>VERZE</small><strong id="vpstableVersions">Protect v${protectVersion}</strong><p id="vpstableVersionDetail">Desktop verze se načte z balíčku.</p></div>
        </div>
        <div class="vp26-actions">
          <button class="vp26-button primary" id="vpstableRefresh" type="button">Obnovit stabilitu</button>
          <button class="vp26-button" id="vpstableSecurity" type="button">Otevřít Windows Zabezpečení</button>
          <button class="vp26-button" id="vpstableUpdate" type="button">Otevřít Windows Update</button>
        </div>
        <p class="notice">Stabilita je read-only self-check Protectu. Nic nevypíná, nemění Defender exclusions ani globální Windows Firewall policy.</p>
      `;
      insertSupervisorPanel(panel);
      panel.querySelector("#vpstableRefresh").onclick = () => refreshStability();
      panel.querySelector("#vpstableSecurity").onclick = () => api.protectOpenWindowsSecurity();
      panel.querySelector("#vpstableUpdate").onclick = () => api.protectOpenWindowsUpdate();
    }
    panel.dataset.vpTabPanel = "stability";
    return panel;
  }

  async function refreshStability() {
    if (stabilityBusy) return;
    stabilityBusy = true;
    try {
      const [statusResult, integrityResult, firewallResult] = await Promise.allSettled([
        api.protectGetStatus?.(),
        api.protectGetIntegrity?.(),
        api.protectFirewallGetStatus?.(),
      ]);
      const status = statusResult.status === "fulfilled" ? statusResult.value : null;
      const integrity = integrityResult.status === "fulfilled" ? integrityResult.value : null;
      const firewall = firewallResult.status === "fulfilled" ? firewallResult.value : null;

      const defenderOk = status?.ok === true;
      const defender = status?.status || {};
      setText("vpstableDefender", defenderOk ? (defender.RealTimeProtectionEnabled ? "Real-time aktivní" : "Defender odpovídá") : "Nedostupné");
      setText("vpstableDefenderDetail", defenderOk ? `Antivirus ${defender.AntivirusEnabled ? "aktivní" : "neaktivní"} · Behavior ${defender.BehaviorMonitorEnabled ? "aktivní" : "neaktivní"}` : (status?.error || "Defender bridge neodpověděl."));

      const backgroundActive = status?.background?.active === true;
      setText("vpstableBackground", backgroundActive ? "Aktivní" : "Neaktivní");
      setText("vpstableBackgroundDetail", status?.background?.mode || "Stav background companion není dostupný.");

      const firewallOk = firewall?.ok === true;
      setText("vpstableFirewall", firewallOk ? (firewall.firewall?.allEnabled ? "Všechny profily aktivní" : "Vyžaduje pozornost") : "Nedostupné");
      setText("vpstableFirewallDetail", firewallOk ? `${firewall.rules?.length || 0} vlastních pravidel Protect · služba ${firewall.firewall?.serviceRunning ? "běží" : "neběží"}` : (firewall?.error || "Firewall bridge neodpověděl."));

      const integrityOk = !!integrity && typeof integrity === "object";
      setText("vpstableIntegrity", integrityOk ? "Manifest načten" : "Nedostupné");
      const hash = String(integrity?.integrityHash || "");
      setText("vpstableIntegrityDetail", integrityOk ? `Platforma ${integrity.platform || "—"}${hash ? ` · hash ${hash.slice(0, 12)}…` : ""}` : "Integrita desktopu se nepodařila načíst.");
      setText("vpstableVersions", `Protect v${protectVersion} · Desktop ${integrity?.appVersion || "—"}`);
      setText("vpstableVersionDetail", `Poslední self-check: ${new Date().toLocaleTimeString("cs-CZ")}`);

      const healthy = [defenderOk, firewallOk, integrityOk].filter(Boolean).length;
      const stateText = healthy === 3 ? "Všechny hlavní diagnostické vrstvy odpovídají." : `${healthy}/3 hlavních diagnostických vrstev odpovídá. Zkontroluj zvýrazněné položky.`;
      setText("vpstableStatus", stateText);
      const banner = document.getElementById("vpstableStatus");
      if (banner) banner.className = `vp26-banner${healthy === 3 ? "" : " warn"}`;
    } catch (error) {
      setText("vpstableStatus", error?.message || "Self-check stability selhal.");
      const banner = document.getElementById("vpstableStatus");
      if (banner) banner.className = "vp26-banner bad";
    } finally {
      stabilityBusy = false;
    }
  }

  function ensure() {
    if (ensuring) return;
    ensuring = true;
    try {
      ensureStyle();
      syncVersionCopy();
      const tabsReady = ensureTabs();
      const firewallPanel = ensureFirewallPanel();
      const stabilityPanel = ensureStabilityPanel();
      if (!tabsReady) return;
      const current = document.body.dataset.voxarioProtectTab || document.querySelector("#voxarioProtectTabs .vp24-tab.active")?.dataset.tab || "overview";
      if (firewallPanel) firewallPanel.hidden = current !== "firewall";
      if (stabilityPanel) stabilityPanel.hidden = current !== "stability";
    } finally {
      ensuring = false;
    }
  }

  const observer = new MutationObserver(() => queueMicrotask(ensure));
  observer.observe(document.documentElement, { childList: true, subtree: true });
  const interval = setInterval(ensure, 1200);
  window.addEventListener("beforeunload", () => clearInterval(interval), { once: true });
  window.__voxarioProtectUiSupervisorV26 = { ensure, activateTab, refreshFirewall, refreshStability };
  ensure();
}

function installProtectUiSupervisor() {
  if (process.argv.slice(1).includes("--protect-background")) return;
  const { app } = require("electron");
  app.on("browser-window-created", (_event, win) => {
    const inject = () => {
      try {
        const url = win.webContents.getURL();
        const title = win.getTitle();
        if (!(url.endsWith("/protect.html") || url.includes("protect.html") || title === "VoxarioProtect")) return;
      } catch {
        return;
      }
      win.webContents.executeJavaScript(`(${protectUiSupervisorV26.toString()})()`, true).catch((error) => {
        console.error("VoxarioProtect UI supervisor failed", error);
      });
    };
    win.webContents.on("did-finish-load", inject);
    win.on("ready-to-show", inject);
    setTimeout(inject, 300).unref?.();
    setTimeout(inject, 900).unref?.();
    setTimeout(inject, 2200).unref?.();
  });
}

installProtectUiSupervisor();
require("./bootstrap.cjs");

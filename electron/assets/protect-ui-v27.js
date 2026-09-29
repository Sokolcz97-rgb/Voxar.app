"use strict";

// VoxarioProtect v2.7 renderer-owned UI. Loaded directly by protect.html so
// Firewall + Stability/Lifetime cannot disappear when main-process injection
// timing changes. Uses only the contextBridge API exposed by preload.cjs.
function protectUiV27() {
  const api = window.studioVoxarioDesktop;
  if (!api) return;

  if (window.__voxarioProtectUiV27?.ensure) {
    window.__voxarioProtectUiV27.ensure();
    return;
  }

  let ensuring = false;
  let firewallBusy = false;
  let stabilityBusy = false;
  const protectVersion = String(api.protectVersion || "2.7");

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node && node.textContent !== String(value ?? "â€”")) node.textContent = String(value ?? "â€”");
  }

  function ensureStyle() {
    if (document.getElementById("voxarioProtectSupervisorStyleV27")) return;
    const style = document.createElement("style");
    style.id = "voxarioProtectSupervisorStyleV27";
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
      if (strong) strong.textContent = "VlastnĂ­ Firewall companion";
      if (paragraph) paragraph.textContent = "Protect ÄŤte stav Windows Defender Firewallu a po vĂ˝slovnĂ©m potvrzenĂ­ umĂ­ vytvoĹ™it pouze vlastnĂ­ per-program Outbound BLOCK pravidlo.";
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
    if (!tab.dataset.vp27Bound) {
      tab.dataset.vp27Bound = "1";
      tab.addEventListener("click", () => activateTab(name));
    }
    return tab;
  }

  function ensureTabs() {
    const tabs = document.getElementById("voxarioProtectTabs");
    if (!tabs) return false;
    ensureTab(tabs, "firewall", "Firewall");
    ensureTab(tabs, "stability", "Stabilita / Ĺľivotnost");
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
    let panel = document.getElementById("voxarioProtectFirewallV27");
    if (!panel || panel.tagName !== "DIV") {
      const replacement = document.createElement("div");
      replacement.id = "voxarioProtectFirewallV27";
      replacement.className = "panel wide";
      replacement.dataset.vpTabPanel = "firewall";
      if (panel) panel.replaceWith(replacement);
      else insertSupervisorPanel(replacement);
      panel = replacement;
    }
    panel.dataset.vpTabPanel = "firewall";
    if (panel.dataset.vp27Built !== "1") {
      panel.dataset.vp27Built = "1";
      panel.innerHTML = `
        <div class="panel-title"><span>VOXARIO FIREWALL</span><span class="muted">WINDOWS DEFENDER FIREWALL COMPANION</span></div>
        <div class="vp26-banner" id="vpfwStatus">NaÄŤĂ­tĂˇm stav Windows Defender Firewalluâ€¦</div>
        <div class="vp26-grid" id="vpfwProfiles"></div>
        <div class="vp26-grid">
          <div class="vp26-card"><small>WINDOWS FIREWALL SERVICE</small><strong id="vpfwService">â€”</strong><p>Protect sluĹľbu nevypĂ­nĂˇ ani nenahrazuje.</p></div>
          <div class="vp26-card"><small>AKTIVNĂŤ SĂŤĹ¤</small><strong id="vpfwNetwork">â€”</strong><p>Read-only informace z Windows Network Profile.</p></div>
          <div class="vp26-card"><small>PRAVIDLA PROTECT</small><strong id="vpfwRuleCount">â€”</strong><p>Pouze per-program Outbound BLOCK. Ĺ˝ĂˇdnĂ© ALLOW rules ani globĂˇlnĂ­ policy.</p></div>
        </div>
        <div class="vp26-actions">
          <button class="vp26-button primary" id="vpfwBlockProgram" type="button">Vybrat aplikaci a zablokovat odchozĂ­ sĂ­ĹĄ</button>
          <button class="vp26-button" id="vpfwRefresh" type="button">Obnovit stav</button>
          <button class="vp26-button" id="vpfwOpenWindows" type="button">OtevĹ™Ă­t Windows Firewall</button>
          <button class="vp26-button" id="vpfwOpenSecurity" type="button">OtevĹ™Ă­t Windows ZabezpeÄŤenĂ­</button>
        </div>
        <p class="notice">ZmÄ›na pravidla vyĹľaduje potvrzenĂ­ uĹľivatele a UAC. Protect nevypĂ­nĂˇ Windows Firewall, neotevĂ­rĂˇ porty, nevytvĂˇĹ™Ă­ ALLOW pravidla a nemaĹľe cizĂ­ pravidla.</p>
        <div class="vp26-section"><h3>VLASTNĂŤ BLOKOVACĂŤ PRAVIDLA</h3><div class="vp26-list" id="vpfwRules"></div></div>
        <div class="vp26-section"><h3>PROTECT â†” DEFENDER CROSS-CHECK</h3><div class="vp26-list" id="vpfwCrossChecks"></div><p class="notice">KdyĹľ Defender hrozbu potvrdĂ­, nĂˇpravu a karantĂ©nu Ĺ™Ă­dĂ­ Defender. Protect nepĹ™edstĂ­rĂˇ Defender karantĂ©nu.</p></div>
      `;
      panel.querySelector("#vpfwRefresh").onclick = () => refreshFirewall();
      panel.querySelector("#vpfwOpenWindows").onclick = async () => {
        const result = await api.protectFirewallOpenWindows();
        if (!result?.ok) setText("vpfwStatus", result?.error || "Windows Firewall se nepodaĹ™ilo otevĹ™Ă­t.");
      };
      panel.querySelector("#vpfwOpenSecurity").onclick = async () => {
        const result = await api.protectOpenWindowsSecurity();
        if (!result?.ok) setText("vpfwStatus", result?.error || "Windows ZabezpeÄŤenĂ­ se nepodaĹ™ilo otevĹ™Ă­t.");
      };
      panel.querySelector("#vpfwBlockProgram").onclick = async () => {
        const button = panel.querySelector("#vpfwBlockProgram");
        button.disabled = true;
        try {
          const selected = await api.protectFirewallSelectProgram();
          if (!selected?.ok) {
            if (!selected?.canceled) setText("vpfwStatus", selected?.error || "Aplikaci se nepodaĹ™ilo vybrat.");
            return;
          }
          const confirmed = await confirmAction(
            "Zablokovat odchozĂ­ pĹ™ipojenĂ­?",
            `VoxarioProtect vytvoĹ™Ă­ ve Windows Defender Firewallu jedno odchozĂ­ BLOCK pravidlo pro:\n${selected.path}\n\nWindows zobrazĂ­ UAC.`,
          );
          if (!confirmed) return;
          setText("vpfwStatus", "ÄŚekĂˇm na UAC a vytvĂˇĹ™Ă­m odchozĂ­ BLOCK pravidloâ€¦");
          const result = await api.protectFirewallBlockSelected(selected.token);
          setText("vpfwStatus", result?.ok ? `${result.fileName || "Aplikace"} byla odĹ™Ă­znuta od odchozĂ­ sĂ­tÄ›.` : (result?.error || "Blokaci se nepodaĹ™ilo vytvoĹ™it."));
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
      empty.textContent = "Protect zatĂ­m nevytvoĹ™il ĹľĂˇdnĂ© vlastnĂ­ blokovacĂ­ pravidlo.";
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
      detail.textContent = `${rule.direction || "Outbound"} Â· ${rule.action || "Block"} Â· ${rule.enabled ? "aktivnĂ­" : "vypnutĂ©"}${rule.program ? ` Â· ${rule.program}` : ""}`;
      info.append(title, detail);
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "vp26-button danger";
      remove.textContent = "Odblokovat";
      remove.onclick = async () => {
        const confirmed = await confirmAction("Odstranit blokaci?", "Protect odstranĂ­ pouze svĂ© vlastnĂ­ Outbound BLOCK pravidlo.");
        if (!confirmed) return;
        remove.disabled = true;
        const result = await api.protectFirewallRemoveRule(rule.name);
        setText("vpfwStatus", result?.ok ? "Blokace byla odstranÄ›na." : (result?.error || "OdblokovĂˇnĂ­ selhalo."));
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
      empty.textContent = "ZatĂ­m nenĂ­ ĹľĂˇdnĂ˝ Protect â†” Defender rozpor ani firewall udĂˇlost.";
      list.appendChild(empty);
      return;
    }
    for (const item of values) {
      const row = document.createElement("div");
      row.className = "vp26-row";
      const info = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = item.title || "BezpeÄŤnostnĂ­ udĂˇlost";
      const detail = document.createElement("span");
      const score = Number.isFinite(Number(item.protectRiskScore)) ? ` Â· Protect ${item.protectRiskScore}/100` : "";
      detail.textContent = `${item.fileName ? `${item.fileName} Â· ` : ""}${item.detail || item.type || "udĂˇlost"}${score}`;
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
        setText("vpfwStatus", result?.error || "Stav Windows Firewallu se nepodaĹ™ilo naÄŤĂ­st.");
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
          strong.textContent = profile.enabled ? "AktivnĂ­" : "Vypnuto";
          const detail = document.createElement("p");
          detail.textContent = `PĹ™Ă­chozĂ­: ${profile.defaultInboundAction || "â€”"} Â· OdchozĂ­: ${profile.defaultOutboundAction || "â€”"}`;
          card.append(label, strong, detail);
          profiles.appendChild(card);
        }
      }
      setText("vpfwService", result.firewall?.serviceRunning ? "SluĹľba bÄ›ĹľĂ­" : "SluĹľba nebÄ›ĹľĂ­");
      const connections = Array.isArray(result.firewall?.connections) ? result.firewall.connections : [];
      setText("vpfwNetwork", connections.length ? connections.map((c) => `${c.name}: ${c.category}`).join(" Â· ") : "SĂ­ĹĄovĂ˝ profil nezjiĹˇtÄ›n");
      setText("vpfwStatus", result.firewall?.allEnabled ? "Windows Defender Firewall je aktivnĂ­ ve vĹˇech profilech. Protect ho doplĹuje vlastnĂ­mi pravidly." : "NÄ›kterĂ˝ profil Windows Firewallu je vypnutĂ˝ nebo nedostupnĂ˝.");
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
    let panel = document.getElementById("voxarioProtectStabilityV27");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "voxarioProtectStabilityV27";
      panel.className = "panel wide";
      panel.dataset.vpTabPanel = "stability";
      panel.innerHTML = `
        <div class="panel-title"><span>STABILITA / Ĺ˝IVOTNOST VOXARIOPROTECT</span><span class="muted">LIVE SELF-CHECK Â· ODEMÄŚENO</span></div>
        <div class="vp26-banner" id="vpstableStatus">NaÄŤĂ­tĂˇm diagnostiku stabilityâ€¦</div>
        <div class="vp26-grid">
          <div class="vp26-card"><small>UI SUPERVISOR</small><strong id="vpstableUi">AktivnĂ­</strong><p>HlĂ­dĂˇ, aby se kategorie po pĹ™estavbÄ› UI neztratily.</p></div>
          <div class="vp26-card"><small>MICROSOFT DEFENDER</small><strong id="vpstableDefender">â€”</strong><p id="vpstableDefenderDetail">ÄŚekĂˇm na stav.</p></div>
          <div class="vp26-card"><small>OCHRANA NA POZADĂŤ</small><strong id="vpstableBackground">â€”</strong><p id="vpstableBackgroundDetail">ÄŚekĂˇm na stav.</p></div>
          <div class="vp26-card"><small>FIREWALL COMPANION</small><strong id="vpstableFirewall">â€”</strong><p id="vpstableFirewallDetail">ÄŚekĂˇm na stav.</p></div>
          <div class="vp26-card"><small>INTEGRITA DESKTOPU</small><strong id="vpstableIntegrity">â€”</strong><p id="vpstableIntegrityDetail">ÄŚekĂˇm na manifest.</p></div>
          <div class="vp26-card"><small>Ĺ˝IVOTNOST / UPTIME</small><strong id="vpstableUptime">â€”</strong><p id="vpstableUptimeDetail">Doba bÄ›hu ochrannĂ©ho procesu.</p></div>
          <div class="vp26-card"><small>AKTUALIZACE</small><strong id="vpstableUpdateState">OvÄ›Ĺ™ujiâ€¦</strong><p id="vpstableUpdateDetail">Kontrola GitHub release kanĂˇlu.</p></div>
          <div class="vp26-card"><small>VERZE</small><strong id="vpstableVersions">Protect v${protectVersion}</strong><p id="vpstableVersionDetail">Desktop verze se naÄŤte z balĂ­ÄŤku.</p></div>
        </div>
        <div class="vp26-actions">
          <button class="vp26-button primary" id="vpstableRefresh" type="button">Obnovit stabilitu</button>
          <button class="vp26-button" id="vpstableSecurity" type="button">OtevĹ™Ă­t Windows ZabezpeÄŤenĂ­</button>
          <button class="vp26-button" id="vpstableUpdate" type="button">OtevĹ™Ă­t Windows Update</button>
        </div>
        <p class="notice">Stabilita je read-only self-check Protectu. Nic nevypĂ­nĂˇ, nemÄ›nĂ­ Defender exclusions ani globĂˇlnĂ­ Windows Firewall policy.</p>
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
      const [statusResult, integrityResult, firewallResult, runtimeResult, updateResult] = await Promise.allSettled([
        api.protectGetStatus?.(),
        api.protectGetIntegrity?.(),
        api.protectFirewallGetStatus?.(),
        api.protectGetRuntimeHealth?.(),
        api.checkUpdatesQuiet?.(),
      ]);
      const status = statusResult.status === "fulfilled" ? statusResult.value : null;
      const integrity = integrityResult.status === "fulfilled" ? integrityResult.value : null;
      const firewall = firewallResult.status === "fulfilled" ? firewallResult.value : null;
      const runtime = runtimeResult.status === "fulfilled" ? runtimeResult.value : null;
      const update = updateResult.status === "fulfilled" ? updateResult.value : null;

      const defenderOk = status?.ok === true;
      const defender = status?.status || {};
      setText("vpstableDefender", defenderOk ? (defender.RealTimeProtectionEnabled ? "Real-time aktivnĂ­" : "Defender odpovĂ­dĂˇ") : "NedostupnĂ©");
      setText("vpstableDefenderDetail", defenderOk ? `Antivirus ${defender.AntivirusEnabled ? "aktivnĂ­" : "neaktivnĂ­"} Â· Behavior ${defender.BehaviorMonitorEnabled ? "aktivnĂ­" : "neaktivnĂ­"}` : (status?.error || "Defender bridge neodpovÄ›dÄ›l."));

      const backgroundActive = status?.background?.active === true;
      setText("vpstableBackground", backgroundActive ? "AktivnĂ­" : "NeaktivnĂ­");
      setText("vpstableBackgroundDetail", status?.background?.mode || "Stav background companion nenĂ­ dostupnĂ˝.");

      const firewallOk = firewall?.ok === true;
      setText("vpstableFirewall", firewallOk ? (firewall.firewall?.allEnabled ? "VĹˇechny profily aktivnĂ­" : "VyĹľaduje pozornost") : "NedostupnĂ©");
      setText("vpstableFirewallDetail", firewallOk ? `${firewall.rules?.length || 0} vlastnĂ­ch pravidel Protect Â· sluĹľba ${firewall.firewall?.serviceRunning ? "bÄ›ĹľĂ­" : "nebÄ›ĹľĂ­"}` : (firewall?.error || "Firewall bridge neodpovÄ›dÄ›l."));

      const integrityOk = !!integrity && typeof integrity === "object";
      setText("vpstableIntegrity", integrityOk ? "Manifest naÄŤten" : "NedostupnĂ©");
      const hash = String(integrity?.integrityHash || "");
      setText("vpstableIntegrityDetail", integrityOk ? `Platforma ${integrity.platform || "â€”"}${hash ? ` Â· hash ${hash.slice(0, 12)}â€¦` : ""}` : "Integrita desktopu se nepodaĹ™ila naÄŤĂ­st.");
      const uptimeSec = Math.max(0, Number(runtime?.uptimeSec || 0));
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      if (runtime?.ok && runtime.appBundlePath) {
        const detail = document.getElementById("vpstableUptimeDetail");
        if (detail) detail.title = `Renderer v2.7 ${window.__voxarioProtectUiV27 ? "loaded" : "unconfirmed"}; IPC ${api ? "available" : "unavailable"}; asset ${runtime.protectUiAssetPresent ? "present" : "missing"}; bundle ${runtime.appBundlePath}`;
      }
      setText("vpstableUptime", runtime?.ok ? `${hours} h ${minutes} min` : "NedostupnĂ©");
      setText("vpstableUptimeDetail", runtime?.ok ? `RAM procesu ${runtime.processMemoryMB || "â€”"} MB Â· ${runtime.arch || "â€”"}` : "Runtime diagnostika neodpovÄ›dÄ›la.");

      const updateAvailable = update?.available === true;
      setText("vpstableUpdateState", updateAvailable ? `DostupnĂˇ ${update.remote || "novĂˇ verze"}` : (update?.error ? "Kontrola selhala" : "AktuĂˇlnĂ­"));
      setText("vpstableUpdateDetail", updateAvailable
        ? `NainstalovĂˇno ${update.current || integrity?.appVersion || "â€”"} Â· aktualizace se stĂˇhne a nainstaluje automaticky.`
        : (update?.error || `Release kanĂˇl je aktuĂˇlnĂ­ Â· Desktop ${update?.current || integrity?.appVersion || "â€”"}`));

      setText("vpstableVersions", `Protect v${protectVersion} Â· Desktop ${integrity?.appVersion || runtime?.appVersion || "â€”"}`);
      setText("vpstableVersionDetail", `PoslednĂ­ self-check: ${new Date().toLocaleTimeString("cs-CZ")}`);

      const healthy = [defenderOk, firewallOk, integrityOk].filter(Boolean).length;
      const stateText = healthy === 3 ? "VĹˇechny hlavnĂ­ diagnostickĂ© vrstvy odpovĂ­dajĂ­." : `${healthy}/3 hlavnĂ­ch diagnostickĂ˝ch vrstev odpovĂ­dĂˇ. Zkontroluj zvĂ˝raznÄ›nĂ© poloĹľky.`;
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
  window.__voxarioProtectUiV27 = { ensure, activateTab, refreshFirewall, refreshStability };
  ensure();
}


function startVoxarioProtectUiV27() {
  const run = () => {
    try { protectUiV27(); } catch (error) { console.error("VoxarioProtect v2.7 UI failed", error); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
}

startVoxarioProtectUiV27();


"use strict";

// VoxarioProtect Guard UI – posílení Defenderu/Firewallu, přehled blokací
// a hlídání autostartu/registru. Používá jen API z preload.cjs.
(function protectGuardUi() {
  const api = window.studioVoxarioDesktop;
  if (!api || typeof api.protectGuardState !== "function") return;

  const GROUPS = [
    { id: "defender", title: "MICROSOFT DEFENDER" },
    { id: "internet", title: "OCHRANA NA INTERNETU" },
    { id: "updates", title: "AKTUALIZACE A VÝKON" },
    { id: "firewall", title: "WINDOWS FIREWALL" },
  ];
  const ACTION_LABELS = { remove: "Odebrat", reset: "Obnovit výchozí", quarantine: "Do karantény", disable: "Vypnout" };
  const DONE_LABELS = { remove: "Odebráno", reset: "Obnoveno na výchozí", quarantine: "V karanténě", disable: "Vypnuto" };
  const SEVERITY_LABELS = { high: "VYSOKÉ RIZIKO", medium: "OVĚŘIT", low: "PODEPSÁNO", info: "INFO" };

  const byId = (id) => document.getElementById(id);
  let catalog = [];
  let state = null;
  let busy = false;
  const selected = new Set();
  let selectionTouched = false;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = String(text);
    return node;
  }

  function formatDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("cs-CZ");
  }

  function signerName(subject) {
    const match = /CN=("?)([^,"]+)\1/.exec(String(subject || ""));
    return match ? match[2] : String(subject || "");
  }

  function banner(id, text, level = "") {
    const node = byId(id);
    if (!node) return;
    node.hidden = !text;
    node.className = `vg-banner${level ? ` ${level}` : ""}`;
    node.textContent = text || "";
  }

  function confirmAction(title, text, acceptLabel) {
    const dialog = byId("confirmDialog");
    const accept = byId("confirmAccept");
    const cancel = byId("confirmCancel");
    if (!dialog || !accept || !cancel) return Promise.resolve(window.confirm(`${title}\n\n${text}`));
    byId("confirmTitle").textContent = title;
    byId("confirmText").textContent = text;
    const previousLabel = accept.textContent;
    if (acceptLabel) accept.textContent = acceptLabel;
    dialog.classList.add("on");
    return new Promise((resolve) => {
      const done = (value) => {
        dialog.classList.remove("on");
        accept.textContent = previousLabel;
        accept.onclick = null;
        cancel.onclick = null;
        resolve(value);
      };
      accept.onclick = () => done(true);
      cancel.onclick = () => done(false);
    });
  }

  function describeError(result, fallback) {
    if (result?.canceled) return "Potvrzení správce bylo zrušeno – nic se nezměnilo.";
    if (result?.unsupported) return "Tato funkce je dostupná jen ve Windows.";
    return result?.error || fallback;
  }

  async function withBusy(button, label, task) {
    if (busy) return;
    busy = true;
    const original = button?.textContent;
    if (button) { button.disabled = true; button.textContent = label; }
    try { await task(); }
    finally {
      busy = false;
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }

  // ------------------------------------------------------------ posílení

  function itemPill(item) {
    if (item.drift) return el("span", "vg-pill bad", "VRÁTILY HO WINDOWS");
    if (item.state === "ok") return el("span", "vg-pill ok", item.applied ? "AKTIVNÍ · PROTECT" : "AKTIVNÍ");
    if (item.state === "off") return el("span", "vg-pill off", "VYPNUTO");
    return el("span", "vg-pill", "NEZNÁMÉ");
  }

  function renderSummary() {
    const box = byId("vgSummary");
    if (!box) return;
    const status = state?.status;
    if (!status) {
      byId("vgSummaryScore").textContent = "—";
      byId("vgSummaryText").textContent = state ? "Stav posílení se zatím nepodařilo načíst." : "Načítám stav Defenderu a Firewallu…";
      return;
    }
    const pending = state.watch?.pending?.filter((row) => row.severity !== "info").length || 0;
    byId("vgSummaryScore").textContent = `${status.recommendedDone}/${status.recommendedTotal} ochran`;
    const parts = [];
    if (state.drift?.length) parts.push(`${state.drift.length} posílení vrátily Windows`);
    if (status.defender?.signaturesStale) parts.push(`definice staré ${status.defender.signatureAge} dní`);
    if (pending) parts.push(`${pending} změn systému ke kontrole`);
    const missing = status.recommendedTotal - status.recommendedDone;
    if (!parts.length) parts.push(missing ? `${missing} doporučených ochran je vypnutých` : "Všechny doporučené ochrany jsou aktivní");
    byId("vgSummaryText").textContent = parts.join(" · ");
    box.className = `vg-summary${state.drift?.length || pending ? " bad" : missing || status.defender?.signaturesStale ? " warn" : ""}`;
  }

  function renderGuard() {
    renderSummary();
    const container = byId("vgItems");
    if (!container) return;
    const status = state?.status;
    if (!status) {
      container.replaceChildren(el("span", "notice", state ? "Stav Defenderu se nepodařilo načíst. Klikni na „Zkontrolovat“." : "Načítám…"));
      return;
    }
    byId("vgScore").textContent = `${status.recommendedDone}/${status.recommendedTotal} (${status.score} %)`;
    const defender = status.defender || {};
    byId("vgSignatures").textContent = defender.signatureAge == null ? "—" : defender.signatureAge === 0 ? "Dnešní" : `Staré ${defender.signatureAge} dní`;
    byId("vgTamper").textContent = defender.tamperProtected == null ? "—" : defender.tamperProtected ? "Zapnutá" : "Vypnutá";
    byId("vgLastCheck").textContent = formatDate(state.lastCheckAt);

    if (defender.runningMode && !/normal/i.test(defender.runningMode)) {
      banner("vgBanner", `Microsoft Defender běží v režimu „${defender.runningMode}“ – nejspíš je nainstalovaný jiný antivirus. Posílení Defenderu se v tomto režimu neprojeví.`, "warn");
    } else if (state.drift?.length) {
      banner("vgBanner", "Některá posílení po aktualizaci Windows nebo zásahu jiného programu přestala platit. Zaškrtnuté položky můžeš jedním klikem obnovit.", "bad");
    } else if (defender.signaturesStale) {
      banner("vgBanner", `Definice Defenderu jsou staré ${defender.signatureAge} dní. Klikni na „Aktualizovat definice teď“.`, "warn");
    } else {
      banner("vgBanner", "");
    }

    if (!selectionTouched) {
      selected.clear();
      for (const item of status.items) {
        if (item.drift || (item.recommended && item.state === "off")) selected.add(item.id);
      }
    }

    const groups = GROUPS.map((group) => {
      const items = status.items.filter((item) => item.group === group.id);
      if (!items.length) return null;
      const wrap = el("div", "vg-group");
      wrap.appendChild(el("h3", "", group.title));
      for (const item of items) {
        const row = el("label", `vg-item${item.drift ? " drift" : item.state === "ok" ? " ok" : ""}`);
        const check = document.createElement("input");
        check.type = "checkbox";
        check.checked = selected.has(item.id);
        check.disabled = item.state === "ok" && !item.drift;
        check.addEventListener("change", () => {
          selectionTouched = true;
          if (check.checked) selected.add(item.id); else selected.delete(item.id);
        });
        const body = el("div");
        body.appendChild(el("b", "", item.recommended ? item.title : `${item.title} (volitelné)`));
        body.appendChild(el("p", "", item.description));
        const side = el("div", "vg-row-actions");
        side.appendChild(itemPill(item));
        if (item.applied) {
          const revert = el("button", "vg-btn", "Vrátit");
          revert.type = "button";
          revert.addEventListener("click", (event) => { event.preventDefault(); void revertItems([item.id], revert); });
          side.appendChild(revert);
        }
        row.append(check, body, side);
        wrap.appendChild(row);
      }
      return wrap;
    }).filter(Boolean);
    container.replaceChildren(...groups);
    byId("vgRevertAll").hidden = !state.canRevert;
  }

  async function applySelected() {
    const ids = [...selected];
    if (!ids.length) { banner("vgBanner", "Vyber alespoň jednu ochranu.", "warn"); return; }
    const titles = (state?.status?.items || []).filter((item) => ids.includes(item.id)).map((item) => `• ${item.title}`).join("\n");
    const ok = await confirmAction(
      "Zapnout ochrany Windows",
      `Protect změní nastavení Microsoft Defenderu a Firewallu:\n${titles}\n\nWindows si vyžádá potvrzení správce (UAC). Původní nastavení se uloží a půjde vrátit.`,
      "Zapnout",
    );
    if (!ok) return;
    await withBusy(byId("vgApply"), "Čekám na potvrzení správce…", async () => {
      const result = await api.protectGuardHarden(ids);
      if (!result?.ok) { banner("vgBanner", describeError(result, "Ochrany se nepodařilo zapnout."), "bad"); return; }
      selectionTouched = false;
      state = result.state;
      renderGuard();
      const problems = [];
      if (result.notTaken?.length) problems.push(`${result.notTaken.length} nastavení Windows nepřijal (Ochrana před falšováním nebo zásady organizace). Zkontroluj je ve Windows Zabezpečení.`);
      if (result.failed?.length) problems.push(`Chyba: ${result.failed.map((row) => row.error).join("; ")}`.slice(0, 400));
      banner("vgBanner", problems.length ? problems.join(" ") : "Hotovo. Ochrany jsou zapnuté a Protect bude hlídat, aby je Windows Update nevrátil.", problems.length ? "warn" : "");
    });
  }

  async function revertItems(ids, button) {
    const all = !ids;
    const ok = await confirmAction(
      "Vrátit původní nastavení",
      all ? "Všechna posílení, která zapnul Protect, se vrátí na hodnoty před změnou." : "Tato ochrana se vrátí na hodnotu před změnou.",
      "Vrátit",
    );
    if (!ok) return;
    await withBusy(button, "Vracím…", async () => {
      const result = await api.protectGuardRevert(ids || []);
      if (!result?.ok) { banner("vgBanner", describeError(result, "Nastavení se nepodařilo vrátit."), "bad"); return; }
      state = result.state;
      selectionTouched = false;
      renderGuard();
      banner("vgBanner", result.failed?.length ? `Část nastavení se nepodařilo vrátit: ${result.failed.map((row) => row.error).join("; ")}` : "Původní nastavení je obnovené.", result.failed?.length ? "warn" : "");
    });
  }

  async function updateSignatures() {
    await withBusy(byId("vgSignatureUpdate"), "Aktualizuji definice…", async () => {
      const result = await api.protectGuardUpdateSignatures();
      if (!result?.ok) { banner("vgBanner", describeError(result, "Definice se nepodařilo aktualizovat."), "bad"); return; }
      if (result.state) state = result.state;
      renderGuard();
      banner("vgBanner", `Definice jsou aktuální (verze ${result.data?.version || "?"}).`);
    });
  }

  // ------------------------------------------------------------ blokace

  async function loadBlocked() {
    const list = byId("vgBlocked");
    await withBusy(byId("vgBlockedRefresh"), "Načítám…", async () => {
      const result = await api.protectGuardBlocked(14);
      if (!result?.ok) { list.replaceChildren(el("span", "notice", describeError(result, "Záznamy Defenderu se nepodařilo načíst."))); return; }
      if (!result.items.length) { list.replaceChildren(el("span", "notice", "Za posledních 14 dní Defender nic nezablokoval.")); return; }
      list.replaceChildren(...result.items.map(renderBlockedRow));
    });
  }

  function renderBlockedRow(item) {
    const row = el("div", `vg-row${item.kind === "threat" ? " high" : item.kind === "config" ? "" : " medium"}`);
    const body = el("div");
    body.appendChild(el("b", "", item.title));
    const parts = [item.target, item.process && item.process !== item.target ? `program: ${item.process}` : null, item.detail, formatDate(item.time)].filter(Boolean);
    body.appendChild(el("span", "", parts.join(" · ")));
    const actions = el("div", "vg-row-actions");
    if (item.canAllow) {
      const allow = el("button", "vg-btn", "Povolit");
      allow.type = "button";
      allow.addEventListener("click", () => void allowBlocked(item, allow));
      actions.appendChild(allow);
    } else if (item.kind === "threat") {
      const open = el("button", "vg-btn", "Windows Zabezpečení");
      open.type = "button";
      open.addEventListener("click", () => api.protectOpenWindowsSecurity());
      actions.appendChild(open);
    }
    row.append(body, actions);
    return row;
  }

  async function allowBlocked(item, button) {
    const file = item.kind === "folders" ? item.process : item.target;
    const what = item.kind === "folders" ? "zapisovat do chráněných složek" : "obejít toto pravidlo ochrany";
    const ok = await confirmAction("Povolit program", `Program ${file} bude smět ${what}. Antivirová kontrola Defenderu pro něj dál platí.\n\nPovol jen program, kterému opravdu věříš.`, "Povolit");
    if (!ok) return;
    await withBusy(button, "Povoluji…", async () => {
      let result = await api.protectGuardAllow(item.id, false);
      if (!result?.ok && /podepsan/i.test(String(result?.error || ""))) {
        const really = await confirmAction("Program není podepsaný", `${file}\n\nTento soubor nemá platný digitální podpis vydavatele. Nepodepsané programy jsou častým nosičem malwaru. Opravdu ho chceš povolit?`, "Přesto povolit");
        if (!really) return;
        result = await api.protectGuardAllow(item.id, true);
      }
      if (!result?.ok) { banner("vgBanner", describeError(result, "Program se nepodařilo povolit."), "bad"); return; }
      button.textContent = "Povoleno";
      button.disabled = true;
    });
  }

  // ------------------------------------------------------------ hlídání

  function renderWatch() {
    const pendingList = byId("vwPending");
    const removedList = byId("vwRemoved");
    if (!pendingList || !removedList) return;
    const watch = state?.watch;
    if (!watch) { pendingList.replaceChildren(el("span", "notice", "Načítám…")); return; }
    if (watch.lastError) banner("vwBanner", `Poslední kontrola se nezdařila: ${watch.lastError}`, "warn");
    else if (!watch.ready) banner("vwBanner", "Protect si teď ukládá výchozí stav systému. První kontrola může trvat až minutu.");
    else banner("vwBanner", watch.baselineAt ? `Výchozí stav uložen ${formatDate(watch.baselineAt)}. Poslední kontrola ${formatDate(state.lastCheckAt)}.` : "");

    const pending = watch.pending || [];
    if (!pending.length) {
      pendingList.replaceChildren(el("span", "notice", watch.ready ? "Žádné nové změny. Vše odpovídá stavu, který znáš." : "Zatím nic ke kontrole."));
    } else {
      const order = { high: 0, medium: 1, low: 2, info: 3 };
      pendingList.replaceChildren(...[...pending].sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4)).map(renderFinding));
    }

    const removed = watch.removed || [];
    if (!removed.length) removedList.replaceChildren(el("span", "notice", "Zatím nic."));
    else removedList.replaceChildren(...removed.map(renderRemoved));
  }

  function renderFinding(finding) {
    const row = el("div", `vg-row ${finding.severity}`);
    const body = el("div");
    body.appendChild(el("b", "", finding.title));
    body.appendChild(el("span", "", finding.detail));
    const meta = [];
    if (finding.target) meta.push(finding.target);
    if (finding.signature) meta.push(finding.signature === "Valid" ? `Podepsáno: ${signerName(finding.signer) || "platný podpis"}` : "Bez platného podpisu vydavatele");
    meta.push(formatDate(finding.detectedAt));
    body.appendChild(el("span", "", meta.join(" · ")));
    const actions = el("div", "vg-row-actions");
    actions.appendChild(el("span", `vg-pill${finding.severity === "high" ? " bad" : finding.severity === "medium" ? " off" : finding.severity === "low" ? " ok" : ""}`, SEVERITY_LABELS[finding.severity] || "INFO"));
    const keep = el("button", "vg-btn", finding.severity === "info" ? "Beru na vědomí" : "Ponechat");
    keep.type = "button";
    keep.addEventListener("click", () => void approveFinding(finding, keep));
    actions.appendChild(keep);
    if (finding.action) {
      const remove = el("button", "vg-btn danger", ACTION_LABELS[finding.action] || "Odebrat");
      remove.type = "button";
      remove.addEventListener("click", () => void removeFinding(finding, remove));
      actions.appendChild(remove);
    }
    row.append(body, actions);
    return row;
  }

  function renderRemoved(record) {
    const row = el("div", "vg-row");
    const body = el("div");
    body.appendChild(el("b", "", `${DONE_LABELS[record.action] || "Odebráno"}: ${record.kindLabel}`));
    body.appendChild(el("span", "", `${record.detail} · ${formatDate(record.at)}`));
    const actions = el("div", "vg-row-actions");
    const restore = el("button", "vg-btn", "Vrátit");
    restore.type = "button";
    restore.addEventListener("click", () => void restoreRemoved(record, restore));
    actions.appendChild(restore);
    row.append(body, actions);
    return row;
  }

  async function approveFinding(finding, button) {
    await withBusy(button, "Ukládám…", async () => {
      const result = await api.protectWatchApprove(finding.id);
      if (!result?.ok) { banner("vwBanner", describeError(result, "Nepodařilo se uložit."), "bad"); return; }
      state = result.state;
      renderWatch();
      renderSummary();
    });
  }

  async function removeFinding(finding, button) {
    const label = ACTION_LABELS[finding.action] || "Odebrat";
    const how = {
      remove: "Položka se odstraní. Protect si uloží její přesnou kopii.",
      reset: "Hodnota se nastaví zpět na výchozí hodnotu Windows. Původní hodnota se uloží.",
      quarantine: "Soubor se přesune do karantény Protectu (nesmaže se).",
      disable: "Položka se vypne, ale zůstane v systému.",
    }[finding.action];
    const ok = await confirmAction(`${label}: ${finding.kindLabel}`, `${finding.detail}\n\n${how} Kdykoli ji vrátíš v sekci „Odebrané položky“.${finding.elevate ? "\n\nWindows si vyžádá potvrzení správce (UAC)." : ""}`, label);
    if (!ok) return;
    await withBusy(button, "Provádím…", async () => {
      const result = await api.protectWatchRemove(finding.id);
      if (!result?.ok) { banner("vwBanner", describeError(result, "Akci se nepodařilo provést."), "bad"); return; }
      state = result.state;
      renderWatch();
      renderSummary();
    });
  }

  async function restoreRemoved(record, button) {
    const ok = await confirmAction("Vrátit položku", `${record.detail}\n\nPoložka se obnoví do původního stavu.`, "Vrátit");
    if (!ok) return;
    await withBusy(button, "Vracím…", async () => {
      const result = await api.protectWatchRestore(record.id);
      if (!result?.ok) { banner("vwBanner", describeError(result, "Položku se nepodařilo vrátit."), "bad"); return; }
      state = result.state;
      renderWatch();
      renderSummary();
    });
  }

  // ------------------------------------------------------------ start

  function render() {
    renderGuard();
    renderWatch();
  }

  async function runCheck(button) {
    await withBusy(button, "Kontroluji…", async () => {
      const result = await api.protectGuardCheck();
      if (result?.state) state = result.state;
      if (!result?.ok) {
        const message = describeError(result, "Kontrolu se nepodařilo dokončit.");
        banner("vgBanner", message, "warn");
        banner("vwBanner", message, "warn");
      }
      render();
    });
  }

  function openGuardTab() {
    const tab = document.querySelector('#voxarioProtectTabs .vp24-tab[data-tab="guard"]');
    if (tab) tab.click();
    else byId("voxarioGuard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function init() {
    byId("vgApply")?.addEventListener("click", () => void applySelected());
    byId("vgRevertAll")?.addEventListener("click", (event) => void revertItems(null, event.currentTarget));
    byId("vgSignatureUpdate")?.addEventListener("click", () => void updateSignatures());
    byId("vgRefresh")?.addEventListener("click", (event) => void runCheck(event.currentTarget));
    byId("vwRefresh")?.addEventListener("click", (event) => void runCheck(event.currentTarget));
    byId("vgBlockedRefresh")?.addEventListener("click", () => void loadBlocked());
    byId("vgSummaryOpen")?.addEventListener("click", openGuardTab);
    api.onProtectGuardState?.((next) => {
      if (!next || busy) return;
      state = next;
      render();
    });
    try { catalog = await api.protectGuardCatalog(); } catch { catalog = []; }
    try { state = await api.protectGuardState(); } catch { state = null; }
    render();
    // Bez uloženého stavu (první spuštění) hned zkontrolujeme.
    if (!state?.status || !state?.watch?.ready) await runCheck(null);
  }

  window.__voxarioProtectGuardUi = { render, get state() { return state; }, get catalog() { return catalog; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void init());
  else void init();
})();

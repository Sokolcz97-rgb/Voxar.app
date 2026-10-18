"use strict";

// Sdílená logika VoxarioProtect Guard pro okno aplikace i rezidentní proces
// na pozadí. Stav (co uživatel posílil, zálohy, baseline hlídání) je v
// jednom JSON souboru v userData; oba procesy ho před každou změnou znovu
// načtou, aby si nepřepisovaly data.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const guard = require("./protect-guard.cjs");
const watch = require("./protect-watch.cjs");

const STATE_FILE = "voxario-protect-guard.json";
const CHECK_MIN_GAP_MS = 4 * 60 * 1000;
const MAX_REMOVED = 60;
const MAX_PENDING = 200;

function emptyState() {
  return {
    version: 1,
    applied: [],
    backup: null,
    lastStatus: null,
    lastCheckAt: null,
    driftNotified: [],
    signatureNotifiedOn: null,
    watch: { baseline: null, baselineAt: null, pending: [], notified: [], removed: [], lastError: null },
  };
}

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

// Položky, které při prvním spuštění nahlásíme hned (nejsou běžné a typicky
// je nastavuje malware nebo „optimalizační“ nástroje).
function isSuspiciousExisting(entry) {
  if (entry.kind === "ifeo" || entry.kind === "exclusion") return true;
  if (entry.kind === "winlogon") return watch.removalFor(entry) !== null;
  if (entry.kind === "policy") {
    if (/\\Exclusions\\/i.test(entry.location)) return true;
    if (/^Disable/i.test(entry.name) && entry.value !== "0" && entry.value !== "") return true;
    if (/^EnableLUA$/i.test(entry.name) && entry.value === "0") return true;
    if (/^ConsentPromptBehaviorAdmin$/i.test(entry.name) && entry.value === "0") return true;
  }
  return false;
}

function createGuardService({ userDataDir, notify = () => {}, addActivity = () => {}, now = () => new Date() } = {}) {
  if (!userDataDir) throw new Error("userDataDir is required");
  const file = path.join(userDataDir, STATE_FILE);
  const quarantineDir = path.join(userDataDir, "protect-quarantine");
  let checking = null;

  function load() {
    try {
      const data = JSON.parse(fs.readFileSync(file, "utf8"));
      const base = emptyState();
      return { ...base, ...data, watch: { ...base.watch, ...(data.watch || {}) } };
    } catch {
      return emptyState();
    }
  }

  function save(state) {
    try {
      fs.mkdirSync(userDataDir, { recursive: true });
      const tmp = `${file}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, file);
    } catch {}
  }

  function update(mutator) {
    const state = load();
    const result = mutator(state);
    save(state);
    return result;
  }

  function publicState(state = load()) {
    const status = state.lastStatus;
    const applied = new Set(state.applied);
    const drift = status ? guard.detectDrift(state.applied, status) : [];
    return {
      lastCheckAt: state.lastCheckAt,
      status: status
        ? {
            ...status,
            items: status.items.map((item) => ({ ...item, applied: applied.has(item.id), drift: drift.includes(item.id) })),
          }
        : null,
      applied: [...applied],
      canRevert: !!state.backup && applied.size > 0,
      drift,
      watch: {
        ready: !!state.watch.baseline,
        baselineAt: state.watch.baselineAt,
        pending: state.watch.pending.map(({ entry, ...rest }) => rest),
        removed: state.watch.removed.map(({ backup, entry, ...rest }) => rest),
        lastError: state.watch.lastError,
      },
    };
  }

  // ------------------------------------------------------------- kontrola

  async function refreshStatus() {
    const result = await guard.readStatus();
    if (!result.ok) return result;
    update((state) => { state.lastStatus = result.status; });
    return result;
  }

  async function runCheck({ notify: shouldNotify = true } = {}) {
    const [statusResult, collected] = await Promise.all([guard.readStatus(), watch.collect()]);
    const messages = [];
    const at = now();

    update((state) => {
      state.lastCheckAt = at.toISOString();

      if (statusResult.ok) {
        state.lastStatus = statusResult.status;
        const drift = guard.detectDrift(state.applied, statusResult.status);
        const already = new Set(state.driftNotified);
        for (const id of drift) {
          if (already.has(id)) continue;
          const item = statusResult.status.items.find((row) => row.id === id);
          messages.push({
            activity: { type: "guard", status: "warning", severity: "high", title: `Posílení bylo vráceno: ${item?.title || id}`, detail: "Nastavení změnila aktualizace Windows nebo jiný program. V Protectu ho můžeš jedním klikem obnovit." },
            toast: ["VoxarioProtect", `Posílení „${item?.title || id}“ už není aktivní. Otevři Protect a obnov ho.`],
          });
        }
        state.driftNotified = drift;

        const defender = statusResult.status.defender;
        const today = at.toISOString().slice(0, 10);
        if (defender.signaturesStale && state.signatureNotifiedOn !== today) {
          state.signatureNotifiedOn = today;
          messages.push({
            activity: { type: "guard", status: "warning", severity: "medium", title: `Definice Defenderu jsou staré ${defender.signatureAge} dní`, detail: "Protect je umí aktualizovat přímo ze serverů Microsoftu." },
            toast: ["VoxarioProtect", `Definice Microsoft Defenderu jsou staré ${defender.signatureAge} dní.`],
          });
        }
      }

      if (collected.ok) {
        state.watch.lastError = null;
        const entries = collected.entries;
        if (!state.watch.baseline) {
          const baseline = {};
          const initial = [];
          for (const entry of entries) {
            const key = watch.entryKey(entry);
            const hash = watch.entryValueHash(entry);
            if (isSuspiciousExisting(entry)) initial.push({ key, hash, change: "existing", entry });
            else baseline[key] = hash;
          }
          state.watch.baseline = baseline;
          state.watch.baselineAt = at.toISOString();
          state.watch.pending = initial.map((raw) => ({ ...watch.toFinding(raw, at), title: `Ke kontrole: ${watch.KIND_LABELS[raw.entry.kind]}` }));
        } else {
          const { findings, current } = watch.diffEntries(state.watch.baseline, entries);
          // Zmizelé položky odebereme z baseline jen u druhů, které se
          // podařilo načíst (jinak by výpadek čtení vyvolal falešné poplachy).
          const kindsSeen = new Set(entries.map((entry) => entry.kind));
          for (const key of Object.keys(state.watch.baseline)) {
            if (!(key in current) && kindsSeen.has(key.split("|")[0])) delete state.watch.baseline[key];
          }
          const previous = new Map(state.watch.pending.map((row) => [row.id, row]));
          const existing = state.watch.pending.filter((row) => row.change === "existing" && current[row.key] === row.hash);
          const fresh = findings.map((raw) => previous.get(watch.toFinding(raw, at).id) || watch.toFinding(raw, at));
          state.watch.pending = [...existing, ...fresh.filter((row) => !existing.some((e) => e.id === row.id))].slice(0, MAX_PENDING);
        }
        const notified = new Set(state.watch.notified);
        for (const finding of state.watch.pending) {
          if (notified.has(finding.id)) continue;
          notified.add(finding.id);
          if (finding.severity === "info") continue;
          messages.push({
            activity: { type: "watch", status: finding.severity === "low" ? "info" : "warning", severity: finding.severity, title: finding.title, detail: finding.detail },
            toast: finding.severity === "low" ? null : ["VoxarioProtect", `${finding.title}: ${finding.detail}`.slice(0, 240)],
          });
        }
        const pendingIds = new Set(state.watch.pending.map((row) => row.id));
        state.watch.notified = [...notified].filter((id) => pendingIds.has(id));
      } else if (!collected.unsupported) {
        state.watch.lastError = collected.error || "Hlídání systému se nepodařilo načíst.";
      }
    });

    for (const message of messages) {
      try { addActivity(message.activity); } catch {}
      if (shouldNotify && message.toast) {
        try { notify(...message.toast); } catch {}
      }
    }
    return {
      ok: statusResult.ok || collected.ok,
      unsupported: !!statusResult.unsupported && !!collected.unsupported,
      error: statusResult.ok ? collected.error : statusResult.error,
      state: publicState(),
    };
  }

  // Periodická kontrola. Když ji před chvílí provedl druhý proces Protectu,
  // přeskočí se, aby notifikace nechodily dvakrát.
  async function check({ force = false, notify: shouldNotify = true } = {}) {
    if (checking) return checking;
    const last = Date.parse(load().lastCheckAt || "");
    if (!force && Number.isFinite(last) && now().getTime() - last < CHECK_MIN_GAP_MS) {
      return { ok: true, skipped: true, state: publicState() };
    }
    checking = runCheck({ notify: shouldNotify }).finally(() => { checking = null; });
    return checking;
  }

  // ------------------------------------------------------------- posílení

  async function harden(ids) {
    const wanted = asArray(ids).filter((id) => guard.HARDENING_ITEMS.some((item) => item.id === id));
    if (!wanted.length) return { ok: false, error: "Vyber alespoň jednu položku." };
    const result = await guard.applyHardening(wanted);
    if (!result.ok) return result;
    const failed = new Set(result.errors.map((row) => row.item));
    const succeeded = wanted.filter((id) => !failed.has(id));
    update((state) => {
      state.backup = guard.mergeBackup(state.backup, result.before);
      state.applied = [...new Set([...state.applied, ...succeeded])];
      state.driftNotified = state.driftNotified.filter((id) => !wanted.includes(id));
    });
    await refreshStatus();
    const status = load().lastStatus;
    // Nastavení, které Windows tiše nepřijalo (typicky Tamper Protection nebo
    // zásady organizace), poznáme podle stavu po změně.
    const notTaken = succeeded.filter((id) => status?.items.find((item) => item.id === id)?.state === "off");
    addActivity({
      type: "guard",
      status: failed.size || notTaken.length ? "warning" : "clean",
      severity: failed.size || notTaken.length ? "medium" : "info",
      title: `Posílení zapnuto (${succeeded.length - notTaken.length}/${wanted.length})`,
      detail: notTaken.length || failed.size ? "Některá nastavení Windows nepřijal – nejspíš kvůli Ochraně před falšováním nebo zásadám organizace." : "Původní nastavení je zálohované a lze ho vrátit.",
    });
    return { ok: true, applied: succeeded, failed: result.errors, notTaken, state: publicState() };
  }

  async function revert(ids) {
    const state = load();
    const wanted = asArray(ids && asArray(ids).length ? ids : state.applied).filter((id) => state.applied.includes(id));
    if (!wanted.length) return { ok: false, error: "Není co vracet." };
    if (!state.backup) return { ok: false, error: "Chybí záloha původního nastavení." };
    const result = await guard.revertHardening(wanted, state.backup);
    if (!result.ok) return result;
    const failed = new Set(result.errors.map((row) => row.item));
    update((next) => {
      next.applied = next.applied.filter((id) => !wanted.includes(id) || failed.has(id));
      next.driftNotified = next.driftNotified.filter((id) => !wanted.includes(id));
    });
    await refreshStatus();
    addActivity({ type: "guard", status: "info", severity: "info", title: `Posílení vráceno na původní nastavení (${wanted.length - failed.size}/${wanted.length})` });
    return { ok: true, failed: result.errors, state: publicState() };
  }

  async function updateSignatures() {
    const result = await guard.updateSignatures();
    if (result.ok) {
      addActivity({ type: "guard", status: "clean", severity: "info", title: "Definice Defenderu aktualizovány", detail: `Verze ${result.data?.version || "?"} · ${result.data?.method || ""}` });
      update((state) => { state.signatureNotifiedOn = null; });
      await refreshStatus();
    }
    return { ...result, state: publicState() };
  }

  // ------------------------------------------------------------- hlídání

  function findPending(id) {
    return load().watch.pending.find((row) => row.id === id) || null;
  }

  function approve(id) {
    const finding = findPending(id);
    if (!finding) return { ok: false, error: "Nález už neexistuje." };
    update((state) => {
      state.watch.baseline = state.watch.baseline || {};
      state.watch.baseline[finding.key] = finding.hash;
      state.watch.pending = state.watch.pending.filter((row) => row.id !== id);
    });
    addActivity({ type: "watch", status: "info", severity: "info", title: `Ponecháno: ${finding.kindLabel}`, detail: finding.detail });
    return { ok: true, state: publicState() };
  }

  async function removeFinding(id) {
    const finding = findPending(id);
    if (!finding) return { ok: false, error: "Nález už neexistuje." };
    if (!finding.action) return { ok: false, error: "Tuto položku Protect neodebírá, jen ji hlásí." };
    const result = await watch.removeEntry(finding.entry, quarantineDir);
    if (!result.ok) return result;
    update((state) => {
      state.watch.pending = state.watch.pending.filter((row) => row.id !== id);
      state.watch.removed.unshift({
        id: crypto.randomUUID(),
        at: now().toISOString(),
        kind: finding.kind,
        kindLabel: finding.kindLabel,
        detail: finding.detail,
        action: finding.action,
        key: finding.key,
        hash: finding.hash,
        entry: finding.entry,
        backup: result.data,
      });
      state.watch.removed = state.watch.removed.slice(0, MAX_REMOVED);
      if (state.watch.baseline) delete state.watch.baseline[finding.key];
    });
    addActivity({ type: "watch", status: "clean", severity: "info", title: `Odebráno: ${finding.kindLabel}`, detail: `${finding.detail} · lze vrátit` });
    return { ok: true, state: publicState() };
  }

  async function restoreRemoved(id) {
    const record = load().watch.removed.find((row) => row.id === id);
    if (!record) return { ok: false, error: "Záznam už neexistuje." };
    const result = await watch.restoreEntry(record.backup);
    if (!result.ok) return result;
    update((state) => {
      state.watch.removed = state.watch.removed.filter((row) => row.id !== id);
      state.watch.baseline = state.watch.baseline || {};
      state.watch.baseline[record.key] = record.hash;
    });
    addActivity({ type: "watch", status: "info", severity: "info", title: `Vráceno: ${record.kindLabel}`, detail: record.detail });
    return { ok: true, state: publicState() };
  }

  // ------------------------------------------------------------- blokace

  async function blocked(days) {
    return guard.readBlocked(days);
  }

  async function allow(kind, filePath, allowUnsigned) {
    if (!["asr", "folders"].includes(kind)) return { ok: false, error: "Tuto blokaci řeší jen Windows Zabezpečení." };
    let result;
    try { result = await guard.allowBlocked(kind, filePath, allowUnsigned === true); }
    catch (error) { return { ok: false, error: error?.message || "Povolení se nepodařilo." }; }
    if (result.ok) {
      addActivity({ type: "guard", status: "info", severity: allowUnsigned ? "medium" : "info", title: kind === "folders" ? "Aplikace povolena v Ochraně složek" : "Program vyjmut z pravidel ASR", detail: String(filePath) });
    }
    return result;
  }

  return {
    file,
    load,
    publicState,
    check,
    refreshStatus,
    harden,
    revert,
    updateSignatures,
    approve,
    removeFinding,
    restoreRemoved,
    blocked,
    allow,
  };
}

module.exports = { createGuardService, isSuspiciousExisting, STATE_FILE };

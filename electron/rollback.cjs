// StudioVoxario — automatický rollback na poslední funkční verzi.
// Sleduje "last known good" verzi v userData a při detekci pádu nebo
// selhání validace nabídne přeinstalaci předchozí verze z manifest.history[].
const { app, dialog, shell, BrowserWindow, Notification } = require("electron");
const path = require("path");
const fs = require("fs");

const STATE_PATH = () => path.join(app.getPath("userData"), "launcher-state.json");
const HEALTHY_AFTER_MS = 15_000; // po 15 s bez pádu považujeme spuštění za úspěšné

function readState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_PATH(), "utf8"));
  } catch {
    return {
      lastGoodVersion: null,
      lastGoodAt: null,
      lastStartVersion: null,
      lastStartAt: null,
      lastCleanExit: true,
      lastCrash: null,
      consecutiveFailures: 0,
      history: [], // [{version, installedAt}]
    };
  }
}

function writeState(patch) {
  const state = { ...readState(), ...patch };
  try {
    fs.mkdirSync(path.dirname(STATE_PATH()), { recursive: true });
    fs.writeFileSync(STATE_PATH(), JSON.stringify(state, null, 2));
  } catch (e) {
    console.error("rollback state write failed", e);
  }
  return state;
}

/** Zavolat na začátku app.whenReady — zaznamená pokus o spuštění. */
function recordStartAttempt() {
  const cur = app.getVersion();
  const prev = readState();
  const suspicious = prev.lastStartVersion && !prev.lastCleanExit;
  writeState({
    lastStartVersion: cur,
    lastStartAt: new Date().toISOString(),
    lastCleanExit: false, // přepíše se v markHealthy / on before-quit
  });
  return { suspicious, prev };
}

/** Naplánuj potvrzení úspěšného startu (po HEALTHY_AFTER_MS bez pádu). */
function scheduleHealthyMark(getWindow) {
  setTimeout(() => {
    try {
      const w = getWindow?.();
      if (w && !w.isDestroyed()) markHealthy();
    } catch {}
  }, HEALTHY_AFTER_MS);
}

function markHealthy() {
  const cur = app.getVersion();
  const s = readState();
  const history = Array.isArray(s.history) ? s.history.slice() : [];
  // Udržíme historii posledních 5 zdravých verzí
  if (!history.length || history[history.length - 1].version !== cur) {
    history.push({ version: cur, installedAt: new Date().toISOString() });
    while (history.length > 5) history.shift();
  }
  writeState({
    lastGoodVersion: cur,
    lastGoodAt: new Date().toISOString(),
    consecutiveFailures: 0,
    lastCleanExit: true,
    lastCrash: null,
    history,
  });
}

function recordCleanExit() {
  writeState({ lastCleanExit: true });
}

function recordCrash(reason) {
  const s = readState();
  writeState({
    lastCleanExit: false,
    lastCrash: { reason: String(reason || "unknown"), at: new Date().toISOString() },
    consecutiveFailures: (s.consecutiveFailures || 0) + 1,
  });
}

/** Najde v manifestu vhodný installer pro rollback. */
function pickRollbackAsset(manifest, targetVersion) {
  if (!manifest || !targetVersion) return null;
  const history = manifest.history || {};
  const entry = history[targetVersion];
  if (!entry) return null;
  const platform = process.platform;
  const asset =
    (entry.platforms && entry.platforms[platform]) ||
    (platform === "win32" ? { installerUrl: entry.installerUrl, sha256: entry.sha256, size: entry.size, publisher: entry.publisher } : null);
  if (!asset || !asset.installerUrl) return null;
  return {
    version: targetVersion,
    installerUrl: asset.installerUrl,
    sha256: asset.sha256 || entry.sha256,
    size: asset.size || entry.size,
    publisher: asset.publisher || entry.publisher || manifest.publisher,
    notes: entry.notes,
  };
}

/**
 * Provede rollback: stáhne, ověří (hash + Authenticode) a spustí předchozí installer.
 * `installVerified` je funkce z updater.cjs, injektovaná kvůli cyklickému importu.
 */
async function performRollback({ manifest, parentWindow, reason, installVerified }) {
  const state = readState();
  const target = state.lastGoodVersion && state.lastGoodVersion !== app.getVersion()
    ? state.lastGoodVersion
    : (state.history || []).slice(0, -1).reverse().map((h) => h.version).find((v) => v !== app.getVersion());

  if (!target) {
    await dialog.showMessageBox(parentWindow, {
      type: "warning",
      title: "Rollback není k dispozici",
      message: "Není známa žádná dřívější funkční verze",
      detail: "Launcher zatím nemá záznam o starší verzi, na kterou by mohl vrátit.",
    });
    return { status: "no-candidate" };
  }

  const asset = pickRollbackAsset(manifest, target);
  if (!asset) {
    await dialog.showMessageBox(parentWindow, {
      type: "warning",
      title: "Rollback není k dispozici",
      message: `Manifest neobsahuje installer pro verzi ${target}`,
      detail:
        "Server neposkytuje starší instalátor v poli manifest.history. " +
        "Vyžádejte si u administrátora ruční instalátor předchozí verze.",
    });
    return { status: "no-asset", target };
  }

  const { response } = await dialog.showMessageBox(parentWindow, {
    type: "question",
    title: "Vrátit na poslední funkční verzi?",
    message: `Aktuální verze ${app.getVersion()} selhala`,
    detail:
      (reason ? `Důvod: ${reason}\n\n` : "") +
      `Chcete stáhnout a nainstalovat naposledy funkční verzi ${target}?\n\n` +
      `Instalátor bude ověřen kontrolním součtem SHA-256 i digitálním podpisem.`,
    buttons: [`Vrátit na ${target}`, "Ne, zůstat"],
    defaultId: 0,
    cancelId: 1,
  });
  if (response !== 0) return { status: "declined", target };

  const result = await installVerified({
    asset,
    version: target,
    parentWindow,
    label: `rollback → ${target}`,
  });

  if (result.status === "installing") {
    new Notification({
      title: "StudioVoxario",
      body: `Vracím se na verzi ${target}. Aplikace se ukončí.`,
    }).show();
  }
  return result;
}

module.exports = {
  readState,
  writeState,
  recordStartAttempt,
  scheduleHealthyMark,
  markHealthy,
  recordCleanExit,
  recordCrash,
  pickRollbackAsset,
  performRollback,
};

// Certificate pinning pro StudioVoxario updater.
// Pinujeme thumbprinty Authenticode/codesign certifikátů, kterými smí být podepsaný
// stažený instalátor. Seznam je uložený v userData, aby ho útočník ovládající pouze
// manifest neuměl přepsat. Rotace pinu z manifestu je povolena jen tehdy, když
// aktuálně stažený instalátor podepsal některý z už důvěryhodných pinů —
// tj. útočník bez platného certifikátu nemůže do pinů propašovat vlastní.
const { app } = require("electron");
const fs = require("fs");
const path = require("path");

const PINS_FILE = () => path.join(app.getPath("userData"), "launcher-pins.json");

/** Sjednotí thumbprint: velká písmena, bez mezer, dvojteček, pomlček. */
function normalize(tp) {
  return String(tp || "").toUpperCase().replace(/[^0-9A-F]/g, "");
}

function loadPins() {
  try {
    const raw = JSON.parse(fs.readFileSync(PINS_FILE(), "utf8"));
    return {
      thumbprints: (raw.thumbprints || []).map(normalize).filter(Boolean),
      updatedAt: raw.updatedAt || null,
      source: raw.source || null,
      history: Array.isArray(raw.history) ? raw.history : [],
    };
  } catch {
    return { thumbprints: [], updatedAt: null, source: null, history: [] };
  }
}

function savePins(state) {
  try {
    fs.mkdirSync(path.dirname(PINS_FILE()), { recursive: true });
    fs.writeFileSync(PINS_FILE(), JSON.stringify(state, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

/**
 * Bootstrap ze zabudovaných pinů (env variable pro CI/dev) — používá se pouze
 * pokud je lokální seznam prázdný a env je nastavené.
 */
function bootstrapPins() {
  const envPins = String(process.env.STUDIOVOXARIO_PINNED_THUMBPRINTS || "")
    .split(",").map(normalize).filter(Boolean);
  if (!envPins.length) return null;
  const state = {
    thumbprints: envPins,
    updatedAt: new Date().toISOString(),
    source: "env-bootstrap",
    history: [{ at: new Date().toISOString(), action: "bootstrap", thumbprints: envPins }],
  };
  savePins(state);
  return state;
}

/**
 * Ověří thumbprint stažené binárky proti uloženým pinům.
 * Vrací:
 *   - { trusted: true, reason: "pinned" }        — thumbprint je mezi piny
 *   - { trusted: true, reason: "tofu", pin }     — piny prázdné, akceptujeme a uložíme
 *   - { trusted: false, reason: "no-thumbprint" }— podpis neposkytl thumbprint
 *   - { trusted: false, reason: "pin-mismatch", pins, actual }
 */
function verifyAgainstPins(actualThumbprint) {
  const actual = normalize(actualThumbprint);
  if (!actual) return { trusted: false, reason: "no-thumbprint" };

  let state = loadPins();
  if (!state.thumbprints.length) {
    // Zkus bootstrap z env, jinak TOFU.
    const boot = bootstrapPins();
    if (boot && boot.thumbprints.includes(actual)) {
      return { trusted: true, reason: "pinned", pins: boot.thumbprints };
    }
    // Trust On First Use — zapiš a povol.
    state = {
      thumbprints: [actual],
      updatedAt: new Date().toISOString(),
      source: "tofu",
      history: [{ at: new Date().toISOString(), action: "tofu-add", thumbprint: actual }],
    };
    savePins(state);
    return { trusted: true, reason: "tofu", pin: actual, pins: state.thumbprints };
  }

  if (state.thumbprints.includes(actual)) {
    return { trusted: true, reason: "pinned", pins: state.thumbprints };
  }
  return { trusted: false, reason: "pin-mismatch", pins: state.thumbprints, actual };
}

/**
 * Bezpečná rotace pinů z manifestu.
 * Podmínka: `currentTrustedThumbprint` musí být v aktuálních pinech (tj. právě
 * ověřený instalátor byl podepsaný důvěryhodným certem). Pak sloučíme piny
 * z manifestu podle strategie:
 *   - mode "add"     (default): přidá nové thumbprinty, staré ponechá
 *   - mode "replace": nahradí seznam manifestem, ale jen pokud tam zůstává
 *                     alespoň jeden ze starých pinů (žádný "clean sweep")
 * `manifestPins` je pole thumbprintů.
 */
function applyManifestPinUpdate({ manifestPins, mode = "add", currentTrustedThumbprint }) {
  const proposed = (manifestPins || []).map(normalize).filter(Boolean);
  if (!proposed.length) return { changed: false, reason: "no-pins-in-manifest" };

  const state = loadPins();
  const trusted = normalize(currentTrustedThumbprint);
  if (!state.thumbprints.length) {
    // Prázdné piny + manifest → jednorázový bootstrap, pouze pokud aktuální
    // podpis je součástí navrženého seznamu (jinak by manifest sám sebe povolil).
    if (!trusted || !proposed.includes(trusted)) {
      return { changed: false, reason: "bootstrap-not-covered-by-current-signature" };
    }
    const next = { thumbprints: proposed, updatedAt: new Date().toISOString(), source: "manifest-bootstrap",
      history: [{ at: new Date().toISOString(), action: "bootstrap-manifest", thumbprints: proposed }] };
    savePins(next);
    return { changed: true, reason: "bootstrap", before: [], after: proposed };
  }

  if (!trusted || !state.thumbprints.includes(trusted)) {
    return { changed: false, reason: "current-signature-not-pinned" };
  }

  let next;
  if (mode === "replace") {
    const overlap = proposed.some((t) => state.thumbprints.includes(t));
    if (!overlap) return { changed: false, reason: "replace-would-orphan" };
    next = proposed.slice();
  } else {
    next = Array.from(new Set([...state.thumbprints, ...proposed]));
  }

  if (JSON.stringify(next) === JSON.stringify(state.thumbprints)) {
    return { changed: false, reason: "no-diff", pins: state.thumbprints };
  }

  const updated = {
    thumbprints: next,
    updatedAt: new Date().toISOString(),
    source: `manifest-${mode}`,
    history: [
      ...state.history.slice(-49),
      { at: new Date().toISOString(), action: `rotate-${mode}`,
        by: trusted, before: state.thumbprints, after: next },
    ],
  };
  savePins(updated);
  return { changed: true, reason: "rotated", before: state.thumbprints, after: next };
}

/** Ruční reset — pouze z tray/IPC, ne z manifestu. */
function resetPins() {
  try { fs.unlinkSync(PINS_FILE()); } catch {}
  return { thumbprints: [], updatedAt: null };
}

module.exports = {
  normalize,
  loadPins,
  savePins,
  verifyAgainstPins,
  applyManifestPinUpdate,
  resetPins,
  PINS_FILE,
};

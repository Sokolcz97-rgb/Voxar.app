/* StudioVoxario Setup — renderer. Kroky, průběh a IPC přes window.installer. */
const $ = (id) => document.getElementById(id);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

const ORDER = ["welcome", "components", "location", "install", "done"];
const PHASES = {
  extract: "Rozbaluji soubory…",
  shortcuts: "Vytvářím zástupce…",
  registry: "Registruji aplikaci ve Windows…",
  remove: "Odstraňuji soubory…",
  done: "Dokončeno",
};
const CHANNEL_HINTS = {
  stable: "Ověřené verze. Doporučeno pro většinu uživatelů.",
  beta: "Novinky dřív, ale mohou obsahovat chyby.",
};

const state = {
  dir: "",
  channel: "stable",
  desktopShortcut: true,
  startShortcut: true,
  mode: "install",
  browserOnly: false,
  productName: "Voxar.app",
  components: { app: true, browser: true },
  result: null, // "installed" | "uninstalled" | "failed"
  requiredBytes: 0,
};
let busy = false;

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "–";
  const mb = bytes / 1024 / 1024;
  if (mb < 1000) return `${Math.ceil(mb)} MB`;
  return `${(mb / 1024).toFixed(1).replace(".", ",")} GB`;
}

function cleanError(err) {
  return String(err?.message || err).replace(/^Error invoking remote method '[^']+':\s*(Error:\s*)?/, "");
}

function showFatal(message) {
  document.body.textContent = "";
  const main = document.createElement("main");
  main.className = "fatal";
  main.textContent = message;
  document.body.appendChild(main);
}

function activate(step) {
  qsa(".screen").forEach((screen) => screen.classList.toggle("active", screen.dataset.step === step));
  const index = ORDER.indexOf(step);
  qsa(".track li").forEach((li) => {
    const i = ORDER.indexOf(li.dataset.step);
    li.classList.toggle("active", li.dataset.step === step);
    li.classList.toggle("done", index > -1 && i > -1 && i < index);
  });
}

function setBusy(value) {
  busy = value;
  $("btnClose").disabled = value;
}

async function refreshDisk() {
  const box = $("diskInfo");
  if (!window.installer.diskInfo) { box.textContent = ""; return; }
  try {
    const info = await window.installer.diskInfo(state.dir);
    if (!info || !Number.isFinite(info.freeBytes)) { box.textContent = ""; return; }
    const enough = !state.requiredBytes || info.freeBytes >= state.requiredBytes;
    box.classList.toggle("warn", !enough);
    box.textContent = enough
      ? `Volné místo: ${formatBytes(info.freeBytes)} · potřeba ${formatBytes(state.requiredBytes)}`
      : `Na disku je jen ${formatBytes(info.freeBytes)} volného místa, potřeba je ${formatBytes(state.requiredBytes)}.`;
    $("startBtn").disabled = !enough;
  } catch {
    box.textContent = "";
  }
}

function applyBrowserOnly() {
  state.components = { app: false, browser: true };
  state.productName = "VoxarioBrowser";
  document.title = "VoxarioBrowser Setup";
  $("windowTitle").textContent = "VoxarioBrowser Setup";
  $("brandName").classList.add("wordmark-long");
  $("brandName").querySelector(".wm-a").textContent = "VOXARIO";
  $("brandName").querySelector(".wm-b").textContent = "BROWSER";
  $("welcomeTitle").textContent = "Vítejte ve VoxarioBrowseru";
  $("welcomeLead").textContent = "Nainstalujeme samostatný prohlížeč StudioVoxario. Aktualizuje se sám, nezávisle na Voxar.app.";
  $("uninTitle").textContent = "Odinstalovat VoxarioBrowser";
  document.querySelector('.track li[data-step="components"]').hidden = true;
  $("welcomeNext").dataset.next = "location";
  $("locationBack").dataset.next = "welcome";
}

async function boot() {
  if (!window.installer) {
    showFatal("Instalátor nelze spustit: komunikační rozhraní se nenačetlo. Stáhněte instalátor znovu.");
    return;
  }

  const d = await window.installer.defaults();
  state.dir = d.defaultDir;
  state.mode = d.mode;
  state.browserOnly = !!d.browserOnly;
  state.requiredBytes = Number(d.installedBytes || d.requiredBytes) || 0;

  $("verLbl").textContent = d.version;
  $("factVersion").textContent = d.version;
  $("factSize").textContent = formatBytes(state.requiredBytes);
  $("pathInput").value = state.dir;
  $("pathInput").title = state.dir;

  if (state.browserOnly) applyBrowserOnly();
  $("launchAfterLabel").textContent = `Spustit ${state.productName}`;

  // Navigace
  qsa("[data-next]").forEach((button) => button.addEventListener("click", () => {
    const next = button.dataset.next;
    if (next === "location") void refreshDisk();
    activate(next);
  }));

  // Komponenty – alespoň jedna musí zůstat vybraná.
  const syncComponents = (changed) => {
    if (!$("chkApp").checked && !$("chkBrowser").checked) {
      changed.checked = true;
      $("componentsHint").hidden = false;
      return;
    }
    $("componentsHint").hidden = true;
    state.components = { app: $("chkApp").checked, browser: $("chkBrowser").checked };
  };
  $("chkApp").addEventListener("change", (e) => syncComponents(e.target));
  $("chkBrowser").addEventListener("change", (e) => syncComponents(e.target));

  // Umístění
  $("pickBtn").addEventListener("click", async () => {
    const picked = await window.installer.pickDir(state.dir);
    if (!picked) return;
    state.dir = picked;
    $("pathInput").value = picked;
    $("pathInput").title = picked;
    void refreshDisk();
  });
  $("chkDesktop").addEventListener("change", (e) => { state.desktopShortcut = e.target.checked; });
  $("chkStart").addEventListener("change", (e) => { state.startShortcut = e.target.checked; });
  qsa('input[name="channel"]').forEach((radio) => radio.addEventListener("change", () => {
    state.channel = radio.value;
    $("channelHint").textContent = CHANNEL_HINTS[radio.value] || "";
  }));

  $("startBtn").addEventListener("click", startInstall);
  $("uninGo").addEventListener("click", startUninstall);
  $("uninCancel").addEventListener("click", () => window.installer.close());

  $("detailsBtn").addEventListener("click", () => {
    const box = $("logBox");
    box.hidden = !box.hidden;
    $("detailsBtn").setAttribute("aria-expanded", String(!box.hidden));
    $("detailsBtn").textContent = box.hidden ? "Zobrazit podrobnosti" : "Skrýt podrobnosti";
  });

  $("finishBtn").addEventListener("click", finish);
  $("launchBrowserBtn").addEventListener("click", () => launch("browser"));

  $("btnMin").addEventListener("click", () => window.installer.minimize?.());
  $("btnClose").addEventListener("click", () => { if (!busy) window.installer.close(); });

  window.installer.onLog((line) => {
    const box = $("logBox");
    box.textContent += (box.textContent ? "\n" : "") + line;
    box.scrollTop = box.scrollHeight;
  });
  window.installer.onProgress((p) => {
    if (!p) return;
    const pct = Math.max(0, Math.min(1, Number(p.pct) || 0));
    $("progFill").style.width = `${(pct * 100).toFixed(1)}%`;
    $("meter").setAttribute("aria-valuenow", String(Math.round(pct * 100)));
    $("progPct").textContent = `${Math.round(pct * 100)} %`;
    $("progLabel").textContent = PHASES[p.phase] || p.phase || "";
  });

  if (state.mode === "uninstall") {
    $("brandSub").textContent = "Odinstalace";
    $("uninPath").textContent = state.dir;
    document.title = `${state.productName} — odinstalace`;
    $("steps").hidden = true;
    activate("uninstall");
  } else {
    activate("welcome");
  }
}

async function launch(target) {
  try {
    await window.installer.launch({ dir: state.dir, target });
  } catch (err) {
    $("doneMsg").textContent = `Aplikaci se nepodařilo spustit: ${cleanError(err)}`;
  }
}

function finish() {
  if (state.result === "installed" && $("launchAfter").checked) {
    void launch(state.browserOnly ? "browser" : (state.components.app ? "app" : "browser"));
    return; // hlavní proces po spuštění instalátor zavře
  }
  window.installer.close();
}

function showResult({ ok, title, message, canLaunch }) {
  $("resultIcon").classList.toggle("error", !ok);
  $("doneTitle").textContent = title;
  $("doneMsg").textContent = message;
  $("launchAfterRow").hidden = !canLaunch;
  $("launchBrowserBtn").hidden = !(canLaunch && !state.browserOnly && state.components.app && state.components.browser);
  $("finishBtn").textContent = ok ? "Dokončit" : "Zavřít";
  activate("done");
}

async function startInstall() {
  setBusy(true);
  $("progressTitle").textContent = `Instaluji ${state.productName}`;
  $("progressLead").textContent = "Může to trvat minutu. Instalátor nezavírejte.";
  activate("install");
  try {
    await window.installer.install({
      dir: state.dir,
      channel: state.channel,
      desktopShortcut: state.desktopShortcut,
      startShortcut: state.startShortcut,
      components: state.components,
    });
    state.result = "installed";
    const parts = [state.components.app && "Voxar.app", state.components.browser && "VoxarioBrowser"].filter(Boolean);
    showResult({
      ok: true,
      title: "Instalace dokončena",
      message: `${parts.join(" a ")} – nainstalováno do složky ${state.dir}. Kanál aktualizací: ${state.channel === "beta" ? "Beta" : "Stable"}.`,
      canLaunch: true,
    });
  } catch (err) {
    state.result = "failed";
    showResult({
      ok: false,
      title: "Instalace se nezdařila",
      message: `${cleanError(err)} Zavřete prosím ${state.productName}, pokud běží, a spusťte instalátor znovu.`,
      canLaunch: false,
    });
  } finally {
    setBusy(false);
  }
}

async function startUninstall() {
  setBusy(true);
  $("progressTitle").textContent = `Odinstalovávám ${state.productName}`;
  $("progressLead").textContent = "Odstraňuji soubory, zástupce a záznam ve Windows.";
  $("steps").hidden = true;
  activate("install");
  try {
    await window.installer.uninstall({ dir: state.dir });
    state.result = "uninstalled";
    showResult({
      ok: true,
      title: "Odinstalováno",
      message: `Aplikace ${state.productName} byla z tohoto počítače odebrána.`,
      canLaunch: false,
    });
  } catch (err) {
    state.result = "failed";
    showResult({
      ok: false,
      title: "Odinstalace se nezdařila",
      message: `${cleanError(err)} Zavřete ${state.productName}, pokud běží, a zkuste to znovu.`,
      canLaunch: false,
    });
  } finally {
    setBusy(false);
  }
}

boot().catch((err) => {
  console.error(err);
  showFatal(`Instalátor se nepodařilo spustit. ${cleanError(err)}`);
});

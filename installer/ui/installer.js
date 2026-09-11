/* Renderer — kroky, progress, IPC bridge. Bez shellu, bez cmd. */
const $ = (id) => document.getElementById(id);
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

let state = { dir: "", channel: "stable", desktopShortcut: true, startShortcut: true, mode: "install", browserOnly: false, components: { app: true, browser: true } };
let operationRunning = false;

async function boot() {
  if (!window.installer) {
    document.body.innerHTML = '<main style="padding:32px;color:#fca5a5;font:16px Segoe UI;background:#060812;min-height:100vh">Instalátor nelze spustit: komunikační rozhraní nebylo načteno.</main>';
    return;
  }
  const d = await window.installer.defaults();
  state.dir = d.defaultDir;
  state.mode = d.mode;
  state.productId = d.productId || "app";
  state.browserOnly = !!d.browserOnly;
  $("verLbl").textContent = d.version;
  $("versionWelcome").textContent = `v${d.version}`;
  $("requiredSpace").textContent = d.requiredBytes ? `${Math.ceil(d.requiredBytes / 1024 / 1024)} MB` : "zjistí se při instalaci";
  $("pathInput").value = state.dir;
  if (d.browserOnly) {
    state.components = { app: false, browser: true };
    $("brandSub").textContent = "VoxarioBrowser · instalátor";
    document.title = "VoxarioBrowser Installer";
    const componentsStep = document.querySelector('.steps li[data-step="components"]');
    const componentsPanel = document.querySelector('.panel[data-step="components"]');
    if (componentsStep) componentsStep.style.display = "none";
    if (componentsPanel) componentsPanel.style.display = "none";
    const welcome = document.querySelector('.panel[data-step="welcome"]');
    if (welcome) {
      welcome.querySelector("h1").textContent = "Vítejte ve VoxarioBrowseru";
      welcome.querySelector("p").textContent = "Samostatný StudioVoxario prohlížeč se nainstaluje jen pro vás a bude se aktualizovat nezávisle na Voxar.app.";
      welcome.querySelector('[data-next="components"]').dataset.next = "location";
    }
    document.querySelectorAll('[data-next="components"]').forEach((button) => { button.dataset.next = "location"; });
  }
  if (d.mode === "uninstall") {
    $("brandSub").textContent = "Odinstalace";
    $("uninPath").textContent = state.dir;
    document.title = "StudioVoxario — Odinstalace";
    activate("uninstall");
    document.querySelector(".steps").style.display = "none";
  } else {
    activate("welcome");
  }

  qsa("[data-next]").forEach((b) => b.addEventListener("click", () => activate(b.dataset.next)));

  $("pickBtn").addEventListener("click", async () => {
    const picked = await window.installer.pickDir(state.dir);
    if (picked) { state.dir = picked; $("pathInput").value = picked; }
  });
  $("chkDesktop").addEventListener("change", (e) => (state.desktopShortcut = e.target.checked));
  $("chkStart").addEventListener("change", (e) => (state.startShortcut = e.target.checked));

  // Komponenty
  const syncComponents = () => {
    state.components.app = $("chkApp").checked;
    state.components.browser = $("chkBrowser").checked;
    $("cardApp").classList.toggle("selected", state.components.app);
    $("cardBrowser").classList.toggle("selected", state.components.browser);
    // Alespoň jedna komponenta musí zůstat zaškrtnutá.
    if (!state.components.app && !state.components.browser) {
      $("chkApp").checked = true;
      state.components.app = true;
      $("cardApp").classList.add("selected");
    }
  };
  $("chkApp").addEventListener("change", syncComponents);
  $("chkBrowser").addEventListener("change", syncComponents);

  qsa('input[name="channel"]').forEach((r) => r.addEventListener("change", () => { state.channel = r.value; }));

  $("startBtn").addEventListener("click", startInstall);
  $("detailsBtn").addEventListener("click", () => { $("logBox").hidden = !$("logBox").hidden; $("detailsBtn").textContent = $("logBox").hidden ? "Podrobnosti instalace" : "Skrýt podrobnosti"; });
  $("launchBtn").addEventListener("click", () => window.installer.launch({ dir: state.dir, target: d.browserOnly ? "browser" : "app" }));
  $("launchBrowserBtn").addEventListener("click", () => window.installer.launch({ dir: state.dir, target: "browser" }));
  $("closeBtn").addEventListener("click", () => { if ($("launchAfter").checked) window.installer.launch({ dir: state.dir, target: d.browserOnly ? "browser" : "app" }); else window.installer.close(); });
  $("btnMin").addEventListener("click", () => window.installer.minimize?.());
  $("btnClose").addEventListener("click", () => { if (!operationRunning) window.installer.close(); });
  $("uninCancel").addEventListener("click", () => window.installer.close());
  $("uninGo").addEventListener("click", startUninstall);


  window.installer.onLog((line) => {
    const el = $("logBox"); el.textContent += (el.textContent ? "\n" : "") + line; el.scrollTop = el.scrollHeight;
  });
  window.installer.onProgress((p) => {
    if (!p) return;
    const pct = Math.max(0, Math.min(1, p.pct || 0));
    $("progFill").style.width = (pct * 100).toFixed(1) + "%";
    $("progPct").textContent = Math.round(pct * 100) + " %";
    const labels = { extract: "Rozbaluji soubory…", shortcuts: "Vytvářím zkratky…", registry: "Zapisuji záznamy…", remove: "Odstraňuji soubory…", done: "Hotovo" };
    $("progLabel").textContent = labels[p.phase] || p.phase;
  });
}

function activate(step) {
  qsa(".panel").forEach((p) => p.classList.toggle("active", p.dataset.step === step));
  qsa(".steps li").forEach((li) => {
    if (li.dataset.step === step) li.classList.add("active");
    else li.classList.remove("active");
  });
}

async function startInstall() {
  operationRunning = true;
  $("btnClose").disabled = true;
  activate("install");
  try {
    await window.installer.install({
      dir: state.dir,
      channel: state.channel,
      desktopShortcut: state.desktopShortcut,
      components: state.components,
    });
    const parts = [state.components.app && "Voxar.app", state.components.browser && "VoxarioBrowser"].filter(Boolean);
    $("doneTitle").textContent = "Hotovo!";
    $("doneMsg").textContent = `${parts.join(" + ")} je nainstalováno v ${state.dir}. Kanál: ${state.channel}.`;
    $("launchBtn").style.display = (state.components.app || state.browserOnly) ? "" : "none";
    if (state.browserOnly) $("launchBtn").textContent = "Spustit VoxarioBrowser";
    $("launchBrowserBtn").style.display = state.components.browser ? "" : "none";
    activate("done");
  } catch (err) {
    $("doneTitle").textContent = "Instalace se nezdařila";
    // Electron IPC obaluje chybu prefixem "Error invoking remote method ... :" — uklidíme ho.
    $("doneMsg").textContent = String(err?.message || err).replace(/^Error invoking remote method '[^']+':\s*/, "");

    $("launchBtn").style.display = "none";
    $("launchBrowserBtn").style.display = "none";
    activate("done");
  } finally {
    operationRunning = false;
    $("btnClose").disabled = false;
  }
}


async function startUninstall() {
  operationRunning = true;
  $("btnClose").disabled = true;
  activate("install");
  try {
    await window.installer.uninstall({ dir: state.dir });
    $("doneTitle").textContent = "Odinstalováno";
    $("doneMsg").textContent = "StudioVoxario bylo odstraněno.";
    $("launchBtn").style.display = "none";
    activate("done");
  } catch (err) {
    $("doneTitle").textContent = "Odinstalace se nezdařila";
    $("doneMsg").textContent = String(err?.message || err).replace(/^Error invoking remote method '[^']+':\s*/, "");
    activate("done");
  } finally {
    operationRunning = false;
    $("btnClose").disabled = false;
  }
}

boot().catch((err) => {
  console.error(err);
  const message = String(err?.message || err);
  document.body.innerHTML = `<main style="padding:32px;color:#fca5a5;font:16px Segoe UI;background:#060812;min-height:100vh">Instalátor se nepodařilo inicializovat.<br><br>${message}</main>`;
});

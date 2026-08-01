/* Renderer — kroky, progress, IPC bridge. Bez shellu, bez cmd. */
const $ = (id) => document.getElementById(id);
const qs = (s, r = document) => r.querySelector(s);
const qsa = (s, r = document) => Array.from(r.querySelectorAll(s));

let state = { dir: "", channel: "stable", desktopShortcut: true, mode: "install" };

async function boot() {
  const d = await window.installer.defaults();
  state.dir = d.defaultDir;
  state.mode = d.mode;
  $("verLbl").textContent = d.version;
  $("pathInput").value = state.dir;
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

  qsa('input[name="channel"]').forEach((r) =>
    r.addEventListener("change", () => {
      state.channel = r.value;
      qsa(".card").forEach((c) => c.classList.remove("selected"));
      r.closest(".card").classList.add("selected");
    }),
  );

  $("startBtn").addEventListener("click", startInstall);
  $("launchBtn").addEventListener("click", () => window.installer.launch(state.dir));
  $("closeBtn").addEventListener("click", () => window.installer.close());
  $("btnMin").addEventListener("click", () => require("@electron/remote")?.getCurrentWindow?.().minimize?.());
  $("btnClose").addEventListener("click", () => window.installer.close());
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
  activate("install");
  try {
    await window.installer.install({ dir: state.dir, channel: state.channel, desktopShortcut: state.desktopShortcut });
    $("doneTitle").textContent = "Hotovo!";
    $("doneMsg").textContent = `StudioVoxario je nainstalováno v ${state.dir}. Kanál: ${state.channel}.`;
    activate("done");
  } catch (err) {
    $("doneTitle").textContent = "Instalace se nezdařila";
    // Electron IPC obaluje chybu prefixem "Error invoking remote method ... :" — uklidíme ho.
    $("doneMsg").textContent = String(err?.message || err).replace(/^Error invoking remote method '[^']+':\s*/, "");

    $("launchBtn").style.display = "none";
    activate("done");
  }
}

async function startUninstall() {
  activate("install");
  try {
    await window.installer.uninstall({ dir: state.dir });
    $("doneTitle").textContent = "Odinstalováno";
    $("doneMsg").textContent = "StudioVoxario bylo odstraněno.";
    $("launchBtn").style.display = "none";
    activate("done");
  } catch (err) {
    $("doneTitle").textContent = "Odinstalace se nezdařila";
    $("doneMsg").textContent = String(err?.message || err);
    activate("done");
  }
}

boot();

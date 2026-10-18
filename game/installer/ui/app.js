(() => {
  "use strict";

  const api = window.ashesInstaller;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mode") === "uninstall" ? "uninstall" : "install";
  const visualTest = params.get("visualTest") === "1";
  const previewStep = Math.max(0, Math.min(5, Number(params.get("previewStep") || 0)));

  const installWizard = document.getElementById("installWizard");
  const uninstallView = document.getElementById("uninstallView");
  const windowModeLabel = document.getElementById("windowModeLabel");
  const minimizeButton = document.getElementById("minimizeButton");
  const closeButton = document.getElementById("closeButton");

  const backButton = document.getElementById("backButton");
  const nextButton = document.getElementById("nextButton");
  const statusText = document.getElementById("statusText");
  const installPath = document.getElementById("installPath");
  const browseButton = document.getElementById("browseButton");
  const requiredSpace = document.getElementById("requiredSpace");
  const freeSpace = document.getElementById("freeSpace");
  const diskWarning = document.getElementById("diskWarning");
  const launcherPayloadSize = document.getElementById("launcherPayloadSize");
  const totalSize = document.getElementById("totalSize");
  const windowShell = document.getElementById("windowShell");
  const desktopShortcutTarget = document.getElementById("desktopShortcutTarget");
  const startShortcutTarget = document.getElementById("startShortcutTarget");

  const desktopShortcut = document.getElementById("desktopShortcut");
  const startShortcut = document.getElementById("startShortcut");
  const autoUpdate = document.getElementById("autoUpdate");
  const diagnostics = document.getElementById("diagnostics");

  const progressPhase = document.getElementById("progressPhase");
  const progressPercent = document.getElementById("progressPercent");
  const progressFill = document.getElementById("progressFill");
  const progressDetail = document.getElementById("progressDetail");
  const progressPayload = document.getElementById("progressPayload");
  const progressState = document.getElementById("progressState");

  const launchAfterInstall = document.getElementById("launchAfterInstall");
  const openFolderAfterInstall = document.getElementById("openFolderAfterInstall");

  const uninstallConfirm = document.getElementById("uninstallConfirm");
  const uninstallCancel = document.getElementById("uninstallCancel");
  const removeUserData = document.getElementById("removeUserData");
  const uninstallProgressFill = document.getElementById("uninstallProgressFill");
  const uninstallStatus = document.getElementById("uninstallStatus");

  let step = 0;
  let defaults = null;
  let installing = false;
  let installationResult = null;

  function formatBytes(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes < 0) return "—";
    if (bytes < 1024) return `${bytes} B`;
    const units = ["KB", "MB", "GB", "TB"];
    let size = bytes / 1024;
    let unit = units[0];
    for (let index = 1; index < units.length && size >= 1024; index += 1) {
      size /= 1024;
      unit = units[index];
    }
    return `${size.toFixed(size >= 100 ? 0 : 1).replace(".", ",")} ${unit}`;
  }

  function setStep(value) {
    step = Math.max(0, Math.min(5, value));
    installWizard.dataset.step = String(step);
    if (windowShell) windowShell.dataset.step = String(step);

    document.querySelectorAll("[data-step]").forEach((node) => {
      node.classList.toggle("active", Number(node.dataset.step) === step);
    });

    document.querySelectorAll("[data-step-indicator]").forEach((node) => {
      const value = Number(node.dataset.stepIndicator);
      node.classList.toggle("active", value === step);
      node.classList.toggle("complete", value < step);
    });

    backButton.disabled = installing || step === 0 || step >= 4;

    backButton.textContent = step === 4 ? "Zrušit" : "‹ Zpět";
    if (step === 3) nextButton.textContent = "Instalovat";
    else if (step === 4) nextButton.textContent = "Instaluji…";
    else if (step === 5) nextButton.textContent = "Dokončit";
    else nextButton.textContent = "Pokračovat ›";

    nextButton.disabled = installing || step === 4;
  }

  async function refreshDiskInfo() {
    if (!defaults) return;

    const info = await api.diskInfo(installPath.value);
    freeSpace.textContent = formatBytes(info.freeBytes);
    const insufficient = info.freeBytes !== null && info.freeBytes < defaults.requiredBytes;
    diskWarning.hidden = !insufficient;
    freeSpace.classList.toggle("healthy", !insufficient);
    if (insufficient) freeSpace.style.color = "#ff8b82";
    else freeSpace.style.color = "";
  }

  async function runInstall() {
    installing = true;
    setStep(4);
    statusText.textContent = "Instalace probíhá…";

    try {
      installationResult = await api.install({
        target: installPath.value,
        desktopShortcut: desktopShortcut.checked,
        startShortcut: startShortcut.checked,
        autoUpdate: autoUpdate.checked,
        diagnostics: diagnostics.checked
      });

      if (!installationResult?.ok) throw new Error("Instalace nebyla dokončena.");

      statusText.textContent = "Launcher je připraven.";
      installing = false;
      setStep(5);
    } catch (error) {
      installing = false;
      statusText.textContent = error?.message || "Instalace selhala.";
      progressPhase.textContent = "Instalace selhala";
      progressDetail.textContent = error?.message || "Neznámá chyba.";
      nextButton.disabled = false;
      nextButton.textContent = "Zkusit znovu";
    }
  }

  async function finishInstall() {
    const target = installationResult?.root || installPath.value;

    try {
      if (openFolderAfterInstall.checked) await api.openFolder(target);
      if (launchAfterInstall.checked) await api.launch(target);
    } catch (error) {
      statusText.textContent = error?.message || "Launcher se nepodařilo spustit.";
      return;
    }

    await api.close();
  }

  nextButton.addEventListener("click", async () => {
    if (step < 3) {
      if (step === 2) {
        await refreshDiskInfo();
        if (!diskWarning.hidden) return;
      }
      setStep(step + 1);
      return;
    }

    if (step === 3) {
      await runInstall();
      return;
    }

    if (step === 5) await finishInstall();
  });

  backButton.addEventListener("click", () => {
    if (!installing && step > 0 && step < 4) setStep(step - 1);
  });

  browseButton.addEventListener("click", async () => {
    const chosen = await api.pickDirectory(installPath.value);
    if (!chosen) return;
    installPath.value = chosen;
    await refreshDiskInfo();
  });

  installPath.addEventListener("change", () => void refreshDiskInfo());

  minimizeButton.addEventListener("click", () => void api.minimize());
  closeButton.addEventListener("click", () => void api.close());

  api.onProgress((value) => {
    const pct = Math.round((Number(value?.pct) || 0) * 100);
    progressFill.style.width = `${pct}%`;
    progressPercent.textContent = `${pct} %`;
    progressPhase.textContent = value?.detail || "Instalace";
    if (defaults?.payloadBytes && progressPayload) {
      progressPayload.textContent = `${formatBytes(defaults.payloadBytes * pct / 100)} / ${formatBytes(defaults.payloadBytes)}`;
    }
    progressDetail.textContent = pct >= 100 ? "Dokončuji…" : "";
    if (progressState) progressState.textContent = value?.phase || "instalace";

    if (mode === "uninstall") {
      uninstallProgressFill.style.width = `${pct}%`;
      uninstallStatus.textContent = value?.detail || "Odinstalace";
    }
  });

  api.onLog((message) => {
    if (mode === "install") statusText.textContent = message;
  });

  async function initInstall() {
    defaults = await api.defaults();
    installPath.value = defaults.defaultTarget;
    requiredSpace.textContent = formatBytes(defaults.requiredBytes);
    freeSpace.textContent = formatBytes(defaults.freeBytes);
    launcherPayloadSize.textContent = `~ ${formatBytes(defaults.payloadBytes)}`;
    if (totalSize) totalSize.textContent = `~ ${formatBytes(defaults.payloadBytes)}`;
    if (progressPayload) progressPayload.textContent = `0 B / ${formatBytes(defaults.payloadBytes)}`;

    // Zástupce lze zvolit v kroku 3 i 4; obě volby jsou propojené.
    for (const [a, b] of [[desktopShortcutTarget, desktopShortcut], [startShortcutTarget, startShortcut]]) {
      if (!a || !b) continue;
      a.addEventListener("change", () => { b.checked = a.checked; });
      b.addEventListener("change", () => { a.checked = b.checked; });
    }

    const insufficient = defaults.freeBytes !== null && defaults.freeBytes < defaults.requiredBytes;
    diskWarning.hidden = !insufficient;
    if (insufficient) freeSpace.style.color = "#ff8b82";

    if (visualTest) {
      setStep(previewStep);

      if (previewStep === 4) {
        progressFill.style.width = "45%";
        progressPercent.textContent = "45 %";
        progressPhase.textContent = "Kopírování souborů launcheru…";
        progressPayload.textContent = `${formatBytes(defaults.payloadBytes * 0.45)} / ${formatBytes(defaults.payloadBytes)}`;
        progressDetail.textContent = "";
        if (progressState) progressState.textContent = "instalace";
      }

      if (previewStep === 5) statusText.textContent = "";
    } else {
      setStep(0);
    }

    window.__ASHES_VISUAL_READY__ = true;
  }

  async function initUninstall() {
    windowModeLabel.textContent = "Odinstalace";
    installWizard.hidden = true;
    uninstallView.hidden = false;

    defaults = await api.defaults();

    uninstallCancel.addEventListener("click", () => void api.close());
    uninstallConfirm.addEventListener("click", async () => {
      uninstallConfirm.disabled = true;
      uninstallCancel.disabled = true;
      uninstallStatus.textContent = "Odinstalace probíhá…";

      try {
        await api.uninstall({
          target: defaults.defaultTarget,
          removeUserData: removeUserData.checked
        });
        uninstallStatus.textContent = "Ashes of Eryon bylo odinstalováno.";
        uninstallConfirm.textContent = "Hotovo";
        uninstallConfirm.disabled = false;
        uninstallConfirm.addEventListener("click", () => void api.close(), { once: true });
      } catch (error) {
        uninstallStatus.textContent = error?.message || "Odinstalace selhala.";
        uninstallConfirm.disabled = false;
        uninstallCancel.disabled = false;
      }
    });
  }

  if (mode === "uninstall") {
    void initUninstall().then(() => {
      window.__ASHES_VISUAL_READY__ = true;
    });
  } else {
    void initInstall();
  }
})();

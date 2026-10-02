(() => {
  const root = document.querySelector(".launcher");
  const primary = document.getElementById("primaryAction");
  const secondary = document.getElementById("secondaryAction");
  const accountName = document.getElementById("accountName");
  const accountState = document.getElementById("accountState");
  const stateBadge = document.getElementById("stateBadge");
  const installedVersion = document.getElementById("installedVersion");
  const installPath = document.getElementById("installPath");
  const progressTitle = document.getElementById("progressTitle");
  const progressDetail = document.getElementById("progressDetail");
  const progressFill = document.getElementById("progressFill");
  const progressValue = document.getElementById("progressValue");

  const states = {
    signed_out: {
      primary: "Přihlásit se",
      secondary: "Vytvořit účet",
      account: "Nepřihlášen",
      accountState: "StudioVoxario účet",
      badge: "SIGNED OUT",
      installed: "—",
      path: "Nenainstalováno",
      progressTitle: "Launcher připraven",
      progressDetail: "Přihlaste se svým StudioVoxario účtem.",
      progress: 0,
      progressValue: "—"
    },
    ready_to_install: {
      primary: "Instalovat",
      secondary: "Změnit umístění",
      account: "Sokolcz",
      accountState: "Přihlášen",
      badge: "READY TO INSTALL",
      installed: "—",
      path: "C:\\Games\\ProjectUnnamed",
      progressTitle: "Připraveno k instalaci",
      progressDetail: "Je potřeba stáhnout přibližně 11.4 GB.",
      progress: 0,
      progressValue: "11.4 GB"
    },
    ready_to_play: {
      primary: "Hrát",
      secondary: "Ověřit soubory",
      account: "Sokolcz",
      accountState: "Online",
      badge: "READY TO PLAY",
      installed: "0.1.0-alpha",
      path: "C:\\Games\\ProjectUnnamed",
      progressTitle: "Hra je aktuální",
      progressDetail: "Všechny soubory jsou připravené.",
      progress: 100,
      progressValue: "100 %"
    }
  };

  function applyState(name) {
    const state = states[name];
    if (!state) return;

    root.dataset.state = name;
    primary.textContent = state.primary;
    secondary.textContent = state.secondary;
    accountName.textContent = state.account;
    accountState.textContent = state.accountState;
    stateBadge.textContent = state.badge;
    installedVersion.textContent = state.installed;
    installPath.textContent = state.path;
    progressTitle.textContent = state.progressTitle;
    progressDetail.textContent = state.progressDetail;
    progressFill.style.width = state.progress + "%";
    progressValue.textContent = state.progressValue;

    document.querySelectorAll("[data-demo-state]").forEach((button) => {
      button.classList.toggle("active", button.dataset.demoState === name);
    });
  }

  document.querySelectorAll("[data-demo-state]").forEach((button) => {
    button.addEventListener("click", () => applyState(button.dataset.demoState));
  });

  primary.addEventListener("click", () => {
    const current = root.dataset.state;
    if (current === "signed_out") applyState("ready_to_install");
    else if (current === "ready_to_install") {
      progressTitle.textContent = "Instalace bude implementována v další fázi";
      progressDetail.textContent = "Tento build je pouze vizuální reference.";
    } else if (current === "ready_to_play") {
      progressTitle.textContent = "Spuštění hry bude připojeno k reálnému klientovi později";
      progressDetail.textContent = "Vizuální prototype neobsahuje Game.exe.";
    }
  });

  applyState("signed_out");
})();

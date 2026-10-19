(() => {
  "use strict";

  // Rozměr předlohy launcheru; celé plátno se úměrně škáluje do okna.
  const REFERENCE_WIDTH = 1672;
  const REFERENCE_HEIGHT = 941;
  const params = new URLSearchParams(window.location.search);

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

  const desktop = window.ashesLauncher;
  const isDesktop = Boolean(desktop?.isDesktop);

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
      path: "C:\\Games\\AshesOfEryon",
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
      path: "C:\\Games\\AshesOfEryon",
      progressTitle: "Hra je aktuální",
      progressDetail: "Všechny soubory jsou připravené.",
      progress: 100,
      progressValue: "100 %"
    },
    // Alfa: 1. akt běží jako 3D hra ze serveru StudioVoxario – nic se nestahuje.
    online: {
      primary: "Hrát",
      secondary: "Můj účet",
      account: "StudioVoxario účet",
      accountState: "Přihlášení ve hře",
      badge: "ALPHA · ONLINE",
      installed: "0.1.0-alpha · 1. akt",
      path: "Online ze studiovoxario.com",
      progressTitle: "Svět je online",
      progressDetail: "1. akt: od Bezejmenného břehu po Pochod bronzu.",
      progress: 100,
      progressValue: "Online"
    }
  };

  function applyState(name) {
    const state = states[name];
    if (!state) return;

    root.dataset.state = name;
    primary.querySelector("span").textContent = state.primary;
    secondary.querySelector("span").textContent = state.secondary;
    accountName.textContent = state.account;
    accountState.lastChild.textContent = state.accountState;
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

  function fitReferenceCanvas() {
    const scale = Math.min(
      window.innerWidth / REFERENCE_WIDTH,
      window.innerHeight / REFERENCE_HEIGHT
    );
    root.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function bindWindowControls() {
    const controls = document.querySelector(".window-controls");
    const minimizeButton = document.getElementById("windowMinimize");
    const maximizeButton = document.getElementById("windowMaximize");
    const closeButton = document.getElementById("windowClose");

    if (!isDesktop) {
      controls?.classList.add("browser-preview");
      return;
    }

    minimizeButton?.addEventListener("click", () => {
      void desktop.window.minimize();
    });

    maximizeButton?.addEventListener("click", () => {
      void desktop.window.toggleMaximize();
    });

    closeButton?.addEventListener("click", () => {
      void desktop.window.close();
    });

    desktop.window.getState()
      .then((state) => {
        if (maximizeButton) maximizeButton.textContent = state?.maximized ? "❐" : "□";
      })
      .catch(() => {});

    desktop.window.onState((state) => {
      if (maximizeButton) maximizeButton.textContent = state?.maximized ? "❐" : "□";
    });

  }

  document.querySelectorAll("[data-demo-state]").forEach((button) => {
    button.addEventListener("click", () => applyState(button.dataset.demoState));
  });

  secondary.addEventListener("click", () => {
    if (isDesktop && root.dataset.state === "online") void desktop.game?.openAccount();
  });

  primary.addEventListener("click", () => {
    const current = root.dataset.state;

    if (isDesktop && current === "online") {
      progressTitle.textContent = "Otevírám svět Ashes of Eryon…";
      progressDetail.textContent = "Hra se otevře v novém okně.";
      desktop.game?.play()
        .then(() => {
          progressTitle.textContent = "Hra běží";
          progressDetail.textContent = "Launcher počká, až herní okno zavřeš.";
        })
        .catch(() => {
          progressTitle.textContent = "Hru se nepodařilo otevřít";
          progressDetail.textContent = "Zkontroluj připojení k internetu a zkus to znovu.";
        });
      return;
    }

    if (isDesktop) {
      if (current === "signed_out") {
        progressTitle.textContent = "StudioVoxario přihlášení";
        progressDetail.textContent = "Bezpečný browser login bude připojen v další fázi.";
      } else if (current === "ready_to_install") {
        progressTitle.textContent = "Instalace ještě není aktivní";
        progressDetail.textContent = "Downloader a ověřování souborů budou připojeny v další fázi.";
      } else if (current === "ready_to_play") {
        progressTitle.textContent = "Herní klient ještě není připojen";
        progressDetail.textContent = "Tlačítko Hrát zatím nespouští Game.exe.";
      }
      return;
    }

    if (current === "signed_out") {
      applyState("ready_to_install");
    } else if (current === "ready_to_install") {
      progressTitle.textContent = "Instalace bude implementována v další fázi";
      progressDetail.textContent = "Tento build je pouze vizuální reference.";
    } else if (current === "ready_to_play") {
      progressTitle.textContent = "Spuštění hry bude připojeno k reálnému klientovi později";
      progressDetail.textContent = "Vizuální prototype neobsahuje Game.exe.";
    }
  });

  window.addEventListener("resize", fitReferenceCanvas);
  fitReferenceCanvas();
  bindWindowControls();
  // Přepínač ukázkových stavů jen v náhledu v prohlížeči (?demo=1).
  const demoControls = document.querySelector(".prototype-controls");
  if (demoControls) demoControls.hidden = isDesktop || params.get("demo") !== "1";
  const initial = !isDesktop && states[params.get("state")] ? params.get("state") : isDesktop ? "online" : "signed_out";
  applyState(initial);
  desktop?.game?.onClosed?.(() => {
    applyState("online");
    progressTitle.textContent = "Vítej zpět";
    progressDetail.textContent = "Svět Kalidry na tebe počká.";
  });
})();

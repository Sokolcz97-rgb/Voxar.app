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
      secondary: "Nastavení",
      account: "StudioVoxario účet",
      accountState: "Přihlášení ve hře",
      badge: "ALPHA · ONLINE",
      installed: "—",
      path: "—",
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
    if (isDesktop && root.dataset.state === "online" && secondary.dataset.full !== "1") openOverlay("settings");
  });

  primary.addEventListener("click", () => {
    const current = root.dataset.state;

    if (isDesktop && current === "online" && unityNeedsInstall()) {
      void installUnity();
      return;
    }

    if (isDesktop && current === "online") {
      progressTitle.textContent = "Otevírám svět Ashes of Eryon…";
      progressDetail.textContent = "Hra se otevře v novém okně.";
      desktop.game?.play()
        .then((result) => {
          progressTitle.textContent = result?.engine === "unity" ? "Hra běží (DirectX 12)" : "Hra běží";
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

  // ------------------------------------------------------------------ živá data launcheru
  const IMAGES = ["news-coast", "news-citadel", "news-ruins"];
  const KIND = { game: "HRA", launcher: "LAUNCHER", news: "NOVINKA", event: "UDÁLOST" };
  let feed = [];
  let nextEventText = "";
  let settings = null;

  function el(tag, cls, text) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }
  function imageFor(item, i) {
    const name = IMAGES.includes(item.image) ? item.image : IMAGES[i % IMAGES.length];
    return `./assets/${name}.webp`;
  }
  function fmtDate(iso) {
    try {
      return new Date(iso).toLocaleDateString("cs-CZ", { day: "numeric", month: "numeric", year: "numeric" });
    } catch {
      return "";
    }
  }
  function fmtSize(bytes) {
    if (!bytes) return "—";
    return bytes > 1e9 ? `${(bytes / 1e9).toFixed(1)} GB` : `${Math.round(bytes / 1e6)} MB`;
  }

  function renderNewsCards() {
    const list = document.getElementById("newsList");
    if (!list || !feed.length) return;
    list.replaceChildren(...feed.slice(0, 3).map((item, i) => {
      const card = el("article", "news-item");
      const img = el("img");
      img.src = imageFor(item, i);
      img.alt = "";
      card.append(img, el("time", "", fmtDate(item.published_at)), el("h3", "", item.title_cs), el("p", "", item.text_cs));
      return card;
    }));
  }

  async function loadLive() {
    if (!isDesktop || !desktop.info) return;
    try {
      const info = await desktop.info();
      states.online.installed = info.version;
      states.online.path = info.installDir;
      installedVersion.textContent = info.version;
      installPath.textContent = info.installDir;
      installPath.title = info.installDir;
      const size = document.getElementById("gameSize");
      if (size) size.textContent = fmtSize(info.sizeBytes);
      const avail = document.getElementById("availableVersion");
      if (avail && avail.textContent === "—") avail.textContent = info.version;
    } catch {}
    try {
      const news = await desktop.news();
      feed = news.items || [];
      if (news.next) {
        nextEventText = `${news.next.title_cs}: ${news.next.when_cs}`;
        states.online.progressDetail = nextEventText;
        if (root.dataset.state === "online" && (progressTitle.textContent === states.online.progressTitle || progressTitle.textContent === "Launcher je aktuální")) progressDetail.textContent = nextEventText;
      }
      renderNewsCards();
    } catch {}
    void refreshServer();
  }

  async function refreshServer() {
    if (!isDesktop || !desktop.server) return;
    let st = { online: false };
    try { st = await desktop.server(); } catch {}
    const dot = document.getElementById("serverDot");
    const label = document.getElementById("serverLabel");
    const state = document.getElementById("serverState");
    if (dot) dot.classList.toggle("offline", !st.online);
    if (label) label.textContent = st.online ? "Servery online" : "Servery nedostupné";
    if (state) {
      state.className = st.online ? "positive" : "negative";
      state.replaceChildren(el("i", "status-dot"), document.createTextNode(st.online ? ` Online${st.ms ? ` · ${st.ms} ms` : ""}` : " Nedostupné"));
    }
  }

  // ------------------------------------------------------------------ překryvná okna
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayBody = document.getElementById("overlayBody");

  function setNav(view) {
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  }
  function closeOverlay() {
    overlay.hidden = true;
    setNav("home");
  }
  function openOverlay(view) {
    if (view === "home") return closeOverlay();
    setNav(view);
    overlay.hidden = false;
    overlayBody.replaceChildren();
    if (view === "news") renderFeed();
    else if (view === "settings") void renderSettings();
    else if (view === "support") renderSupport();
  }

  function renderFeed() {
    overlayTitle.textContent = "Novinky a změny";
    if (!feed.length) {
      overlayBody.append(el("p", "", isDesktop ? "Novinky se načítají…" : "Novinky jsou dostupné v aplikaci."));
      return;
    }
    feed.forEach((item, i) => {
      const row = el("article", "feed-item");
      const img = el("img");
      img.src = imageFor(item, i);
      img.alt = "";
      const text = el("div");
      const time = el("time", "", fmtDate(item.published_at));
      time.append(el("span", "feed-tag", KIND[item.kind] || "NOVINKA"));
      text.append(time, el("h3", "", item.title_cs), el("p", "", item.text_cs));
      row.append(img, text);
      overlayBody.append(row);
    });
  }

  function toggleRow(key, title, hint) {
    const row = el("div", "setting");
    const copy = el("div");
    copy.append(el("b", "", title), el("small", "", hint));
    const t = el("button", "toggle");
    t.type = "button";
    t.setAttribute("role", "switch");
    t.setAttribute("aria-checked", String(Boolean(settings[key])));
    t.addEventListener("click", async () => {
      settings = await desktop.settings.set({ [key]: !settings[key] });
      t.setAttribute("aria-checked", String(Boolean(settings[key])));
    });
    row.append(copy, t);
    return row;
  }

  async function renderSettings() {
    overlayTitle.textContent = "Nastavení";
    if (!isDesktop || !desktop.settings) {
      overlayBody.append(el("p", "", "Nastavení je dostupné v aplikaci."));
      return;
    }
    settings = await desktop.settings.get();
    overlayBody.append(
      toggleRow("fullscreen", "Spouštět hru na celou obrazovku", "Herní okno se otevře přes celou obrazovku (F11 / nastavení hry ho přepne)."),
      toggleRow("autoUpdate", "Automatické aktualizace", "Launcher si sám stáhne a nainstaluje novou verzi."),
      toggleRow("desktopShortcut", "Ikona hry na ploše", "Zástupce Ashes of Eryon na ploše s ikonou hry."),
      toggleRow("startWithWindows", "Spouštět launcher se systémem", "Launcher se otevře po přihlášení do Windows."),
    );
    const engine = el("div", "setting");
    const engineCopy = el("div");
    engineCopy.append(el("b", "", "Verze hry"), el("small", "", "Unity: DirectX 12 / Vulkan, NVIDIA DLSS a AMD FSR 2 (stáhne se do počítače). Webová: běží ze serveru, nic se nestahuje."));
    const engineChoice = el("div", "choice");
    [["unity", "Unity (DirectX 12)"], ["web", "Webová"]].forEach(([value, label]) => {
      const b = el("button", "", label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(settings.engine === value));
      b.addEventListener("click", async () => {
        settings = await desktop.settings.set({ engine: value });
        engineSetting = settings.engine;
        engineChoice.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
        showUnity(unityStatus);
      });
      engineChoice.append(b);
    });
    engine.append(engineCopy, engineChoice);
    overlayBody.append(engine);

    const after = el("div", "setting");
    const copy = el("div");
    copy.append(el("b", "", "Po spuštění hry"), el("small", "", "Co má udělat launcher, když se otevře herní okno."));
    const choice = el("div", "choice");
    [["minimize", "Minimalizovat"], ["hide", "Skrýt"], ["keep", "Nechat otevřený"]].forEach(([value, label]) => {
      const b = el("button", "", label);
      b.type = "button";
      b.setAttribute("aria-pressed", String(settings.afterPlay === value));
      b.addEventListener("click", async () => {
        settings = await desktop.settings.set({ afterPlay: value });
        choice.querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", "false"));
        b.setAttribute("aria-pressed", "true");
      });
      choice.append(b);
    });
    after.append(copy, choice);
    overlayBody.append(after);

    const actions = el("div", "action-row");
    const check = el("button", "", "Zkontrolovat aktualizace");
    check.type = "button";
    check.addEventListener("click", async () => {
      check.textContent = "Kontroluji…";
      const st = await desktop.update.check();
      check.textContent = st?.state === "current" ? "Launcher je aktuální" : st?.state === "error" ? "Kontrola selhala" : "Aktualizace se stahuje…";
    });
    const cache = el("button", "", "Vymazat mezipaměť hry");
    cache.type = "button";
    cache.addEventListener("click", async () => {
      await desktop.clearCache();
      cache.textContent = "Mezipaměť vymazána";
    });
    const folder = el("button", "", "Otevřít složku hry");
    folder.type = "button";
    folder.addEventListener("click", () => void desktop.open("folder"));
    actions.append(check, cache, folder);
    if (desktop.unity) {
      const verify = el("button", "", "Ověřit soubory hry (Unity)");
      verify.type = "button";
      verify.addEventListener("click", () => { closeOverlay(); void installUnity(); });
      const unityFolder = el("button", "", "Složka Unity verze");
      unityFolder.type = "button";
      unityFolder.addEventListener("click", () => void desktop.open("unity-folder"));
      actions.append(verify, unityFolder);
    }
    overlayBody.append(actions);
    try {
      const info = await desktop.info();
      overlayBody.append(el("p", "about", `Ashes of Eryon Launcher ${info.version} · Electron ${info.electron} · ${info.installDir}`));
    } catch {}
  }

  function renderSupport() {
    overlayTitle.textContent = "Podpora";
    overlayBody.append(
      el("p", "", "Něco nefunguje, máš nápad nebo chceš přístup do testování? Napiš nám ticket – odpovídáme česky."),
    );
    const actions = el("div", "action-row");
    [["tickets", "Napsat ticket"], ["roadmap", "Roadmapa hry"], ["download", "Stáhnout GameSetup"], ["web", "StudioVoxario.com"], ["logs", "Složka s logy launcheru"]].forEach(([what, label]) => {
      const b = el("button", "", label);
      b.type = "button";
      b.addEventListener("click", () => void desktop?.open?.(what));
      actions.append(b);
    });
    overlayBody.append(actions);
    overlayBody.append(el("p", "about", "Když se hra seká: v nastavení hry sniž grafiku, nebo zkontroluj, že máš aktuální ovladače grafické karty."));
  }

  document.querySelectorAll(".nav-item[data-view]").forEach((b) => b.addEventListener("click", () => openOverlay(b.dataset.view)));
  document.getElementById("allNews")?.addEventListener("click", () => openOverlay("news"));
  document.getElementById("overlayClose")?.addEventListener("click", closeOverlay);
  window.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) closeOverlay(); });

  // Automatické aktualizace launcheru (stav posílá hlavní proces).
  function showUpdate(status) {
    if (!status || root.dataset.state !== "online") return;
    if (status.current) installedVersion.textContent = status.current;
    const avail = document.getElementById("availableVersion");
    if (avail) avail.textContent = status.latest || status.current || "—";
    const latest = status.latest ? ` ${status.latest}` : "";
    if (status.state === "current") {
      progressTitle.textContent = "Launcher je aktuální";
      progressDetail.textContent = nextEventText || "Svět Kalidry je online.";
    } else if (status.state === "downloading") {
      progressTitle.textContent = `Stahuji aktualizaci launcheru${latest}`;
      progressDetail.textContent = "Nic nemusíš instalovat, launcher se sám restartuje.";
      const pct = Math.round((status.progress || 0) * 100);
      progressFill.style.width = pct + "%";
      progressValue.textContent = pct + " %";
    } else if (status.state === "ready") {
      progressTitle.textContent = `Aktualizace${latest} je připravená`;
      progressDetail.textContent = "Nainstaluje se po zavření hry.";
      progressFill.style.width = "100%";
      progressValue.textContent = "100 %";
    } else if (status.state === "restarting") {
      progressTitle.textContent = `Instaluji aktualizaci${latest}…`;
      progressDetail.textContent = "Launcher se za chvilku sám znovu otevře.";
    } else if (status.state === "full") {
      progressTitle.textContent = `Je k dispozici nová verze${latest}`;
      progressDetail.textContent = "Tahle verze potřebuje nový GameSetup – klikni na „Můj účet“ → Stáhnout.";
      secondary.querySelector("span").textContent = "Stáhnout novou verzi";
      secondary.dataset.full = "1";
    }
  }
  if (isDesktop && desktop.update) {
    desktop.update.onStatus(showUpdate);
    desktop.update.status().then(showUpdate).catch(() => {});
  }
  secondary.addEventListener("click", (event) => {
    if (secondary.dataset.full === "1" && isDesktop) {
      event.stopImmediatePropagation();
      void desktop.update?.openFullInstaller();
    }
  }, true);

  // ------------------------------------------------------------------ Unity verze (DirectX 12, DLSS)
  let unityStatus = null;
  let engineSetting = "unity";
  function unityNeedsInstall() {
    return engineSetting === "unity" && unityStatus && ["install", "update", "error"].includes(unityStatus.state);
  }
  async function installUnity() {
    progressTitle.textContent = "Připravuji stahování hry…";
    progressDetail.textContent = "Unity verze s DirectX 12 a DLSS.";
    const st = await desktop.unity.install().catch(() => null);
    showUnity(st);
  }
  function showUnity(st) {
    if (st) unityStatus = st;
    st = unityStatus;
    if (!st || root.dataset.state !== "online" || engineSetting !== "unity") {
      if (engineSetting !== "unity" && root.dataset.state === "online") primary.querySelector("span").textContent = "Hrát";
      return;
    }
    const label = primary.querySelector("span");
    const v = st.latest ? ` ${st.latest}` : "";
    if (st.state === "install") {
      label.textContent = "Instalovat";
      progressTitle.textContent = `Unity verze${v} je připravená ke stažení`;
      progressDetail.textContent = `DirectX 12, NVIDIA DLSS, AMD FSR 2 · ${fmtSize(st.size)}`;
      progressValue.textContent = fmtSize(st.size);
      progressFill.style.width = "0%";
    } else if (st.state === "update") {
      label.textContent = "Aktualizovat";
      progressTitle.textContent = `Nová verze hry${v}`;
      progressDetail.textContent = `Nainstalováno ${st.installed || "—"} · stáhnou se jen změněné soubory.`;
    } else if (st.state === "verifying" || st.state === "downloading") {
      label.textContent = "Stahuji…";
      const pct = Math.round((st.progress || 0) * 100);
      progressTitle.textContent = st.state === "verifying" ? "Ověřuji soubory hry…" : `Stahuji hru${v}`;
      progressDetail.textContent = st.total ? `${fmtSize(st.done)} z ${fmtSize(st.total)}` : "Kontroluji, co je potřeba stáhnout.";
      progressFill.style.width = pct + "%";
      progressValue.textContent = pct + " %";
    } else if (st.state === "ready") {
      label.textContent = "Hrát";
      progressTitle.textContent = `Hra je aktuální${v}`;
      progressDetail.textContent = "Unity verze · DirectX 12 · DLSS / FSR 2";
      progressFill.style.width = "100%";
      progressValue.textContent = "100 %";
      installedVersion.textContent = st.installed || st.latest || "—";
    } else if (st.state === "running") {
      progressTitle.textContent = "Hra běží (DirectX 12)";
      progressDetail.textContent = "Launcher počká, až hru zavřeš.";
    } else if (st.state === "error") {
      label.textContent = "Zkusit znovu";
      progressTitle.textContent = "Stažení hry se nepodařilo";
      progressDetail.textContent = st.error || "Zkontroluj připojení k internetu.";
    }
  }
  if (isDesktop && desktop.unity) {
    desktop.settings.get().then((s) => { engineSetting = s?.engine || "unity"; showUnity(null); }).catch(() => {});
    desktop.unity.onStatus(showUnity);
    desktop.unity.status().then((st) => st && showUnity(st)).catch(() => {});
  }

  void loadLive();
  if (isDesktop) {
    setInterval(() => void refreshServer(), 60000);
    setInterval(() => void loadLive(), 10 * 60000);
  }

  desktop?.game?.onClosed?.(() => {
    applyState("online");
    progressTitle.textContent = "Vítej zpět";
    progressDetail.textContent = "Svět Kalidry na tebe počká.";
    if (engineSetting === "unity") showUnity(null);
  });
})();

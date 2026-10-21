using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Hlavní rozhraní ve stylu Eryon: přihlášení (pozadí a logo z launcheru), načítání,
    /// horní lišta s portrétem postavy a nastavení se záložkami (grafika, zobrazení a
    /// monitor, zvuk, ovládání, módy).
    /// </summary>
    public class GameUI : MonoBehaviour
    {
        public GameBootstrap boot;
        public WindowGuard guard;
        string email = "", password = "";
        bool settingsOpen;
        int tab;
        float fps, fpsTimer;
        int frames;
        Vector2 scroll;
        static readonly string[] Tabs = { "Grafika", "Zobrazení", "Zvuk", "Ovládání", "Módy" };

        public bool SettingsOpen => settingsOpen;
        public void TestOpenSettings(int t) { settingsOpen = true; tab = t; }

        void Update()
        {
            frames++;
            fpsTimer += Time.unscaledDeltaTime;
            if (fpsTimer >= 0.5f) { fps = frames / fpsTimer; frames = 0; fpsTimer = 0; }
            var dialog = NpcDialog.Instance;
            if (Input.GetKeyDown(KeyCode.Escape) && boot.inWorld)
            {
                if (dialog != null && dialog.IsOpen) dialog.Close();
                else settingsOpen = !settingsOpen;
            }
            bool blocked = settingsOpen || (dialog != null && dialog.IsOpen) || (Encounters.Instance != null && Encounters.Instance.Busy);
            if (boot.player != null) boot.player.inputEnabled = !blocked;
            if (boot.rig != null) boot.rig.inputEnabled = !settingsOpen;
        }

        void OnGUI()
        {
            EryonSkin.Begin();
            GUI.depth = settingsOpen ? -20 : 0; // nastavení vždy nahoře
            if (!boot.inWorld) { LoginScreen(); return; }
            Hud();
            if (settingsOpen) Settings();
        }

        // ------------------------------------------------------------------ přihlášení
        void LoginScreen()
        {
            float W = EryonSkin.W, H = EryonSkin.H;
            var full = new Rect(0, 0, W, H);
            EryonSkin.Cover(full, EryonSkin.Background);
            GUI.DrawTexture(full, EryonSkin.Vignette);
            EryonSkin.Fill(new Rect(0, 0, W * 0.42f, H), new Color(0.03f, 0.02f, 0.015f, 0.55f));

            // levý sloupec: logo a přihlášení
            float colW = 520, x = Mathf.Max(60, W * 0.08f);
            if (EryonSkin.Logo != null) GUI.DrawTexture(new Rect(x + colW / 2 - 150, H * 0.06f, 300, 300), EryonSkin.Logo, ScaleMode.ScaleToFit);
            GUI.Label(new Rect(x, H * 0.06f + 300, colW, 30), "KAPITOLA I  ·  POSLEDNÍ ŠTÍT", new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleCenter, fontSize = 16, normal = { textColor = EryonSkin.Gold } });

            var r = new Rect(x, H * 0.06f + 350, colW, CrashReporter.Notice != null ? 470 : 400);
            var inner = EryonSkin.DrawPanel(r, "Vstup do Kalidry");
            GUILayout.BeginArea(inner);
            if (boot.busy || (boot.api.SignedIn && boot.state == null && string.IsNullOrEmpty(boot.status)))
            {
                GUILayout.Space(40);
                Spinner(new Vector2(inner.width / 2, 70));
                GUILayout.Space(70);
                GUILayout.Label(string.IsNullOrEmpty(boot.status) ? "Načítám…" : boot.status, EryonSkin.Center);
            }
            else if (boot.api.SignedIn && boot.state == null)
            {
                GUILayout.Space(10);
                GUILayout.Label(boot.status, EryonSkin.Body);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Odhlásit se", EryonSkin.Button, GUILayout.Height(44))) boot.SignOut();
            }
            else
            {
                GUILayout.Label("E-MAIL ÚČTU STUDIOVOXARIO", EryonSkin.Caps);
                GUI.SetNextControlName("email");
                email = GUILayout.TextField(email, EryonSkin.Field, GUILayout.Height(44));
                GUILayout.Space(10);
                GUILayout.Label("HESLO", EryonSkin.Caps);
                password = GUILayout.PasswordField(password, '•', EryonSkin.Field, GUILayout.Height(44));
                GUILayout.Space(18);
                bool can = email.Length > 3 && password.Length > 0;
                GUI.enabled = can;
                bool enter = Event.current.type == EventType.KeyDown && (Event.current.keyCode == KeyCode.Return || Event.current.keyCode == KeyCode.KeypadEnter);
                if (GUILayout.Button("VSTOUPIT DO SVĚTA", EryonSkin.ButtonPrimary, GUILayout.Height(54)) || (enter && can)) boot.SignIn(email.Trim(), password);
                GUI.enabled = true;
                GUILayout.Space(8);
                if (!string.IsNullOrEmpty(boot.status)) GUILayout.Label($"<color=#e0672a>{boot.status}</color>", EryonSkin.Small);
                GUILayout.FlexibleSpace();
                if (CrashReporter.Notice != null) GUILayout.Label($"<color=#e0672a>{CrashReporter.Notice}</color>", EryonSkin.Small);
                GUILayout.Label("Přihlašuješ se přes Google nebo Discord? Na studiovoxario.com si v profilu nastav heslo.", EryonSkin.Small);
            }
            GUILayout.EndArea();

            // pravý dolní roh: verze a technika
            var info = $"Unity · DirectX 12 · {(Upscaling.DlssSupported ? "NVIDIA DLSS" : "AMD FSR 2")}    verze {Application.version}";
            GUI.Label(new Rect(W - 640, H - 44, 610, 30), info, new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleRight });
            GUI.Label(new Rect(W - 640, H - 80, 610, 34), "Every choice leaves a scar.", new GUIStyle(EryonSkin.Body) { alignment = TextAnchor.MiddleRight, fontSize = 26, fontStyle = FontStyle.Italic, normal = { textColor = new Color(0.93f, 0.89f, 0.82f, 0.8f) } });
        }

        static void Spinner(Vector2 c)
        {
            float t = Time.unscaledTime * 2.2f;
            for (int i = 0; i < 8; i++)
            {
                float a = i / 8f * Mathf.PI * 2;
                float k = Mathf.Repeat(i / 8f - t / (Mathf.PI * 2) * 2, 1);
                EryonSkin.DiamondAt(c + new Vector2(Mathf.Cos(a), Mathf.Sin(a)) * 26, 10, new Color(1, 0.85f, 0.55f, 0.25f + k * 0.75f));
            }
        }

        // ------------------------------------------------------------------ horní lišta
        void Hud()
        {
            var ch = boot.state.character;
            float W = EryonSkin.W, H = EryonSkin.H;
            // rámeček postavy
            var frame = new Rect(16, 16, 440, 128);
            EryonSkin.Fill(new Rect(frame.x + 50, frame.y + 14, frame.width - 50, frame.height - 28), new Color(0.04f, 0.03f, 0.025f, 0.82f));
            EryonSkin.Fill(new Rect(frame.x + 50, frame.y + 14, frame.width - 50, 1), EryonSkin.Line);
            EryonSkin.Fill(new Rect(frame.x + 50, frame.yMax - 15, frame.width - 50, 1), EryonSkin.Line);
            EryonSkin.Portrait(new Rect(frame.x, frame.y, 118, 118), EryonSkin.PortraitFor(ch.@class, ch.appearance?.gender));
            // úroveň v kosočtverci
            EryonSkin.DiamondAt(new Vector2(frame.x + 100, frame.y + 100), 40, Color.white);
            GUI.Label(new Rect(frame.x + 80, frame.y + 86, 40, 28), ch.level.ToString(), new GUIStyle(EryonSkin.Key) { fontSize = 17 });
            string name = string.IsNullOrEmpty(ch.display_name) ? ch.name : ch.display_name;
            EryonSkin.Shadowed(new Rect(frame.x + 132, frame.y + 20, 290, 32), name, new GUIStyle(EryonSkin.H2) { fontSize = 23, normal = { textColor = EryonSkin.GoldBright } });
            GUI.Label(new Rect(frame.x + 132, frame.y + 50, 290, 22), $"{EryonSkin.ClassName(ch.@class)}  ·  {EryonSkin.FactionName(ch.faction)}", new GUIStyle(EryonSkin.Small) { fontSize = 16 });
            float xpK = ch.xp_need > 0 ? ch.xp / (float)ch.xp_need : 0;
            EryonSkin.Bar(new Rect(frame.x + 132, frame.y + 78, 270, 18), xpK, new Color(0.62f, 0.48f, 0.9f), ch.xp_need > 0 ? $"{ch.xp} / {ch.xp_need} zk." : "");
            // zlato a čest
            GUI.Label(new Rect(frame.x + 132, frame.y + 100, 300, 24), $"<color=#f0d08a>◆ {ch.gold} zlata</color>     <color=#9fd4f0>✦ {ch.honor} cti</color>", new GUIStyle(EryonSkin.Small) { fontSize = 18, richText = true, font = EryonSkin.CormorantBold });

            // spodní lišta s klávesami
            float y = H - 40;
            string[] keys = { "WASD", "pohyb", "Shift", "běh", "Mezerník", "skok", "E", "mluvit", "M", "mapa", "Esc", "nastavení" };
            float x = 18;
            for (int i = 0; i < keys.Length; i += 2)
            {
                float kw = 14 + keys[i].Length * 10;
                EryonSkin.KeyCap(new Rect(x, y, kw, 24), keys[i]);
                GUI.Label(new Rect(x + kw + 6, y, 120, 24), keys[i + 1], new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleLeft });
                x += kw + 16 + keys[i + 1].Length * 9;
            }
            if (PlayerPrefs.GetInt("ui.fps", 1) == 1)
                GUI.Label(new Rect(W - 130, H - 38, 112, 24), $"{fps:0} FPS", new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleRight });
        }

        // ------------------------------------------------------------------ nastavení
        void Settings()
        {
            float W = EryonSkin.W, H = EryonSkin.H;
            EryonSkin.Fill(new Rect(0, 0, W, H), new Color(0, 0, 0, 0.55f));
            var r = new Rect(W / 2 - 480, H / 2 - 400, 960, 800);
            var inner = EryonSkin.DrawPanel(r, "Nastavení");
            // záložky
            GUILayout.BeginArea(new Rect(inner.x, inner.y - 8, inner.width, 50));
            GUILayout.BeginHorizontal();
            for (int i = 0; i < Tabs.Length; i++)
                if (GUILayout.Button(Tabs[i], tab == i ? EryonSkin.ChipOn : EryonSkin.Chip, GUILayout.Height(38))) { tab = i; scroll = Vector2.zero; }
            GUILayout.EndHorizontal();
            GUILayout.EndArea();

            GUILayout.BeginArea(new Rect(inner.x, inner.y + 52, inner.width, inner.height - 120));
            scroll = GUILayout.BeginScrollView(scroll, GUIStyle.none, GUIStyle.none);
            switch (tab)
            {
                case 0: Graphics(); break;
                case 1: Display(); break;
                case 2: Sound(); break;
                case 3: Controls(); break;
                case 4: ModsTab(); break;
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();

            GUILayout.BeginArea(new Rect(inner.x, inner.yMax - 58, inner.width, 58));
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("ZPĚT DO HRY", EryonSkin.ButtonPrimary, GUILayout.Height(50), GUILayout.Width(280))) settingsOpen = false;
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("Odhlásit se", EryonSkin.Button, GUILayout.Height(50), GUILayout.Width(200))) { settingsOpen = false; boot.SignOut(); }
            if (GUILayout.Button("Ukončit hru", EryonSkin.Button, GUILayout.Height(50), GUILayout.Width(200))) Application.Quit();
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        static void Section(string title, string hint = null)
        {
            GUILayout.Space(10);
            GUILayout.Label(title.ToUpperInvariant(), EryonSkin.H2);
            if (hint != null) GUILayout.Label(hint, EryonSkin.Small);
            GUILayout.Space(4);
        }

        void Graphics()
        {
            Section("Zvětšování obrazu", Upscaling.DlssSupported ? "Tvoje karta podporuje NVIDIA DLSS." : "DLSS vyžaduje kartu NVIDIA RTX a DirectX 12 – použij AMD FSR 2.");
            var mode = Upscaling.CurrentMode;
            var quality = Upscaling.CurrentQuality;
            GUILayout.BeginHorizontal();
            if (EryonSkin.Toggle(mode == Upscaling.Mode.Off, "Vypnuto", GUILayout.Height(40))) mode = Upscaling.Mode.Off;
            GUI.enabled = Upscaling.DlssSupported;
            if (EryonSkin.Toggle(mode == Upscaling.Mode.DLSS, "NVIDIA DLSS", GUILayout.Height(40))) mode = Upscaling.Mode.DLSS;
            GUI.enabled = true;
            if (EryonSkin.Toggle(mode == Upscaling.Mode.FSR2, "AMD FSR 2", GUILayout.Height(40))) mode = Upscaling.Mode.FSR2;
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            if (EryonSkin.Toggle(quality == Upscaling.Quality.MaximumQuality, "Kvalita", GUILayout.Height(36))) quality = Upscaling.Quality.MaximumQuality;
            if (EryonSkin.Toggle(quality == Upscaling.Quality.Balanced, "Vyvážené", GUILayout.Height(36))) quality = Upscaling.Quality.Balanced;
            if (EryonSkin.Toggle(quality == Upscaling.Quality.MaximumPerformance, "Výkon", GUILayout.Height(36))) quality = Upscaling.Quality.MaximumPerformance;
            if (EryonSkin.Toggle(quality == Upscaling.Quality.UltraPerformance, "Ultra výkon", GUILayout.Height(36))) quality = Upscaling.Quality.UltraPerformance;
            if (mode == Upscaling.Mode.DLSS && EryonSkin.Toggle(quality == Upscaling.Quality.DLAA, "DLAA", GUILayout.Height(36))) quality = Upscaling.Quality.DLAA;
            GUILayout.EndHorizontal();
            if (mode != Upscaling.CurrentMode || quality != Upscaling.CurrentQuality)
            {
                Upscaling.Save(mode, quality);
                Upscaling.Apply(boot.cam);
            }

            Section("Kvalita světa", "Stíny, mlha, okluze, dohled, hustota stromů a trávy (stromy a tráva se změní po příštím vstupu do světa).");
            GUILayout.BeginHorizontal();
            int qual = PlayerPrefs.GetInt("gfx.quality", 2);
            string[] qn = { "Nízká", "Střední", "Vysoká", "Ultra" };
            for (int i = 0; i < qn.Length; i++)
                if (EryonSkin.Toggle(qual == i, qn[i], GUILayout.Height(40))) Atmosphere.ApplyQuality(i);
            GUILayout.EndHorizontal();
        }

        void Display()
        {
            var displays = WindowGuard.Displays();
            Section("Monitor hry", "Hra se vždy otevře a po minimalizaci vrátí na zvolený monitor (i v režimu celé obrazovky).");
            string cur = WindowGuard.SavedDisplay;
            if (string.IsNullOrEmpty(cur)) cur = WindowGuard.CurrentKey();
            GUILayout.BeginHorizontal();
            for (int i = 0; i < displays.Count; i++)
            {
                var d = displays[i];
                string label = $"{i + 1}. {(string.IsNullOrEmpty(d.name) ? "Monitor" : d.name)}  {d.width}×{d.height}";
                if (EryonSkin.Toggle(cur == WindowGuard.Key(d), label, GUILayout.Height(40))) guard?.MoveTo(d);
            }
            GUILayout.EndHorizontal();

            Section("Režim zobrazení");
            GUILayout.BeginHorizontal();
            if (EryonSkin.Toggle(Screen.fullScreenMode == FullScreenMode.Windowed, "Okno", GUILayout.Height(40))) guard?.SetMode(FullScreenMode.Windowed);
            if (EryonSkin.Toggle(Screen.fullScreenMode == FullScreenMode.FullScreenWindow, "Celá obrazovka v okně", GUILayout.Height(40))) guard?.SetMode(FullScreenMode.FullScreenWindow);
            if (EryonSkin.Toggle(Screen.fullScreenMode == FullScreenMode.ExclusiveFullScreen, "Exkluzivní celá obrazovka", GUILayout.Height(40))) guard?.SetMode(FullScreenMode.ExclusiveFullScreen);
            GUILayout.EndHorizontal();
            GUILayout.Label("Tip: „Celá obrazovka v okně“ nepřeskakuje mezi monitory při přepínání Alt+Tab.", EryonSkin.Small);

            Section("Rozlišení");
            GUILayout.BeginHorizontal();
            foreach (var hgt in new[] { 720, 900, 1080, 1440, 2160 })
            {
                int wid = hgt * 16 / 9;
                if (EryonSkin.Toggle(Screen.height == hgt, hgt == 2160 ? "4K" : $"{hgt}p", GUILayout.Height(36))) Screen.SetResolution(wid, hgt, Screen.fullScreenMode);
            }
            GUILayout.EndHorizontal();

            Section("Snímky za sekundu");
            GUILayout.BeginHorizontal();
            if (EryonSkin.Toggle(QualitySettings.vSyncCount > 0, "V-Sync", GUILayout.Height(36))) { QualitySettings.vSyncCount = 1; PlayerPrefs.SetInt("gfx.vsync", 1); }
            if (EryonSkin.Toggle(QualitySettings.vSyncCount == 0, "Bez V-Sync", GUILayout.Height(36))) { QualitySettings.vSyncCount = 0; PlayerPrefs.SetInt("gfx.vsync", 0); }
            foreach (var cap in new[] { 30, 60, 144, 240, 0 })
                if (EryonSkin.Toggle(Application.targetFrameRate == (cap == 0 ? -1 : cap), cap == 0 ? "Bez limitu" : $"{cap}", GUILayout.Height(36)))
                {
                    Application.targetFrameRate = cap == 0 ? -1 : cap;
                    PlayerPrefs.SetInt("gfx.fpsCap", cap);
                }
            GUILayout.EndHorizontal();
            GUILayout.BeginHorizontal();
            bool showFps = PlayerPrefs.GetInt("ui.fps", 1) == 1;
            if (EryonSkin.Toggle(showFps, "Zobrazit FPS", GUILayout.Height(34))) PlayerPrefs.SetInt("ui.fps", 1);
            if (EryonSkin.Toggle(!showFps, "Skrýt FPS", GUILayout.Height(34))) PlayerPrefs.SetInt("ui.fps", 0);
            GUILayout.EndHorizontal();

            Section("Velikost rozhraní");
            GUILayout.BeginHorizontal();
            float s = PlayerPrefs.GetFloat("ui.scale", 1f);
            GUILayout.Label($"{Mathf.RoundToInt(s * 100)} %", EryonSkin.BodyBold, GUILayout.Width(80));
            float ns = GUILayout.HorizontalSlider(s, 0.75f, 1.5f, GUILayout.Width(500));
            if (Mathf.Abs(ns - s) > 0.001f) PlayerPrefs.SetFloat("ui.scale", Mathf.Round(ns * 20) / 20);
            GUILayout.EndHorizontal();
        }

        void Sound()
        {
            Section("Hudba", "Album „Eryon“ – skladba podle kapitoly příběhu.");
            GUILayout.BeginHorizontal();
            GUILayout.Label($"{Mathf.RoundToInt(Music.Volume * 100)} %", EryonSkin.BodyBold, GUILayout.Width(80));
            Music.Volume = GUILayout.HorizontalSlider(Music.Volume, 0, 1, GUILayout.Width(500));
            GUILayout.EndHorizontal();
            var music = boot.GetComponent<Music>();
            if (music != null && music.NowPlaying != null) GUILayout.Label("♪  " + music.NowPlaying, EryonSkin.Body);
        }

        static void Controls()
        {
            Section("Ovládání");
            (string k, string d)[] rows =
            {
                ("W A S D", "pohyb"), ("Shift", "běh"), ("Mezerník", "skok"), ("Pravé tlačítko myši", "otáčení kamery"), ("Kolečko myši", "vzdálenost kamery"),
                ("Q / E", "otáčení kamery klávesami"), ("E", "mluvit s NPC, zapálit vatru, památník"), ("M", "mapa světa"), ("Esc", "nastavení / zavřít okno"), ("F8", "znovu načíst módy"),
            };
            foreach (var (k, d) in rows)
            {
                GUILayout.BeginHorizontal();
                GUILayout.Label(k, new GUIStyle(EryonSkin.BodyBold) { normal = { textColor = EryonSkin.GoldBright } }, GUILayout.Width(280));
                GUILayout.Label(d, EryonSkin.Body);
                GUILayout.EndHorizontal();
            }
        }

        void ModsTab()
        {
            Section("Módy a doplňky", "Vlastní rozšíření v jazyce Lua (jako doplňky ve World of Warcraft) – rozhraní, upozornění, vlastní modely. Nemění pravidla hry na serveru.");
            var mods = ModManager.Instance;
            if (mods == null) { GUILayout.Label("Módy nejsou dostupné.", EryonSkin.Small); return; }
            GUILayout.Label("Složka s módy: " + ModManager.ModsFolder, EryonSkin.Small);
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Otevřít složku", EryonSkin.Button, GUILayout.Height(40), GUILayout.Width(220))) ModManager.OpenFolder();
            if (GUILayout.Button("Znovu načíst (F8)", EryonSkin.Button, GUILayout.Height(40), GUILayout.Width(220))) mods.Reload();
            GUILayout.EndHorizontal();
            GUILayout.Space(8);
            if (mods.Mods.Count == 0) GUILayout.Label("Zatím žádné módy. Ukázkový mód „UkazkaEryon“ se vytvoří ve složce po prvním spuštění.", EryonSkin.Body);
            foreach (var m in mods.Mods)
            {
                GUILayout.BeginHorizontal();
                bool on = mods.IsEnabled(m.id);
                if (GUILayout.Button(on ? "Zapnuto" : "Vypnuto", on ? EryonSkin.ChipOn : EryonSkin.Chip, GUILayout.Width(130), GUILayout.Height(34))) mods.SetEnabled(m.id, !on);
                GUILayout.Label($"<b>{m.name}</b>  <color=#a8998a>{m.version} · {m.author}</color>", EryonSkin.Body, GUILayout.Height(34));
                GUILayout.EndHorizontal();
                if (!string.IsNullOrEmpty(m.description)) GUILayout.Label(m.description, EryonSkin.Small);
                if (!string.IsNullOrEmpty(m.error)) GUILayout.Label($"<color=#e0672a>Chyba: {m.error}</color>", EryonSkin.Small);
            }
        }
    }
}

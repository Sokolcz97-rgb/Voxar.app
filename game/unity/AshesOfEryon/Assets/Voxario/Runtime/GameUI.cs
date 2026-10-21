using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Rozhraní zkušební verze (IMGUI): přihlášení, horní lišta, nastavení grafiky
    /// (DLSS / FSR 2, rozlišení, režim okna, svislá synchronizace, limit FPS) a FPS.
    /// </summary>
    public class GameUI : MonoBehaviour
    {
        public GameBootstrap boot;
        public WindowGuard guard;
        string email = "", password = "";
        bool settingsOpen;
        float fps, fpsTimer;
        int frames;
        GUIStyle title, label, small, box;
        static readonly Color Gold = new Color(0.85f, 0.66f, 0.36f);

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

        void Styles()
        {
            if (title != null) return;
            title = new GUIStyle(GUI.skin.label) { fontSize = 34, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, normal = { textColor = Gold } };
            label = new GUIStyle(GUI.skin.label) { fontSize = 15, wordWrap = true, normal = { textColor = new Color(0.92f, 0.88f, 0.8f) } };
            small = new GUIStyle(label) { fontSize = 12, normal = { textColor = new Color(0.75f, 0.7f, 0.62f) } };
            box = new GUIStyle(GUI.skin.box) { normal = { background = Tex(new Color(0.05f, 0.04f, 0.04f, 0.88f)) } };
        }

        static Texture2D Tex(Color c)
        {
            var t = new Texture2D(1, 1);
            t.SetPixel(0, 0, c);
            t.Apply();
            return t;
        }

        void OnGUI()
        {
            Styles();
            GUI.Label(new Rect(Screen.width - 110, Screen.height - 26, 100, 22), $"{fps:0} FPS", small);
            if (!boot.inWorld) { LoginScreen(); return; }
            Hud();
            if (settingsOpen) Settings();
        }

        void LoginScreen()
        {
            float w = 420, h = 330;
            var r = new Rect((Screen.width - w) / 2, (Screen.height - h) / 2, w, h);
            GUI.Box(r, GUIContent.none, box);
            GUILayout.BeginArea(new Rect(r.x + 24, r.y + 18, w - 48, h - 36));
            GUILayout.Label("ASHES OF ERYON", title);
            GUILayout.Label("Zkušební verze (Unity, DirectX 12, DLSS)", small);
            GUILayout.Space(10);
            if (boot.api.SignedIn && boot.state == null && !boot.busy)
            {
                GUILayout.Label(boot.status, label);
                if (GUILayout.Button("Odhlásit se", GUILayout.Height(30))) boot.SignOut();
            }
            else
            {
                GUILayout.Label("E-mail účtu StudioVoxario", small);
                email = GUILayout.TextField(email, GUILayout.Height(26));
                GUILayout.Label("Heslo", small);
                password = GUILayout.PasswordField(password, '•', GUILayout.Height(26));
                GUILayout.Space(8);
                GUI.enabled = !boot.busy && email.Length > 3 && password.Length > 0;
                if (GUILayout.Button(boot.busy ? "…" : "Přihlásit se", GUILayout.Height(34))) boot.SignIn(email.Trim(), password);
                GUI.enabled = true;
                if (!string.IsNullOrEmpty(boot.status)) GUILayout.Label(boot.status, label);
                GUILayout.Label("Účet přes Google/Discord? Na studiovoxario.com si nastav heslo v profilu.", small);
            }
            GUILayout.EndArea();
        }

        void Hud()
        {
            var ch = boot.state.character;
            GUI.Box(new Rect(10, 10, 360, 54), GUIContent.none, box);
            GUI.Label(new Rect(22, 14, 340, 24), $"{(string.IsNullOrEmpty(ch.display_name) ? ch.name : ch.display_name)}  ·  úroveň {ch.level}", label);
            GUI.Label(new Rect(22, 36, 340, 20), $"{ClassName(ch.@class)} · {(ch.faction == "legie" ? "Legie Rudého slunce" : "Obránci Kalidry")} · {ch.gold} zlata", small);
            GUI.Label(new Rect(10, Screen.height - 26, 700, 22), "WASD pohyb · Shift běh · Mezerník skok · E mluvit · M mapa · pravé tlačítko myši otáčení · kolečko vzdálenost · Esc nastavení", small);
        }

        static string ClassName(string c) => c == "lucistnik" ? "Lučištník" : c == "vestec" ? "Věštec" : "Štítonoš";

        void Settings()
        {
            float w = 640, h = 640;
            var r = new Rect((Screen.width - w) / 2, (Screen.height - h) / 2, w, h);
            GUI.Box(r, GUIContent.none, box);
            GUILayout.BeginArea(new Rect(r.x + 24, r.y + 16, w - 48, h - 32));
            GUILayout.Label("Nastavení grafiky", new GUIStyle(title) { fontSize = 24, alignment = TextAnchor.MiddleLeft });

            GUILayout.Label("Zvětšování obrazu", label);
            var mode = Upscaling.CurrentMode;
            var quality = Upscaling.CurrentQuality;
            bool dlss = Upscaling.DlssSupported;
            GUILayout.BeginHorizontal();
            if (Toggle(mode == Upscaling.Mode.Off, "Vypnuto")) mode = Upscaling.Mode.Off;
            GUI.enabled = dlss;
            if (Toggle(mode == Upscaling.Mode.DLSS, "NVIDIA DLSS")) mode = Upscaling.Mode.DLSS;
            GUI.enabled = true;
            if (Toggle(mode == Upscaling.Mode.FSR2, "AMD FSR 2")) mode = Upscaling.Mode.FSR2;
            GUILayout.EndHorizontal();
            GUILayout.Label(dlss ? "DLSS je k dispozici (karta NVIDIA RTX)." : "DLSS není k dispozici – vyžaduje kartu NVIDIA RTX a DirectX 12. Použij FSR 2.", small);
            GUILayout.BeginHorizontal();
            if (Toggle(quality == Upscaling.Quality.MaximumQuality, "Kvalita")) quality = Upscaling.Quality.MaximumQuality;
            if (Toggle(quality == Upscaling.Quality.Balanced, "Vyvážené")) quality = Upscaling.Quality.Balanced;
            if (Toggle(quality == Upscaling.Quality.MaximumPerformance, "Výkon")) quality = Upscaling.Quality.MaximumPerformance;
            if (Toggle(quality == Upscaling.Quality.UltraPerformance, "Ultra výkon")) quality = Upscaling.Quality.UltraPerformance;
            if (mode == Upscaling.Mode.DLSS && Toggle(quality == Upscaling.Quality.DLAA, "DLAA")) quality = Upscaling.Quality.DLAA;
            GUILayout.EndHorizontal();
            if (mode != Upscaling.CurrentMode || quality != Upscaling.CurrentQuality)
            {
                Upscaling.Save(mode, quality);
                Upscaling.Apply(boot.cam);
            }

            GUILayout.Space(6);
            GUILayout.Label("Kvalita grafiky (stíny, mlha, okluze, dohled)", label);
            GUILayout.BeginHorizontal();
            int qual = PlayerPrefs.GetInt("gfx.quality", 2);
            string[] qn = { "Nízká", "Střední", "Vysoká", "Ultra" };
            for (int i = 0; i < qn.Length; i++)
                if (Toggle(qual == i, qn[i])) Atmosphere.ApplyQuality(i);
            GUILayout.EndHorizontal();

            var displays = WindowGuard.Displays();
            if (displays.Count > 1)
            {
                GUILayout.Label("Monitor", label);
                GUILayout.BeginHorizontal();
                string cur = WindowGuard.CurrentKey();
                for (int i = 0; i < displays.Count; i++)
                {
                    var d = displays[i];
                    string key = $"{d.name}|{d.width}x{d.height}|{d.workArea.x},{d.workArea.y}";
                    if (Toggle(cur == key, $"{i + 1}: {d.width}×{d.height}")) guard?.MoveTo(d);
                }
                GUILayout.EndHorizontal();
            }

            GUILayout.Space(6);
            GUILayout.Label("Režim zobrazení", label);
            GUILayout.BeginHorizontal();
            if (Toggle(Screen.fullScreenMode == FullScreenMode.Windowed, "Okno")) Screen.fullScreenMode = FullScreenMode.Windowed;
            if (Toggle(Screen.fullScreenMode == FullScreenMode.FullScreenWindow, "Okno přes celou obrazovku")) Screen.fullScreenMode = FullScreenMode.FullScreenWindow;
            if (Toggle(Screen.fullScreenMode == FullScreenMode.ExclusiveFullScreen, "Celá obrazovka")) Screen.fullScreenMode = FullScreenMode.ExclusiveFullScreen;
            GUILayout.EndHorizontal();

            GUILayout.Label("Rozlišení", label);
            GUILayout.BeginHorizontal();
            foreach (var hgt in new[] { 720, 900, 1080, 1440, 2160 })
            {
                int wid = hgt * 16 / 9;
                if (Toggle(Screen.height == hgt, hgt == 2160 ? "4K" : $"{hgt}p")) Screen.SetResolution(wid, hgt, Screen.fullScreenMode);
            }
            GUILayout.EndHorizontal();

            GUILayout.Label("Svislá synchronizace a limit snímků", label);
            GUILayout.BeginHorizontal();
            if (Toggle(QualitySettings.vSyncCount > 0, "V-Sync zap.")) { QualitySettings.vSyncCount = 1; PlayerPrefs.SetInt("gfx.vsync", 1); }
            if (Toggle(QualitySettings.vSyncCount == 0, "V-Sync vyp.")) { QualitySettings.vSyncCount = 0; PlayerPrefs.SetInt("gfx.vsync", 0); }
            foreach (var cap in new[] { 30, 60, 144, 0 })
                if (Toggle(Application.targetFrameRate == (cap == 0 ? -1 : cap), cap == 0 ? "Bez limitu" : $"{cap}"))
                {
                    Application.targetFrameRate = cap == 0 ? -1 : cap;
                    PlayerPrefs.SetInt("gfx.fpsCap", cap);
                }
            GUILayout.EndHorizontal();

            GUILayout.FlexibleSpace();
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Zpět do hry", GUILayout.Height(32))) settingsOpen = false;
            if (GUILayout.Button("Odhlásit se", GUILayout.Height(32))) { settingsOpen = false; boot.SignOut(); }
            if (GUILayout.Button("Ukončit hru", GUILayout.Height(32))) Application.Quit();
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        static bool Toggle(bool on, string text)
        {
            var prev = GUI.color;
            if (on) GUI.color = Gold;
            bool clicked = GUILayout.Button(text, GUILayout.Height(28)) && !on;
            GUI.color = prev;
            return clicked;
        }
    }
}

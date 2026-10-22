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
        static readonly string[] Tabs = { "Grafika", "Zobrazení", "Zvuk", "Ovládání", "Módy", "Postavy" };

        public bool SettingsOpen => settingsOpen;
        public void TestOpenSettings(int t) { settingsOpen = true; tab = t; }

        void Update()
        {
            frames++;
            fpsTimer += Time.unscaledDeltaTime;
            if (fpsTimer >= 0.5f) { fps = frames / fpsTimer; frames = 0; fpsTimer = 0; }
            var dialog = NpcDialog.Instance;
            bool windowOpen = (CharacterWindow.Instance != null && CharacterWindow.Instance.IsOpen) || (Arena.Instance != null && Arena.Instance.IsOpen)
                              || (Chronicle.Instance != null && Chronicle.Instance.IsOpen) || (Feedback.Instance != null && Feedback.Instance.IsOpen);
            if (Input.GetKeyDown(KeyCode.Escape) && boot.inWorld && !Chat.Typing && (Oddil.Instance == null || !Oddil.Instance.IsOpen) && !windowOpen && !UiFocus.ClosedThisFrame)
            {
                if (dialog != null && dialog.IsOpen) dialog.Close();
                else settingsOpen = !settingsOpen;
            }
            bool blocked = settingsOpen || windowOpen || Chat.Typing || (Oddil.Instance != null && Oddil.Instance.IsOpen) || (dialog != null && dialog.IsOpen) || (Encounters.Instance != null && Encounters.Instance.Busy);
            if (boot.player != null) boot.player.inputEnabled = !blocked;
            if (boot.rig != null) boot.rig.inputEnabled = !settingsOpen && !Chat.Typing;
        }

        void OnGUI()
        {
            EryonSkin.Begin();
            GUI.depth = settingsOpen ? -20 : 0; // nastavení vždy nahoře
            if (!boot.inWorld) { if (boot.NeedsCharacter && !boot.busy) CreatorScreen(); else LoginScreen(); return; }
            Hud();
            if (settingsOpen) Settings();
        }

        // ------------------------------------------------------------------ přihlášení
        bool showPassword, rememberEmail = true, loginInit;
        Texture2D fadeTex;
        [System.Serializable] class NewsItem { public string title_cs, text_cs, published_at; }
        [System.Serializable] class NewsList { public NewsItem[] items; }
        NewsItem[] news;
        int serverState; // 0 = ověřuji, 1 = online, -1 = nedostupné
        bool newsLoading;
        const string Site = "https://studiovoxario.com";

        System.Collections.IEnumerator LoadNews()
        {
            newsLoading = true;
            var url = SupabaseClient.Url + "/rest/v1/ashes_changelog?select=title_cs,text_cs,published_at&kind=eq.game&order=published_at.desc&limit=3";
            using (var req = UnityEngine.Networking.UnityWebRequest.Get(url))
            {
                req.SetRequestHeader("apikey", SupabaseClient.PublishableKey);
                req.timeout = 10;
                yield return req.SendWebRequest();
                if (req.result == UnityEngine.Networking.UnityWebRequest.Result.Success)
                {
                    serverState = 1;
                    news = JsonUtility.FromJson<NewsList>("{\"items\":" + req.downloadHandler.text + "}")?.items;
                }
                else serverState = -1;
            }
        }

        void InitLogin()
        {
            loginInit = true;
            rememberEmail = PlayerPrefs.GetInt("login.remember", 1) == 1;
            if (rememberEmail && string.IsNullOrEmpty(email)) email = PlayerPrefs.GetString("login.email", "");
            fadeTex = new Texture2D(256, 1, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp };
            for (int i = 0; i < 256; i++)
            {
                float t = i / 255f;
                float a = t < 0.55f ? 0.86f : Mathf.Lerp(0.86f, 0f, Mathf.SmoothStep(0, 1, (t - 0.55f) / 0.45f));
                fadeTex.SetPixel(i, 0, new Color(0.025f, 0.018f, 0.012f, a));
            }
            fadeTex.Apply();
            if (!newsLoading) StartCoroutine(LoadNews());
        }

        void DoSignIn()
        {
            PlayerPrefs.SetInt("login.remember", rememberEmail ? 1 : 0);
            PlayerPrefs.SetString("login.email", rememberEmail ? email.Trim() : "");
            boot.SignIn(email.Trim(), password);
        }

        static string NewsDate(string iso)
        {
            return System.DateTime.TryParse(iso, System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.AssumeUniversal, out var d)
                ? d.ToLocalTime().ToString("d. M. yyyy") : "";
        }

        void LinkButton(string text, string url, float width)
        {
            var st = new GUIStyle(EryonSkin.Small) { fontSize = 16, normal = { textColor = EryonSkin.GoldBright }, hover = { textColor = Color.white } };
            if (GUILayout.Button(text, st, GUILayout.Width(width))) Application.OpenURL(url);
            var lr = GUILayoutUtility.GetLastRect();
            EryonSkin.Fill(new Rect(lr.x, lr.yMax - 3, Mathf.Min(lr.width, st.CalcSize(new GUIContent(text)).x), 1), new Color(0.85f, 0.7f, 0.4f, 0.5f));
        }

        void LoginScreen()
        {
            if (!loginInit) InitLogin();
            float W = EryonSkin.W, H = EryonSkin.H;
            var full = new Rect(0, 0, W, H);
            EryonSkin.Cover(full, EryonSkin.Background);
            GUI.DrawTexture(full, EryonSkin.Vignette);
            // plynulý přechod místo ostré hrany
            GUI.DrawTexture(new Rect(0, 0, W * 0.62f, H), fadeTex);

            // levý sloupec: logo a přihlášení
            float colW = 520, x = Mathf.Max(60, W * 0.08f);
            float top = Mathf.Max(20, H * 0.05f);
            if (EryonSkin.Logo != null) GUI.DrawTexture(new Rect(x + colW / 2 - 140, top, 280, 280), EryonSkin.Logo, ScaleMode.ScaleToFit);
            var capsC = new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleCenter, fontSize = 16, normal = { textColor = EryonSkin.Gold } };
            GUI.Label(new Rect(x, top + 282, colW, 26), "KAPITOLA I  ·  POSLEDNÍ ŠTÍT", capsC);
            EryonSkin.Ornament(new Rect(x + colW / 2 - 90, top + 310, 180, 12));

            bool form = !(boot.busy || boot.api.SignedIn);
            var r = new Rect(x, top + 334, colW, form ? (CrashReporter.Notice != null ? 500 : 450) : 300);
            var inner = EryonSkin.DrawPanel(r, "Vstup do Kalidry");
            GUILayout.BeginArea(inner);
            if (boot.busy || (boot.api.SignedIn && boot.state == null && string.IsNullOrEmpty(boot.status)))
            {
                GUILayout.Space(30);
                Spinner(new Vector2(inner.width / 2, 60));
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
                bool enter = Event.current.type == EventType.KeyDown && (Event.current.keyCode == KeyCode.Return || Event.current.keyCode == KeyCode.KeypadEnter);
                GUILayout.Label("E-MAIL ÚČTU STUDIOVOXARIO", EryonSkin.Caps);
                GUI.SetNextControlName("email");
                email = GUILayout.TextField(email, 120, EryonSkin.Field, GUILayout.Height(46));
                GUILayout.Space(12);
                GUILayout.BeginHorizontal();
                GUILayout.Label("HESLO", EryonSkin.Caps);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button(showPassword ? "skrýt" : "zobrazit", new GUIStyle(EryonSkin.Small) { fontSize = 14, alignment = TextAnchor.MiddleRight, normal = { textColor = EryonSkin.Gold } }, GUILayout.Width(90)))
                    showPassword = !showPassword;
                GUILayout.EndHorizontal();
                GUI.SetNextControlName("password");
                password = showPassword ? GUILayout.TextField(password, 128, EryonSkin.Field, GUILayout.Height(46))
                                        : GUILayout.PasswordField(password, '•', 128, EryonSkin.Field, GUILayout.Height(46));
                if (Event.current.capsLock && GUI.GetNameOfFocusedControl() == "password")
                    GUILayout.Label("<color=#e0a040>Pozor, máš zapnutý Caps Lock.</color>", new GUIStyle(EryonSkin.Small) { richText = true, fontSize = 14 });
                else GUILayout.Space(6);
                GUILayout.Space(4);
                GUILayout.BeginHorizontal();
                GUILayout.Space(4);
                if (GUILayout.Button("        Zapamatovat e-mail", new GUIStyle(EryonSkin.Small) { fontSize = 16, normal = { textColor = EryonSkin.Text } }, GUILayout.Width(260), GUILayout.Height(26)))
                    rememberEmail = !rememberEmail;
                var cb = GUILayoutUtility.GetLastRect();
                var box = new Rect(cb.x + 2, cb.y + 5, 16, 16);
                EryonSkin.Fill(box, EryonSkin.Gold);
                EryonSkin.Fill(new Rect(box.x + 2, box.y + 2, 12, 12), new Color(0.05f, 0.04f, 0.03f, 1f));
                if (rememberEmail) EryonSkin.Fill(new Rect(box.x + 5, box.y + 5, 6, 6), EryonSkin.GoldBright);
                GUILayout.FlexibleSpace();
                LinkButton("Zapomenuté heslo?", Site + "/reset-password" + (email.Contains("@") ? "?email=" + System.Uri.EscapeDataString(email.Trim()) : ""), 160);
                GUILayout.EndHorizontal();
                GUILayout.Space(10);
                bool can = email.Trim().Length > 3 && email.Contains("@") && password.Length > 0;
                GUI.enabled = can;
                if (GUILayout.Button("VSTOUPIT DO SVĚTA", EryonSkin.ButtonPrimary, GUILayout.Height(56)) || (enter && can)) DoSignIn();
                GUI.enabled = true;
                // první spuštění: kurzor rovnou do pole
                if (Event.current.type == EventType.Repaint && string.IsNullOrEmpty(GUI.GetNameOfFocusedControl()))
                    GUI.FocusControl(string.IsNullOrEmpty(email) ? "email" : "password");
                GUILayout.Space(6);
                if (!string.IsNullOrEmpty(boot.status)) GUILayout.Label($"<color=#e0672a>{boot.status}</color>", new GUIStyle(EryonSkin.Small) { richText = true, wordWrap = true });
                GUILayout.FlexibleSpace();
                if (CrashReporter.Notice != null) GUILayout.Label($"<color=#e0672a>{CrashReporter.Notice}</color>", new GUIStyle(EryonSkin.Small) { richText = true, wordWrap = true });
                EryonSkin.Fill(GUILayoutUtility.GetRect(inner.width, 1), EryonSkin.Line);
                GUILayout.Space(6);
                GUILayout.BeginHorizontal();
                GUILayout.Label("Nemáš účet?", new GUIStyle(EryonSkin.Small) { fontSize = 16 }, GUILayout.Width(110));
                LinkButton("Vytvoř si ho zdarma", Site + "/auth", 200);
                GUILayout.EndHorizontal();
                GUILayout.Label("Přihlašuješ se přes Google nebo Discord? Klikni na „Zapomenuté heslo?“ a nastav si heslo i pro hru.", new GUIStyle(EryonSkin.Small) { fontSize = 15, wordWrap = true });
            }
            GUILayout.EndArea();

            // pravý sloupec: stav serveru a novinky
            float nw = 470, nx = W - nw - Mathf.Max(40, W * 0.04f), ny = top + 10;
            var dot = serverState == 1 ? new Color(0.35f, 0.85f, 0.45f) : serverState == -1 ? new Color(0.9f, 0.35f, 0.25f) : new Color(0.9f, 0.75f, 0.3f);
            var sr = new Rect(nx, ny, nw, 40);
            EryonSkin.Fill(sr, new Color(0.03f, 0.02f, 0.015f, 0.7f));
            EryonSkin.Fill(new Rect(sr.x + 16, sr.y + 15, 10, 10), dot);
            GUI.Label(new Rect(sr.x + 36, sr.y, nw - 50, 40), serverState == 1 ? "SERVERY ONLINE" : serverState == -1 ? "SERVERY NEDOSTUPNÉ" : "OVĚŘUJI SERVERY…",
                new GUIStyle(EryonSkin.Caps) { fontSize = 15, alignment = TextAnchor.MiddleLeft });
            GUI.Label(new Rect(sr.x, sr.y, nw - 16, 40), "Uzavřený test", new GUIStyle(EryonSkin.Small) { fontSize = 14, alignment = TextAnchor.MiddleRight });
            if (news != null && news.Length > 0)
            {
                float y = ny + 54;
                GUI.Label(new Rect(nx, y, nw, 28), "NOVINKY", new GUIStyle(EryonSkin.Caps) { fontSize = 16, normal = { textColor = EryonSkin.Gold } });
                y += 32;
                var tSt = new GUIStyle(EryonSkin.BodyBold) { fontSize = 19, wordWrap = true };
                var bSt = new GUIStyle(EryonSkin.Small) { fontSize = 15, wordWrap = true };
                foreach (var n in news)
                {
                    if (n == null || y > H - 220) break;
                    string body = n.text_cs ?? "";
                    string title = (n.title_cs ?? "").Replace("Unity verze", "Verze");
                    if (body.Length > 170) body = body.Substring(0, 167).TrimEnd() + "…";
                    float th = tSt.CalcHeight(new GUIContent(title), nw - 32), bh = bSt.CalcHeight(new GUIContent(body), nw - 32);
                    var card = new Rect(nx, y, nw, th + bh + 46);
                    EryonSkin.Fill(card, new Color(0.03f, 0.02f, 0.015f, 0.72f));
                    EryonSkin.Fill(new Rect(card.x, card.y, 3, card.height), EryonSkin.Gold);
                    GUI.Label(new Rect(card.x + 16, card.y + 10, nw - 32, 18), NewsDate(n.published_at), new GUIStyle(EryonSkin.Small) { fontSize = 13 });
                    GUI.Label(new Rect(card.x + 16, card.y + 28, nw - 32, th), title, tSt);
                    GUI.Label(new Rect(card.x + 16, card.y + 32 + th, nw - 32, bh), body, bSt);
                    y += card.height + 10;
                }
            }

            // spodní lišta: odkazy vlevo, verze vpravo
            var foot = new GUIStyle(EryonSkin.Small) { fontSize = 14, wordWrap = false, clipping = TextClipping.Overflow, normal = { textColor = new Color(0.85f, 0.8f, 0.72f, 0.75f) }, hover = { textColor = EryonSkin.GoldBright } };
            float fx = x;
            foreach (var (label, url) in new[] { ("© 2026 StudioVoxario", Site), ("Podmínky použití", Site + "/terms"), ("Ochrana soukromí", Site + "/privacy"), ("Podpora", Site) })
            {
                float lw = foot.CalcSize(new GUIContent(label)).x;
                if (GUI.Button(new Rect(fx, H - 40, lw + 4, 26), label, foot)) Application.OpenURL(url);
                fx += lw + 26;
            }
            var info = $"DirectX 12 · {(Upscaling.DlssSupported ? "NVIDIA DLSS" : "AMD FSR 2")}   ·   verze {Application.version}";
            GUI.Label(new Rect(W - 640, H - 44, 610, 30), info, new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleRight, fontSize = 14 });
            GUI.Label(new Rect(W - 640, H - 82, 610, 34), "Každá volba zanechá jizvu.", new GUIStyle(EryonSkin.Body) { alignment = TextAnchor.MiddleRight, fontSize = 26, fontStyle = FontStyle.Italic, normal = { textColor = new Color(0.93f, 0.89f, 0.82f, 0.8f) } });
        }

        // ------------------------------------------------------------------ tvorba postavy
        string cName = "", cClass = "hoplit", cGender = "m", cFaction = "kalidra", cError;

        static readonly (string id, string desc)[] ClassInfo =
        {
            ("hoplit", "Štít a kopí. Nejvíc životů a blok štítem. Hlavní vlastnost: síla."),
            ("lucistnik", "Luk a dýka. Rychlé zásahy a úhyby. Hlavní vlastnost: obratnost."),
            ("vestec", "Oheň a proroctví. Silná kouzla, méně životů. Hlavní vlastnost: intelekt."),
        };

        void CreatorScreen()
        {
            float W = EryonSkin.W, H = EryonSkin.H;
            var full = new Rect(0, 0, W, H);
            EryonSkin.Cover(full, EryonSkin.Background);
            GUI.DrawTexture(full, EryonSkin.Vignette);
            EryonSkin.Fill(full, new Color(0.03f, 0.02f, 0.015f, 0.5f));
            float w = Mathf.Min(1300, W - 60), h = Mathf.Min(900, H - 60);
            var r = new Rect((W - w) / 2, (H - h) / 2, w, h);
            var inner = EryonSkin.DrawPanel(r, "Zrození hrdiny");
            GUILayout.BeginArea(inner);
            GUILayout.Label("Každá volba zanechá jizvu. Jméno, strana i povolání zůstanou s tvým hrdinou navždy.", new GUIStyle(EryonSkin.Body) { fontStyle = FontStyle.Italic });
            GUILayout.Space(10);

            GUILayout.Label("STRANA VÁLKY", EryonSkin.Caps);
            GUILayout.BeginHorizontal();
            FactionCard("kalidra", "Obránci Kalidry", "Poslední svobodné město na pobřeží. Probudíš se na Bezejmenném břehu a pomůžeš Eryonovi udržet hradby.");
            GUILayout.Space(16);
            FactionCard("legie", "Legie Rudého slunce", "Vojsko Azkara, Syna Rudého slunce. Vystoupíš z černých lodí v zátoce a povedeš útok na Kalidru.");
            GUILayout.EndHorizontal();
            GUILayout.Space(12);

            GUILayout.Label("POVOLÁNÍ", EryonSkin.Caps);
            GUILayout.BeginHorizontal();
            foreach (var c in ClassInfo)
            {
                bool on = cClass == c.id;
                GUILayout.BeginVertical(on ? EryonSkin.ChipOn : EryonSkin.Chip, GUILayout.Width((inner.width - 40) / 3), GUILayout.Height(250));
                var pr = GUILayoutUtility.GetRect(130, 130, GUILayout.ExpandWidth(true));
                EryonSkin.Portrait(new Rect(pr.x + pr.width / 2 - 65, pr.y + 4, 122, 122), EryonSkin.PortraitFor(c.id, cGender));
                GUILayout.Label(EryonSkin.ClassName(c.id), new GUIStyle(EryonSkin.H2) { alignment = TextAnchor.MiddleCenter, normal = { textColor = on ? EryonSkin.GoldBright : EryonSkin.Text } });
                GUILayout.Label(c.desc, new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.UpperCenter, wordWrap = true });
                GUILayout.EndVertical();
                if (Event.current.type == EventType.MouseDown && GUILayoutUtility.GetLastRect().Contains(Event.current.mousePosition)) { cClass = c.id; Event.current.Use(); }
                GUILayout.Space(10);
            }
            GUILayout.EndHorizontal();
            GUILayout.Space(12);

            GUILayout.BeginHorizontal();
            GUILayout.BeginVertical(GUILayout.Width(520));
            GUILayout.Label("JMÉNO HRDINY (3–20 znaků)", EryonSkin.Caps);
            cName = GUILayout.TextField(cName, 20, EryonSkin.Field, GUILayout.Height(46));
            GUILayout.EndVertical();
            GUILayout.Space(30);
            GUILayout.BeginVertical();
            GUILayout.Label("POSTAVA", EryonSkin.Caps);
            GUILayout.BeginHorizontal();
            if (EryonSkin.Toggle(cGender == "m", "Muž", GUILayout.Height(46), GUILayout.Width(150))) cGender = "m";
            if (EryonSkin.Toggle(cGender == "f", "Žena", GUILayout.Height(46), GUILayout.Width(150))) cGender = "f";
            GUILayout.EndHorizontal();
            GUILayout.EndVertical();
            GUILayout.EndHorizontal();

            var slots = boot.GetComponent<CharacterSlots>();
            if (slots != null && slots.HasOthers)
            {
                GUILayout.Space(10);
                GUILayout.Label("NEBO POKRAČUJ S EXISTUJÍCÍ POSTAVOU", EryonSkin.Caps);
                slots.Draw(false);
            }
            else if (slots != null && !slots.Loaded) slots.Refresh();
            GUILayout.FlexibleSpace();
            if (!string.IsNullOrEmpty(cError)) GUILayout.Label($"<color=#e0672a>{cError}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true });
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Odhlásit se", EryonSkin.Button, GUILayout.Height(50), GUILayout.Width(220))) boot.SignOut();
            GUILayout.FlexibleSpace();
            string nm = cName.Trim();
            GUI.enabled = nm.Length >= 3 && !boot.busy;
            if (GUILayout.Button("VSTOUPIT DO SVĚTA", EryonSkin.ButtonPrimary, GUILayout.Height(58), GUILayout.Width(380)))
            {
                cError = null;
                boot.CreateCharacter(nm, cClass, cGender, cFaction, e => cError = e);
            }
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }

        void FactionCard(string id, string title, string desc)
        {
            bool on = cFaction == id;
            GUILayout.BeginVertical(on ? EryonSkin.ChipOn : EryonSkin.Chip, GUILayout.Height(110));
            GUILayout.Label(title, new GUIStyle(EryonSkin.H2) { normal = { textColor = on ? EryonSkin.GoldBright : EryonSkin.Text } });
            GUILayout.Label(desc, new GUIStyle(EryonSkin.Small) { wordWrap = true });
            GUILayout.EndVertical();
            if (Event.current.type == EventType.MouseDown && GUILayoutUtility.GetLastRect().Contains(Event.current.mousePosition)) { cFaction = id; Event.current.Use(); }
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
            GUI.Label(new Rect(frame.x + 132, frame.y + 100, 320, 24), $"<color=#8cc06b>❤ {Mathf.RoundToInt(boot.state.hp)}</color>    <color=#f0d08a>◆ {ch.gold}</color>    <color=#9fd4f0>✦ {ch.honor} cti</color>", new GUIStyle(EryonSkin.Small) { fontSize = 18, richText = true, font = EryonSkin.CormorantBold });

            // spodní lišta s klávesami (tmavý podklad kvůli čitelnosti na světlém terénu)
            float y = H - 40;
            EryonSkin.Fill(new Rect(0, y - 8, W, 48), new Color(0.03f, 0.02f, 0.015f, 0.55f));
            string[] keys = { "WASD", "pohyb", "Shift", "běh", "Mezerník", "skok", "E", "mluvit", "C", "postava", "I", "batoh", "K", "kronika", "M", "mapa", "Enter", "chat", "O", "oddíl", "F1", "hlášení", "Esc", "nastavení" };
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
                if (GUILayout.Button(Tabs[i], tab == i ? EryonSkin.ChipOn : EryonSkin.Chip, GUILayout.Height(38))) { tab = i; scroll = Vector2.zero; if (i == 5) boot.GetComponent<CharacterSlots>()?.Refresh(); }
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
                case 5:
                    Section("Tvé postavy", "Na jednom účtu můžeš mít až 4 hrdiny – třeba za každou stranu války.");
                    boot.GetComponent<CharacterSlots>()?.Draw(true);
                    break;
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
            GUILayout.Space(16);
            Section("Zvukové efekty", "Zásahy, bloky, mince, nová úroveň.");
            GUILayout.BeginHorizontal();
            GUILayout.Label($"{Mathf.RoundToInt(Sfx.Volume * 100)} %", EryonSkin.BodyBold, GUILayout.Width(80));
            float sv = GUILayout.HorizontalSlider(Sfx.Volume, 0, 1, GUILayout.Width(500));
            if (Mathf.Abs(sv - Sfx.Volume) > 0.001f) Sfx.Volume = sv;
            GUILayout.Space(20);
            if (GUILayout.Button("Vyzkoušet", EryonSkin.Button, GUILayout.Width(160), GUILayout.Height(36))) Sfx.Play("crit");
            GUILayout.EndHorizontal();
        }

        static void Controls()
        {
            Section("Ovládání");
            (string k, string d)[] rows =
            {
                ("W A S D", "pohyb"), ("Shift", "běh"), ("R", "automatický běh vpřed"), ("T", "návrat do bezpečí (5 s, jednou za 3 min)"), ("Mezerník", "skok"), ("Pravé tlačítko myši", "otáčení kamery"), ("Kolečko myši", "vzdálenost kamery"),
                ("Q / E", "otáčení kamery klávesami"), ("E", "mluvit s NPC, zapálit vatru, památník"), ("M", "mapa světa"),
                ("Enter", "chat (Tab – kanál Svět / Oddíl, /o zpráva do oddílu)"), ("O", "oddíl"), ("C", "postava a trénink"), ("I / B", "batoh a výbava"), ("K", "kronika – výpravy a boss kapitoly"), ("H", "skrýt / zobrazit rádce"), ("F1", "nahlásit chybu nebo nápad vývojářům"),
                ("Esc", "nastavení / zavřít okno"), ("F8", "znovu načíst módy"),
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

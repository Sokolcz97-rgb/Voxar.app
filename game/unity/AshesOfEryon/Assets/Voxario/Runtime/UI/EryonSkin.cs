using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Vzhled rozhraní „Eryon“ (stejné barvy a písma jako web a launcher):
    /// tmavé panely se zlatým rámem, písmo Cinzel na nadpisy a Cormorant Garamond na text,
    /// zlatá tlačítka, kosočtverečné ozdoby. Rozhraní se kreslí ve virtuálním rozlišení
    /// 1920 × 1080 a škáluje se podle výšky obrazovky (vypadá stejně na 1080p, 1440p i 4K).
    /// </summary>
    public static class EryonSkin
    {
        // ------------------------------------------------------------------ barvy (ashes.css)
        public static readonly Color Bg = Hex("#0d0b0a");
        public static readonly Color Panel = new Color(17 / 255f, 14 / 255f, 12 / 255f, 0.9f);
        public static readonly Color Line = new Color(201 / 255f, 164 / 255f, 92 / 255f, 0.35f);
        public static readonly Color LineStrong = new Color(214 / 255f, 178 / 255f, 104 / 255f, 0.8f);
        public static readonly Color Gold = Hex("#d2ae68");
        public static readonly Color GoldBright = Hex("#f0d08a");
        public static readonly Color Text = Hex("#ece2d0");
        public static readonly Color Muted = Hex("#a8998a");
        public static readonly Color Ember = Hex("#e0672a");
        public static readonly Color Blood = Hex("#9c2a1c");
        public static readonly Color Good = Hex("#8cc06b");
        public static readonly Color Sky = Hex("#9fd4f0");

        static Color Hex(string h) { ColorUtility.TryParseHtmlString(h, out var c); return c; }

        // ------------------------------------------------------------------ písma a styly
        public static Font Cinzel, CinzelBold, Cormorant, CormorantBold;
        public static GUIStyle Title, H1, H2, Body, BodyBold, Small, Caps, Button, ButtonPrimary, ButtonGhost, Chip, ChipOn, Field, PanelStyle, Center, Key;
        public static Texture2D White, PanelTex, ButtonTex, ButtonHover, ButtonDown, PrimaryTex, PrimaryHover, FieldTex, ChipTex, ChipOnTex, Background, Logo, Wordmark, Vignette, Diamond, Ring, Disc;
        static bool ready;

        /// <summary>Měřítko rozhraní (virtuální výška 1080 px).</summary>
        public static float Scale => Mathf.Max(0.5f, Screen.height / 1080f) * Mathf.Clamp(PlayerPrefs.GetFloat("ui.scale", 1f), 0.75f, 1.5f);
        public static float W => Screen.width / Scale;
        public static float H => Screen.height / Scale;

        /// <summary>Volat na začátku každého OnGUI: nastaví škálování a styly.</summary>
        public static void Begin()
        {
            if (!ready) Init();
            GUI.matrix = Matrix4x4.Scale(new Vector3(Scale, Scale, 1));
            GUI.skin.settings.cursorColor = Gold;
            GUI.skin.settings.selectionColor = new Color(0.82f, 0.68f, 0.4f, 0.35f);
        }

        /// <summary>Pozice myši ve virtuálních souřadnicích (pro vlastní kreslení).</summary>
        public static Vector2 Mouse => Event.current.mousePosition;

        static void Init()
        {
            ready = true;
            Cinzel = Resources.Load<Font>("UI/Cinzel-Regular");
            CinzelBold = Resources.Load<Font>("UI/Cinzel-SemiBold") ?? Cinzel;
            Cormorant = Resources.Load<Font>("UI/Cormorant-Medium");
            CormorantBold = Resources.Load<Font>("UI/Cormorant-SemiBold") ?? Cormorant;
            Background = Resources.Load<Texture2D>("UI/background");
            Logo = Resources.Load<Texture2D>("UI/logo");
            Wordmark = Resources.Load<Texture2D>("UI/wordmark");

            White = Solid(Color.white);
            PanelTex = Frame(48, Panel, new Color(0.04f, 0.03f, 0.025f, 0.94f), LineStrong, Line, true);
            ButtonTex = Frame(32, new Color(0.16f, 0.12f, 0.09f, 0.95f), new Color(0.09f, 0.07f, 0.055f, 0.95f), new Color(0.75f, 0.6f, 0.35f, 0.75f), new Color(0, 0, 0, 0), false);
            ButtonHover = Frame(32, new Color(0.25f, 0.19f, 0.12f, 0.97f), new Color(0.13f, 0.1f, 0.07f, 0.97f), GoldBright, new Color(0, 0, 0, 0), false);
            ButtonDown = Frame(32, new Color(0.08f, 0.06f, 0.05f, 0.97f), new Color(0.15f, 0.11f, 0.08f, 0.97f), Gold, new Color(0, 0, 0, 0), false);
            PrimaryTex = Frame(32, Hex("#e8c77e"), Hex("#a87a3a"), Hex("#fbe6b0"), new Color(0, 0, 0, 0), false);
            PrimaryHover = Frame(32, Hex("#f6dc9c"), Hex("#c29048"), Color.white, new Color(0, 0, 0, 0), false);
            FieldTex = Frame(24, new Color(0.03f, 0.025f, 0.02f, 0.95f), new Color(0.06f, 0.05f, 0.04f, 0.95f), new Color(0.6f, 0.48f, 0.28f, 0.6f), new Color(0, 0, 0, 0), false);
            ChipTex = Frame(24, new Color(0.11f, 0.09f, 0.07f, 0.9f), new Color(0.07f, 0.055f, 0.045f, 0.9f), new Color(0.55f, 0.44f, 0.27f, 0.55f), new Color(0, 0, 0, 0), false);
            ChipOnTex = Frame(24, new Color(0.36f, 0.27f, 0.14f, 0.95f), new Color(0.22f, 0.16f, 0.09f, 0.95f), GoldBright, new Color(0, 0, 0, 0), false);
            Vignette = MakeVignette();
            Diamond = MakeDiamond(32);
            Ring = MakeRing(128, 0.86f, 0.98f);
            Disc = MakeRing(128, 0f, 1f);

            Title = Style(CinzelBold, 54, GoldBright, TextAnchor.MiddleCenter);
            H1 = Style(CinzelBold, 30, Gold, TextAnchor.MiddleLeft);
            H2 = Style(CinzelBold, 21, Gold, TextAnchor.MiddleLeft);
            Body = Style(Cormorant, 22, Text, TextAnchor.UpperLeft); Body.wordWrap = true; Body.richText = true;
            BodyBold = Style(CormorantBold, 22, Text, TextAnchor.UpperLeft); BodyBold.wordWrap = true; BodyBold.richText = true;
            Small = Style(Cormorant, 17, Muted, TextAnchor.UpperLeft); Small.wordWrap = true; Small.richText = true;
            Caps = Style(Cinzel, 14, Muted, TextAnchor.MiddleLeft);
            Center = Style(Cormorant, 22, Text, TextAnchor.MiddleCenter); Center.wordWrap = true; Center.richText = true;
            Key = Style(CinzelBold, 15, Bg, TextAnchor.MiddleCenter);

            Button = Btn(ButtonTex, ButtonHover, ButtonDown, Text, GoldBright, CinzelBold, 16);
            ButtonPrimary = Btn(PrimaryTex, PrimaryHover, ButtonTex, Hex("#1a1209"), Hex("#120c06"), CinzelBold, 19);
            ButtonGhost = Btn(null, null, null, Muted, GoldBright, Cormorant, 19);
            ButtonGhost.alignment = TextAnchor.MiddleLeft;
            Chip = Btn(ChipTex, ButtonHover, ButtonDown, Muted, Text, Cinzel, 14);
            ChipOn = Btn(ChipOnTex, ChipOnTex, ChipOnTex, GoldBright, GoldBright, CinzelBold, 14);
            Field = new GUIStyle(GUI.skin.textField)
            {
                font = Cormorant, fontSize = 22, padding = new RectOffset(14, 14, 8, 8), border = new RectOffset(8, 8, 8, 8),
                normal = { background = FieldTex, textColor = Text }, focused = { background = FieldTex, textColor = GoldBright },
                hover = { background = FieldTex, textColor = Text }, active = { background = FieldTex, textColor = Text },
                onNormal = { background = FieldTex, textColor = Text }, onFocused = { background = FieldTex, textColor = GoldBright },
            };
            PanelStyle = new GUIStyle { normal = { background = PanelTex }, border = new RectOffset(16, 16, 16, 16) };

            var slider = GUI.skin.horizontalSlider;
            slider.normal.background = Solid(new Color(0.35f, 0.28f, 0.18f, 0.9f));
            slider.fixedHeight = 4;
            slider.margin = new RectOffset(4, 4, 12, 12);
            var thumb = GUI.skin.horizontalSliderThumb;
            thumb.normal.background = Diamond; thumb.hover.background = Diamond; thumb.active.background = Diamond;
            thumb.fixedWidth = 18; thumb.fixedHeight = 18;
            thumb.margin = new RectOffset(0, 0, -7, 0);
        }

        static GUIStyle Style(Font f, int size, Color c, TextAnchor a) => new GUIStyle(GUI.skin.label) { font = f, fontSize = size, alignment = a, normal = { textColor = c }, padding = new RectOffset(0, 0, 0, 0), margin = new RectOffset(0, 0, 0, 0) };

        static GUIStyle Btn(Texture2D n, Texture2D h, Texture2D a, Color text, Color hoverText, Font f, int size)
        {
            var s = new GUIStyle(GUI.skin.button)
            {
                font = f, fontSize = size, alignment = TextAnchor.MiddleCenter, border = new RectOffset(10, 10, 10, 10),
                padding = new RectOffset(14, 14, 6, 6), margin = new RectOffset(4, 4, 4, 4),
                normal = { background = n, textColor = text }, hover = { background = h, textColor = hoverText },
                active = { background = a, textColor = hoverText }, focused = { background = n, textColor = text },
            };
            if (n == null) { s.normal.background = null; s.hover.background = null; s.active.background = null; s.focused.background = null; }
            return s;
        }

        static Texture2D Solid(Color c)
        {
            var t = new Texture2D(1, 1) { hideFlags = HideFlags.DontSave };
            t.SetPixel(0, 0, c);
            t.Apply();
            return t;
        }

        /// <summary>Rám: svislý přechod výplně, zlatá linka, vnitřní tenká linka a kosočtverečné rohy.</summary>
        static Texture2D Frame(int size, Color top, Color bottom, Color border, Color inner, bool corners)
        {
            var t = new Texture2D(size, size, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear, hideFlags = HideFlags.DontSave };
            for (int y = 0; y < size; y++)
            for (int x = 0; x < size; x++)
            {
                var c = Color.Lerp(bottom, top, y / (float)(size - 1));
                int d = Mathf.Min(Mathf.Min(x, y), Mathf.Min(size - 1 - x, size - 1 - y));
                if (d == 0) c = Color.Lerp(c, border, border.a);
                else if (d == 1) c = Color.Lerp(c, new Color(0, 0, 0, c.a), 0.5f);
                else if (d == 4 && inner.a > 0) c = Color.Lerp(c, inner, inner.a);
                if (corners)
                {
                    // kosočtverce v rozích
                    foreach (var (cx, cy) in new[] { (0, 0), (size - 1, 0), (0, size - 1), (size - 1, size - 1) })
                        if (Mathf.Abs(x - cx) + Mathf.Abs(y - cy) <= 4) c = border;
                }
                c.a = Mathf.Max(c.a, d == 0 ? border.a : c.a);
                t.SetPixel(x, y, c);
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeVignette()
        {
            int s = 128;
            var t = new Texture2D(s, s, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, hideFlags = HideFlags.DontSave };
            for (int y = 0; y < s; y++)
            for (int x = 0; x < s; x++)
            {
                float dx = (x / (float)(s - 1) - 0.5f) * 2, dy = (y / (float)(s - 1) - 0.5f) * 2;
                float d = Mathf.Clamp01(Mathf.Sqrt(dx * dx * 0.8f + dy * dy) - 0.35f);
                t.SetPixel(x, y, new Color(0.02f, 0.015f, 0.01f, Mathf.SmoothStep(0, 0.92f, d)));
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeDiamond(int s)
        {
            var t = new Texture2D(s, s, TextureFormat.RGBA32, false) { hideFlags = HideFlags.DontSave };
            float h = (s - 1) / 2f;
            for (int y = 0; y < s; y++)
            for (int x = 0; x < s; x++)
            {
                float d = (Mathf.Abs(x - h) + Mathf.Abs(y - h)) / h;
                var c = Color.Lerp(GoldBright, Gold * 0.8f, d);
                c.a = Mathf.Clamp01((1 - d) * 6);
                t.SetPixel(x, y, c);
            }
            t.Apply();
            return t;
        }

        static Texture2D MakeRing(int s, float inner, float outer)
        {
            var t = new Texture2D(s, s, TextureFormat.RGBA32, false) { hideFlags = HideFlags.DontSave };
            float h = (s - 1) / 2f;
            for (int y = 0; y < s; y++)
            for (int x = 0; x < s; x++)
            {
                float d = Mathf.Sqrt((x - h) * (x - h) + (y - h) * (y - h)) / h;
                float a = Mathf.Clamp01((d - inner) * s / 2) * Mathf.Clamp01((outer - d) * s / 2);
                t.SetPixel(x, y, new Color(1, 1, 1, a));
            }
            t.Apply();
            return t;
        }

        // ------------------------------------------------------------------ kreslení
        public static void Fill(Rect r, Color c)
        {
            var prev = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(r, White);
            GUI.color = prev;
        }

        /// <summary>Panel se zlatým rámem; volitelně nadpis s ozdobnou linkou.</summary>
        public static Rect DrawPanel(Rect r, string title = null)
        {
            GUI.Box(r, GUIContent.none, PanelStyle);
            if (string.IsNullOrEmpty(title)) return new Rect(r.x + 24, r.y + 20, r.width - 48, r.height - 40);
            GUI.Label(new Rect(r.x + 26, r.y + 16, r.width - 52, 40), title.ToUpperInvariant(), H1);
            Ornament(new Rect(r.x + 26, r.y + 60, r.width - 52, 10));
            return new Rect(r.x + 26, r.y + 80, r.width - 52, r.height - 100);
        }

        /// <summary>Zlatá linka s kosočtvercem uprostřed.</summary>
        public static void Ornament(Rect r)
        {
            float y = r.y + r.height / 2;
            Fill(new Rect(r.x, y, r.width / 2 - 10, 1), Line);
            Fill(new Rect(r.x + r.width / 2 + 10, y, r.width / 2 - 10, 1), Line);
            GUI.DrawTexture(new Rect(r.x + r.width / 2 - 6, y - 6, 12, 12), Diamond);
        }

        public static void DiamondAt(Vector2 c, float size, Color tint)
        {
            var prev = GUI.color;
            GUI.color = tint;
            GUI.DrawTexture(new Rect(c.x - size / 2, c.y - size / 2, size, size), Diamond);
            GUI.color = prev;
        }

        /// <summary>Ukazatel (zdraví, zkušenosti) se zlatým rámem a textem.</summary>
        public static void Bar(Rect r, float v, Color c, string label)
        {
            Fill(r, new Color(0, 0, 0, 0.75f));
            Fill(new Rect(r.x + 2, r.y + 2, (r.width - 4) * Mathf.Clamp01(v), r.height - 4), c * 0.85f);
            Fill(new Rect(r.x + 2, r.y + 2, (r.width - 4) * Mathf.Clamp01(v), (r.height - 4) * 0.45f), new Color(1, 1, 1, 0.12f));
            Fill(new Rect(r.x, r.y, r.width, 1), LineStrong);
            Fill(new Rect(r.x, r.yMax - 1, r.width, 1), LineStrong);
            Fill(new Rect(r.x, r.y, 1, r.height), LineStrong);
            Fill(new Rect(r.xMax - 1, r.y, 1, r.height), LineStrong);
            if (!string.IsNullOrEmpty(label)) Shadowed(r, label, new GUIStyle(Center) { fontSize = Mathf.RoundToInt(r.height * 0.62f), font = CormorantBold });
        }

        /// <summary>Text se stínem (čitelný i na světlém pozadí).</summary>
        public static void Shadowed(Rect r, string text, GUIStyle style)
        {
            var c = style.normal.textColor;
            style.normal.textColor = new Color(0, 0, 0, 0.85f * c.a);
            GUI.Label(new Rect(r.x + 1.5f, r.y + 1.5f, r.width, r.height), text, style);
            style.normal.textColor = c;
            GUI.Label(r, text, style);
        }

        /// <summary>Klávesa jako zlatá „krytka“ (např. [E]).</summary>
        public static void KeyCap(Rect r, string key)
        {
            GUI.DrawTexture(r, PrimaryTex);
            GUI.Label(r, key, Key);
        }

        /// <summary>Obrázek „cover“ (vyplní obdélník, ořízne přesah).</summary>
        public static void Cover(Rect r, Texture tex)
        {
            if (tex == null) { Fill(r, Bg); return; }
            float ta = tex.width / (float)tex.height, ra = r.width / r.height;
            Rect uv = ta > ra ? new Rect((1 - ra / ta) / 2, 0, ra / ta, 1) : new Rect(0, (1 - ta / ra) / 2, 1, ta / ra);
            GUI.DrawTextureWithTexCoords(r, tex, uv);
        }

        /// <summary>Kulatý portrét se zlatým prstencem.</summary>
        public static void Portrait(Rect r, Texture tex)
        {
            Fill(new Rect(r.x + 4, r.y + 4, r.width - 8, r.height - 8), new Color(0, 0, 0, 0));
            var prev = GUI.color;
            GUI.color = new Color(0.05f, 0.04f, 0.03f, 0.95f);
            GUI.DrawTexture(r, Disc);
            GUI.color = prev;
            if (tex != null) GUI.DrawTexture(new Rect(r.x + r.width * 0.08f, r.y + r.height * 0.08f, r.width * 0.84f, r.height * 0.84f), tex, ScaleMode.ScaleAndCrop);
            GUI.color = Gold;
            GUI.DrawTexture(r, Ring);
            GUI.color = prev;
        }

        public static Texture2D PortraitFor(string cls, string gender)
        {
            if (cls != "lucistnik" && cls != "vestec") cls = "hoplit";
            return Resources.Load<Texture2D>($"UI/portrait_{cls}_{(gender == "f" ? "f" : "m")}");
        }

        public static bool Toggle(bool on, string text, params GUILayoutOption[] o) => GUILayout.Button(text, on ? ChipOn : Chip, o) && !on;

        public static string ClassName(string c) => c == "lucistnik" ? "Lučištník" : c == "vestec" ? "Věštec ohně" : "Štítonoš";
        public static string FactionName(string f) => f == "legie" ? "Legie Rudého slunce" : "Obránci Kalidry";
    }
}

using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Minimapa vpravo nahoře (výřez kolem hráče) a velká mapa na klávesu M.
    /// Mapa se vykreslí jednou z výškové funkce světa (stejné barvy jako terén).
    /// </summary>
    public class Minimap : MonoBehaviour
    {
        public GameBootstrap boot;
        // web x -135 … 135, z -135 … 345 (s jižním dílem)
        const float X0 = WorldMap.MinX, X1 = WorldMap.MaxX, Z0 = WorldMap.MinZ, Z1 = WorldMap.MaxZ;
        const int ResY = 640;
        static readonly int ResX = Mathf.RoundToInt(ResY * (X1 - X0) / (Z1 - Z0));
        static float Aspect => (X1 - X0) / (Z1 - Z0);
        Texture2D map, dot;
        bool big;

        void Update()
        {
            if (boot.inWorld && !Chat.Typing && KeyBinds.Down("map")) big = !big;
        }

        void Build()
        {
            map = new Texture2D(ResX, ResY, TextureFormat.RGB24, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[ResX * ResY];
            for (int iy = 0; iy < ResY; iy++)
            for (int ix = 0; ix < ResX; ix++)
            {
                // obrázek: nahoře sever (web z záporné → Unity +Z), x doprava; řádek iy = 0 je nahoře
                float x = X0 + ix / (float)(ResX - 1) * (X1 - X0);
                float z = Z0 + iy / (float)(ResY - 1) * (Z1 - Z0);
                float h = WorldMap.HeightAt(x, z);
                Color c;
                if (h < 0) c = Color.Lerp(new Color(0.12f, 0.27f, 0.33f), new Color(0.05f, 0.13f, 0.19f), Mathf.Clamp01(-h / 6));
                else if (WorldMap.InCity(x, z)) c = new Color(0.72f, 0.67f, 0.58f);
                else if (WorldMap.RoadDistance(x, z) < 1.6f) c = new Color(0.55f, 0.45f, 0.31f);
                else if (h < 1.1f) c = new Color(0.78f, 0.69f, 0.52f);
                else if (h > 9) c = Color.Lerp(new Color(0.45f, 0.43f, 0.39f), new Color(0.75f, 0.73f, 0.7f), Mathf.Clamp01((h - 9) / 12));
                else c = Color.Lerp(new Color(0.33f, 0.4f, 0.19f), new Color(0.5f, 0.45f, 0.28f), Mathf.Clamp01((h - 1) / 8));
                if (z > 100 && h >= 1.1f)
                {
                    // jih: vysychající břeh, rudé útesy, pouštní písek, oáza
                    float arid = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(104, 200, z));
                    var desert = Color.Lerp(new Color(0.8f, 0.6f, 0.38f), new Color(0.86f, 0.68f, 0.45f), Mathf.Clamp01((h - 1) / 6));
                    if (h > 9) desert = Color.Lerp(new Color(0.58f, 0.34f, 0.24f), new Color(0.72f, 0.46f, 0.32f), Mathf.Clamp01((h - 9) / 20));
                    c = Color.Lerp(c, desert, h > 9 ? Mathf.Max(arid, Mathf.InverseLerp(126, 140, z)) : arid);
                    if (Vector2.Distance(new Vector2(x, z), WorldMap.Oasis) < WorldMap.OasisR) c = new Color(0.12f, 0.36f, 0.4f);
                    else if (Vector2.Distance(new Vector2(x, z), WorldMap.Oasis) < WorldMap.OasisR + 6) c = new Color(0.38f, 0.46f, 0.22f);
                }
                float shade = 0.85f + Mathf.Clamp(WorldMap.HeightAt(x - 1, z - 1) - h, -1, 1) * 0.15f;
                px[(ResY - 1 - iy) * ResX + ix] = c * shade;
            }
            map.SetPixels32(px);
            map.Apply();
            dot = new Texture2D(1, 1);
            dot.SetPixel(0, 0, Color.white);
            dot.Apply();
        }

        Vector2 ToUv(Vector2 web) => new Vector2((web.x - X0) / (X1 - X0), (Z1 - web.y) / (Z1 - Z0));

        void OnGUI()
        {
            if (Event.current.type != EventType.Repaint) return;
            if (!boot.inWorld || boot.player == null) return;
            if (map == null) Build();
            EryonSkin.Begin();
            float W = EryonSkin.W, H = EryonSkin.H;
            var pw = WorldMap.ToWeb(boot.player.transform.position);
            DrawRegionBanner(RegionName(pw), W, H);
            if (big)
            {
                EryonSkin.Fill(new Rect(0, 0, W, H), new Color(0, 0, 0, 0.6f));
                float mh = H - 180, mw = mh * Aspect;
                if (mw > W - 120) { mw = W - 120; mh = mw / Aspect; }
                var outer = new Rect((W - mw) / 2 - 16, (H - mh) / 2 - 56, mw + 32, mh + 88);
                GUI.Box(outer, GUIContent.none, EryonSkin.PanelStyle);
                GUI.Label(new Rect(outer.x, outer.y + 8, outer.width, 36), "POBŘEŽÍ KALIDRY", new GUIStyle(EryonSkin.H1) { alignment = TextAnchor.MiddleCenter, fontSize = 24 });
                var r = new Rect((W - mw) / 2, (H - mh) / 2, mw, mh);
                float s = mw;
                GUI.DrawTexture(r, map);
                Border(r);
                DrawMarks(r, new Rect(0, 0, 1, 1), true);
                GUI.Label(new Rect(r.x, r.yMax + 4, s, 26), "M – zavřít mapu", new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleCenter });
                return;
            }
            float size = 250;
            var rect = new Rect(W - size - 24, 24, size, size);
            // výřez ~81 × 81 m kolem hráče
            float zx = 81f / (X1 - X0), zy = 81f / (Z1 - Z0);
            var uv = ToUv(pw);
            var src = new Rect(uv.x - zx / 2, uv.y - zy / 2, zx, zy);
            EryonSkin.Fill(new Rect(rect.x - 6, rect.y - 6, size + 12, size + 12), new Color(0.04f, 0.03f, 0.02f, 0.9f));
            GUI.DrawTextureWithTexCoords(rect, map, src);
            DrawMarks(rect, src, false);
            Border(rect);
            // světové strany
            var cs = new GUIStyle(EryonSkin.Key) { fontSize = 13 };
            EryonSkin.DiamondAt(new Vector2(rect.center.x, rect.y - 2), 24, Color.white);
            GUI.Label(new Rect(rect.center.x - 12, rect.y - 14, 24, 24), "S", cs);
            GUI.Label(new Rect(rect.x, rect.yMax + 8, size, 22), RegionName(pw), new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleCenter, fontSize = 15, normal = { textColor = EryonSkin.GoldBright } });
            if (DayNight.Instance != null)
                GUI.Label(new Rect(rect.x - 20, rect.yMax + 28, size + 40, 20), DayNight.Instance.ClockText() + (WorldPresence.PingMs > 0 ? $"   ·   odezva {WorldPresence.PingMs} ms" : ""),
                    new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleCenter, fontSize = 14, wordWrap = false });
        }

        // ---------------------------------------------------------------- název oblasti při vstupu (jih, verše z písní)
        static readonly System.Collections.Generic.Dictionary<string, string> Verses = new System.Collections.Generic.Dictionary<string, string>
        {
            ["Solný průsmyk"] = "„Třetí den jsme stáli v průsmyku, vítr nesl sůl a dým.“",
            ["Rudé útesy"] = "„Za městem se kopce zvedly, v dálce rudě hořel kraj.“",
            ["Solné pobřeží"] = "„Moře si pamatuje. Kámen si pamatuje.“",
            ["Rudé písky"] = "„Krev mizí v písku, však jméno zůstává.“",
            ["Ruiny Starého slunce"] = "„A tam, kde kdysi stál poslední štít, dodnes vítr nese jeho jméno.“",
            ["Oáza Posledního doušku"] = "„Jen podaly chléb a vodu a řekly tiše: Jděte dál.“",
        };
        string lastRegion, bannerTitle, bannerVerse;
        float bannerAt = -100;
        readonly System.Collections.Generic.HashSet<string> seenRegions = new System.Collections.Generic.HashSet<string>();

        void DrawRegionBanner(string region, float W, float H)
        {
            if (region != lastRegion)
            {
                lastRegion = region;
                // jen nové jižní oblasti, každá jednou za hru (ať to neruší při přecházení sem a tam)
                if (Verses.TryGetValue(region, out var verse) && seenRegions.Add(region))
                {
                    bannerTitle = region; bannerVerse = verse; bannerAt = Time.time;
                }
            }
            float t = Time.time - bannerAt;
            if (t > 6 || bannerTitle == null) return;
            float a = Mathf.Clamp01(t / 0.8f) * Mathf.Clamp01((6 - t) / 1.2f);
            var ts = new GUIStyle(EryonSkin.Center) { font = EryonSkin.CinzelBold, fontSize = 46, normal = { textColor = new Color(1f, 0.86f, 0.55f, a) } };
            var vs = new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 24, wordWrap = true, normal = { textColor = new Color(0.95f, 0.9f, 0.8f, a) } };
            EryonSkin.Shadowed(new Rect(0, H * 0.2f, W, 60), bannerTitle.ToUpperInvariant(), ts);
            EryonSkin.Shadowed(new Rect(W * 0.2f, H * 0.2f + 62, W * 0.6f, 60), bannerVerse, vs);
        }

        static void Border(Rect r)
        {
            EryonSkin.Fill(new Rect(r.x - 2, r.y - 2, r.width + 4, 2), EryonSkin.LineStrong);
            EryonSkin.Fill(new Rect(r.x - 2, r.yMax, r.width + 4, 2), EryonSkin.LineStrong);
            EryonSkin.Fill(new Rect(r.x - 2, r.y - 2, 2, r.height + 4), EryonSkin.LineStrong);
            EryonSkin.Fill(new Rect(r.xMax, r.y - 2, 2, r.height + 4), EryonSkin.LineStrong);
            foreach (var c in new[] { new Vector2(r.x, r.y), new Vector2(r.xMax, r.y), new Vector2(r.x, r.yMax), new Vector2(r.xMax, r.yMax) })
                EryonSkin.DiamondAt(c, 14, Color.white);
        }

        /// <summary>Název oblasti podle polohy (zjednodušeně podle webové mapy).</summary>
        public static string RegionName(Vector2 p)
        {
            if (WorldMap.InCity(p.x, p.y)) return "Kalidra";
            if (p.y > 118)
            {
                if (Vector2.Distance(p, WorldMap.Oasis) < WorldMap.OasisR + 16) return "Oáza Posledního doušku";
                if (Vector2.Distance(p, WorldMap.Ruins) < 22) return "Ruiny Starého slunce";
                if (WorldMap.PathDistance(p.x, p.y, WorldMap.CanyonPath) < 12) return "Solný průsmyk";
                if (p.y > 206) return "Rudé písky";
                if (p.x < -44) return "Solné pobřeží";
                if (p.y > 134) return "Rudé útesy";
            }
            if (Vector2.Distance(p, new Vector2(60, -68)) < 22) return "Tábor Legie";
            if (Vector2.Distance(p, new Vector2(-64, -74)) < 30) return "Zátoka černých plachet";
            if (p.y < -30) return "Kopce strážních ohňů";
            if (p.x < -40 && p.y > 26) return "Bezejmenný břeh";
            if (p.x < 0 && p.y > -26) return "Akvadukt";
            return "Pláň před branou";
        }

        void DrawMarks(Rect r, Rect view, bool names)
        {
            // view: viditelná část mapy v souřadnicích uv (0…1, y nahoru = sever)
            Vector2 ToScreen(Vector2 web, out bool inside)
            {
                var uv = ToUv(web);
                float fx = (uv.x - view.x) / view.width, fy = (uv.y - view.y) / view.height;
                inside = fx >= 0 && fx <= 1 && fy >= 0 && fy <= 1;
                return new Vector2(r.x + fx * r.width, r.y + (1 - fy) * r.height);
            }
            string faction = boot.state?.character?.faction ?? "kalidra";
            foreach (var n in WorldMap.Npcs)
            {
                if (n.faction != faction) continue;
                var p = ToScreen(new Vector2(n.x, n.z), out bool ok);
                if (!ok) continue;
                var mark = NpcDialog.Marker(n.id);
                GUI.color = mark != null ? new Color(1f, 0.8f, 0.2f) : new Color(0.95f, 0.92f, 0.85f);
                float s = mark != null ? 9 : 6;
                GUI.DrawTexture(new Rect(p.x - s / 2, p.y - s / 2, s, s), dot);
                if (names) EryonSkin.Shadowed(new Rect(p.x - 80, p.y + 4, 160, 22), n.name, new GUIStyle(EryonSkin.Center) { fontSize = 16, font = EryonSkin.CormorantBold });
            }
            // cíle aktivních úkolů (nepřátelé, vatry, památník) – červené značky
            if (Encounters.Instance != null)
                foreach (var t in Encounters.Instance.QuestTargets())
                {
                    var tp = ToScreen(t, out bool okT);
                    if (!okT) continue;
                    GUI.color = new Color(1f, 0.35f, 0.25f, 0.85f + 0.15f * Mathf.Sin(Time.time * 4));
                    GUI.DrawTexture(new Rect(tp.x - 4, tp.y - 4, 8, 8), dot);
                }
            // světový boss
            var wb = WorldBoss.Instance;
            if (wb != null && (wb.state == null || wb.state.alive))
            {
                var bp = ToScreen(WorldBoss.Spot, out bool okB);
                if (okB)
                {
                    GUI.color = new Color(1f, 0.25f, 0.2f);
                    GUI.DrawTexture(new Rect(bp.x - 7, bp.y - 7, 14, 14), dot);
                    if (names) EryonSkin.Shadowed(new Rect(bp.x - 90, bp.y + 6, 180, 22), "Thalassos", new GUIStyle(EryonSkin.Center) { fontSize = 16, font = EryonSkin.CormorantBold });
                }
            }
            // stadion (start) a během závodu další méta
            if (Race.Instance != null && Race.Instance.StartSpot.HasValue)
            {
                var rs = Race.Instance.Running && Race.Instance.Target.HasValue ? WorldMap.ToWeb(Race.Instance.Target.Value) : Race.Instance.StartSpot.Value;
                var sp = ToScreen(rs, out bool okS);
                if (okS)
                {
                    GUI.color = new Color(0.95f, 0.92f, 0.82f);
                    GUI.DrawTexture(new Rect(sp.x - 5, sp.y - 5, 10, 10), dot);
                    if (names && !Race.Instance.Running) EryonSkin.Shadowed(new Rect(sp.x - 90, sp.y + 5, 180, 22), "Stadion", new GUIStyle(EryonSkin.Center) { fontSize = 15, font = EryonSkin.CormorantBold });
                }
            }
            var pw = WorldMap.ToWeb(boot.player.transform.position);
            var pp = ToScreen(pw, out _);
            GUI.color = new Color(0.4f, 0.85f, 1f);
            GUI.DrawTexture(new Rect(pp.x - 5, pp.y - 5, 10, 10), dot);
            // směr pohledu
            var fwd = boot.player.transform.forward;
            var tip = pp + new Vector2(fwd.x, -fwd.z) * 12;
            GUI.DrawTexture(new Rect(tip.x - 2.5f, tip.y - 2.5f, 5, 5), dot);
            GUI.color = Color.white;
        }
    }
}

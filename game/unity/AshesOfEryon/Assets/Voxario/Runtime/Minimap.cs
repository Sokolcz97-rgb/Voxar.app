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
        const int Res = 512;
        const float Half = 135f; // web souřadnice -135 … 135
        Texture2D map, dot;
        bool big;
        GUIStyle label;

        void Update()
        {
            if (boot.inWorld && Input.GetKeyDown(KeyCode.M)) big = !big;
        }

        void Build()
        {
            map = new Texture2D(Res, Res, TextureFormat.RGB24, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            var px = new Color32[Res * Res];
            for (int iy = 0; iy < Res; iy++)
            for (int ix = 0; ix < Res; ix++)
            {
                // obrázek: nahoře sever (web z záporné → Unity +Z), x doprava
                float x = -Half + ix / (float)(Res - 1) * Half * 2;
                float z = Half - iy / (float)(Res - 1) * Half * 2;
                z = -z;
                float h = WorldMap.HeightAt(x, z);
                Color c;
                if (h < 0) c = Color.Lerp(new Color(0.12f, 0.27f, 0.33f), new Color(0.05f, 0.13f, 0.19f), Mathf.Clamp01(-h / 6));
                else if (WorldMap.InCity(x, z)) c = new Color(0.72f, 0.67f, 0.58f);
                else if (WorldMap.RoadDistance(x, z) < 1.6f) c = new Color(0.55f, 0.45f, 0.31f);
                else if (h < 1.1f) c = new Color(0.78f, 0.69f, 0.52f);
                else if (h > 9) c = Color.Lerp(new Color(0.45f, 0.43f, 0.39f), new Color(0.75f, 0.73f, 0.7f), Mathf.Clamp01((h - 9) / 12));
                else c = Color.Lerp(new Color(0.33f, 0.4f, 0.19f), new Color(0.5f, 0.45f, 0.28f), Mathf.Clamp01((h - 1) / 8));
                float shade = 0.85f + Mathf.Clamp(WorldMap.HeightAt(x - 1, z - 1) - h, -1, 1) * 0.15f;
                px[(Res - 1 - iy) * Res + ix] = c * shade;
            }
            map.SetPixels32(px);
            map.Apply();
            dot = new Texture2D(1, 1);
            dot.SetPixel(0, 0, Color.white);
            dot.Apply();
            label = new GUIStyle(GUI.skin.label) { fontSize = 11, alignment = TextAnchor.MiddleCenter, normal = { textColor = Color.white } };
        }

        Vector2 ToUv(Vector2 web) => new Vector2((web.x + Half) / (Half * 2), (-web.y + Half) / (Half * 2));

        void OnGUI()
        {
            if (!boot.inWorld || boot.player == null) return;
            if (map == null) Build();
            var pw = WorldMap.ToWeb(boot.player.transform.position);
            if (big)
            {
                float s = Mathf.Min(Screen.width, Screen.height) - 120;
                var r = new Rect((Screen.width - s) / 2, (Screen.height - s) / 2, s, s);
                GUI.DrawTexture(r, map);
                DrawMarks(r, new Rect(0, 0, 1, 1), true);
                GUI.Label(new Rect(r.x, r.yMax + 4, s, 20), "Mapa světa · M zavřít", label);
                return;
            }
            float size = 190;
            var rect = new Rect(Screen.width - size - 14, 14, size, size);
            float zoom = 0.28f; // podíl mapy ve výřezu
            var uv = ToUv(pw);
            var src = new Rect(uv.x - zoom / 2, uv.y - zoom / 2, zoom, zoom);
            GUI.color = new Color(0, 0, 0, 0.6f);
            GUI.DrawTexture(new Rect(rect.x - 3, rect.y - 3, size + 6, size + 6), dot);
            GUI.color = Color.white;
            GUI.DrawTextureWithTexCoords(rect, map, src);
            DrawMarks(rect, src, false);
            GUI.Label(new Rect(rect.x, rect.yMax + 2, size, 18), "M – velká mapa", label);
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
                if (names) GUI.Label(new Rect(p.x - 60, p.y + 4, 120, 16), n.name, label);
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

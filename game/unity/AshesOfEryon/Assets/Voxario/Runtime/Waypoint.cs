using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Ukazatel cíle: zlatý kosočtverec ukazuje směr a vzdálenost k nejbližšímu cíli úkolu
    /// (odevzdání u NPC, cíl aktivního úkolu, nový úkol). Mimo obrazovku stojí u jejího okraje.
    /// Klávesa H ho skryje spolu s rádcem.
    /// </summary>
    public class Waypoint : MonoBehaviour
    {
        public GameBootstrap boot;
        Vector3? target;
        string label;
        float scanAt;

        void Update()
        {
            if (!boot.inWorld || boot.player == null) { target = null; return; }
            if (Time.time < scanAt) return;
            scanAt = Time.time + 0.5f;
            target = null;
            var p = boot.player.transform.position;
            float best = float.MaxValue;
            void Consider(Vector3 pos, string text, float bias)
            {
                float d = Vector3.Distance(p, pos) * bias;
                if (d < best && Vector3.Distance(p, pos) > 4f) { best = d; target = pos; label = text; }
            }
            // 1) odevzdání a nové úkoly u NPC
            foreach (var n in NpcDialog.Npcs)
            {
                if (n.t == null) continue;
                var mark = NpcDialog.Marker(n.def.id);
                if (mark == "?") Consider(n.t.position, $"{n.def.name} – odevzdat úkol", 0.5f);
                else if (mark == "!") Consider(n.t.position, $"{n.def.name} – nový úkol", 1.6f);
            }
            // 2) cíle aktivních úkolů
            if (Encounters.Instance != null)
                foreach (var t in Encounters.Instance.QuestTargets())
                    Consider(WorldMap.ToWorld(t.x, t.y), "cíl úkolu", 1f);
        }

        void OnGUI()
        {
            if (target == null || !boot.inWorld || PlayerPrefs.GetInt("ui.guide.hidden", 0) == 1) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            if (Encounters.Instance != null && Encounters.Instance.Busy) return;
            var cam = boot.cam;
            if (cam == null) return;
            EryonSkin.Begin();
            float k = EryonSkin.Scale, W = EryonSkin.W, H = EryonSkin.H;
            var world = target.Value + Vector3.up * 2.6f;
            var sp = cam.WorldToScreenPoint(world);
            bool behind = sp.z < 0;
            Vector2 v = new Vector2(sp.x / k, (Screen.height - sp.y) / k);
            if (behind) v = new Vector2(W - v.x, H - v.y);
            float m = 70;
            bool off = behind || v.x < m || v.x > W - m || v.y < m + 150 || v.y > H - m - 60;
            if (off)
            {
                // na okraj obrazovky ve směru cíle
                var c = new Vector2(W / 2, H / 2);
                var dir = (v - c);
                if (dir.sqrMagnitude < 1) dir = Vector2.up;
                dir.Normalize();
                float sx = (W / 2 - m) / Mathf.Max(0.001f, Mathf.Abs(dir.x)), sy = (H / 2 - m - 80) / Mathf.Max(0.001f, Mathf.Abs(dir.y));
                v = c + dir * Mathf.Min(sx, sy);
            }
            float dist = Vector3.Distance(boot.player.transform.position, target.Value);
            float pulse = 1 + Mathf.Sin(Time.time * 4) * 0.08f;
            EryonSkin.DiamondAt(v, 30 * pulse, new Color(1f, 0.82f, 0.4f, 0.95f));
            var st = new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 18, normal = { textColor = EryonSkin.GoldBright } };
            EryonSkin.Shadowed(new Rect(v.x - 160, v.y + 18, 320, 24), $"{label} · {Mathf.RoundToInt(dist)} m", st);
        }
    }
}

using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Jmenovka nad postavou (písmo Cinzel, stín; NPC se značkou úkolu).</summary>
    public class NameTag : MonoBehaviour
    {
        public string title, subtitle;
        public string npcId;
        public bool isPlayer;
        public bool enemy;
        /// <summary>Barva podtitulku (obtížnost nepřítele); alfa 0 = výchozí.</summary>
        public Color subtitleColor = new Color(0, 0, 0, 0);
        public float height = 2.2f;
        static GUIStyle titleStyle, subStyle, markStyle;

        void OnGUI()
        {
            var cam = Camera.main;
            if (cam == null || !cam.enabled) return;
            var world = transform.position + Vector3.up * height;
            float dist = Vector3.Distance(cam.transform.position, world);
            if (dist > (npcId != null ? 45 : enemy ? 35 : 28)) return;
            var sp = cam.WorldToScreenPoint(world);
            if (sp.z < 0) return;
            EryonSkin.Begin();
            float k = EryonSkin.Scale;
            titleStyle ??= new GUIStyle(EryonSkin.Center) { font = EryonSkin.CinzelBold, fontSize = 18 };
            subStyle ??= new GUIStyle(EryonSkin.Center) { font = EryonSkin.Cormorant, fontSize = 16 };
            markStyle ??= new GUIStyle(EryonSkin.Center) { font = EryonSkin.CinzelBold, fontSize = 34 };
            float x = sp.x / k, y = (Screen.height - sp.y) / k;
            float fade = Mathf.Clamp01((45 - dist) / 10f);
            titleStyle.normal.textColor = (isPlayer ? EryonSkin.Sky : enemy ? new Color(1f, 0.45f, 0.36f) : EryonSkin.GoldBright) * new Color(1, 1, 1, fade);
            var sc = subtitleColor.a > 0 ? subtitleColor : new Color(0.86f, 0.8f, 0.72f);
            subStyle.normal.textColor = new Color(sc.r, sc.g, sc.b, fade);
            EryonSkin.Shadowed(new Rect(x - 150, y - 34, 300, 24), title, titleStyle);
            if (!string.IsNullOrEmpty(subtitle)) EryonSkin.Shadowed(new Rect(x - 150, y - 12, 300, 20), subtitle, subStyle);
            if (npcId != null)
            {
                var mark = NpcDialog.Marker(npcId);
                if (mark != null)
                {
                    float bob = Mathf.Sin(Time.time * 3) * 3;
                    EryonSkin.DiamondAt(new Vector2(x, y - 62 + bob), 36, mark == "?" ? EryonSkin.Good : Color.white);
                    markStyle.normal.textColor = new Color(0.1f, 0.07f, 0.04f, fade);
                    GUI.Label(new Rect(x - 18, y - 80 + bob, 36, 36), mark, markStyle);
                }
            }
        }
    }
}

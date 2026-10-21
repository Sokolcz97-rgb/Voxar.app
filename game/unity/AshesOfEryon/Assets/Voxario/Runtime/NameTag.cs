using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Jmenovka nad postavou (jen do vzdálenosti 28 m).</summary>
    public class NameTag : MonoBehaviour
    {
        public string title, subtitle;
        public string npcId;
        public bool isPlayer;
        static GUIStyle titleStyle, subStyle, markStyle, playerStyle;

        void OnGUI()
        {
            var cam = Camera.main;
            if (cam == null) return;
            var world = transform.position + Vector3.up * 2.2f;
            if (Vector3.Distance(cam.transform.position, world) > (npcId != null ? 45 : 28)) return;
            var sp = cam.WorldToScreenPoint(world);
            if (sp.z < 0) return;
            titleStyle ??= new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 15, fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.95f, 0.85f, 0.6f) } };
            subStyle ??= new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 11, normal = { textColor = new Color(0.85f, 0.8f, 0.72f) } };
            markStyle ??= new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 30, fontStyle = FontStyle.Bold, normal = { textColor = new Color(1f, 0.78f, 0.25f) } };
            playerStyle ??= new GUIStyle(titleStyle) { normal = { textColor = new Color(0.7f, 0.9f, 1f) } };
            float x = sp.x, y = Screen.height - sp.y;
            GUI.Label(new Rect(x - 100, y - 30, 200, 20), title, isPlayer ? playerStyle : titleStyle);
            if (!string.IsNullOrEmpty(subtitle)) GUI.Label(new Rect(x - 100, y - 13, 200, 16), subtitle, subStyle);
            if (npcId != null)
            {
                var mark = NpcDialog.Marker(npcId);
                if (mark != null) GUI.Label(new Rect(x - 20, y - 66, 40, 36), mark, markStyle);
            }
        }
    }
}

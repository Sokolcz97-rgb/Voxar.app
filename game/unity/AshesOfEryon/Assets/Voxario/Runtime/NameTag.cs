using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Jmenovka nad postavou (jen do vzdálenosti 28 m).</summary>
    public class NameTag : MonoBehaviour
    {
        public string title, subtitle;
        static GUIStyle titleStyle, subStyle;

        void OnGUI()
        {
            var cam = Camera.main;
            if (cam == null) return;
            var world = transform.position + Vector3.up * 2.2f;
            if (Vector3.Distance(cam.transform.position, world) > 28) return;
            var sp = cam.WorldToScreenPoint(world);
            if (sp.z < 0) return;
            titleStyle ??= new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 15, fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.95f, 0.85f, 0.6f) } };
            subStyle ??= new GUIStyle(GUI.skin.label) { alignment = TextAnchor.MiddleCenter, fontSize = 11, normal = { textColor = new Color(0.85f, 0.8f, 0.72f) } };
            float x = sp.x, y = Screen.height - sp.y;
            GUI.Label(new Rect(x - 100, y - 30, 200, 20), title, titleStyle);
            GUI.Label(new Rect(x - 100, y - 13, 200, 16), subtitle, subStyle);
        }
    }
}

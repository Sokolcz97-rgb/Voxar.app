using System.Collections;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Hlášení chyb a nápadů přímo ze hry (F1). K textu se automaticky přidá verze hry,
    /// poloha, oblast, úroveň postavy a grafika – ať je chyba snadno dohledatelná.
    /// </summary>
    public class Feedback : MonoBehaviour
    {
        public GameBootstrap boot;
        public static Feedback Instance { get; private set; }
        bool open, busy;
        string kind = "bug", text = "", msg;
        bool msgOk;

        public bool IsOpen => open;
        void Awake() => Instance = this;

        void Update()
        {
            if (!boot.inWorld) { open = false; return; }
            if (Input.GetKeyDown(KeyCode.F1) && (open || !Chat.Typing)) { open = !open; msg = null; }
            if (open && Input.GetKeyDown(KeyCode.Escape)) { open = false; UiFocus.MarkClosed(); }
        }

        string Context()
        {
            var p = boot.player != null ? WorldMap.ToWeb(boot.player.transform.position) : Vector2.zero;
            var ch = boot.state?.character;
            return "{" +
                   "\"version\":" + MiniJson.Write(Application.version) +
                   ",\"x\":" + p.x.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) +
                   ",\"z\":" + p.y.ToString("0.0", System.Globalization.CultureInfo.InvariantCulture) +
                   ",\"region\":" + MiniJson.Write(Minimap.RegionName(p)) +
                   ",\"level\":" + (ch?.level ?? 0) +
                   ",\"faction\":" + MiniJson.Write(ch?.faction ?? "") +
                   ",\"gpu\":" + MiniJson.Write(SystemInfo.graphicsDeviceName + " · " + SystemInfo.graphicsDeviceType) +
                   ",\"os\":" + MiniJson.Write(SystemInfo.operatingSystem) +
                   ",\"fps\":" + Mathf.RoundToInt(1f / Mathf.Max(0.001f, Time.smoothDeltaTime)) +
                   "}";
        }

        IEnumerator Send()
        {
            busy = true;
            string err = null;
            string args = "{\"p_kind\":" + MiniJson.Write(kind) + ",\"p_text\":" + MiniJson.Write(text.Trim()) + ",\"p_context\":" + Context() + "}";
            yield return boot.api.Rpc("ashes_feedback_send", args, (j, e) => err = e);
            busy = false;
            if (err != null) { msg = err; msgOk = false; yield break; }
            msg = "Díky! Hlášení dorazilo vývojářům.";
            msgOk = true;
            text = "";
            Sfx.Play("quest", 0.5f);
        }

        void OnGUI()
        {
            if (!open || !boot.inWorld) return;
            EryonSkin.Begin();
            GUI.depth = -14;
            float W = EryonSkin.W, H = EryonSkin.H;
            var r = new Rect(W / 2 - 400, H / 2 - 270, 800, 540);
            var inner = EryonSkin.DrawPanel(r, "Hlášení pro vývojáře");
            GUILayout.BeginArea(inner);
            GUILayout.Label("Narazil jsi na chybu nebo máš nápad? Napiš, co se stalo. Verzi hry, polohu, oblast, úroveň a grafiku přidáme automaticky.", EryonSkin.Small);
            GUILayout.Space(6);
            GUILayout.BeginHorizontal();
            if (EryonSkin.Toggle(kind == "bug", "Chyba", GUILayout.Height(38), GUILayout.Width(180))) kind = "bug";
            if (EryonSkin.Toggle(kind == "idea", "Nápad", GUILayout.Height(38), GUILayout.Width(180))) kind = "idea";
            if (EryonSkin.Toggle(kind == "other", "Jiné", GUILayout.Height(38), GUILayout.Width(180))) kind = "other";
            GUILayout.EndHorizontal();
            GUILayout.Space(8);
            text = GUILayout.TextArea(text, 4000, new GUIStyle(EryonSkin.Field) { wordWrap = true, alignment = TextAnchor.UpperLeft }, GUILayout.Height(250));
            GUILayout.FlexibleSpace();
            if (msg != null) GUILayout.Label($"<color=#{(msgOk ? "8cc06b" : "e0672a")}>{msg}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true });
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Zavřít (Esc)", EryonSkin.Button, GUILayout.Height(46), GUILayout.Width(200))) open = false;
            GUILayout.FlexibleSpace();
            GUI.enabled = !busy && text.Trim().Length >= 5;
            if (GUILayout.Button(busy ? "Odesílám…" : "ODESLAT", EryonSkin.ButtonPrimary, GUILayout.Height(50), GUILayout.Width(260))) StartCoroutine(Send());
            GUI.enabled = true;
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }
    }
}

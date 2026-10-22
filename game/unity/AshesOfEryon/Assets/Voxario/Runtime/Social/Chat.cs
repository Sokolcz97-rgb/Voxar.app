using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Chat (jako v MMORPG): kanál frakce „Svět“ a kanál oddílu. Enter = psát, Tab = přepnout
    /// kanál, /o zpráva = do oddílu, Esc = zrušit. Zprávy drží server (ashes_chat_send /
    /// ashes_chat_recent) – čistí text a hlídá spam; web i Unity sdílí stejné kanály.
    /// </summary>
    public class Chat : MonoBehaviour
    {
        public GameBootstrap boot;
        public static Chat Instance { get; private set; }
        /// <summary>Hráč právě píše – ostatní klávesy (pohyb, E, M…) se ignorují.</summary>
        // psaní do chatu nebo do hlášení (F1) – klávesové zkratky se ignorují
        public static bool Typing => (Instance != null && Instance.typing) || (Feedback.Instance != null && Feedback.Instance.IsOpen);

        class Msg { public long id; public string channel, name, tag, text; public bool mine; public float t; }
        [System.Serializable] class Row { public long id; public string channel, name, tag, text; public bool mine; }
        [System.Serializable] class Rows { public Row[] items; }

        readonly List<Msg> messages = new List<Msg>();
        long lastId;
        float pollAt;
        bool typing, focusField, sending;
        string input = "";
        bool oddilChannel;
        float lastActivity;
        string error;
        float errorUntil;

        void Awake() => Instance = this;

        string WorldChannel => "world:" + (string.IsNullOrEmpty(boot.state?.character?.faction) ? "kalidra" : boot.state.character.faction);
        string OddilChannel => Oddil.Instance != null && Oddil.Instance.MyId != null ? "oddil:" + Oddil.Instance.MyId : null;

        void Update()
        {
            if (!boot.inWorld || !boot.api.SignedIn) { typing = false; return; }
            if (Time.unscaledTime > pollAt && !sending)
            {
                pollAt = Time.unscaledTime + (typing ? 1.5f : 3f);
                StartCoroutine(Poll());
            }
            if (!typing && (Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter)) && !Blocked())
            {
                typing = true;
                focusField = true;
                lastActivity = Time.unscaledTime;
            }
        }

        bool Blocked()
        {
            var ui = boot.GetComponent<GameUI>();
            return (ui != null && ui.SettingsOpen) || (NpcDialog.Instance != null && NpcDialog.Instance.IsOpen) || (Encounters.Instance != null && Encounters.Instance.Busy)
                   || (Feedback.Instance != null && Feedback.Instance.IsOpen);
        }

        IEnumerator Poll()
        {
            string json = null;
            yield return boot.api.Rpc("ashes_chat_recent", $"{{\"p_after\":{lastId}}}", (j, e) => json = j);
            if (string.IsNullOrEmpty(json) || json == "[]" || json == "null") yield break;
            var rows = JsonUtility.FromJson<Rows>("{\"items\":" + json + "}");
            if (rows?.items == null) yield break;
            foreach (var r in rows.items)
            {
                if (r.id <= lastId) continue;
                lastId = r.id;
                Add(new Msg { id = r.id, channel = r.channel, name = r.name, tag = r.tag, text = r.text, mine = r.mine, t = Time.unscaledTime });
                if (!r.mine) ModManager.Fire("chat", r.channel.StartsWith("oddil") ? "oddil" : "svet", r.name, r.text);
            }
        }

        void Add(Msg m)
        {
            messages.Add(m);
            if (messages.Count > 80) messages.RemoveAt(0);
            lastActivity = Time.unscaledTime;
        }

        /// <summary>Pro samotest: ukázkové zprávy.</summary>
        public void TestFill()
        {
            Add(new Msg { channel = "world:kalidra", name = "Nikandros", tag = "ŠTÍT", text = "Kdo jde na vrakaře na břeh?", t = Time.unscaledTime });
            Add(new Msg { channel = "oddil:x", name = "Ariadna", tag = "ŠTÍT", text = "Sraz u kašny na agoře!", t = Time.unscaledTime });
            Add(new Msg { channel = "world:kalidra", name = "Tester", text = "Jdu s vámi.", mine = true, t = Time.unscaledTime });
            System("Vítej v Kalidře. Enter – psát, Tab – kanál.");
            typing = true;
            input = "Vatra na kopci už hoří";
        }

        /// <summary>Systémová zpráva (jen u tebe).</summary>
        public void System(string text) => Add(new Msg { channel = "system", name = "", text = text, t = Time.unscaledTime });

        IEnumerator Send(string text)
        {
            text = text.Trim();
            if (text.Length == 0) yield break;
            string channel = oddilChannel && OddilChannel != null ? OddilChannel : WorldChannel;
            if (text.StartsWith("/o ") || text.StartsWith("/oddil "))
            {
                if (OddilChannel == null) { Error("Nejsi v žádném oddílu."); yield break; }
                channel = OddilChannel;
                text = text.Substring(text.IndexOf(' ') + 1);
            }
            else if (text.StartsWith("/s ") || text.StartsWith("/svet "))
            {
                channel = WorldChannel;
                text = text.Substring(text.IndexOf(' ') + 1);
            }
            sending = true;
            string err = null;
            yield return boot.api.Rpc("ashes_chat_send", "{\"p_channel\":" + MiniJson.Write(channel) + ",\"p_text\":" + MiniJson.Write(text) + "}", (j, e) => err = e);
            sending = false;
            if (err != null) Error(err);
            pollAt = 0;
        }

        void Error(string e) { error = e; errorUntil = Time.unscaledTime + 4; }

        void OnGUI()
        {
            if (!boot.inWorld) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            GUI.depth = 1;
            float H = EryonSkin.H;
            float w = 560, h = 260, x = 18, y = H - 64 - h - 44;
            bool active = typing || Time.unscaledTime - lastActivity < 12;
            float alpha = typing ? 1 : Mathf.Clamp01(1 - (Time.unscaledTime - lastActivity - 10) / 2);
            if (active) EryonSkin.Fill(new Rect(x, y, w, h + (typing ? 44 : 0)), new Color(0.03f, 0.02f, 0.015f, 0.55f * alpha));

            // zprávy odspodu
            var style = new GUIStyle(EryonSkin.Body) { fontSize = 19, richText = true, wordWrap = true };
            float cy = y + h - 6;
            for (int i = messages.Count - 1; i >= 0 && cy > y + 4; i--)
            {
                var m = messages[i];
                float age = Time.unscaledTime - m.t;
                float a = typing ? 1 : Mathf.Clamp01(1 - (age - 14) / 3);
                if (a <= 0) continue;
                string line = Format(m);
                float lh = style.CalcHeight(new GUIContent(line), w - 20);
                cy -= lh;
                if (cy < y + 2) break;
                var prev = GUI.color;
                GUI.color = new Color(1, 1, 1, a);
                EryonSkin.Shadowed(new Rect(x + 10, cy, w - 20, lh), line, style);
                GUI.color = prev;
            }

            if (error != null && Time.unscaledTime < errorUntil)
                GUI.Label(new Rect(x + 10, y - 26, w, 24), $"<color=#e0672a>{error}</color>", new GUIStyle(EryonSkin.Small) { richText = true });

            if (!typing)
            {
                if (active) GUI.Label(new Rect(x + 10, y + h + 4, w, 22), "Enter – psát   ·   Tab – kanál   ·   /o oddíl", new GUIStyle(EryonSkin.Caps) { normal = { textColor = new Color(0.66f, 0.6f, 0.54f, alpha) } });
                return;
            }
            // vstupní řádek
            var e = Event.current;
            if (e.type == EventType.KeyDown)
            {
                if (e.keyCode == KeyCode.Return || e.keyCode == KeyCode.KeypadEnter)
                {
                    if (!sending && input.Trim().Length > 0) StartCoroutine(Send(input));
                    input = "";
                    typing = false;
                    GUI.FocusControl(null);
                    e.Use();
                    return;
                }
                if (e.keyCode == KeyCode.Escape) { typing = false; input = ""; GUI.FocusControl(null); e.Use(); return; }
                if (e.keyCode == KeyCode.Tab) { oddilChannel = !oddilChannel && OddilChannel != null; e.Use(); }
            }
            string chLabel = oddilChannel && OddilChannel != null ? "ODDÍL" : "SVĚT";
            var chipRect = new Rect(x + 6, y + h + 6, 86, 34);
            GUI.Box(chipRect, chLabel, oddilChannel ? EryonSkin.ChipOn : EryonSkin.Chip);
            GUI.SetNextControlName("chat");
            input = GUI.TextField(new Rect(x + 98, y + h + 4, w - 104, 38), input, 200, EryonSkin.Field);
            if (focusField) { GUI.FocusControl("chat"); focusField = false; }
        }

        static string Format(Msg m)
        {
            if (m.channel == "system") return $"<color=#a8998a><i>{Escape(m.text)}</i></color>";
            bool oddil = m.channel != null && m.channel.StartsWith("oddil");
            string tag = string.IsNullOrEmpty(m.tag) ? "" : $"<color=#d2ae68>[{Escape(m.tag)}]</color> ";
            string chan = oddil ? "<color=#8cc06b>[Oddíl]</color> " : "";
            string name = m.mine ? $"<color=#9fd4f0>{Escape(m.name)}</color>" : $"<color=#f0d08a>{Escape(m.name)}</color>";
            string text = oddil ? $"<color=#c9e7b5>{Escape(m.text)}</color>" : Escape(m.text);
            return $"{chan}{tag}{name}: {text}";
        }

        /// <summary>Text od hráčů nesmí obsahovat formátovací značky.</summary>
        static string Escape(string s) => (s ?? "").Replace("<", "‹").Replace(">", "›");
    }
}

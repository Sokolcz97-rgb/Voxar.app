using System.Collections;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Oddíl (klan): založení (od 2. úrovně, 50 zlata), pozvánky, členové a hodnosti
    /// (velitel, setník, člen), odchod. Klávesa O. Pravidla drží server (ashes_oddil_*).
    /// </summary>
    public class Oddil : MonoBehaviour
    {
        public GameBootstrap boot;
        public static Oddil Instance { get; private set; }

        [System.Serializable] public class Member { public string user_id, name, @class, role; public int level; public bool online, me; }
        [System.Serializable] public class Info { public string id, name, tag, motto, faction, role; public Member[] members; }
        [System.Serializable] public class Invite { public string id, name, tag, motto; public int members; }
        [System.Serializable] class Reply { public Info oddil; public Invite[] invites; }

        Info info;
        Invite[] invites = new Invite[0];
        bool open, busy, loaded;
        string newName = "", newTag = "", newMotto = "", inviteName = "", error, ok;
        float refreshAt;
        Vector2 scroll;

        public string MyId => info != null && !string.IsNullOrEmpty(info.id) ? info.id : null;
        public string MyTag => info != null && !string.IsNullOrEmpty(info.tag) ? info.tag : null;
        public bool IsOpen => open;
        bool test;

        /// <summary>Pro samotest: ukázkový oddíl.</summary>
        public void TestOpen()
        {
            test = true;
            open = true;
            info = new Info
            {
                id = "x", name = "Štít Kalidry", tag = "ŠTÍT", motto = "Dokud jeden stojí, Kalidra nepadne.", role = "velitel",
                members = new[]
                {
                    new Member { name = "Tester", @class = "hoplit", level = 3, role = "velitel", online = true, me = true },
                    new Member { name = "Ariadna", @class = "vestec", level = 5, role = "setnik", online = true },
                    new Member { name = "Nikandros", @class = "lucistnik", level = 2, role = "clen", online = false },
                },
            };
        }

        void Awake() => Instance = this;
        public void Close() { open = false; test = false; }

        void Update()
        {
            if (test) return;
            if (!boot.inWorld || !boot.api.SignedIn) { open = false; loaded = false; info = null; return; }
            if (Time.unscaledTime > refreshAt && !busy)
            {
                refreshAt = Time.unscaledTime + (open ? 15 : 60);
                StartCoroutine(Call("ashes_oddil_info", "{}", null));
            }
            if (!Chat.Typing && Input.GetKeyDown(KeyCode.O)) { open = !open; error = ok = null; if (open) refreshAt = 0; }
            if (open && Input.GetKeyDown(KeyCode.Escape)) { open = false; UiFocus.MarkClosed(); }
        }

        IEnumerator Call(string fn, string args, string success)
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc(fn, args, (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { error = err; ok = null; yield break; }
            var r = JsonUtility.FromJson<Reply>(json);
            string before = MyTag;
            info = r?.oddil != null && !string.IsNullOrEmpty(r.oddil.id) ? r.oddil : null;
            invites = r?.invites ?? new Invite[0];
            if (!loaded && invites.Length > 0) Chat.Instance?.System($"Máš pozvánku do oddílu {invites[0].name} – klávesa O.");
            loaded = true;
            if (success != null) { ok = success; error = null; }
            if (before != MyTag) boot.GetComponent<WorldPresence>()?.Retrack();
        }

        static string Q(string s) => MiniJson.Write(s ?? "");

        static string RoleName(string r) => r == "velitel" ? "Velitel" : r == "setnik" ? "Setník" : "Člen";

        void OnGUI()
        {
            if (!open || !boot.inWorld) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            GUI.depth = -10;
            float W = EryonSkin.W, H = EryonSkin.H;
            var r = new Rect(W / 2 - 430, H / 2 - 360, 860, 720);
            var inner = EryonSkin.DrawPanel(r, info != null ? $"Oddíl {info.name}" : "Oddíl");
            GUILayout.BeginArea(inner);
            GUI.enabled = !busy;
            if (info == null) NoOddil(); else Members();
            GUILayout.FlexibleSpace();
            if (error != null) GUILayout.Label($"<color=#e0672a>{error}</color>", EryonSkin.Small);
            if (ok != null) GUILayout.Label($"<color=#8cc06b>{ok}</color>", EryonSkin.Small);
            GUILayout.BeginHorizontal();
            if (info != null && GUILayout.Button("Opustit oddíl", EryonSkin.Button, GUILayout.Height(42), GUILayout.Width(220)))
                StartCoroutine(Call("ashes_oddil_leave", "{}", "Opustil jsi oddíl."));
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("ZAVŘÍT (O)", EryonSkin.ButtonPrimary, GUILayout.Height(46), GUILayout.Width(220))) open = false;
            GUILayout.EndHorizontal();
            GUI.enabled = true;
            GUILayout.EndArea();
        }

        void NoOddil()
        {
            GUILayout.Label("Oddíl je skupina spolubojovníků tvé frakce: společný kanál v chatu, zkratka u jména a velení (velitel, setníci, členové).", EryonSkin.Body);
            if (invites.Length > 0)
            {
                GUILayout.Space(8);
                GUILayout.Label("POZVÁNKY", EryonSkin.H2);
                foreach (var inv in invites)
                {
                    GUILayout.BeginHorizontal();
                    GUILayout.Label($"<b>[{inv.tag}] {inv.name}</b>  <color=#a8998a>{inv.members} členů · {inv.motto}</color>", EryonSkin.Body, GUILayout.Height(40));
                    if (GUILayout.Button("Přijmout", EryonSkin.ButtonPrimary, GUILayout.Width(150), GUILayout.Height(40)))
                        StartCoroutine(Call("ashes_oddil_answer", $"{{\"p_oddil\":{Q(inv.id)},\"p_accept\":true}}", $"Vítej v oddílu {inv.name}!"));
                    if (GUILayout.Button("Odmítnout", EryonSkin.Button, GUILayout.Width(150), GUILayout.Height(40)))
                        StartCoroutine(Call("ashes_oddil_answer", $"{{\"p_oddil\":{Q(inv.id)},\"p_accept\":false}}", "Pozvánka odmítnuta."));
                    GUILayout.EndHorizontal();
                }
            }
            GUILayout.Space(12);
            GUILayout.Label("ZALOŽIT ODDÍL", EryonSkin.H2);
            GUILayout.Label("Od 2. úrovně, stojí 50 zlata. Zkratka 2–5 znaků se zobrazuje u jmen členů.", EryonSkin.Small);
            GUILayout.Label("NÁZEV", EryonSkin.Caps);
            newName = GUILayout.TextField(newName, 24, EryonSkin.Field, GUILayout.Height(42));
            GUILayout.BeginHorizontal();
            GUILayout.BeginVertical(GUILayout.Width(200));
            GUILayout.Label("ZKRATKA", EryonSkin.Caps);
            newTag = GUILayout.TextField(newTag.ToUpperInvariant(), 5, EryonSkin.Field, GUILayout.Height(42));
            GUILayout.EndVertical();
            GUILayout.BeginVertical();
            GUILayout.Label("HESLO ODDÍLU (nepovinné)", EryonSkin.Caps);
            newMotto = GUILayout.TextField(newMotto, 80, EryonSkin.Field, GUILayout.Height(42));
            GUILayout.EndVertical();
            GUILayout.EndHorizontal();
            GUILayout.Space(8);
            if (GUILayout.Button("ZALOŽIT ODDÍL (50 ZLATA)", EryonSkin.ButtonPrimary, GUILayout.Height(48), GUILayout.Width(360)))
                StartCoroutine(Create());
        }

        IEnumerator Create()
        {
            yield return Call("ashes_oddil_create", $"{{\"p_name\":{Q(newName)},\"p_tag\":{Q(newTag)},\"p_motto\":{Q(newMotto)}}}", "Oddíl založen!");
            // odečtené zlato
            if (info != null) yield return boot.api.Rpc("ashes_state", "{}", (j, e) => { if (e == null) { var st = JsonUtility.FromJson<GameState>(j); if (st?.character != null) boot.state = st; } });
        }

        void Members()
        {
            GUILayout.Label($"<color=#d2ae68>[{info.tag}]</color>  {(string.IsNullOrEmpty(info.motto) ? "" : "„" + info.motto + "“")}", new GUIStyle(EryonSkin.Body) { fontSize = 22, fontStyle = FontStyle.Italic });
            GUILayout.Label($"Tvoje hodnost: {RoleName(info.role)}   ·   {info.members?.Length ?? 0} členů   ·   kanál v chatu: Tab nebo /o", EryonSkin.Small);
            GUILayout.Space(8);
            bool leader = info.role == "velitel", officer = info.role == "setnik";
            scroll = GUILayout.BeginScrollView(scroll, GUIStyle.none, GUI.skin.verticalScrollbar, GUILayout.Height(390));
            foreach (var m in info.members ?? new Member[0])
            {
                GUILayout.BeginHorizontal(GUILayout.Height(40));
                var dot = GUILayoutUtility.GetRect(18, 40, GUILayout.Width(18));
                EryonSkin.DiamondAt(new Vector2(dot.x + 9, dot.y + 20), 10, m.online ? EryonSkin.Good : new Color(0.4f, 0.36f, 0.32f));
                GUILayout.Label($"<b>{m.name}</b>{(m.me ? "  <color=#9fd4f0>(ty)</color>" : "")}", EryonSkin.Body, GUILayout.Width(260), GUILayout.Height(40));
                GUILayout.Label($"{EryonSkin.ClassName(m.@class)} · úr. {m.level}", EryonSkin.Small, GUILayout.Width(190), GUILayout.Height(40));
                GUILayout.Label(RoleName(m.role), new GUIStyle(EryonSkin.BodyBold) { normal = { textColor = m.role == "velitel" ? EryonSkin.GoldBright : EryonSkin.Text } }, GUILayout.Width(100), GUILayout.Height(40));
                if (!m.me)
                {
                    if (leader && m.role == "clen" && GUILayout.Button("Povýšit", EryonSkin.Chip, GUILayout.Width(90), GUILayout.Height(34))) Act(m, "promote", $"{m.name} je setník.");
                    if (leader && m.role == "setnik" && GUILayout.Button("Degradovat", EryonSkin.Chip, GUILayout.Width(90), GUILayout.Height(34))) Act(m, "demote", $"{m.name} je člen.");
                    if ((leader || (officer && m.role == "clen")) && GUILayout.Button("Vyloučit", EryonSkin.Chip, GUILayout.Width(90), GUILayout.Height(34))) Act(m, "kick", $"{m.name} byl vyloučen.");
                }
                GUILayout.EndHorizontal();
            }
            GUILayout.EndScrollView();
            if (leader || officer)
            {
                GUILayout.Space(6);
                GUILayout.BeginHorizontal();
                inviteName = GUILayout.TextField(inviteName, 40, EryonSkin.Field, GUILayout.Height(42), GUILayout.Width(360));
                if (GUILayout.Button("Pozvat hráče", EryonSkin.Button, GUILayout.Height(42), GUILayout.Width(200)) && inviteName.Trim().Length > 0)
                {
                    StartCoroutine(Call("ashes_oddil_invite", $"{{\"p_name\":{Q(inviteName.Trim())}}}", $"Pozvánka odeslána: {inviteName.Trim()}"));
                    inviteName = "";
                }
                GUILayout.EndHorizontal();
                GUILayout.Label("Zadej jméno postavy (stejné frakce).", EryonSkin.Small);
            }
        }

        void Act(Member m, string action, string done) => StartCoroutine(Call("ashes_oddil_member", $"{{\"p_user\":{Q(m.user_id)},\"p_action\":{Q(action)}}}", done));
    }
}

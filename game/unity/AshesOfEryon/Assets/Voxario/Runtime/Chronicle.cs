using System;
using System.Collections;
using System.Globalization;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Kronika (klávesa K, nebo hostinský Gorgias / markytánka Sabra): příběhová kampaň
    /// ze serveru – kapitola, výpravy za odvahu (časové mise), boss kapitoly.
    /// Výpravu i bosse vyhodnotí server (ashes_start_quest, ashes_finish_quest,
    /// ashes_fight_boss), souboj se přehraje ve světě přes Encounters.
    /// </summary>
    public class Chronicle : MonoBehaviour
    {
        public GameBootstrap boot;
        public static Chronicle Instance { get; private set; }

        bool open, busy;
        string error;
        GameState seenState;
        TimeSpan serverOffset; // serverový čas − místní čas
        Vector2 scroll;
        bool doneNotified, expeditionSeen;

        public bool IsOpen => open;
        void Awake() => Instance = this;
        public void Open() { open = true; error = null; }
        public void Close() => open = false;
        public void TestOpen() { open = true; }

        static bool TryTime(string s, out DateTimeOffset t) =>
            DateTimeOffset.TryParse(s ?? "", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out t);

        DateTimeOffset ServerNow => DateTimeOffset.UtcNow + serverOffset;

        Expedition Active
        {
            get
            {
                var qs = boot.state?.quests;
                if (qs == null) return null;
                foreach (var q in qs) if (q.state == "active") return q;
                return null;
            }
        }

        /// <summary>Zbývající čas aktivní výpravy (null = žádná výprava).</summary>
        public TimeSpan? Remaining
        {
            get
            {
                var a = Active;
                if (a == null || !TryTime(a.ends_at, out var end)) return null;
                var left = end - ServerNow;
                return left < TimeSpan.Zero ? TimeSpan.Zero : left;
            }
        }

        static string Fmt(TimeSpan t) => t.TotalHours >= 1 ? $"{(int)t.TotalHours}:{t.Minutes:00}:{t.Seconds:00}" : $"{t.Minutes}:{t.Seconds:00}";

        void Update()
        {
            if (!boot.inWorld) { open = false; return; }
            if (boot.state != seenState)
            {
                seenState = boot.state;
                if (TryTime(boot.state?.now, out var sn)) serverOffset = sn - DateTimeOffset.UtcNow;
            }
            // výprava právě skončila → upozornění
            var left = Remaining;
            bool done = left.HasValue && left.Value <= TimeSpan.Zero;
            if (done && !doneNotified && expeditionSeen)
            {
                Sfx.Play("quest");
                ModManager.Fire("expedition", "ready", Active?.title ?? "");
            }
            expeditionSeen = left.HasValue;
            doneNotified = done;
            if (Chat.Typing) return;
            if (Input.GetKeyDown(KeyCode.K)) { if (open) open = false; else Open(); }
            if (open && Input.GetKeyDown(KeyCode.Escape)) { open = false; UiFocus.MarkClosed(); }
        }

        IEnumerator Call(string fn, string args)
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc(fn, args, (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { error = err; yield break; }
            var st = JsonUtility.FromJson<GameState>(json);
            if (st?.character != null) boot.state = st;
            error = null;
            if (fn == "ashes_start_quest") { ModManager.Fire("expedition", "start", Active?.title ?? ""); Sfx.Play("quest", 0.6f); }
        }

        void Fight(string fn, string args, string cls, string label, string note)
        {
            if (Encounters.Instance == null) return;
            open = false;
            Encounters.Instance.StoryNote = note;
            if (fn == "ashes_finish_quest") ModManager.Fire("expedition", "end", label);
            Encounters.Instance.StartStoryFight(fn, args, cls, label, e => { error = e; open = true; });
        }

        // ------------------------------------------------------------------ HUD: odpočet výpravy
        void HudBadge()
        {
            var left = Remaining;
            if (left == null) return;
            float W = EryonSkin.W;
            var r = new Rect(W / 2 - 200, 16, 400, 46);
            GUI.Box(r, GUIContent.none, EryonSkin.PanelStyle);
            string text = left.Value <= TimeSpan.Zero ? "Výprava skončila – otevři Kroniku (K)" : $"Na výpravě · zbývá {Fmt(left.Value)}";
            GUI.Label(r, text, new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 21, normal = { textColor = left.Value <= TimeSpan.Zero ? EryonSkin.GoldBright : EryonSkin.Text } });
        }

        void OnGUI()
        {
            if (!boot.inWorld || boot.state?.character == null) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            bool fighting = Encounters.Instance != null && Encounters.Instance.Busy;
            if (!open) { if (!fighting) HudBadge(); return; }
            GUI.depth = -12;
            float W = EryonSkin.W, H = EryonSkin.H;
            float w = Mathf.Min(1180, W - 60), h = Mathf.Min(800, H - 100);
            var r = new Rect((W - w) / 2, (H - h) / 2, w, h);
            var st = boot.state;
            var ch = st.character;
            var chap = st.chapter;
            var inner = EryonSkin.DrawPanel(r, chap != null && !string.IsNullOrEmpty(chap.title) ? $"Kapitola {chap.n} · {chap.title}" : "Kronika");
            GUILayout.BeginArea(inner);
            GUI.enabled = !busy && !fighting;
            scroll = GUILayout.BeginScrollView(scroll, GUIStyle.none, GUI.skin.verticalScrollbar, GUILayout.Height(inner.height - 64));

            // válka o Kalidru
            if (st.world != null && st.world.wall_max > 0)
            {
                float k = Mathf.Clamp01(st.world.wall / (float)st.world.wall_max);
                GUILayout.Label($"VÁLKA O KALIDRU  ·  hrdinů {st.world.heroes} (Kalidra {st.world.kalidra} · Legie {st.world.legie})", EryonSkin.Caps);
                EryonSkin.Bar(GUILayoutUtility.GetRect(inner.width - 30, 22), k, new Color(0.45f, 0.7f, 0.95f), $"Hradba Kalidry {Mathf.RoundToInt(k * 100)} %  –  " +
                    (ch.faction == "legie" ? "každé tvé vítězství ji boří" : "každé tvé vítězství ji zpevňuje"));
                GUILayout.Space(10);
            }
            if (chap != null && !string.IsNullOrEmpty(chap.intro))
                GUILayout.Label(chap.intro, new GUIStyle(EryonSkin.Body) { fontStyle = FontStyle.Italic, fontSize = 21 });
            GUILayout.Space(8);

            // postup kapitoly a odvaha
            GUILayout.BeginHorizontal();
            GUILayout.BeginVertical(GUILayout.Width(inner.width / 2 - 20));
            GUILayout.Label("POSTUP KAPITOLY", EryonSkin.Caps);
            int need = Mathf.Max(1, chap?.need ?? 1);
            EryonSkin.Bar(GUILayoutUtility.GetRect(inner.width / 2 - 30, 24), Mathf.Clamp01(ch.chapter_progress / (float)need), EryonSkin.Gold, $"{Mathf.Min(ch.chapter_progress, need)} / {need} výprav");
            GUILayout.EndVertical();
            GUILayout.Space(20);
            GUILayout.BeginVertical();
            GUILayout.Label("ODVAHA (obnoví se každé ráno)", EryonSkin.Caps);
            EryonSkin.Bar(GUILayoutUtility.GetRect(inner.width / 2 - 40, 24), Mathf.Clamp01(ch.courage / 100f), EryonSkin.Ember, $"{ch.courage} / 100");
            GUILayout.EndVertical();
            GUILayout.EndHorizontal();
            GUILayout.Space(14);

            var act = Active;
            if (act != null)
            {
                // probíhající výprava
                GUILayout.Label("PROBÍHAJÍCÍ VÝPRAVA", EryonSkin.Caps);
                GUILayout.Label(act.title, new GUIStyle(EryonSkin.H2) { normal = { textColor = EryonSkin.GoldBright } });
                if (!string.IsNullOrEmpty(act.story)) GUILayout.Label(act.story, EryonSkin.Body);
                var left = Remaining ?? TimeSpan.Zero;
                GUILayout.Space(6);
                if (left > TimeSpan.Zero)
                {
                    GUILayout.Label($"Vrátíš se za <b>{Fmt(left)}</b>. Mezitím můžeš volně hrát – výprava běží i po zavření hry.", new GUIStyle(EryonSkin.Body) { richText = true });
                }
                else
                {
                    string foe = act.enemy != null && !string.IsNullOrEmpty(act.enemy.name) ? act.enemy.name : "nepřítel";
                    GUILayout.Label($"Na konci cesty tě čeká <b>{foe}</b>.", new GUIStyle(EryonSkin.Body) { richText = true });
                    if (GUILayout.Button("DOKONČIT VÝPRAVU – SOUBOJ", EryonSkin.ButtonPrimary, GUILayout.Height(54), GUILayout.Width(420)))
                        Fight("ashes_finish_quest", "{\"p_skip\":false}", act.enemy?.@class ?? "hoplit", foe, $"Výprava „{act.title}“ je u konce.");
                }
            }
            else if (st.quests != null && st.quests.Length > 0)
            {
                GUILayout.Label("NABÍDNUTÉ VÝPRAVY  (vyber jednu – ostatní propadnou)", EryonSkin.Caps);
                foreach (var q in st.quests)
                {
                    if (q.state != "offered") continue;
                    GUILayout.BeginHorizontal(GUILayout.MinHeight(96));
                    GUILayout.BeginVertical();
                    GUILayout.Label(q.title, new GUIStyle(EryonSkin.H2) { fontSize = 22, normal = { textColor = EryonSkin.GoldBright } });
                    if (!string.IsNullOrEmpty(q.story)) GUILayout.Label(q.story, new GUIStyle(EryonSkin.Small) { fontSize = 17 });
                    GUILayout.Label($"⏱ {q.minutes} min   ·   <color=#c8a8ff>+{q.xp} zk.</color>   ·   <color=#f0d08a>◆ {q.gold}</color>   ·   kořist {q.item_chance} %" +
                                    (q.enemy != null && !string.IsNullOrEmpty(q.enemy.name) ? $"   ·   nepřítel: {q.enemy.name}" : ""),
                        new GUIStyle(EryonSkin.Small) { richText = true });
                    GUILayout.EndVertical();
                    GUILayout.FlexibleSpace();
                    bool can = ch.courage >= q.CourageCost;
                    GUI.enabled = !busy && !fighting && can;
                    if (GUILayout.Button(can ? $"Vydat se  ·  odvaha {q.CourageCost}" : $"Málo odvahy ({q.CourageCost})", EryonSkin.ButtonPrimary, GUILayout.Width(300), GUILayout.Height(52)))
                    {
                        var id = q.id;
                        StartCoroutine(Call("ashes_start_quest", "{\"p_quest\":" + MiniJson.Write(id) + "}"));
                    }
                    GUI.enabled = !busy && !fighting;
                    GUILayout.EndHorizontal();
                    EryonSkin.Fill(GUILayoutUtility.GetRect(inner.width - 30, 1), EryonSkin.Line);
                }
            }
            else GUILayout.Label("Žádné výpravy nejsou k dispozici. Zkus to znovu za chvíli.", EryonSkin.Body);

            // boss kapitoly
            GUILayout.Space(16);
            if (chap?.boss != null && !string.IsNullOrEmpty(chap.boss.e))
            {
                GUILayout.Label("STRÁŽCE KAPITOLY", EryonSkin.Caps);
                GUILayout.Label($"{chap.boss.e}  ·  {chap.boss.t}", new GUIStyle(EryonSkin.H2) { normal = { textColor = new Color(1f, 0.55f, 0.4f) } });
                if (!string.IsNullOrEmpty(chap.boss.s)) GUILayout.Label(chap.boss.s, new GUIStyle(EryonSkin.Body) { fontStyle = FontStyle.Italic });
                bool ready = ch.chapter_progress >= need;
                TimeSpan cd = TimeSpan.Zero;
                if (TryTime(ch.boss_ready_at, out var br) && br > ServerNow) cd = br - ServerNow;
                GUI.enabled = !busy && !fighting && ready && cd <= TimeSpan.Zero;
                string label = !ready ? $"Nejdřív splň výpravy ({ch.chapter_progress}/{need})" : cd > TimeSpan.Zero ? $"Odpočíváš ještě {Fmt(cd)}" : $"VYZVAT: {chap.boss.e.ToUpperInvariant()}";
                if (GUILayout.Button(label, EryonSkin.ButtonPrimary, GUILayout.Height(54), GUILayout.Width(460)))
                    Fight("ashes_fight_boss", "{}", string.IsNullOrEmpty(chap.boss.c) ? "hoplit" : chap.boss.c, chap.boss.e, chap.boss.win);
                GUI.enabled = !busy && !fighting;
            }
            // zprávy ze světa
            if (st.chronicle != null && st.chronicle.Length > 0)
            {
                GUILayout.Space(16);
                GUILayout.Label("ZPRÁVY ZE SVĚTA", EryonSkin.Caps);
                int shown = 0;
                foreach (var c in st.chronicle)
                {
                    if (string.IsNullOrEmpty(c.text) || ++shown > 6) continue;
                    string when = TryTime(c.created_at, out var t) ? t.ToLocalTime().ToString("d. M. HH:mm") : "";
                    GUILayout.Label($"<color=#a8998a>{when}</color>   {c.text}", new GUIStyle(EryonSkin.Small) { richText = true, fontSize = 17 });
                }
            }
            GUILayout.EndScrollView();

            GUILayout.FlexibleSpace();
            GUILayout.BeginHorizontal();
            if (error != null) GUILayout.Label($"<color=#e0672a>{error}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true }, GUILayout.Height(46));
            GUILayout.FlexibleSpace();
            GUI.enabled = true;
            if (GUILayout.Button("ZAVŘÍT (Esc)", EryonSkin.ButtonPrimary, GUILayout.Height(46), GUILayout.Width(240))) open = false;
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }
    }
}

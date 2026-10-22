using System.Collections;
using System.Collections.Generic;
using System.Linq;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Rozhovory s NPC (klávesa E) a úkoly od NPC: nabídka, přijetí, odevzdání.
    /// Pravidla a odměny drží server (ashes_wq_accept / ashes_wq_event / ashes_wq_turnin),
    /// texty jsou stejné jako ve webové verzi.
    /// </summary>
    public class NpcDialog : MonoBehaviour
    {
        public GameBootstrap boot;
        public static readonly List<(WorldMap.Npc def, Transform t)> Npcs = new List<(WorldMap.Npc, Transform)>();

        (WorldMap.Npc def, Transform t)? near;
        (WorldMap.Npc def, Transform t)? open;
        string text;          // hlavní text okna
        string title;         // nadpis (jméno NPC nebo úkol)
        Content.QuestDef offer; // nabízený úkol (čeká na přijetí)
        string notice;        // krátké oznámení (odměna, chyba)
        float noticeUntil;
        bool busy;
        public bool testMode;

        public bool IsOpen => open.HasValue;
        public static NpcDialog Instance { get; private set; }
        void Awake() => Instance = this;

        /// <summary>Značka nad NPC: „!“ = nový úkol, „?“ = úkol k odevzdání.</summary>
        public static string Marker(string npc)
        {
            var d = Instance;
            if (d == null || d.boot.state == null) return null;
            foreach (var q in Content.Data.quests)
            {
                if (q.giver != npc) continue;
                var wq = d.boot.state.Quest(q.id);
                if (wq != null && wq.state == "ready") return "?";
            }
            foreach (var q in Content.Data.quests)
                if (q.giver == npc && d.Available(q)) return "!";
            return null;
        }

        void Update()
        {
            if (!boot.inWorld || boot.player == null) { near = null; open = null; return; }
            var p = boot.player.transform.position;
            near = null;
            float best = 3.6f;
            foreach (var n in Npcs)
            {
                if (n.t == null) continue;
                float d = Vector3.Distance(p, n.t.position);
                if (d < best) { best = d; near = n; }
            }
            if (open.HasValue && (near == null || near.Value.def.id != open.Value.def.id) && !testMode) Close();
            if (!Chat.Typing && Input.GetKeyDown(KeyCode.E) && near.HasValue && !open.HasValue) Open(near.Value);
            if (open.HasValue)
            {
                // NPC se otočí k hráči
                var t = open.Value.t;
                var dir = p - t.position;
                dir.y = 0;
                if (dir.sqrMagnitude > 0.01f) t.rotation = Quaternion.Slerp(t.rotation, Quaternion.LookRotation(dir), 1 - Mathf.Exp(-6 * Time.deltaTime));
            }
        }

        void Open((WorldMap.Npc def, Transform t) n)
        {
            open = n;
            offer = null;
            title = $"{n.def.name} · {n.def.role}";
            text = Content.Data.Talk(n.def.id)?.greet ?? "…";
            ModManager.Fire("npc_talk", n.def.id, n.def.name);
            // úkoly typu „promluv si s …“
            var st = boot.state;
            foreach (var q in Content.Data.quests)
            {
                var wq = st?.Quest(q.id);
                if (wq == null || wq.state != "active" || q.type != "talk") continue;
                string target = string.IsNullOrEmpty(q.goalNpc) ? q.target : q.goalNpc;
                if (target == n.def.id) StartCoroutine(Call("ashes_wq_event", $"{{\"p_kind\":\"talk\",\"p_target\":\"{n.def.id}\"}}", null));
            }
        }

        /// <summary>Pro samotest: otevře rozhovor s NPC podle id.</summary>
        public void TestOpen(string id)
        {
            foreach (var n in Npcs) if (n.def.id == id) { Open(n); return; }
        }

        public void Close()
        {
            open = null;
            offer = null;
        }

        void Notice(string s)
        {
            notice = s;
            noticeUntil = Time.time + 6;
        }

        IEnumerator Call(string fn, string args, System.Action<string> onOk)
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc(fn, args, (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { Notice(err); yield break; }
            if (onOk != null) onOk(json);
            else ApplyState(json);
        }

        void ApplyState(string json)
        {
            var st = JsonUtility.FromJson<GameState>(json);
            if (st != null && st.character != null) boot.state = st;
        }

        bool Available(Content.QuestDef q)
        {
            var st = boot.state;
            if (st == null || q.faction != (string.IsNullOrEmpty(st.character.faction) ? "kalidra" : st.character.faction)) return false;
            if (st.Quest(q.id) != null) return false;
            foreach (var r in q.req ?? new string[0])
            {
                var w = st.Quest(r);
                if (w == null || w.state != "done") return false;
            }
            return true;
        }

        void OnGUI()
        {
            if (!boot.inWorld) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            float W = EryonSkin.W, H = EryonSkin.H;
            QuestTracker();
            if (notice != null && Time.time < noticeUntil)
            {
                var nr = new Rect(W / 2 - 330, 110, 660, 54);
                GUI.Box(nr, GUIContent.none, EryonSkin.PanelStyle);
                EryonSkin.Shadowed(nr, notice, new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 22, normal = { textColor = EryonSkin.GoldBright } });
            }
            if (!open.HasValue)
            {
                if (near.HasValue) Prompt(W, H, "E", $"Mluvit – {near.Value.def.name}");
                return;
            }
            DialogWindow(W, H);
        }

        /// <summary>Výzva k akci nad spodní lištou ([E] …).</summary>
        public static void Prompt(float W, float H, string key, string text)
        {
            var r = new Rect(W / 2 - 220, H - 170, 440, 50);
            GUI.Box(r, GUIContent.none, EryonSkin.PanelStyle);
            EryonSkin.KeyCap(new Rect(r.x + 16, r.y + 11, 34, 28), key);
            GUI.Label(new Rect(r.x + 62, r.y, r.width - 76, r.height), text, new GUIStyle(EryonSkin.BodyBold) { alignment = TextAnchor.MiddleLeft, normal = { textColor = EryonSkin.GoldBright } });
        }

        void DialogWindow(float W, float H)
        {
            var n = open.Value;
            float w = Mathf.Min(1180, W - 80), h = 380;
            var r = new Rect((W - w) / 2, H - h - 70, w, h);
            GUI.Box(r, GUIContent.none, EryonSkin.PanelStyle);
            // portrét a jméno
            EryonSkin.Portrait(new Rect(r.x + 26, r.y + 26, 150, 150), EryonSkin.PortraitFor(n.def.cls, "m"));
            GUI.Label(new Rect(r.x + 26, r.y + 182, 150, 28), n.def.name.ToUpperInvariant(), new GUIStyle(EryonSkin.H2) { alignment = TextAnchor.MiddleCenter, fontSize = 18, normal = { textColor = EryonSkin.GoldBright } });
            GUI.Label(new Rect(r.x + 16, r.y + 208, 170, 24), n.def.role, new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleCenter });

            float tx = r.x + 210, tw = w * 0.5f;
            GUI.Label(new Rect(tx, r.y + 22, tw, 36), title, new GUIStyle(EryonSkin.H1) { fontSize = 24 });
            EryonSkin.Ornament(new Rect(tx, r.y + 62, tw, 10));
            GUI.Label(new Rect(tx, r.y + 82, tw, h - 110), text, new GUIStyle(EryonSkin.Body) { fontSize = 24 });

            // volby vpravo
            float ox = tx + tw + 30, ow = r.xMax - ox - 26;
            EryonSkin.Fill(new Rect(ox - 16, r.y + 26, 1, h - 52), EryonSkin.Line);
            GUILayout.BeginArea(new Rect(ox, r.y + 26, ow, h - 52));
            GUI.enabled = !busy;
            var st = boot.state;
            var opt = new GUIStyle(EryonSkin.ButtonGhost) { fontSize = 21, wordWrap = true, padding = new RectOffset(28, 8, 6, 6) };
            bool Option(string label, Color mark)
            {
                var rr = GUILayoutUtility.GetRect(new GUIContent(label), opt, GUILayout.ExpandWidth(true));
                bool hover = rr.Contains(Event.current.mousePosition);
                if (hover) EryonSkin.Fill(rr, new Color(0.82f, 0.68f, 0.4f, 0.1f));
                EryonSkin.DiamondAt(new Vector2(rr.x + 12, rr.y + rr.height / 2), 11, mark);
                return GUI.Button(rr, label, opt);
            }
            if (offer != null)
            {
                GUILayout.Label("ÚKOL", EryonSkin.Caps);
                GUILayout.Label(offer.objective, new GUIStyle(EryonSkin.BodyBold) { normal = { textColor = EryonSkin.GoldBright } });
                GUILayout.Space(14);
                if (GUILayout.Button("PŘIJMOUT ÚKOL", EryonSkin.ButtonPrimary, GUILayout.Height(50)))
                {
                    var q = offer;
                    StartCoroutine(Call("ashes_wq_accept", $"{{\"p_quest\":\"{q.id}\"}}", json =>
                    {
                        ApplyState(json);
                        Notice($"Nový úkol: {q.title}");
                        ModManager.Fire("quest_accepted", q.id, q.title);
                        offer = null;
                        text = "Dobře. Vrať se, až to bude hotové.";
                    }));
                }
                if (GUILayout.Button("Zatím ne", EryonSkin.Button, GUILayout.Height(42))) { offer = null; text = Content.Data.Talk(n.def.id)?.greet ?? "…"; }
            }
            else
            {
                foreach (var q in Content.Data.quests.Where(q => q.giver == n.def.id))
                {
                    var wq = st?.Quest(q.id);
                    if (wq != null && wq.state == "ready" && Option($"Odevzdat: {q.title}", EryonSkin.Good))
                    {
                        var qq = q;
                        StartCoroutine(Call("ashes_wq_turnin", $"{{\"p_quest\":\"{q.id}\"}}", json =>
                        {
                            var res = JsonUtility.FromJson<TurnInResult>(json);
                            if (res?.state?.character != null) boot.state = res.state;
                            title = qq.title;
                            text = qq.done;
                            Notice($"Úkol splněn: {qq.title}   +{res?.xp} zk.   +{res?.gold} zlata" + (res != null && res.levels > 0 ? "   ·   NOVÁ ÚROVEŇ!" : ""));
                            ModManager.Fire("quest_done", qq.id, qq.title);
                        }));
                    }
                }
                foreach (var q in Content.Data.quests.Where(q => q.giver == n.def.id && Available(q)))
                    if (Option($"Úkol: {q.title}", EryonSkin.Ember)) { offer = q; title = q.title; text = q.offer; }
                if ((n.def.id == "tharos" || n.def.id == "rukmar") && Option("Ukaž mi své zboží (obchod)", EryonSkin.GoldBright))
                {
                    var smith = $"{n.def.name} · {n.def.role}";
                    Close();
                    CharacterWindow.Instance?.OpenSmith(smith);
                }
                if ((n.def.id == "arena-k" || n.def.id == "arena-l") && Option("Chci zápasit v aréně", EryonSkin.Ember))
                {
                    Close();
                    Arena.Instance?.Open();
                }
                var talk = Content.Data.Talk(n.def.id);
                if (talk?.lore != null)
                    foreach (var l in talk.lore)
                        if (Option(l.q, EryonSkin.Gold)) { title = $"{n.def.name} · {n.def.role}"; text = l.a; }
                GUILayout.FlexibleSpace();
                if (Option("Rozloučit se", EryonSkin.Muted)) Close();
            }
            GUI.enabled = true;
            GUILayout.EndArea();
        }

        void QuestTracker()
        {
            var st = boot.state;
            if (st?.wquests == null) return;
            var active = st.wquests.Where(q => q.state == "active" || q.state == "ready").ToList();
            if (active.Count == 0) return;
            float W = EryonSkin.W;
            float w = 380, x = W - w - 20, y = 330;
            GUI.Label(new Rect(x, y, w, 28), "ÚKOLY", new GUIStyle(EryonSkin.H2) { fontSize = 19 });
            EryonSkin.Fill(new Rect(x, y + 30, w, 1), EryonSkin.Line);
            y += 40;
            foreach (var wq in active)
            {
                var def = Content.Data.Quest(wq.quest_id);
                if (def == null) continue;
                bool ready = wq.state == "ready";
                string line = ready
                    ? $"Hotovo – vrať se za {NpcName(def.giver)}"
                    : def.count > 1 ? $"{def.objective}  ({wq.progress}/{def.count})" : def.objective;
                EryonSkin.DiamondAt(new Vector2(x + 7, y + 13), 12, ready ? EryonSkin.Good : EryonSkin.Gold);
                EryonSkin.Shadowed(new Rect(x + 22, y, w - 22, 26), def.title, new GUIStyle(EryonSkin.BodyBold) { fontSize = 21, normal = { textColor = ready ? EryonSkin.Good : EryonSkin.GoldBright } });
                var ls = new GUIStyle(EryonSkin.Small) { fontSize = 17, normal = { textColor = EryonSkin.Text } };
                float lh = ls.CalcHeight(new GUIContent(line), w - 22);
                EryonSkin.Shadowed(new Rect(x + 22, y + 26, w - 22, lh), line, ls);
                y += 34 + lh;
            }
        }

        static string NpcName(string id)
        {
            foreach (var n in WorldMap.Npcs) if (n.id == id) return n.name;
            return id;
        }
    }
}

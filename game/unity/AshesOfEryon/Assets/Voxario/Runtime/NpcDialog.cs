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
        GUIStyle box, head, body, small, gold;

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
            if (Input.GetKeyDown(KeyCode.E) && near.HasValue && !open.HasValue) Open(near.Value);
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

        void Styles()
        {
            if (box != null) return;
            var tex = new Texture2D(1, 1);
            tex.SetPixel(0, 0, new Color(0.06f, 0.045f, 0.04f, 0.92f));
            tex.Apply();
            box = new GUIStyle(GUI.skin.box) { normal = { background = tex } };
            head = new GUIStyle(GUI.skin.label) { fontSize = 20, fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.9f, 0.72f, 0.42f) } };
            body = new GUIStyle(GUI.skin.label) { fontSize = 16, wordWrap = true, normal = { textColor = new Color(0.93f, 0.89f, 0.82f) } };
            small = new GUIStyle(GUI.skin.label) { fontSize = 13, wordWrap = true, normal = { textColor = new Color(0.78f, 0.72f, 0.64f) } };
            gold = new GUIStyle(small) { fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.95f, 0.78f, 0.4f) } };
        }

        void OnGUI()
        {
            if (!boot.inWorld) return;
            Styles();
            QuestTracker();
            if (notice != null && Time.time < noticeUntil)
            {
                GUI.Box(new Rect(Screen.width / 2 - 260, 80, 520, 40), GUIContent.none, box);
                GUI.Label(new Rect(Screen.width / 2 - 250, 88, 500, 30), notice, new GUIStyle(gold) { alignment = TextAnchor.MiddleCenter, fontSize = 15 });
            }
            if (!open.HasValue)
            {
                if (near.HasValue)
                {
                    var r = new Rect(Screen.width / 2 - 170, Screen.height - 130, 340, 34);
                    GUI.Box(r, GUIContent.none, box);
                    GUI.Label(r, $"[E]  Mluvit – {near.Value.def.name}", new GUIStyle(gold) { alignment = TextAnchor.MiddleCenter, fontSize = 15 });
                }
                return;
            }
            DialogWindow();
        }

        void DialogWindow()
        {
            var n = open.Value;
            float w = Mathf.Min(720, Screen.width - 40), h = 330;
            var r = new Rect((Screen.width - w) / 2, Screen.height - h - 60, w, h);
            GUI.Box(r, GUIContent.none, box);
            GUILayout.BeginArea(new Rect(r.x + 22, r.y + 16, w - 44, h - 30));
            GUILayout.Label(title, head);
            GUILayout.Space(4);
            GUILayout.Label(text, body);
            GUILayout.FlexibleSpace();
            GUI.enabled = !busy;
            var st = boot.state;
            if (offer != null)
            {
                GUILayout.Label("Úkol: " + offer.objective, gold);
                GUILayout.BeginHorizontal();
                if (GUILayout.Button("Přijmout úkol", GUILayout.Height(30)))
                {
                    var q = offer;
                    StartCoroutine(Call("ashes_wq_accept", $"{{\"p_quest\":\"{q.id}\"}}", json =>
                    {
                        ApplyState(json);
                        Notice($"Nový úkol: {q.title}");
                        offer = null;
                        text = "Dobře. Vrať se, až to bude hotové.";
                    }));
                }
                if (GUILayout.Button("Zatím ne", GUILayout.Height(30))) { offer = null; text = Content.Data.Talk(n.def.id)?.greet ?? "…"; }
                GUILayout.EndHorizontal();
            }
            else
            {
                // odevzdání hotových úkolů
                foreach (var q in Content.Data.quests.Where(q => q.giver == n.def.id))
                {
                    var wq = st?.Quest(q.id);
                    if (wq != null && wq.state == "ready" && GUILayout.Button($"✔ Odevzdat: {q.title}", GUILayout.Height(28)))
                    {
                        var qq = q;
                        StartCoroutine(Call("ashes_wq_turnin", $"{{\"p_quest\":\"{q.id}\"}}", json =>
                        {
                            var res = JsonUtility.FromJson<TurnInResult>(json);
                            if (res?.state?.character != null) boot.state = res.state;
                            title = qq.title;
                            text = qq.done;
                            Notice($"Úkol splněn: {qq.title}  +{res?.xp} zkušeností  +{res?.gold} zlata" + (res != null && res.levels > 0 ? "  ·  nová úroveň!" : ""));
                        }));
                    }
                }
                // nové úkoly
                foreach (var q in Content.Data.quests.Where(q => q.giver == n.def.id && Available(q)))
                {
                    if (GUILayout.Button($"! {q.title}", GUILayout.Height(28)))
                    {
                        offer = q;
                        title = q.title;
                        text = q.offer;
                    }
                }
                // vyprávění
                var talk = Content.Data.Talk(n.def.id);
                if (talk?.lore != null)
                    foreach (var l in talk.lore)
                        if (GUILayout.Button(l.q, GUILayout.Height(26))) { title = $"{n.def.name} · {n.def.role}"; text = l.a; }
                if (GUILayout.Button("Rozloučit se", GUILayout.Height(26))) Close();
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
            float w = 320, y = 250;
            GUI.Box(new Rect(Screen.width - w - 12, y, w, 30 + active.Count * 44), GUIContent.none, box);
            GUI.Label(new Rect(Screen.width - w, y + 6, w - 20, 22), "Úkoly", new GUIStyle(head) { fontSize = 15 });
            y += 30;
            foreach (var wq in active)
            {
                var def = Content.Data.Quest(wq.quest_id);
                if (def == null) continue;
                string line = wq.state == "ready"
                    ? $"Hotovo – vrať se za {NpcName(def.giver)}"
                    : def.type == "kill"
                        ? $"{def.objective} ({wq.progress}/{def.count}) · boj zatím ve webové verzi"
                        : def.count > 1 ? $"{def.objective} ({wq.progress}/{def.count})" : def.objective;
                GUI.Label(new Rect(Screen.width - w, y, w - 20, 18), def.title, gold);
                GUI.Label(new Rect(Screen.width - w, y + 17, w - 20, 26), line, small);
                y += 44;
            }
        }

        static string NpcName(string id)
        {
            foreach (var n in WorldMap.Npcs) if (n.id == id) return n.name;
            return id;
        }
    }
}

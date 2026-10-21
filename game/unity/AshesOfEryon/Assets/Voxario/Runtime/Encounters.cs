using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    // ------------------------------------------------------------------ odpověď serveru na souboj
    [Serializable] public class FightRound { public int a, d, h1, h2; public bool c, e, b; }
    [Serializable] public class Fighter { public string name; public string @class; public int level; }
    [Serializable] public class Fight { public int winner, hp1, hp2; public Fighter f1, f2; public FightRound[] rounds; }
    [Serializable]
    public class FightResult
    {
        public Fight fight;
        public bool won;
        public int xp, gold, levels;
        public string[] quests;
        public GameState state;
    }

    /// <summary>
    /// Nepřátelé v oblastech, strážní ohně a památník (stejná data jako web – map.ts).
    /// Nepřítel, který hráče zahlédne, se k němu rozběhne; dotyk spustí souboj, který
    /// vyhodnotí server (ashes_world_fight) a hra ho přehraje kolo po kole.
    /// </summary>
    public class Encounters : MonoBehaviour
    {
        public GameBootstrap boot;

        // ------------------------------------------------------------------ data (map.ts)
        struct EnemyDef { public string id, name, cls; public int l0, l1; }
        static EnemyDef E(string id, string n, string c, int l0, int l1) => new EnemyDef { id = id, name = n, cls = c, l0 = l0, l1 = l1 };

        static readonly Dictionary<string, Dictionary<string, EnemyDef[]>> RegionEnemies = new Dictionary<string, Dictionary<string, EnemyDef[]>>
        {
            ["kalidra"] = new Dictionary<string, EnemyDef[]>
            {
                ["shore"] = new[] { E("vrakar", "Vrakař", "lucistnik", 1, 2), E("pasarak", "Pašerák z útesů", "lucistnik", 1, 2) },
                ["aqueduct"] = new[] { E("lapka", "Lapka od akvaduktu", "hoplit", 2, 3), E("kultista", "Kultista popela", "vestec", 2, 3) },
                ["hills"] = new[] { E("zved-legie", "Zvěd Rudého slunce", "lucistnik", 3, 5), E("predvoj", "Předvoj legie", "hoplit", 3, 5) },
                ["plain"] = new[] { E("kopinik", "Kopiník Rudého slunce", "hoplit", 4, 6), E("knez-slunce", "Kněz Rudého slunce", "vestec", 4, 6) },
                ["cove"] = new[] { E("strazce-lodi", "Strážce černých lodí", "hoplit", 5, 7) },
                ["camp"] = new[] { E("garda", "Azkarova garda", "hoplit", 6, 8) },
            },
            ["legie"] = new Dictionary<string, EnemyDef[]>
            {
                ["cove"] = new[] { E("strazny-utesy", "Strážný z útesů", "lucistnik", 1, 2), E("vrakar", "Vrakař", "lucistnik", 1, 2) },
                ["shore"] = new[] { E("vrakar", "Vrakař", "lucistnik", 2, 3), E("rybar", "Rybář s harpunou", "hoplit", 2, 3) },
                ["aqueduct"] = new[] { E("strazce-akvaduktu", "Strážce akvaduktu", "hoplit", 2, 3), E("knezka", "Kněžka přílivu", "vestec", 2, 3) },
                ["hills"] = new[] { E("zved-kalidra", "Kalidrský zvěd", "lucistnik", 3, 5), E("strazce-ohne", "Strážce ohně", "hoplit", 3, 5) },
                ["plain"] = new[] { E("obrance", "Obránce Kalidry", "hoplit", 4, 6), E("knez-kalidry", "Kněz Kalidry", "vestec", 4, 6) },
                ["kalidra"] = new[] { E("straz-kalidry", "Stráž Kalidry", "hoplit", 6, 8) },
            },
        };

        static readonly (string region, float x, float z)[] Camps =
        {
            ("shore", -64, 80), ("shore", -46, 82), ("shore", -72, 32), ("shore", -32, 72),
            ("aqueduct", -46, 18), ("aqueduct", -28, 2), ("aqueduct", -56, -4), ("aqueduct", -20, -18),
            ("hills", -24, -40), ("hills", -8, -64), ("hills", 16, -68), ("hills", 36, -46), ("hills", -2, -42),
            ("plain", 12, 26), ("plain", 34, 0), ("plain", 34, 36), ("plain", 8, -6),
            ("cove", -64, -44), ("cove", -30, -74),
            ("camp", 44, -76), ("camp", 72, -56),
            ("kalidra", 86, 2), ("kalidra", 86, 36),
        };

        static readonly Dictionary<string, string[]> Safe = new Dictionary<string, string[]> { ["kalidra"] = new[] { "kalidra" }, ["legie"] = new[] { "cove", "camp" } };
        static readonly (float x, float z, float r)[] SafeZones = { (-52, 50, 20), (-44, -50, 18), (62, 15, 14), (56, -60, 14) };
        public static readonly Vector2 RespawnKalidra = new Vector2(62, 15), RespawnLegie = new Vector2(56, -60);
        static readonly (string id, float x, float z)[] Beacons = { ("b1", -22, -58), ("b2", 2, -72), ("b3", 28, -60) };
        static readonly Vector2 Memorial = new Vector2(28, 30);

        static bool InSafe(Vector2 p, float margin = 0)
        {
            foreach (var s in SafeZones) if (Vector2.Distance(p, new Vector2(s.x, s.z)) < s.r + margin) return true;
            return false;
        }

        // ------------------------------------------------------------------ stav
        class Enemy
        {
            public EnemyDef def;
            public string region;
            public CharacterView view;
            public NameTag tag;
            public Vector2 home, pos, target;
            public float wait, calmUntil, respawnAt;
            public bool alive = true;
        }

        readonly List<Enemy> enemies = new List<Enemy>();
        readonly List<(string id, Transform t, Fire fire)> beacons = new List<(string, Transform, Fire)>();
        Transform memorial;
        string faction = "kalidra";
        bool fighting;
        FightResult result;
        string note;
        float noteUntil;
        // přehrávání souboje
        string fName1, fName2;
        int hp1, hp2, max1, max2;
        readonly List<(Vector3 pos, string text, Color color, float t0)> floats = new List<(Vector3, string, Color, float)>();
        GUIStyle box, head, body, gold, floatStyle;
        public bool Busy => fighting || result != null;
        public static Encounters Instance { get; private set; }
        void Awake() => Instance = this;

        public void Build(Transform root, ModelLibrary lib, string fac)
        {
            faction = fac;
            enemies.Clear();
            beacons.Clear();
            var parent = new GameObject("Enemies").transform;
            parent.SetParent(root, false);
            var rnd = new System.Random(99);
            foreach (var camp in Camps)
            {
                if (Array.IndexOf(Safe[faction], camp.region) >= 0) continue;
                if (!RegionEnemies[faction].TryGetValue(camp.region, out var defs)) continue;
                int count = camp.region == "kalidra" || camp.region == "camp" ? 1 : 2;
                for (int i = 0; i < count; i++)
                {
                    var def = defs[rnd.Next(defs.Length)];
                    var home = new Vector2(camp.x + (float)(rnd.NextDouble() - 0.5) * 6, camp.z + (float)(rnd.NextDouble() - 0.5) * 6);
                    var v = CharacterView.Create(lib.Hero($"{def.cls}_m_lo") ?? lib.Hero($"{def.cls}_m"), parent, 1.62f, def.name);
                    v.transform.position = WorldMap.ToWorld(home.x, home.y);
                    var tag = v.gameObject.AddComponent<NameTag>();
                    tag.title = def.name;
                    tag.subtitle = $"úroveň {def.l0}–{def.l1}";
                    tag.enemy = true;
                    enemies.Add(new Enemy { def = def, region = camp.region, view = v, tag = tag, home = home, pos = home, target = home, wait = (float)rnd.NextDouble() * 3 });
                }
            }
            // strážní ohně (vatry) a památník
            foreach (var b in Beacons)
            {
                var go = new GameObject("Beacon " + b.id);
                go.transform.SetParent(root, false);
                go.transform.position = WorldMap.ToWorld(b.x, b.z);
                // kamenný podstavec a oheň
                var pile = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                pile.transform.SetParent(go.transform, false);
                pile.transform.localScale = new Vector3(2.8f, 0.6f, 2.8f);
                pile.transform.localPosition = new Vector3(0, 0.5f, 0);
                pile.GetComponent<Renderer>().sharedMaterial = ModelLibrary.NewLit(new Color(0.7f, 0.67f, 0.6f), 0.1f);
                var fire = Fire.Create(go.transform, go.transform.position + Vector3.up * 1.1f, 1.6f, true);
                fire.lit = false;
                var tag = go.AddComponent<NameTag>();
                tag.title = "Strážní vatra";
                tag.subtitle = "";
                beacons.Add((b.id, go.transform, fire));
            }
            var mem = GameObject.CreatePrimitive(PrimitiveType.Cube);
            mem.name = "Memorial";
            mem.transform.SetParent(root, false);
            mem.transform.localScale = new Vector3(1.2f, 2.4f, 0.5f);
            mem.transform.position = WorldMap.ToWorld(Memorial.x, Memorial.y) + Vector3.up * 1.1f;
            mem.GetComponent<Renderer>().sharedMaterial = ModelLibrary.NewLit(new Color(0.62f, 0.6f, 0.56f), 0.2f);
            var mtag = mem.AddComponent<NameTag>();
            mtag.title = "Památník padlých";
            mtag.subtitle = "";
            memorial = mem.transform;
            for (int i = 0; i < 8; i++)
            {
                float a = i / 8f * Mathf.PI * 2;
                var st = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                Destroy(st.GetComponent<Collider>());
                st.transform.SetParent(root, false);
                st.transform.localScale = Vector3.one * 0.55f;
                st.transform.position = WorldMap.ToWorld(Memorial.x + Mathf.Cos(a) * 2.2f, Memorial.y + Mathf.Sin(a) * 2.2f) + Vector3.up * 0.1f;
                st.GetComponent<Renderer>().sharedMaterial = mem.GetComponent<Renderer>().sharedMaterial;
            }
            Fire.Create(root, WorldMap.ToWorld(Memorial.x + 0.9f, Memorial.y + 0.8f) + Vector3.up * 0.1f, 0.3f, false);
            RefreshBeacons();
        }

        /// <summary>Zapálené vatry podle úkolu „Strážní ohně“ (cíle v targets).</summary>
        void RefreshBeacons()
        {
            var wq = boot.state?.Quest("k4");
            foreach (var b in beacons)
            {
                bool lit = faction == "legie" || (wq != null && (wq.state != "active" || (wq.targets != null && Array.IndexOf(wq.targets, b.id) >= 0)));
                b.fire.lit = lit;
            }
        }

        void Note(string s) { note = s; noteUntil = Time.time + 5; }

        void Update()
        {
            if (!boot.inWorld || boot.player == null) return;
            var pw = WorldMap.ToWeb(boot.player.transform.position);
            float dt = Time.deltaTime, now = Time.time;
            bool calm = fighting || result != null || InSafe(pw) || (NpcDialog.Instance != null && NpcDialog.Instance.IsOpen);
            foreach (var e in enemies)
            {
                if (!e.alive)
                {
                    if (now > e.respawnAt)
                    {
                        e.alive = true;
                        e.pos = e.home;
                        e.view.gameObject.SetActive(true);
                        e.view.transform.rotation = Quaternion.identity;
                        e.calmUntil = now + 2;
                    }
                    continue;
                }
                if (fighting) { e.view.speed = 0; continue; }
                float toPlayer = Vector2.Distance(pw, e.pos);
                float homeDist = Vector2.Distance(e.pos, e.home);
                float speed = 0;
                if (InSafe(e.pos, 1)) { e.target = e.home; speed = 2.6f; }
                else if (!calm && now > e.calmUntil && toPlayer < 7 && homeDist < 18)
                {
                    e.target = pw;
                    speed = 3.4f;
                    if (toPlayer < 1.5f)
                    {
                        e.calmUntil = now + 4;
                        StartCoroutine(RunFight(e));
                        continue;
                    }
                }
                else
                {
                    e.wait -= dt;
                    if (e.wait <= 0 && Vector2.Distance(e.pos, e.target) < 0.5f)
                    {
                        e.target = e.home + new Vector2(UnityEngine.Random.Range(-7f, 7f), UnityEngine.Random.Range(-7f, 7f));
                        if (InSafe(e.target, 2) || WorldMap.HeightAt(e.target.x, e.target.y) < 0.5f) e.target = e.home;
                        e.wait = 2 + UnityEngine.Random.value * 4;
                    }
                    if (homeDist > 18) e.target = e.home;
                    if (Vector2.Distance(e.pos, e.target) > 0.5f && e.wait <= 0) speed = 1.5f;
                }
                if (speed > 0)
                {
                    var d = e.target - e.pos;
                    if (d.magnitude > 0.1f)
                    {
                        d.Normalize();
                        var next = e.pos + d * speed * dt;
                        if (WorldMap.HeightAt(next.x, next.y) > 0.3f) e.pos = next; else e.target = e.pos;
                        e.view.transform.rotation = Quaternion.Slerp(e.view.transform.rotation, Quaternion.LookRotation(new Vector3(d.x, 0, -d.y)), 1 - Mathf.Exp(-8 * dt));
                    }
                }
                e.view.speed = speed;
                e.view.transform.position = WorldMap.ToWorld(e.pos.x, e.pos.y);
            }

            // vatry a památník (klávesa E)
            if (!Busy && Input.GetKeyDown(KeyCode.E) && (NpcDialog.Instance == null || !NpcDialog.Instance.IsOpen))
            {
                foreach (var b in beacons)
                    if (Vector3.Distance(boot.player.transform.position, b.t.position) < 4) StartCoroutine(Interact("beacon", b.id));
                if (memorial != null && Vector3.Distance(boot.player.transform.position, memorial.position) < 4) StartCoroutine(Interact("visit", "memorial"));
            }
        }

        string NearPrompt()
        {
            if (boot.player == null) return null;
            foreach (var b in beacons) if (Vector3.Distance(boot.player.transform.position, b.t.position) < 4) return "[E]  Zapálit strážní vatru";
            if (memorial != null && Vector3.Distance(boot.player.transform.position, memorial.position) < 4) return "[E]  Položit květ k památníku";
            return null;
        }

        IEnumerator Interact(string kind, string target)
        {
            string quest = kind == "beacon" ? "k4" : "k7";
            var wq = boot.state?.Quest(quest);
            if (wq == null || wq.state != "active")
            {
                Note(kind == "beacon" ? "Vatra čeká na rozkaz. (Úkol „Strážní ohně“ dává Damon.)" : "Památník padlých. Kámen si pamatuje jejich jména.");
                yield break;
            }
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_wq_event", $"{{\"p_kind\":\"{kind}\",\"p_target\":\"{target}\"}}", (j, e) => { json = j; err = e; });
            if (err != null) { Note(err); yield break; }
            var st = JsonUtility.FromJson<GameState>(json);
            if (st?.character != null) boot.state = st;
            RefreshBeacons();
            Note(kind == "beacon" ? "Vatra vzplála – vidí ji celé pobřeží." : "Položil jsi květ k památníku padlých.");
        }

        // ------------------------------------------------------------------ souboj
        IEnumerator RunFight(Enemy e)
        {
            fighting = true;
            boot.player.inputEnabled = false;
            boot.player.view.speed = 0;
            // tváří v tvář
            var pp = boot.player.transform.position;
            var ep = e.view.transform.position;
            var dir = ep - pp; dir.y = 0;
            if (dir.sqrMagnitude > 0.01f)
            {
                boot.player.transform.rotation = Quaternion.LookRotation(dir);
                e.view.transform.rotation = Quaternion.LookRotation(-dir);
            }
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_world_fight", $"{{\"p_region\":\"{e.region}\",\"p_enemy\":\"{e.def.id}\"}}", (j, er) => { json = j; err = er; });
            if (err != null)
            {
                Note(err);
                e.calmUntil = Time.time + 6;
                fighting = false;
                boot.player.inputEnabled = true;
                yield break;
            }
            var res = JsonUtility.FromJson<FightResult>(json);
            var f = res.fight;
            fName1 = f.f1?.name ?? "Ty";
            fName2 = $"{f.f2?.name ?? e.def.name} · úroveň {f.f2?.level}";
            var r0 = f.rounds != null && f.rounds.Length > 0 ? f.rounds[0] : null;
            max1 = r0 == null ? f.hp1 : Mathf.Max(r0.h1 + (r0.a == 2 && !r0.e ? r0.d : 0), 1);
            max2 = r0 == null ? f.hp2 : Mathf.Max(r0.h2 + (r0.a == 1 && !r0.e ? r0.d : 0), 1);
            hp1 = max1; hp2 = max2;
            yield return new WaitForSeconds(0.4f);
            foreach (var r in f.rounds ?? new FightRound[0])
            {
                var attacker = r.a == 1 ? boot.player.view : e.view;
                var target = r.a == 1 ? e.view : boot.player.view;
                attacker.Lunge();
                yield return new WaitForSeconds(0.18f);
                var at = target.transform.position + Vector3.up * 2f;
                if (r.e) Float(at, "úhyb", new Color(0.7f, 0.85f, 1f));
                else
                {
                    if (r.b) Float(at + Vector3.up * 0.4f, "blok", new Color(0.8f, 0.8f, 0.8f));
                    Float(at, (r.c ? "KRITICKÝ  " : "") + "-" + r.d, r.c ? new Color(1f, 0.45f, 0.2f) : (r.a == 1 ? new Color(1f, 0.9f, 0.5f) : new Color(1f, 0.35f, 0.3f)));
                    target.Flinch();
                }
                hp1 = r.h1; hp2 = r.h2;
                yield return new WaitForSeconds(0.42f);
            }
            if (res.won)
            {
                e.view.Fall();
                yield return new WaitForSeconds(0.9f);
                e.alive = false;
                e.respawnAt = Time.time + 35;
                e.view.gameObject.SetActive(false);
            }
            else
            {
                boot.player.view.Fall();
                yield return new WaitForSeconds(0.9f);
                e.calmUntil = Time.time + 6;
            }
            if (res.state?.character != null) boot.state = res.state;
            RefreshBeacons();
            result = res;
            fighting = false;
        }

        void CloseResult()
        {
            bool lost = result != null && !result.won;
            result = null;
            boot.player.view.Stand();
            boot.player.inputEnabled = true;
            if (lost) boot.player.Respawn(faction == "legie" ? RespawnLegie : RespawnKalidra);
        }

        void Float(Vector3 pos, string text, Color color) => floats.Add((pos, text, color, Time.time));

        void Styles()
        {
            if (box != null) return;
            var tex = new Texture2D(1, 1);
            tex.SetPixel(0, 0, new Color(0.06f, 0.045f, 0.04f, 0.92f));
            tex.Apply();
            box = new GUIStyle(GUI.skin.box) { normal = { background = tex } };
            head = new GUIStyle(GUI.skin.label) { fontSize = 26, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(0.92f, 0.74f, 0.42f) } };
            body = new GUIStyle(GUI.skin.label) { fontSize = 16, wordWrap = true, alignment = TextAnchor.MiddleCenter, normal = { textColor = new Color(0.93f, 0.89f, 0.82f) } };
            gold = new GUIStyle(body) { fontStyle = FontStyle.Bold, normal = { textColor = new Color(0.95f, 0.78f, 0.4f) } };
            floatStyle = new GUIStyle(GUI.skin.label) { fontSize = 22, fontStyle = FontStyle.Bold, alignment = TextAnchor.MiddleCenter };
        }

        void Bar(Rect r, float v, Color c, string label)
        {
            GUI.Box(r, GUIContent.none, box);
            var prev = GUI.color;
            GUI.color = c;
            GUI.DrawTexture(new Rect(r.x + 2, r.y + 2, (r.width - 4) * Mathf.Clamp01(v), r.height - 4), Texture2D.whiteTexture);
            GUI.color = prev;
            GUI.Label(r, label, new GUIStyle(body) { fontSize = 13 });
        }

        void OnGUI()
        {
            if (!boot.inWorld) return;
            Styles();
            var cam = boot.cam;
            // létající čísla
            for (int i = floats.Count - 1; i >= 0; i--)
            {
                var f = floats[i];
                float age = Time.time - f.t0;
                if (age > 1.2f) { floats.RemoveAt(i); continue; }
                var sp = cam.WorldToScreenPoint(f.pos + Vector3.up * age * 0.8f);
                if (sp.z < 0) continue;
                floatStyle.normal.textColor = new Color(f.color.r, f.color.g, f.color.b, 1 - age / 1.2f);
                GUI.Label(new Rect(sp.x - 120, Screen.height - sp.y - 15, 240, 30), f.text, floatStyle);
            }
            if (note != null && Time.time < noteUntil)
            {
                GUI.Box(new Rect(Screen.width / 2 - 280, 130, 560, 36), GUIContent.none, box);
                GUI.Label(new Rect(Screen.width / 2 - 280, 130, 560, 36), note, gold);
            }
            if (fighting || result != null)
            {
                float w = 300;
                Bar(new Rect(Screen.width / 2 - w - 20, 70, w, 26), hp1 / (float)Mathf.Max(1, max1), new Color(0.3f, 0.75f, 0.35f), $"{fName1}  {hp1}/{max1}");
                Bar(new Rect(Screen.width / 2 + 20, 70, w, 26), hp2 / (float)Mathf.Max(1, max2), new Color(0.8f, 0.25f, 0.2f), $"{fName2}  {hp2}/{max2}");
            }
            if (result != null)
            {
                var r = new Rect(Screen.width / 2 - 230, Screen.height / 2 - 120, 460, 240);
                GUI.Box(r, GUIContent.none, box);
                GUILayout.BeginArea(new Rect(r.x + 20, r.y + 16, r.width - 40, r.height - 30));
                GUILayout.Label(result.won ? "Vítězství" : "Porážka", head);
                if (result.won)
                {
                    GUILayout.Label($"+{result.xp} zkušeností   +{result.gold} zlata" + (result.levels > 0 ? "   ·   NOVÁ ÚROVEŇ!" : ""), gold);
                    if (result.quests != null && result.quests.Length > 0)
                        foreach (var q in result.quests)
                        {
                            var def = Content.Data.Quest(q);
                            var wq = boot.state?.Quest(q);
                            if (def != null) GUILayout.Label($"Úkol „{def.title}“: {wq?.progress}/{def.count}" + (wq?.state == "ready" ? " – hotovo!" : ""), body);
                        }
                }
                else GUILayout.Label("Padl jsi. Probudíš se v bezpečí u hradeb.", body);
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("Pokračovat", GUILayout.Height(34))) CloseResult();
                GUILayout.EndArea();
                return;
            }
            var prompt = NearPrompt();
            if (prompt != null && !fighting)
            {
                var pr = new Rect(Screen.width / 2 - 170, Screen.height - 130, 340, 34);
                GUI.Box(pr, GUIContent.none, box);
                GUI.Label(pr, prompt, gold);
            }
        }
    }
}

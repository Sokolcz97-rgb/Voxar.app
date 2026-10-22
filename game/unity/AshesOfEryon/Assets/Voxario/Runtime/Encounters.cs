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
        public Item item;
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
        public bool Busy => fighting || result != null;
        /// <summary>Text pod výsledkem příběhového souboje (např. vítězství nad bossem).</summary>
        public string StoryNote;
        public static Encounters Instance { get; private set; }
        void Awake() => Instance = this;

        ModelLibrary library;
        Transform worldRoot;
        // aréna: soupeř, čest a režim bez smrti
        CharacterView arenaFoe;
        bool arenaMode;
        int arenaHonor;

        public void Build(Transform root, ModelLibrary lib, string fac)
        {
            faction = fac;
            library = lib;
            worldRoot = root;
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
            bool legie = faction == "legie";
            var wq = boot.state?.Quest(legie ? "l4" : "k4");
            foreach (var b in beacons)
            {
                // Kalidra vatry zapaluje (k4), Legie je zhasíná (l4)
                bool touched = wq != null && (wq.state != "active" || (wq.targets != null && Array.IndexOf(wq.targets, b.id) >= 0));
                b.fire.lit = legie ? !touched : touched;
            }
        }

        void Note(string s) { note = s; noteUntil = Time.time + 5; }

        /// <summary>Polohy (webové souřadnice) cílů aktivních úkolů pro minimapu.</summary>
        public List<Vector2> QuestTargets()
        {
            var list = new List<Vector2>();
            var st = boot.state;
            if (st?.wquests == null) return list;
            foreach (var wq in st.wquests)
            {
                if (wq.state != "active") continue;
                var def = Content.Data.Quest(wq.quest_id);
                if (def == null) continue;
                if (def.type == "kill")
                {
                    foreach (var e in enemies) if (e.alive && e.def.id == def.target) list.Add(e.pos);
                }
                else if (def.type == "beacon")
                {
                    foreach (var b in Beacons) if (wq.targets == null || Array.IndexOf(wq.targets, b.id) < 0) list.Add(new Vector2(b.x, b.z));
                }
                else if (def.type == "visit") list.Add(Memorial);
            }
            return list;
        }

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
            if (!Busy && !Chat.Typing && Input.GetKeyDown(KeyCode.E) && (NpcDialog.Instance == null || !NpcDialog.Instance.IsOpen))
            {
                foreach (var b in beacons)
                    if (Vector3.Distance(boot.player.transform.position, b.t.position) < 4) StartCoroutine(Interact("beacon", b.id));
                if (memorial != null && Vector3.Distance(boot.player.transform.position, memorial.position) < 4) StartCoroutine(Interact("visit", "memorial"));
            }
        }

        string NearPrompt()
        {
            if (boot.player == null) return null;
            foreach (var b in beacons) if (Vector3.Distance(boot.player.transform.position, b.t.position) < 4) return faction == "legie" ? "[E]  Uhasit kalidrskou vatru" : "[E]  Zapálit strážní vatru";
            if (memorial != null && Vector3.Distance(boot.player.transform.position, memorial.position) < 4) return "[E]  Položit květ k památníku";
            return null;
        }

        IEnumerator Interact(string kind, string target)
        {
            bool legie = faction == "legie";
            string quest = kind == "beacon" ? (legie ? "l4" : "k4") : "k7";
            var wq = boot.state?.Quest(quest);
            if (wq == null || wq.state != "active")
            {
                Note(kind == "beacon"
                    ? (legie ? "Kalidrská vatra. (Úkol „Zhasnout ohně“ dává kněz Oren.)" : "Vatra čeká na rozkaz. (Úkol „Strážní ohně“ dává Damon.)")
                    : "Památník padlých. Kámen si pamatuje jejich jména.");
                yield break;
            }
            if (kind == "beacon" && wq.targets != null && Array.IndexOf(wq.targets, target) >= 0)
            {
                Note(legie ? "Tahle vatra už je uhašená." : "Tahle vatra už hoří.");
                yield break;
            }
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_wq_event", $"{{\"p_kind\":\"{kind}\",\"p_target\":\"{target}\"}}", (j, e) => { json = j; err = e; });
            if (err != null) { Note(err); yield break; }
            var st = JsonUtility.FromJson<GameState>(json);
            if (st?.character != null) boot.state = st;
            RefreshBeacons();
            Note(kind == "beacon" ? (legie ? "Vatra zasyčela a zhasla. Kalidra o jedno oko méně." : "Vatra vzplála – vidí ji celé pobřeží.") : "Položil jsi květ k památníku padlých.");
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
            ModManager.Fire("fight_start", e.def.id, e.def.name);
            yield return Replay(res.fight, e.view, $"{res.fight.f2?.name ?? e.def.name} · úroveň {res.fight.f2?.level}");
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
            ResultSound();
            ModManager.Fire("fight_end", res.won ? "won" : "lost", e.def.name);
            fighting = false;
        }

        /// <summary>Přehraje souboj vyhodnocený serverem kolo po kole (hráč = f1).</summary>
        IEnumerator Replay(Fight f, CharacterView foe, string foeLabel)
        {
            fName1 = f.f1?.name ?? "Ty";
            fName2 = foeLabel;
            var r0 = f.rounds != null && f.rounds.Length > 0 ? f.rounds[0] : null;
            max1 = r0 == null ? f.hp1 : Mathf.Max(r0.h1 + (r0.a == 2 && !r0.e ? r0.d : 0), 1);
            max2 = r0 == null ? f.hp2 : Mathf.Max(r0.h2 + (r0.a == 1 && !r0.e ? r0.d : 0), 1);
            hp1 = max1; hp2 = max2;
            yield return new WaitForSeconds(0.4f);
            foreach (var r in f.rounds ?? new FightRound[0])
            {
                var attacker = r.a == 1 ? boot.player.view : foe;
                var target = r.a == 1 ? foe : boot.player.view;
                attacker.Lunge();
                yield return new WaitForSeconds(0.18f);
                var at = target.transform.position + Vector3.up * 2f;
                if (r.e) { Float(at, "úhyb", new Color(0.7f, 0.85f, 1f)); Sfx.Play("dodge"); }
                else
                {
                    Sfx.Play(r.b ? "block" : r.c ? "crit" : "hit");
                    if (r.b) Float(at + Vector3.up * 0.4f, "blok", new Color(0.8f, 0.8f, 0.8f));
                    Float(at, (r.c ? "KRITICKÝ  " : "") + "-" + r.d, r.c ? new Color(1f, 0.45f, 0.2f) : (r.a == 1 ? new Color(1f, 0.9f, 0.5f) : new Color(1f, 0.35f, 0.3f)));
                    target.Flinch();
                }
                hp1 = r.h1; hp2 = r.h2;
                yield return new WaitForSeconds(0.42f);
            }
        }

        // ------------------------------------------------------------------ aréna
        [Serializable] public class ArenaResult { public Fight fight; public bool won; public int honor, gold; public bool rival; public GameState state; }

        /// <summary>Zápas v aréně: server vyhodnotí souboj proti uložené postavě jiného hráče.</summary>
        public void StartArena(string targetId, string cls, string gender, string label, Action<string> onError)
        {
            if (Busy || boot.player == null) return;
            StartCoroutine(RunServerFight("ashes_arena_fight", $"{{\"p_target\":{MiniJson.Write(targetId)}}}", true, cls, gender, label, onError));
        }

        /// <summary>Souboj z Kroniky (konec výpravy, boss kapitoly) – výsledek ve formátu FightResult.</summary>
        public void StartStoryFight(string fn, string args, string cls, string label, Action<string> onError)
        {
            if (Busy || boot.player == null) return;
            StartCoroutine(RunServerFight(fn, args, false, cls, "m", label, onError));
        }

        IEnumerator RunServerFight(string fn, string args, bool arena, string cls, string gender, string label, Action<string> onError)
        {
            fighting = true;
            boot.player.inputEnabled = false;
            boot.player.view.speed = 0;
            string json = null, err = null;
            yield return boot.api.Rpc(fn, args, (j, er) => { json = j; err = er; });
            if (err != null)
            {
                fighting = false;
                boot.player.inputEnabled = true;
                onError?.Invoke(err);
                yield break;
            }
            var res = JsonUtility.FromJson<ArenaResult>(json);
            var story = arena ? null : JsonUtility.FromJson<FightResult>(json);
            if (!arena && res.fight?.f2 != null && !string.IsNullOrEmpty(res.fight.f2.name))
            {
                label = $"{res.fight.f2.name} · úroveň {res.fight.f2.level}";
                if (!string.IsNullOrEmpty(res.fight.f2.@class)) cls = res.fight.f2.@class;
            }
            // soupeř se objeví naproti hráči
            var pt = boot.player.transform;
            var tpl = library != null ? (library.Hero($"{cls}_{gender}") ?? library.Hero($"{cls}_m")) : null;
            if (tpl != null)
            {
                arenaFoe = CharacterView.Create(tpl, worldRoot, gender == "f" ? 1.55f : 1.62f, "Soupeř v aréně");
                var pos = pt.position + pt.forward * 2.4f;
                var w = WorldMap.ToWeb(pos);
                arenaFoe.transform.position = WorldMap.ToWorld(w.x, w.y);
                arenaFoe.transform.rotation = Quaternion.LookRotation(-pt.forward);
                var tag = arenaFoe.gameObject.AddComponent<NameTag>();
                tag.title = label;
                tag.enemy = true;
            }
            ModManager.Fire("fight_start", "arena", label);
            yield return new WaitForSeconds(0.5f);
            yield return Replay(res.fight, arenaFoe != null ? arenaFoe : boot.player.view, label);
            if (res.won) { if (arenaFoe != null) arenaFoe.Fall(); }
            else boot.player.view.Fall();
            yield return new WaitForSeconds(0.9f);
            if (res.state?.character != null) boot.state = res.state;
            arenaMode = true; // bez smrti a návratu na respawn
            arenaHonor = arena ? res.honor : int.MinValue;
            result = arena ? new FightResult { won = res.won, gold = res.gold, xp = 0, state = res.state } : story;
            ResultSound();
            ModManager.Fire("fight_end", res.won ? "won" : "lost", label);
            fighting = false;
        }

        void CloseResult()
        {
            bool lost = result != null && !result.won && !arenaMode;
            result = null;
            boot.player.view.Stand();
            boot.player.inputEnabled = true;
            if (arenaFoe != null) { Destroy(arenaFoe.gameObject); arenaFoe = null; }
            arenaMode = false;
            StoryNote = null;
            if (lost) boot.player.Respawn(faction == "legie" ? RespawnLegie : RespawnKalidra);
        }

        void ResultSound()
        {
            if (result == null) return;
            if (result.levels > 0) Sfx.Play("level");
            else if (result.won) Sfx.Play("coin");
            else Sfx.Play("fall", 0.8f);
        }

        void Float(Vector3 pos, string text, Color color) => floats.Add((pos, text, color, Time.time));

        void OnGUI()
        {
            if (!boot.inWorld) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            float W = EryonSkin.W, H = EryonSkin.H, k = EryonSkin.Scale;
            var cam = boot.cam;
            // létající čísla (pozice z obrazovky převedené do virtuálních souřadnic)
            for (int i = floats.Count - 1; i >= 0; i--)
            {
                var f = floats[i];
                float age = Time.time - f.t0;
                if (age > 1.3f) { floats.RemoveAt(i); continue; }
                var sp = cam.WorldToScreenPoint(f.pos + Vector3.up * age * 0.9f);
                if (sp.z < 0) continue;
                var st = new GUIStyle(EryonSkin.Center) { font = EryonSkin.CinzelBold, fontSize = f.text.StartsWith("KRIT") ? 34 : 28, normal = { textColor = new Color(f.color.r, f.color.g, f.color.b, 1 - age / 1.3f) } };
                EryonSkin.Shadowed(new Rect(sp.x / k - 160, (Screen.height - sp.y) / k - 20, 320, 40), f.text, st);
            }
            if (note != null && Time.time < noteUntil)
            {
                var nr = new Rect(W / 2 - 330, 170, 660, 50);
                GUI.Box(nr, GUIContent.none, EryonSkin.PanelStyle);
                EryonSkin.Shadowed(nr, note, new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, normal = { textColor = EryonSkin.GoldBright } });
            }
            if (fighting || result != null)
            {
                float bw = 420;
                var left = new Rect(W / 2 - bw - 50, 40, bw, 30);
                var right = new Rect(W / 2 + 50, 40, bw, 30);
                GUI.Label(new Rect(left.x, left.y - 30, bw, 28), fName1, new GUIStyle(EryonSkin.H2) { normal = { textColor = EryonSkin.Sky } });
                GUI.Label(new Rect(right.x, right.y - 30, bw, 28), fName2, new GUIStyle(EryonSkin.H2) { alignment = TextAnchor.MiddleRight, normal = { textColor = new Color(1f, 0.5f, 0.4f) } });
                EryonSkin.Bar(left, hp1 / (float)Mathf.Max(1, max1), EryonSkin.Good, $"{hp1} / {max1}");
                EryonSkin.Bar(right, hp2 / (float)Mathf.Max(1, max2), EryonSkin.Blood * 1.6f, $"{hp2} / {max2}");
                EryonSkin.DiamondAt(new Vector2(W / 2, 55), 56, Color.white);
                GUI.Label(new Rect(W / 2 - 28, 27, 56, 56), "VS", new GUIStyle(EryonSkin.Key) { fontSize = 17 });
            }
            if (result != null)
            {
                EryonSkin.Fill(new Rect(0, 0, W, H), new Color(0, 0, 0, 0.45f));
                var r = new Rect(W / 2 - 330, H / 2 - 190, 660, 380);
                GUI.Box(r, GUIContent.none, EryonSkin.PanelStyle);
                var head = new GUIStyle(EryonSkin.Title) { fontSize = 60, normal = { textColor = result.won ? EryonSkin.GoldBright : EryonSkin.Ember } };
                EryonSkin.Shadowed(new Rect(r.x, r.y + 26, r.width, 70), result.won ? "VÍTĚZSTVÍ" : "PORÁŽKA", head);
                EryonSkin.Ornament(new Rect(r.x + 60, r.y + 104, r.width - 120, 12));
                GUILayout.BeginArea(new Rect(r.x + 40, r.y + 130, r.width - 80, r.height - 150));
                if (arenaMode && arenaHonor == int.MinValue)
                {
                    if (result.won)
                        GUILayout.Label($"<color=#c8a8ff>+{result.xp} zkušeností</color>      <color=#f0d08a>◆ +{result.gold} zlata</color>", new GUIStyle(EryonSkin.Center) { fontSize = 26, font = EryonSkin.CormorantBold, richText = true });
                    else
                        GUILayout.Label($"<color=#c8a8ff>+{result.xp} zkušeností</color>  ·  Ustoupil jsi, ale přežil.", new GUIStyle(EryonSkin.Center) { fontSize = 24, richText = true });
                    if (result.levels > 0) GUILayout.Label("NOVÁ ÚROVEŇ!", new GUIStyle(EryonSkin.Title) { fontSize = 28 });
                    if (result.item != null && result.item.Valid)
                        GUILayout.Label($"Kořist: <color=#{ColorUtility.ToHtmlStringRGB(CharacterWindow.RarityColor(result.item.rarity))}>{result.item.name}</color>  <size=18>(v batohu – klávesa I)</size>", new GUIStyle(EryonSkin.Center) { fontSize = 24, richText = true, font = EryonSkin.CormorantBold });
                    if (result.won && !string.IsNullOrEmpty(StoryNote)) GUILayout.Label(StoryNote, new GUIStyle(EryonSkin.Center) { fontSize = 20, wordWrap = true, fontStyle = FontStyle.Italic });
                }
                else if (arenaMode)
                {
                    string hon = arenaHonor >= 0 ? $"<color=#9fd4f0>✦ +{arenaHonor} cti</color>" : $"<color=#e0672a>✦ {arenaHonor} cti</color>";
                    string gl = result.gold > 0 ? $"      <color=#f0d08a>◆ +{result.gold} zlata</color>" : "";
                    GUILayout.Label(hon + gl, new GUIStyle(EryonSkin.Center) { fontSize = 26, font = EryonSkin.CormorantBold });
                    GUILayout.Label(result.won ? "Dav v aréně skanduje tvé jméno." : "Tentokrát byl soupeř silnější. Trénuj a vrať se.", EryonSkin.Center);
                }
                else if (result.won)
                {
                    GUILayout.Label($"<color=#c8a8ff>+{result.xp} zkušeností</color>      <color=#f0d08a>◆ +{result.gold} zlata</color>", new GUIStyle(EryonSkin.Center) { fontSize = 26, font = EryonSkin.CormorantBold });
                    if (result.item != null && result.item.Valid)
                        GUILayout.Label($"Kořist: <color=#{ColorUtility.ToHtmlStringRGB(CharacterWindow.RarityColor(result.item.rarity))}>{result.item.name}</color>  <size=18>(v batohu – klávesa I)</size>", new GUIStyle(EryonSkin.Center) { fontSize = 24, richText = true, font = EryonSkin.CormorantBold });
                    if (result.levels > 0) GUILayout.Label("NOVÁ ÚROVEŇ!", new GUIStyle(EryonSkin.Title) { fontSize = 28 });
                    if (result.quests != null)
                        foreach (var q in result.quests)
                        {
                            var def = Content.Data.Quest(q);
                            var wq = boot.state?.Quest(q);
                            if (def != null) GUILayout.Label($"{def.title}: {wq?.progress}/{def.count}" + (wq?.state == "ready" ? "  –  hotovo!" : ""), EryonSkin.Center);
                        }
                }
                else GUILayout.Label(faction == "legie" ? "Padl jsi. Probudíš se v bezpečí tábora Legie." : "Padl jsi. Probudíš se v bezpečí u hradeb Kalidry.", new GUIStyle(EryonSkin.Center) { fontSize = 24 });
                GUILayout.FlexibleSpace();
                GUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("POKRAČOVAT", EryonSkin.ButtonPrimary, GUILayout.Height(54), GUILayout.Width(300))) CloseResult();
                GUILayout.FlexibleSpace();
                GUILayout.EndHorizontal();
                GUILayout.EndArea();
                return;
            }
            var prompt = NearPrompt();
            if (prompt != null && !fighting) NpcDialog.Prompt(W, H, "E", prompt.Replace("[E]  ", ""));
        }
    }
}

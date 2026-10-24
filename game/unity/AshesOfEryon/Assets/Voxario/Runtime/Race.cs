using System;
using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Běh na stadionu: u startovního sloupu (E) začne časovka – oběhni otočné sloupy (méty)
    /// v pořadí a vrať se na start. Čas měří server (ashes_race_start / ashes_race_finish),
    /// odměna 3× denně, za osobní rekord půldruhá. Aktivní méta má zapálenou pánev.
    /// </summary>
    public class Race : MonoBehaviour
    {
        public GameBootstrap boot;
        public static Race Instance { get; private set; }

        // start, tři méty, cíl = start (webové souřadnice x, z)
        public static readonly Vector2[] Course = { new Vector2(0, 15), new Vector2(30, -15), new Vector2(45, 25), new Vector2(-5, 40) };
        readonly List<Vector2> pts = new List<Vector2>();
        readonly List<Fire> fires = new List<Fire>();
        Transform startPost;

        [Serializable] public class Top { public string name, faction; public int best_ms; }
        [Serializable] class StartRes { public int best_ms, runs_left; public Top[] top; }
        [Serializable] class FinishRes { public int ms, best_ms, gold, xp, levels, runs_left; public bool record; public Top[] top; public GameState state; }

        bool running, busy;
        int next;              // index další méty (pts.Count = návrat na start)
        float startedAt;
        int bestMs, runsLeft = 3;
        Top[] top = new Top[0];
        string note;
        float noteUntil;

        public bool Running => running;
        void Awake() => Instance = this;

        /// <summary>Další cíl závodu (pro ukazatel), jinak null.</summary>
        public Vector3? Target => running ? WorldMap.ToWorld(Cur.x, Cur.y) : (Vector3?)null;
        Vector2 Cur => next < pts.Count ? pts[next] : pts[0];
        public Vector2? StartSpot => pts.Count > 0 ? pts[0] : (Vector2?)null;
        public string TargetLabel => next < pts.Count ? $"méta {next}/{pts.Count - 1}" : "cíl – startovní sloup";

        public void Build(Transform root)
        {
            pts.Clear(); fires.Clear(); running = false;
            foreach (var c in Course)
            {
                var p = c;
                // kdyby bod vyšel do vody, posune se k pevnině uprostřed pláně
                for (int i = 0; i < 30 && WorldMap.HeightAt(p.x, p.y) < 0.6f; i++) p = Vector2.MoveTowards(p, new Vector2(20, 10), 2f);
                pts.Add(p);
            }
            var stone = ModelLibrary.NewLit(new Color(0.86f, 0.83f, 0.76f), 0.25f);
            var bronze = ModelLibrary.NewLit(new Color(0.55f, 0.38f, 0.2f), 0.5f);
            for (int i = 0; i < pts.Count; i++)
            {
                var go = new GameObject(i == 0 ? "Stadion start" : "Méta " + i);
                go.transform.SetParent(root, false);
                go.transform.position = WorldMap.ToWorld(pts[i].x, pts[i].y);
                var col = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                col.transform.SetParent(go.transform, false);
                col.transform.localScale = new Vector3(0.7f, 1.6f, 0.7f);
                col.transform.localPosition = new Vector3(0, 1.6f, 0);
                col.GetComponent<Renderer>().sharedMaterial = stone;
                var bowl = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
                Destroy(bowl.GetComponent<Collider>());
                bowl.transform.SetParent(go.transform, false);
                bowl.transform.localScale = new Vector3(1.1f, 0.15f, 1.1f);
                bowl.transform.localPosition = new Vector3(0, 3.3f, 0);
                bowl.GetComponent<Renderer>().sharedMaterial = bronze;
                var f = Fire.Create(go.transform, go.transform.position + Vector3.up * 3.45f, 0.7f, i == 0);
                f.lit = i == 0;
                fires.Add(f);
                var tag = go.AddComponent<NameTag>();
                tag.title = i == 0 ? "Stadion – startovní sloup" : $"Méta {i}";
                tag.subtitle = i == 0 ? "běh kolem mét · E" : "";
                tag.height = 4.2f;
                if (i == 0) startPost = go.transform;
            }
        }

        float DistTo(Vector2 p) => boot.player == null ? 999 : Vector2.Distance(WorldMap.ToWeb(boot.player.transform.position), p);

        void SetLit(int idx)
        {
            for (int i = 0; i < fires.Count; i++) if (fires[i] != null) fires[i].lit = i == idx;
        }

        void Update()
        {
            if (!boot.inWorld || pts.Count == 0) { running = false; return; }
            bool fight = Encounters.Instance != null && Encounters.Instance.Busy;
            if (running)
            {
                if (fight || Time.time - startedAt > 290) { Abort("Závod přerušen."); return; }
                if (DistTo(Cur) < 3.2f)
                {
                    if (next < pts.Count) { next++; Sfx.Play("click", 2f); SetLit(next < pts.Count ? next : 0); }
                    else if (!busy) StartCoroutine(Finish());
                }
                return;
            }
            if (!busy && !fight && !Chat.Typing && DistTo(pts[0]) < 4f && KeyBinds.Down("interact")
                && (NpcDialog.Instance == null || !NpcDialog.Instance.IsOpen))
                StartCoroutine(Begin());
        }

        void Abort(string why)
        {
            running = false;
            SetLit(0);
            Note(why);
        }

        void Note(string s) { note = s; noteUntil = Time.time + 5; }

        IEnumerator Begin()
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_race_start", "{}", (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { Note(err); yield break; }
            var r = JsonUtility.FromJson<StartRes>(json);
            bestMs = r?.best_ms ?? 0; runsLeft = r?.runs_left ?? 0; top = r?.top ?? new Top[0];
            running = true;
            next = 1;
            startedAt = Time.time;
            SetLit(1);
            Sfx.Play("quest");
            Note(runsLeft > 0 ? "Běž! Oběhni méty v pořadí a vrať se ke startu." : "Běž! (Odměny na dnešek už máš – běží se o rekord.)");
        }

        IEnumerator Finish()
        {
            busy = true;
            running = false;
            SetLit(0);
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_race_finish", "{}", (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { Note(err); yield break; }
            var r = JsonUtility.FromJson<FinishRes>(json);
            if (r == null) yield break;
            if (r.state?.character != null) boot.state = r.state;
            bestMs = r.best_ms; runsLeft = r.runs_left; top = r.top ?? new Top[0];
            string t = Sec(r.ms);
            string reward = r.gold > 0 ? $"  +{r.gold} zlata, +{r.xp} zkušeností" : "";
            Note((r.record ? $"NOVÝ REKORD! {t}" : $"Doběhl jsi za {t} (rekord {Sec(r.best_ms)}).") + reward);
            Sfx.Play(r.levels > 0 ? "level" : r.record ? "quest" : "coin");
        }

        static string Sec(int ms) => (ms / 1000f).ToString("0.0", System.Globalization.CultureInfo.InvariantCulture).Replace('.', ',') + " s";

        void OnGUI()
        {
            if (!boot.inWorld || pts.Count == 0) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            float W = EryonSkin.W, H = EryonSkin.H;
            if (running)
            {
                var r = new Rect(W / 2 - 200, 176, 400, 74);
                EryonSkin.Fill(r, new Color(0.04f, 0.03f, 0.025f, 0.8f));
                EryonSkin.Fill(new Rect(r.x, r.y, r.width, 3), EryonSkin.Gold);
                GUI.Label(new Rect(r.x, r.y + 6, r.width, 36), Sec(Mathf.RoundToInt((Time.time - startedAt) * 1000)),
                    new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 32, normal = { textColor = EryonSkin.GoldBright } });
                GUI.Label(new Rect(r.x, r.y + 44, r.width, 24), (next < pts.Count ? $"Méta {next} z {pts.Count - 1}" : "Zpět ke startu!") + (bestMs > 0 ? $"   ·   rekord {Sec(bestMs)}" : ""),
                    new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleCenter });
            }
            else if (DistTo(pts[0]) < 4f && (Encounters.Instance == null || !Encounters.Instance.Busy))
            {
                NpcDialog.Prompt(W, H, "E", "Běh kolem mét (stadion)");
                if (top != null && top.Length > 0)
                {
                    string s = "NEJRYCHLEJŠÍ:  ";
                    for (int i = 0; i < top.Length && i < 3; i++) s += $"{i + 1}. {top[i].name} {Sec(top[i].best_ms)}    ";
                    GUI.Label(new Rect(W / 2 - 400, H - 280, 800, 24), s, new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleCenter });
                }
            }
            if (note != null && Time.time < noteUntil)
                EryonSkin.Shadowed(new Rect(W / 2 - 400, H - 250, 800, 30), note,
                    new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 22, normal = { textColor = EryonSkin.GoldBright } });
        }
    }
}

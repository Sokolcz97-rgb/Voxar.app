using System.Collections;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Aréna (Mistr arény v Kalidře / Mistr zápasů v táboře Legie): souboj s uloženou
    /// postavou jiného hráče. Výsledek a čest počítá server (ashes_arena_fight), hra
    /// souboj přehraje přes Encounters. Soupeř z druhé strany dává 1,5× více cti.
    /// </summary>
    public class Arena : MonoBehaviour
    {
        public GameBootstrap boot;
        public static Arena Instance { get; private set; }

        [System.Serializable]
        public class Opponent
        {
            public string id, name, @class, faction;
            public int level, honor, sila, obratnost, intelekt, vydrz, stesti, wmin, wmax, armor;
            public bool eryon, azkar;
            public Appearance appearance;
        }
        [System.Serializable] class OpponentList { public Opponent[] items; }
        [System.Serializable] public class Famous { public string name, @class, faction; public int level, honor, chapter; public bool eryon, azkar; }
        [System.Serializable] class FamousList { public Famous[] items; }
        Famous[] fame;
        bool fameTab, fameLoaded;

        bool open, busy, loaded;
        Opponent[] list = new Opponent[0];
        string error;
        Vector2 scroll;

        public bool IsOpen => open;
        void Awake() => Instance = this;

        public void Open()
        {
            open = true;
            loaded = false;
            error = null;
        }

        public void Close() => open = false;

        public void TestOpen()
        {
            open = true;
            loaded = true;
            list = new[]
            {
                new Opponent { id = "1", name = "Eryon", @class = "hoplit", faction = "kalidra", level = 12, honor = 640, eryon = true, appearance = new Appearance { gender = "m" } },
                new Opponent { id = "2", name = "Kassandra", @class = "vestec", faction = "legie", level = 4, honor = 85, appearance = new Appearance { gender = "f" } },
                new Opponent { id = "3", name = "Leonidas", @class = "lucistnik", faction = "kalidra", level = 3, honor = 40, appearance = new Appearance { gender = "m" } },
            };
        }

        void Update()
        {
            if (!boot.inWorld) { open = false; return; }
            if (open && !Chat.Typing && Input.GetKeyDown(KeyCode.Escape)) { open = false; UiFocus.MarkClosed(); }
            if (open && !loaded && !busy) StartCoroutine(Load());
            if (open && fameTab && !fameLoaded && !busy) StartCoroutine(LoadFame());
        }

        IEnumerator LoadFame()
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_hall_of_fame", "{}", (j, e) => { json = j; err = e; });
            busy = false;
            fameLoaded = true;
            if (err != null) { error = err; fame = new Famous[0]; yield break; }
            fame = JsonUtility.FromJson<FamousList>("{\"items\":" + (string.IsNullOrEmpty(json) ? "[]" : json) + "}")?.items ?? new Famous[0];
        }

        void FameList(Rect inner)
        {
            GUILayout.Label("Nejslavnější hrdinové podle cti.", EryonSkin.Small);
            if (!fameLoaded) { GUILayout.Label("Kronikář listuje svitky…", EryonSkin.Body); return; }
            scroll = GUILayout.BeginScrollView(scroll, GUIStyle.none, GUI.skin.verticalScrollbar, GUILayout.Height(inner.height - 190));
            int i = 0;
            var me = boot.state.character;
            string myName = string.IsNullOrEmpty(me.display_name) ? me.name : me.display_name;
            foreach (var f in fame ?? new Famous[0])
            {
                i++;
                bool mine = f.name == myName;
                GUILayout.BeginHorizontal(GUILayout.Height(48));
                GUILayout.Label($"<b>{i}.</b>", new GUIStyle(EryonSkin.H2) { richText = true, normal = { textColor = i <= 3 ? EryonSkin.GoldBright : EryonSkin.Text } }, GUILayout.Width(56));
                string legend = f.eryon ? " ★ Eryon" : f.azkar ? " ★ Azkar" : "";
                GUILayout.Label($"{(mine ? "<color=#9fd4f0>" : "")}<b>{f.name}</b>{legend}{(mine ? "  (ty)</color>" : "")}", new GUIStyle(EryonSkin.Body) { richText = true, fontSize = 21 }, GUILayout.Width(380));
                GUILayout.Label($"{EryonSkin.ClassName(f.@class)} · úr. {f.level} · kap. {f.chapter}", EryonSkin.Small, GUILayout.Width(280));
                GUILayout.Label(f.faction == "legie" ? "<color=#e0672a>Legie</color>" : "<color=#9fd4f0>Kalidra</color>", new GUIStyle(EryonSkin.Small) { richText = true }, GUILayout.Width(100));
                GUILayout.FlexibleSpace();
                GUILayout.Label($"<color=#9fd4f0>✦ {f.honor}</color>", new GUIStyle(EryonSkin.H2) { richText = true, alignment = TextAnchor.MiddleRight }, GUILayout.Width(120));
                GUILayout.EndHorizontal();
            }
            GUILayout.EndScrollView();
        }

        IEnumerator Load()
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_arena_opponents", "{}", (j, e) => { json = j; err = e; });
            busy = false;
            loaded = true;
            if (err != null) { error = err; list = new Opponent[0]; yield break; }
            list = JsonUtility.FromJson<OpponentList>("{\"items\":" + (string.IsNullOrEmpty(json) ? "[]" : json) + "}")?.items ?? new Opponent[0];
        }

        void OnGUI()
        {
            if (!open || !boot.inWorld || boot.state?.character == null) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            GUI.depth = -12;
            float W = EryonSkin.W, H = EryonSkin.H;
            var r = new Rect(W / 2 - 520, H / 2 - 370, 1040, 720);
            var inner = EryonSkin.DrawPanel(r, "Aréna");
            var me = boot.state.character;
            GUILayout.BeginArea(inner);
            GUILayout.Label("Zápas proti uložené postavě jiného hrdiny. Vítězství přináší čest a zlato, porážka trochu cti vezme. " +
                            "Soupeř z druhé strany války dává <color=#f0d08a>1,5× více cti</color> a posune hradbu. Mezi zápasy si musíš chvíli odpočinout.",
                new GUIStyle(EryonSkin.Small) { richText = true, fontSize = 17 });
            GUILayout.Label($"Tvá čest: <color=#9fd4f0>✦ {me.honor}</color>   ·   vítězství {me.wins} / porážky {me.losses}", new GUIStyle(EryonSkin.BodyBold) { richText = true });
            GUILayout.BeginHorizontal();
            if (EryonSkin.Toggle(!fameTab, "Soupeři", GUILayout.Height(36), GUILayout.Width(200))) fameTab = false;
            if (EryonSkin.Toggle(fameTab, "Síň slávy", GUILayout.Height(36), GUILayout.Width(200))) { fameTab = true; fameLoaded = false; }
            GUILayout.EndHorizontal();
            GUILayout.Space(6);
            if (fameTab)
            {
                FameList(inner);
                GUILayout.FlexibleSpace();
                if (error != null) GUILayout.Label($"<color=#e0672a>{error}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true });
                GUILayout.BeginHorizontal();
                GUILayout.FlexibleSpace();
                if (GUILayout.Button("ZAVŘÍT (Esc)", EryonSkin.ButtonPrimary, GUILayout.Height(46), GUILayout.Width(240))) open = false;
                GUILayout.EndHorizontal();
                GUILayout.EndArea();
                return;
            }
            if (!loaded) GUILayout.Label("Mistr arény vybírá soupeře…", EryonSkin.Body);
            else if (list.Length == 0) GUILayout.Label("Zatím tu není žádný jiný hrdina. Přiveď přátele!", EryonSkin.Body);
            scroll = GUILayout.BeginScrollView(scroll, GUIStyle.none, GUI.skin.verticalScrollbar, GUILayout.Height(inner.height - 230));
            GUI.enabled = !busy && Encounters.Instance != null && !Encounters.Instance.Busy;
            foreach (var o in list)
            {
                bool rival = o.faction != me.faction;
                GUILayout.BeginHorizontal(GUILayout.Height(84));
                var pr = GUILayoutUtility.GetRect(72, 72, GUILayout.Width(72), GUILayout.Height(72));
                EryonSkin.Portrait(pr, EryonSkin.PortraitFor(o.@class, o.appearance?.gender));
                GUILayout.Space(12);
                GUILayout.BeginVertical();
                string legend = o.eryon ? "  <color=#f0d08a>★ legenda – Eryon</color>" : o.azkar ? "  <color=#e0672a>★ legenda – Azkar</color>" : "";
                GUILayout.Label($"<b>{o.name}</b>{legend}", new GUIStyle(EryonSkin.Body) { fontSize = 23, richText = true });
                GUILayout.Label($"{EryonSkin.ClassName(o.@class)} · úroveň {o.level} · {EryonSkin.FactionName(o.faction)}" + (rival ? "  ·  <color=#e0672a>nepřítel (1,5× čest)</color>" : ""),
                    new GUIStyle(EryonSkin.Small) { richText = true });
                GUILayout.EndVertical();
                GUILayout.FlexibleSpace();
                GUILayout.Label($"<color=#9fd4f0>✦ {o.honor}</color>", new GUIStyle(EryonSkin.H2) { richText = true, alignment = TextAnchor.MiddleRight }, GUILayout.Width(110), GUILayout.Height(60));
                if (GUILayout.Button("VYZVAT", EryonSkin.ButtonPrimary, GUILayout.Width(170), GUILayout.Height(52)))
                {
                    var opp = o;
                    open = false;
                    Encounters.Instance.StartArena(opp.id, opp.@class, opp.appearance?.gender == "f" ? "f" : "m",
                        $"{opp.name} · úroveň {opp.level}", err => { error = err; open = true; loaded = true; });
                }
                GUILayout.EndHorizontal();
                EryonSkin.Fill(GUILayoutUtility.GetRect(inner.width - 30, 1), EryonSkin.Line);
            }
            GUI.enabled = true;
            GUILayout.EndScrollView();
            GUILayout.FlexibleSpace();
            if (error != null) GUILayout.Label($"<color=#e0672a>{error}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true });
            GUILayout.BeginHorizontal();
            if (GUILayout.Button("Obnovit soupeře", EryonSkin.Button, GUILayout.Height(44), GUILayout.Width(240))) { loaded = false; error = null; }
            GUILayout.FlexibleSpace();
            if (GUILayout.Button("ZAVŘÍT (Esc)", EryonSkin.ButtonPrimary, GUILayout.Height(46), GUILayout.Width(240))) open = false;
            GUILayout.EndHorizontal();
            GUILayout.EndArea();
        }
    }
}

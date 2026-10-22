using System;
using System.Collections;
using System.Globalization;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Světový boss: pirátský vůdce Thalassos se svou družinou na pláni u Památníku padlých. Životy jsou sdílené
    /// pro celý server (ashes_boss_state / ashes_boss_attack) – útočí na něj hráči obou stran,
    /// po pádu dostanou odměnu všichni, kdo se zapojili, a Thalassos se za 20 minut vrátí s novou posádkou.
    /// </summary>
    public class WorldBoss : MonoBehaviour
    {
        public GameBootstrap boot;
        public static WorldBoss Instance { get; private set; }
        public static Vector2 Spot = new Vector2(20, 50);

        [Serializable] public class Top { public string name; public int damage; }
        [Serializable]
        public class State
        {
            public string name, cls, respawn_at, killer;
            public int generation, hp, hp_max, my_damage;
            public bool alive;
            public Top[] top;
        }

        public State state;
        public CharacterView View { get; private set; }
        NameTag tag;
        readonly System.Collections.Generic.List<CharacterView> crew = new System.Collections.Generic.List<CharacterView>();
        float pollAt;
        bool polling;
        string note;
        float noteUntil;

        void Awake() => Instance = this;

        public void Build(Transform root, ModelLibrary lib)
        {
            state = null;
            var tpl = lib != null ? (lib.Hero("hoplit_m") ?? lib.Hero("hoplit_m_lo")) : null;
            // místo na souši (kdyby terén na zvoleném místě byl pod vodou, hledá se okolí)
            Spot = new Vector2(20, 50);
            if (WorldMap.HeightAt(Spot.x, Spot.y) < 0.6f)
                for (int i = 1; i < 40 && WorldMap.HeightAt(Spot.x, Spot.y) < 0.6f; i++)
                    Spot = new Vector2(20 + Mathf.Cos(i) * i * 0.8f, 50 - Mathf.Sin(i) * i * 0.8f - i * 0.3f);
            View = CharacterView.Create(tpl, root, 1.9f, "Thalassos");
            View.transform.position = WorldMap.ToWorld(Spot.x, Spot.y);
            View.transform.rotation = Quaternion.Euler(0, 200, 0);
            tag = View.gameObject.AddComponent<NameTag>();
            tag.title = "Thalassos, vůdce pirátů";
            tag.subtitle = "světový boss";
            tag.subtitleColor = new Color(1f, 0.45f, 0.3f);
            tag.enemy = true;
            tag.height = 2.7f;
            crew.Clear();
            for (int i = 0; i < 4; i++)
            {
                float a = i * Mathf.PI / 2 + 0.6f;
                var ct = lib != null ? (lib.Hero(i % 2 == 0 ? "lucistnik_m_lo" : "hoplit_m_lo") ?? tpl) : tpl;
                var c = CharacterView.Create(ct, root, 1.62f, "Pirát");
                c.transform.position = WorldMap.ToWorld(Spot.x + Mathf.Cos(a) * 3.2f, Spot.y + Mathf.Sin(a) * 3.2f);
                c.transform.rotation = Quaternion.Euler(0, 200 + i * 25, 0);
                crew.Add(c);
            }
            Fire.Create(root, WorldMap.ToWorld(Spot.x + 3.5f, Spot.y - 2) + Vector3.up * 0.1f, 0.5f, false);
            pollAt = 0;
        }

        float Dist => boot.player == null || View == null ? 999 : Vector3.Distance(boot.player.transform.position, View.transform.position);

        void Update()
        {
            if (!boot.inWorld || View == null) return;
            if (!polling && Time.time > pollAt) StartCoroutine(Poll());
            bool alive = state == null || state.alive;
            if (View.gameObject.activeSelf != alive)
            {
                View.gameObject.SetActive(alive);
                foreach (var c in crew) if (c != null) c.gameObject.SetActive(alive);
            }
            if (state != null && tag != null) tag.subtitle = state.alive ? $"světový boss · ❤ {state.hp} / {state.hp_max}" : "padl";
            bool busy = Encounters.Instance != null && Encounters.Instance.Busy;
            if (alive && !busy && !Chat.Typing && Dist < 7f && Input.GetKeyDown(KeyCode.E)
                && (NpcDialog.Instance == null || !NpcDialog.Instance.IsOpen))
            {
                Encounters.Instance?.StartBossAttack(View, e => { note = e; noteUntil = Time.time + 4; });
            }
        }

        IEnumerator Poll()
        {
            polling = true;
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_boss_state", "{}", (j, e) => { json = j; err = e; });
            polling = false;
            pollAt = Time.time + (Dist < 60 ? 6f : 25f);
            if (err == null && !string.IsNullOrEmpty(json)) state = JsonUtility.FromJson<State>(json);
        }

        /// <summary>Po útoku – rychlé obnovení stavu.</summary>
        public void Refresh() => pollAt = 0;

        void OnGUI()
        {
            if (!boot.inWorld || View == null) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            float d = Dist;
            if (d > 45 || state == null) return;
            EryonSkin.Begin();
            float W = EryonSkin.W, H = EryonSkin.H;
            bool fighting = Encounters.Instance != null && Encounters.Instance.Busy;
            if (!fighting)
            {
                var r = new Rect(W / 2 - 300, 176, 600, 30);
                if (state.alive)
                {
                    GUI.Label(new Rect(r.x, r.y - 30, r.width, 28), "THALASSOS, VŮDCE PIRÁTŮ  ·  SVĚTOVÝ BOSS", new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleCenter, fontSize = 17, normal = { textColor = new Color(1f, 0.55f, 0.4f) } });
                    EryonSkin.Bar(r, state.hp / (float)Mathf.Max(1, state.hp_max), EryonSkin.Blood * 1.6f, $"{state.hp} / {state.hp_max}");
                    string top = "";
                    if (state.top != null)
                        for (int i = 0; i < state.top.Length && i < 3; i++) top += $"{i + 1}. {state.top[i].name} ({state.top[i].damage})   ";
                    GUI.Label(new Rect(r.x, r.yMax + 4, r.width, 24), $"Tvé poškození: {state.my_damage}    {top}", new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleCenter });
                }
                else
                {
                    string when = "";
                    if (DateTimeOffset.TryParse(state.respawn_at ?? "", CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var t))
                    {
                        var left = t - DateTimeOffset.UtcNow;
                        when = left.TotalSeconds > 0 ? $" Vrátí se asi za {Mathf.CeilToInt((float)left.TotalMinutes)} min." : " Brzy se vrátí.";
                    }
                    EryonSkin.Shadowed(new Rect(r.x - 100, r.y, r.width + 200, 30), $"Thalassos padl{(string.IsNullOrEmpty(state.killer) ? "" : $" – poslední ránu zasadil {state.killer}")}.{when}",
                        new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 22, normal = { textColor = EryonSkin.GoldBright } });
                }
            }
            if (state.alive && !fighting && d < 7f) NpcDialog.Prompt(W, H, "E", "Zaútočit na Thalassose");
            if (note != null && Time.time < noteUntil)
                EryonSkin.Shadowed(new Rect(W / 2 - 330, H - 232, 660, 30), note, new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, fontSize = 22, normal = { textColor = EryonSkin.Ember } });
        }
    }
}

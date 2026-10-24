using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Rádce „Co dál“ pod rámečkem postavy: podle stavu postavy ukáže jeden další krok
    /// (úkol, odevzdání, výprava, výbava, trénink). Klávesa H ho skryje / zobrazí.
    /// </summary>
    public class Guide : MonoBehaviour
    {
        public GameBootstrap boot;
        bool hidden;

        void Start() => hidden = PlayerPrefs.GetInt("ui.guide.hidden", 0) == 1;

        void Update()
        {
            if (!boot.inWorld || Chat.Typing) return;
            if (KeyBinds.Down("guide"))
            {
                hidden = !hidden;
                PlayerPrefs.SetInt("ui.guide.hidden", hidden ? 1 : 0);
            }
        }

        static string NpcName(string id)
        {
            foreach (var n in WorldMap.Npcs) if (n.id == id) return $"{n.name} ({n.role})";
            return id;
        }

        static bool Unlocked(Content.QuestDef q, GameState st)
        {
            foreach (var r in q.req ?? new string[0])
            {
                var w = st.Quest(r);
                if (w == null || w.state != "done") return false;
            }
            return true;
        }

        /// <summary>Jedna věta s dalším krokem.</summary>
        public string NextStep()
        {
            var st = boot.state;
            if (st?.character == null) return null;
            string fac = string.IsNullOrEmpty(st.character.faction) ? "kalidra" : st.character.faction;
            var data = Content.Data;
            // 1) hotový úkol k odevzdání
            foreach (var q in data.quests)
            {
                var w = st.Quest(q.id);
                if (w != null && w.state == "ready") return $"Odevzdej úkol „{q.title}“ – vrať se za: {NpcName(q.giver)}.";
            }
            // 2) rozpracovaný úkol
            foreach (var q in data.quests)
            {
                var w = st.Quest(q.id);
                if (w != null && w.state == "active")
                    return string.IsNullOrEmpty(q.objective) ? $"Pokračuj v úkolu „{q.title}“." : $"{q.title}: {q.objective}" + (q.count > 1 ? $" ({w.progress}/{q.count})" : "");
            }
            // 3) nový úkol od NPC (vykřičník nad hlavou)
            foreach (var q in data.quests)
                if (q.faction == fac && st.Quest(q.id) == null && Unlocked(q, st))
                    return $"Nový úkol čeká u: {NpcName(q.giver)} – nad hlavou má zlatý vykřičník. Přijdi k němu a stiskni E.";
            if (st.GiftReady) return "Čeká na tebe denní dar – otevři Kroniku (K) a vyzvedni si zlato a zkušenosti.";
            // 4) výprava z Kroniky
            var rem = Chronicle.Instance?.Remaining;
            if (rem.HasValue && rem.Value.TotalSeconds <= 0) return "Výprava skončila – otevři Kroniku (K) a dokonči ji soubojem.";
            if (!rem.HasValue && st.quests != null && st.quests.Length > 0 && st.character.courage >= 10)
                return "Otevři Kroniku (K) a vydej se na výpravu – posuneš příběh kapitoly.";
            if (st.chapter != null && st.chapter.need > 0 && st.character.chapter_progress >= st.chapter.need)
                return $"Kapitola je připravená: v Kronice (K) vyzvi strážce – {st.chapter.boss?.e}.";
            // 5) výbava v batohu / trénink
            if (st.items != null)
                foreach (var it in st.items)
                    if (!it.equipped && it.level <= st.character.level + 2)
                    {
                        bool slotEmpty = true;
                        foreach (var e in st.items) if (e.equipped && e.slot == it.slot) slotEmpty = false;
                        if (slotEmpty) return $"V batohu máš {it.name} na volný slot – nasaď ho v okně Batoh (I).";
                    }
            var tc = st.train_cost;
            if (tc != null)
            {
                int cheapest = Mathf.Min(Mathf.Min(tc.sila, tc.obratnost), Mathf.Min(Mathf.Min(tc.intelekt, tc.vydrz), tc.stesti));
                if (cheapest > 0 && st.character.gold >= cheapest * 2) return "Máš dost zlata – natrénuj vlastnosti v okně Postava (C).";
            }
            var wb = WorldBoss.Instance;
            if (wb?.state != null && wb.state.alive && st.character.level >= 2)
                return "Na pláni u Památníku padlých táboří pirátský vůdce Thalassos se svou družinou (rudý bod na mapě). Spoj síly s ostatními – přijdi k němu a stiskni E.";
            return fac == "legie"
                ? "Bojuj s obránci Kalidry v kraji, zkus arénu u Mistra zápasů, navštiv kováře Rukmara nebo si zaběhni kolo kolem mét na stadionu (bílý sloup na pláni)."
                : "Bojuj s Legií v kraji, zkus arénu u Mistra arény, navštiv kováře Tharose nebo si zaběhni kolo kolem mét na stadionu (bílý sloup na pláni).";
        }

        void OnGUI()
        {
            if (hidden || !boot.inWorld) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            if (Encounters.Instance != null && Encounters.Instance.Busy) return;
            if ((CharacterWindow.Instance != null && CharacterWindow.Instance.IsOpen) || (Chronicle.Instance != null && Chronicle.Instance.IsOpen) || (Arena.Instance != null && Arena.Instance.IsOpen)) return;
            var step = NextStep();
            if (string.IsNullOrEmpty(step)) return;
            EryonSkin.Begin();
            // nahoře uprostřed (vlevo je rámeček postavy a ukázkový mód Deník poutníka)
            var r = new Rect(EryonSkin.W / 2 - 280, 70, 560, 96);
            EryonSkin.Fill(r, new Color(0.04f, 0.03f, 0.025f, 0.78f));
            EryonSkin.Fill(new Rect(r.x, r.y, 3, r.height), EryonSkin.Gold);
            GUI.Label(new Rect(r.x + 14, r.y + 6, r.width - 28, 22), "CO DÁL", EryonSkin.Caps);
            GUI.Label(new Rect(r.x + 14, r.y + 6, r.width - 28, 22), "H – skrýt rádce", new GUIStyle(EryonSkin.Small) { fontSize = 13, alignment = TextAnchor.MiddleRight });
            GUI.Label(new Rect(r.x + 14, r.y + 28, r.width - 28, r.height - 32), step, new GUIStyle(EryonSkin.Body) { fontSize = 19, wordWrap = true });
        }
    }
}

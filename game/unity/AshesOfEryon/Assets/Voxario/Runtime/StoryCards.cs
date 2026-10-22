using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Velké příběhové karty: úvod kapitoly (při prvním vstupu do světa a po poražení
    /// strážce kapitoly) a oslava nové úrovně. Kapitolu si pamatuje pro každou postavu zvlášť.
    /// </summary>
    public class StoryCards : MonoBehaviour
    {
        public GameBootstrap boot;
        string cardTitle, cardSub, cardText;
        float cardUntil;
        int lastLevel = -1;
        string lastName;
        float levelUntil;
        int levelShown;

        public bool CardOpen => cardTitle != null && Time.time < cardUntil;

        void Start()
        {
            // samotest v CI fotí okna – karty by je zakryly
            if (System.Array.IndexOf(System.Environment.GetCommandLineArgs(), "-voxario-selftest") >= 0) enabled = false;
        }

        void Update()
        {
            var st = boot.state;
            if (!boot.inWorld || st?.character == null || string.IsNullOrEmpty(st.character.name)) { lastLevel = -1; return; }
            var ch = st.character;
            if (lastName != ch.name) { lastName = ch.name; lastLevel = ch.level; }
            // nová úroveň
            if (ch.level > lastLevel && lastLevel > 0)
            {
                levelShown = ch.level;
                levelUntil = Time.time + 4f;
                Sfx.Play("level");
            }
            lastLevel = ch.level;
            // kapitola
            var chap = st.chapter;
            if (chap != null && chap.n > 0 && !string.IsNullOrEmpty(chap.title))
            {
                string key = $"ashes.chapterSeen.{ch.name}.{ch.faction}";
                if (PlayerPrefs.GetInt(key, 0) < chap.n && !(Encounters.Instance != null && Encounters.Instance.Busy))
                {
                    PlayerPrefs.SetInt(key, chap.n);
                    cardTitle = $"Kapitola {Roman(chap.n)}";
                    cardSub = chap.title;
                    cardText = chap.intro;
                    cardUntil = Time.time + 12f;
                }
            }
            if (CardOpen && (Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Escape) || Input.GetMouseButtonDown(0)))
            {
                cardUntil = 0;
                UiFocus.MarkClosed();
            }
        }

        static string Roman(int n) => n switch { 1 => "I", 2 => "II", 3 => "III", 4 => "IV", 5 => "V", 6 => "VI", 7 => "VII", 8 => "VIII", _ => n.ToString() };

        void OnGUI()
        {
            if (!boot.inWorld) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            float W = EryonSkin.W, H = EryonSkin.H;
            if (CardOpen)
            {
                GUI.depth = -15;
                float fade = Mathf.Clamp01((cardUntil - Time.time) / 1.2f);
                EryonSkin.Fill(new Rect(0, 0, W, H), new Color(0, 0, 0, 0.55f * fade));
                var old = GUI.color;
                GUI.color = new Color(1, 1, 1, fade);
                EryonSkin.Shadowed(new Rect(0, H * 0.3f, W, 40), cardTitle.ToUpperInvariant(), new GUIStyle(EryonSkin.Caps) { alignment = TextAnchor.MiddleCenter, fontSize = 24, normal = { textColor = EryonSkin.Gold } });
                EryonSkin.Shadowed(new Rect(0, H * 0.3f + 40, W, 90), cardSub, new GUIStyle(EryonSkin.Title) { fontSize = 66, alignment = TextAnchor.MiddleCenter, normal = { textColor = EryonSkin.GoldBright } });
                EryonSkin.Ornament(new Rect(W / 2 - 260, H * 0.3f + 138, 520, 12));
                if (!string.IsNullOrEmpty(cardText))
                    EryonSkin.Shadowed(new Rect(W / 2 - 520, H * 0.3f + 166, 1040, 140), cardText, new GUIStyle(EryonSkin.Body) { fontSize = 26, wordWrap = true, alignment = TextAnchor.UpperCenter, fontStyle = FontStyle.Italic });
                GUI.Label(new Rect(0, H * 0.3f + 320, W, 30), "Mezerník nebo kliknutí – pokračovat", new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleCenter });
                GUI.color = old;
            }
            if (Time.time < levelUntil && !CardOpen)
            {
                float t = 4f - (levelUntil - Time.time);
                float a = Mathf.Clamp01(t * 3) * Mathf.Clamp01((levelUntil - Time.time) / 0.8f);
                var old = GUI.color;
                GUI.color = new Color(1, 1, 1, a);
                EryonSkin.Shadowed(new Rect(0, H * 0.22f, W, 80), "NOVÁ ÚROVEŇ", new GUIStyle(EryonSkin.Title) { fontSize = 58, alignment = TextAnchor.MiddleCenter, normal = { textColor = EryonSkin.GoldBright } });
                EryonSkin.Shadowed(new Rect(0, H * 0.22f + 78, W, 40), $"Dosáhl jsi {levelShown}. úrovně – víc životů a lepší kořist. Trénuj vlastnosti (C).", new GUIStyle(EryonSkin.Body) { fontSize = 24, alignment = TextAnchor.MiddleCenter });
                GUI.color = old;
            }
        }
    }
}

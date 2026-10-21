using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Okno hry:
    /// • při minimalizaci (okno 0×0) se nevykresluje – DLSS a dynamické rozlišení
    ///   s nulovou velikostí obrazu hru shazovaly,
    /// • na pozadí se šetří grafická karta (nižší FPS),
    /// • hra drží vybraný monitor – po návratu z minimalizace ho vrátí zpět.
    /// </summary>
    public class WindowGuard : MonoBehaviour
    {
        public GameBootstrap boot;
        bool hidden;
        bool focused = true;
        int savedFps;
        float checkAt;
        bool moving;

        public static List<DisplayInfo> Displays()
        {
            var list = new List<DisplayInfo>();
            Screen.GetDisplayLayout(list);
            return list;
        }

        public static string SavedDisplay => PlayerPrefs.GetString("gfx.display", "");

        public static string Key(DisplayInfo d) => $"{d.name}|{d.width}x{d.height}|{d.workArea.x},{d.workArea.y}";
        FullScreenMode lastMode;

        /// <summary>Změna režimu okna – vždy na uloženém monitoru.</summary>
        public void SetMode(FullScreenMode mode)
        {
            StartCoroutine(ChangeMode(mode));
        }

        IEnumerator ChangeMode(FullScreenMode mode)
        {
            DisplayInfo? target = SavedInfo();
            if (target.HasValue && CurrentKey() != Key(target.Value))
                yield return Move(target.Value);
            var d = target ?? Screen.mainWindowDisplayInfo;
            if (mode == FullScreenMode.Windowed) Screen.SetResolution(Mathf.Min(1600, d.width - 80), Mathf.Min(900, d.height - 80), mode);
            else Screen.SetResolution(d.width, d.height, mode);
            PlayerPrefs.SetInt("gfx.mode", (int)mode);
            yield return null;
            yield return null;
            lastMode = Screen.fullScreenMode;
            RestoreMonitor();
        }

        static DisplayInfo? SavedInfo()
        {
            string saved = SavedDisplay;
            if (string.IsNullOrEmpty(saved)) return null;
            foreach (var d in Displays()) if (Key(d) == saved) return d;
            return null;
        }

        public static string CurrentKey() => Key(Screen.mainWindowDisplayInfo);

        public void MoveTo(DisplayInfo d)
        {
            PlayerPrefs.SetString("gfx.display", Key(d));
            PlayerPrefs.Save();
            StartCoroutine(Move(d));
        }

        IEnumerator Move(DisplayInfo d)
        {
            moving = true;
            var mode = Screen.fullScreenMode;
            yield return Screen.MoveMainWindowTo(d, mode == FullScreenMode.Windowed ? new Vector2Int(d.width / 2 - Screen.width / 2, d.height / 2 - Screen.height / 2) : Vector2Int.zero);
            if (mode != FullScreenMode.Windowed) Screen.SetResolution(d.width, d.height, mode);
            yield return null;
            moving = false;
        }

        IEnumerator Start()
        {
            // po spuštění na uložený monitor (při prvním spuštění si zapamatuje aktuální)
            yield return null;
            if (string.IsNullOrEmpty(SavedDisplay)) { PlayerPrefs.SetString("gfx.display", CurrentKey()); PlayerPrefs.Save(); }
            lastMode = Screen.fullScreenMode;
            RestoreMonitor();
        }

        void RestoreMonitor()
        {
            string saved = SavedDisplay;
            if (string.IsNullOrEmpty(saved) || moving) return;
            if (CurrentKey() == saved) return;
            foreach (var d in Displays())
                if (Key(d) == saved) { StartCoroutine(Move(d)); return; }
        }

        void OnApplicationFocus(bool on)
        {
            focused = on;
            Debug.Log($"[Voxario] fokus {on} {Screen.width}x{Screen.height} {Screen.fullScreenMode}");
            if (on)
            {
                checkAt = Time.unscaledTime + 0.5f;
                if (savedFps != 0) { Application.targetFrameRate = savedFps; savedFps = 0; }
            }
            else
            {
                savedFps = Application.targetFrameRate == 0 ? -1 : Application.targetFrameRate;
                Application.targetFrameRate = 30;
            }
        }

        void Update()
        {
            // minimalizované okno: nekreslit (DLSS s nulovým rozlišením padá)
            bool tiny = Screen.width < 64 || Screen.height < 64;
            if (tiny != hidden)
            {
                hidden = tiny;
                if (boot.cam != null) boot.cam.enabled = !tiny;
            }
            if (focused && checkAt > 0 && Time.unscaledTime > checkAt)
            {
                checkAt = 0;
                if (Screen.fullScreenMode != FullScreenMode.Windowed) RestoreMonitor();
            }
            // přepnutí režimu (Alt+Enter) – hlídat monitor
            if (Screen.fullScreenMode != lastMode && !moving)
            {
                lastMode = Screen.fullScreenMode;
                Debug.Log($"[Voxario] režim okna {lastMode} {Screen.width}x{Screen.height}");
                checkAt = Time.unscaledTime + 0.3f;
            }
        }
    }
}

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

        static string Key(DisplayInfo d) => $"{d.name}|{d.width}x{d.height}|{d.workArea.x},{d.workArea.y}";

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
            // po spuštění na uložený monitor
            yield return null;
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
        }
    }
}

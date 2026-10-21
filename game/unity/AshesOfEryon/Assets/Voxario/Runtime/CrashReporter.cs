using System.Collections;
using System.IO;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Když minulý běh hry spadl, pošle po přihlášení konec jeho logu na server
    /// (ashes_report_crash), aby šlo pád opravit bez posílání souborů ručně.
    /// </summary>
    public static class CrashReporter
    {
        static bool sent;
        /// <summary>Hláška pro hráče po pádu (zobrazí se na přihlašovací obrazovce).</summary>
        public static string Notice;

        /// <summary>
        /// Volá se při startu hry (před nastavením kamery). Když minulý běh spadl se zapnutým
        /// DLSS a stalo se to už podruhé po sobě, přepne zvětšování na FSR 2.
        /// </summary>
        public static void CheckPrevious()
        {
            try
            {
                var dir = Path.GetDirectoryName(Application.consoleLogPath);
                var prev = Path.Combine(dir ?? "", "Player-prev.log");
                if (!File.Exists(prev)) return;
                var text = File.ReadAllText(prev);
                bool crashed = text.Contains("Crash!!!");
                if (!crashed) { PlayerPrefs.SetInt("gfx.dlssCrashes", 0); return; }
                Notice = "Hra se minule neočekávaně ukončila. Hlášení se po přihlášení odešle vývojářům.";
                if (Upscaling.CurrentMode == Upscaling.Mode.DLSS)
                {
                    int n = PlayerPrefs.GetInt("gfx.dlssCrashes", 0) + 1;
                    PlayerPrefs.SetInt("gfx.dlssCrashes", n);
                    if (n >= 2)
                    {
                        Upscaling.Save(Upscaling.Mode.FSR2, Upscaling.CurrentQuality);
                        PlayerPrefs.SetInt("gfx.dlssCrashes", 0);
                        Notice = "Hra minule dvakrát spadla se zapnutým DLSS – pro jistotu jsme přepnuli na AMD FSR 2. DLSS můžeš znovu zapnout v Nastavení → Grafika.";
                    }
                }
                Debug.Log("[Voxario] minulý běh spadl; upscaler " + Upscaling.CurrentMode);
            }
            catch { }
        }

        public static IEnumerator SendIfCrashed(SupabaseClient api)
        {
            if (sent || !api.SignedIn) yield break;
            sent = true;
            string log = null;
            try
            {
                var dir = Path.GetDirectoryName(Application.consoleLogPath);
                var prev = Path.Combine(dir ?? "", "Player-prev.log");
                if (File.Exists(prev))
                {
                    var text = File.ReadAllText(prev);
                    bool crashed = text.Contains("Crash!!!") || text.Contains("Fatal error") || !text.Contains("[Voxario] konec");
                    if (crashed && text.Length > 50) log = Extract(text);
                }
            }
            catch { }
            if (log == null) yield break;
            string args = "{\"p_version\":" + Q(Application.version) + ",\"p_gpu\":" + Q($"{SystemInfo.graphicsDeviceName} · {SystemInfo.graphicsDeviceType} · {SystemInfo.operatingSystem}") + ",\"p_log\":" + Q(log) + "}";
            yield return api.Rpc("ashes_report_crash", args, (_, __) => { });
        }

        static string Q(string s) => MiniJson.Write(s ?? "");

        /// <summary>Podstatné části logu: hlášky hry, text před pádem a výpis zásobníku (bez seznamu knihoven).</summary>
        static string Extract(string text)
        {
            var sb = new System.Text.StringBuilder();
            var lines = text.Split('\n');
            var vox = new System.Collections.Generic.List<string>();
            foreach (var l in lines) if (l.Contains("[Voxario]") || l.Contains("Exception") || l.Contains("[Mod ")) vox.Add(l.TrimEnd());
            sb.AppendLine("=== hlášky hry ===");
            foreach (var l in vox.GetRange(System.Math.Max(0, vox.Count - 60), System.Math.Min(60, vox.Count))) sb.AppendLine(l);
            int crash = text.IndexOf("Crash!!!", System.StringComparison.Ordinal);
            if (crash > 0)
            {
                sb.AppendLine("=== před pádem ===");
                int from = System.Math.Max(0, crash - 6000);
                sb.AppendLine(text.Substring(from, crash - from));
            }
            int stack = text.IndexOf("OUTPUTTING STACK TRACE", System.StringComparison.Ordinal);
            sb.AppendLine("=== zásobník ===");
            sb.AppendLine(stack > 0 ? text.Substring(stack, System.Math.Min(8000, text.Length - stack)) : text.Substring(System.Math.Max(0, text.Length - 6000)));
            var r = sb.ToString();
            return r.Length > 28000 ? r.Substring(0, 28000) : r;
        }
    }
}

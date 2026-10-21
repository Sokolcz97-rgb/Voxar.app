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
                    if (crashed && text.Length > 50) log = text.Length > 28000 ? text.Substring(text.Length - 28000) : text;
                }
            }
            catch { }
            if (log == null) yield break;
            string args = "{\"p_version\":" + Q(Application.version) + ",\"p_gpu\":" + Q($"{SystemInfo.graphicsDeviceName} · {SystemInfo.graphicsDeviceType} · {SystemInfo.operatingSystem}") + ",\"p_log\":" + Q(log) + "}";
            yield return api.Rpc("ashes_report_crash", args, (_, __) => { });
        }

        static string Q(string s) => MiniJson.Write(s ?? "");
    }
}

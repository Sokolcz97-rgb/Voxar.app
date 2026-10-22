using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Průběh úhlů kloubů během jednoho kroku, vytažený při sestavení z animace Mixamo
    /// (Resources/gait_*.json, viz VoxarioBuild.ExtractGaits). Úhly ve stupních v rovině
    /// kroku: + = dopředu (stehno, paže), koleno a loket + = pokrčení.
    /// </summary>
    public class Gait
    {
        static readonly Dictionary<string, Gait> cache = new Dictionary<string, Gait>();

        readonly Dictionary<string, float[]> curves = new Dictionary<string, float[]>();
        public int Cycles { get; private set; } = 1;
        public float Length { get; private set; } = 1;
        float offset; // posun, aby fáze seděla s procedurální chůzí (levá noha vpředu ve 3/4 cyklu)

        public static Gait Load(string name)
        {
            if (cache.TryGetValue(name, out var g)) return g;
            g = null;
            var ta = Resources.Load<TextAsset>(name);
            if (ta != null)
            {
                try
                {
                    var obj = MiniJson.Obj(MiniJson.Parse(ta.text));
                    g = new Gait { Cycles = Mathf.Max(1, (int)MiniJson.N(obj, "cycles", 1)), Length = Mathf.Max(0.1f, (float)MiniJson.N(obj, "length", 1)) };
                    foreach (var kv in obj)
                        if (kv.Value is List<object> list)
                        {
                            var arr = new float[list.Count];
                            for (int i = 0; i < arr.Length; i++) arr[i] = System.Convert.ToSingle(list[i], System.Globalization.CultureInfo.InvariantCulture);
                            g.curves[kv.Key] = arr;
                        }
                    if (!g.curves.ContainsKey("thighL") || !g.curves.ContainsKey("thighR")) g = null;
                    else
                    {
                        var l = g.curves["thighL"]; var r = g.curves["thighR"];
                        int best = 0;
                        for (int i = 1; i < l.Length; i++) if (l[i] - r[i] > l[best] - r[best]) best = i;
                        g.offset = best / (float)l.Length;
                        Debug.Log($"[Voxario] chůze {name}: cyklů {g.Cycles}, vzorků {l.Length}");
                    }
                }
                catch (System.Exception e) { Debug.LogWarning($"[Voxario] chůze {name}: {e.Message}"); g = null; }
            }
            cache[name] = g;
            return g;
        }

        /// <summary>Fáze kroku (radiány, 2π = levý + pravý krok) → čas v klipu 0..1.</summary>
        public float T(float phase)
        {
            float cyc = phase / (2 * Mathf.PI);
            float t = (cyc - 0.75f) / Cycles + offset;
            return t - Mathf.Floor(t);
        }

        /// <summary>Čas v klipu podle skutečného času (klidový postoj).</summary>
        public float TTime(float seconds)
        {
            float t = seconds / Length;
            return t - Mathf.Floor(t);
        }

        public float Sample(string key, float t)
        {
            if (!curves.TryGetValue(key, out var a) || a.Length == 0) return 0;
            float f = t * a.Length;
            int i = (int)f % a.Length;
            int j = (i + 1) % a.Length;
            return Mathf.Lerp(a[i], a[j], f - Mathf.Floor(f));
        }

        public float Mean(string key)
        {
            if (!curves.TryGetValue(key, out var a) || a.Length == 0) return 0;
            float s = 0;
            foreach (var v in a) s += v;
            return s / a.Length;
        }
    }
}

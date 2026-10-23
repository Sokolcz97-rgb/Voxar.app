using System;
using System.Collections;
using System.Collections.Generic;
using System.Globalization;
using System.Reflection;
using UnityEngine;
using UnityEngine.Networking;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace Voxario.Ashes
{
    /// <summary>
    /// Moře s vlnami (vodní systém HDRP): vzdouvání a vlnky podle větru, pěna na hřebenech,
    /// barva a průhlednost podle hloubky, kaustiky na dně, vlny lámající se u pobřeží.
    /// Vítr a oblačnost se berou ze skutečného počasí nad Egejským mořem (Pireus, Open-Meteo).
    /// Na kvalitě Nízká zůstává jednoduchá rovná hladina. API vodního systému se mezi verzemi
    /// HDRP mění, proto se vše nastavuje přes reflexi – co chybí, se jen zapíše do logu.
    /// </summary>
    public class Ocean : MonoBehaviour
    {
        public static Ocean Instance { get; private set; }

        /// <summary>Vítr v km/h (z počasí, výchozí mírný).</summary>
        public static float WindKmh { get; private set; } = 14f;
        /// <summary>Odkud vítr fouká (°, 0 = sever).</summary>
        public static float WindFrom { get; private set; } = 330f;
        /// <summary>Oblačnost 0..1 (z počasí).</summary>
        public static float CloudCover { get; private set; } = 0.3f;
        /// <summary>Přibližná výška vln v metrech (pro houpání lodí).</summary>
        public static float WaveHeight => Mathf.Clamp(0.08f + WindKmh * 0.025f, 0.08f, 1.6f);
        public static bool Live { get; private set; }

        Component surface;
        GameObject flatSea;
        readonly List<Component> shore = new List<Component>();
        int quality = -1;
        static bool loggedFields;

        public static void Create(Transform root, GameObject flat)
        {
            var go = new GameObject("Ocean");
            go.transform.SetParent(root, false);
            var o = go.AddComponent<Ocean>();
            o.flatSea = flat;
            Instance = o;
        }

        void Start()
        {
            Apply(PlayerPrefs.GetInt("gfx.quality", 2));
            StartCoroutine(Weather());
        }

        void OnDestroy() { if (Instance == this) Instance = null; }

        static bool WaterSupported()
        {
            try
            {
                var asset = GraphicsSettings.currentRenderPipeline as HDRenderPipelineAsset;
                if (asset == null) return false;
                object s = asset.currentPlatformRenderPipelineSettings;
                var f = s.GetType().GetField("supportWater", BindingFlags.Public | BindingFlags.Instance);
                return f != null && (bool)f.GetValue(s);
            }
            catch { return false; }
        }

        // ---------------------------------------------------------------- reflexe
        static void Set(object o, string name, object value)
        {
            if (o == null) return;
            var t = o.GetType();
            try
            {
                var f = t.GetField(name, BindingFlags.Public | BindingFlags.Instance);
                if (f != null) { f.SetValue(o, Convert(value, f.FieldType)); return; }
                var p = t.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
                if (p != null && p.CanWrite) { p.SetValue(o, Convert(value, p.PropertyType)); return; }
                Debug.Log($"[Voxario] moře: {t.Name} nemá „{name}“");
            }
            catch (Exception e) { Debug.Log($"[Voxario] moře: {name} – {e.Message}"); }
        }

        static object Convert(object v, Type to)
        {
            if (v == null) return null;
            if (to.IsEnum) return v is string s ? Enum.Parse(to, s) : Enum.ToObject(to, v);
            if (to.IsInstanceOfType(v)) return v;
            return System.Convert.ChangeType(v, to, CultureInfo.InvariantCulture);
        }

        static Type HdType(string name) => typeof(HDRenderPipelineAsset).Assembly.GetType("UnityEngine.Rendering.HighDefinition." + name);

        // ---------------------------------------------------------------- kvalita
        /// <summary>0–1 = vlny, 2 = + pěna a kaustiky, 3 = + teselace a příboj u břehu</summary>
        public void Apply(int q)
        {
            if (q == quality) return;
            quality = q;
            // vlny jsou na všech kvalitách (na nízké bez pěny, kaustik a teselace)
            bool water = WaterSupported();
            if (flatSea != null) flatSea.SetActive(!water);
            if (!water)
            {
                if (surface != null) surface.gameObject.SetActive(false);
                foreach (var d in shore) if (d != null) d.gameObject.SetActive(false);
                Live = false;
                Debug.Log($"[Voxario] moře: rovná hladina (kvalita {q}, vodní systém {(WaterSupported() ? "ano" : "ne")})");
                return;
            }
            if (surface == null) BuildSurface();
            if (surface == null) { if (flatSea != null) flatSea.SetActive(true); return; }
            surface.gameObject.SetActive(true);
            Live = true;
            Set(surface, "foam", q >= 2);
            Set(surface, "caustics", q >= 2);
            Set(surface, "cpuSimulation", false);
            Set(surface, "tessellation", q >= 3);
            Set(surface, "deformation", q >= 3);
            if (q >= 3 && shore.Count == 0) BuildShore();
            foreach (var d in shore) if (d != null) d.gameObject.SetActive(q >= 3);
            ApplyWind();
        }

        void BuildSurface()
        {
            var t = HdType("WaterSurface");
            if (t == null) { Debug.Log("[Voxario] moře: WaterSurface v této verzi HDRP není"); return; }
            var go = new GameObject("Moře (vlny)");
            go.transform.SetParent(transform, false);
            go.transform.position = new Vector3(0, 0f, 0);
            try { surface = go.AddComponent(t); }
            catch (Exception e) { Debug.Log("[Voxario] moře: " + e.Message); Destroy(go); return; }
            if (!loggedFields)
            {
                loggedFields = true;
                var names = new List<string>();
                foreach (var f in t.GetFields(BindingFlags.Public | BindingFlags.Instance)) names.Add(f.Name);
                Debug.Log("[Voxario] WaterSurface: " + string.Join(", ", names));
            }
            Set(surface, "surfaceType", "OceanSeaLake");
            Set(surface, "geometryType", "Infinite");
            Set(surface, "timeMultiplier", 1f);
            Set(surface, "repetitionSize", 500f);
            Set(surface, "ripples", true);
            // barva: u břehu tyrkysová a průhledná, v hloubce tmavě modrá
            Set(surface, "refractionColor", new Color(0.1f, 0.5f, 0.55f));
            Set(surface, "maxRefractionDistance", 1.2f);
            Set(surface, "absorptionDistance", 6f);
            Set(surface, "scatteringColor", new Color(0.02f, 0.18f, 0.24f));
            Set(surface, "ambientScattering", 0.25f);
            Set(surface, "heightScattering", 0.4f);
            Set(surface, "displacementScattering", 0.3f);
            Set(surface, "directLightTipScattering", 0.6f);
            Set(surface, "directLightBodyScattering", 0.5f);
            Set(surface, "startSmoothness", 0.95f);
            Set(surface, "endSmoothness", 0.85f);
            // pěna na hřebenech
            Set(surface, "simulationFoamAmount", 0.35f);
            Set(surface, "simulationFoamSmoothness", 0.4f);
            Set(surface, "foamTextureTiling", 0.2f);
            // kaustiky (světelné odlesky na dně u břehu)
            Set(surface, "causticsIntensity", 0.6f);
            Set(surface, "causticsPlaneBlendDistance", 4f);
            Set(surface, "underWater", false);
        }

        /// <summary>Vlny lámající se u pobřeží: deformátory „ShoreWave“ podél pobřeží mapy.</summary>
        void BuildShore()
        {
            var t = HdType("WaterDeformer");
            if (t == null) return;
            var points = new List<(Vector2 p, Vector2 toLand)>();
            for (float x = -110; x <= 120; x += 3)
                for (float z = -125; z <= 95; z += 3)
                {
                    float h = WorldMap.HeightAt(x, z);
                    if (h < 0.05f || h > 0.7f) continue;
                    // pobřeží: kousek vedle je moře
                    var g = new Vector2(WorldMap.HeightAt(x + 1.5f, z) - WorldMap.HeightAt(x - 1.5f, z), WorldMap.HeightAt(x, z + 1.5f) - WorldMap.HeightAt(x, z - 1.5f));
                    if (g.sqrMagnitude < 0.0004f) continue;
                    var toLand = g.normalized;
                    if (WorldMap.HeightAt(x - toLand.x * 5, z - toLand.y * 5) > -0.2f) continue;
                    var p = new Vector2(x, z);
                    bool near = false;
                    foreach (var q in points) if ((q.p - p).sqrMagnitude < 18 * 18) { near = true; break; }
                    if (!near) points.Add((p, toLand));
                    if (points.Count >= 48) break;
                }
            foreach (var (p, toLand) in points)
            {
                try
                {
                    var go = new GameObject("Příboj");
                    go.transform.SetParent(transform, false);
                    // web (x, z) → Unity (x, −z); vlna jde směrem k pevnině
                    var land = new Vector3(toLand.x, 0, -toLand.y);
                    go.transform.position = WorldMap.ToWorld(p.x - toLand.x * 7, p.y - toLand.y * 7) * 1f;
                    go.transform.position = new Vector3(go.transform.position.x, 0, go.transform.position.z);
                    go.transform.rotation = Quaternion.LookRotation(land, Vector3.up) * Quaternion.Euler(0, 90, 0);
                    var d = go.AddComponent(t);
                    Set(d, "type", "ShoreWave");
                    Set(d, "regionSize", new Vector2(24f, 16f));
                    Set(d, "amplitude", 0.45f);
                    Set(d, "waveLength", 9f);
                    Set(d, "waveRepetition", 3);
                    Set(d, "waveSpeed", 6f);
                    Set(d, "breakingRange", new Vector2(0.65f, 0.9f));
                    Set(d, "deepFoamRange", new Vector2(0.55f, 0.85f));
                    Set(d, "waveBlend", new Vector2(0.4f, 0.8f));
                    shore.Add(d);
                }
                catch (Exception e) { Debug.Log("[Voxario] příboj: " + e.Message); break; }
            }
            Debug.Log($"[Voxario] moře: příboj na {shore.Count} místech pobřeží");
        }

        void ApplyWind()
        {
            if (surface == null) return;
            // velké vlny (vzdouvání) a vlnky podle skutečného větru; trochu přehnané, ať je vidět
            float swell = Mathf.Clamp(WindKmh * 1.3f + 6f, 8f, 70f);
            Set(surface, "largeWindSpeed", swell);
            Set(surface, "largeOrientationValue", WindFrom + 180f);
            Set(surface, "largeChaos", 0.75f);
            Set(surface, "ripplesWindSpeed", Mathf.Clamp(WindKmh, 4f, 28f));
            Set(surface, "ripplesOrientationValue", WindFrom + 180f);
            Set(surface, "ripplesChaos", 0.9f);
        }

        // ---------------------------------------------------------------- počasí
        IEnumerator Weather()
        {
            while (true)
            {
                const string url = "https://api.open-meteo.com/v1/forecast?latitude=37.94&longitude=23.64&current=wind_speed_10m,wind_direction_10m,cloud_cover&wind_speed_unit=kmh";
                using (var req = UnityWebRequest.Get(url))
                {
                    req.timeout = 10;
                    yield return req.SendWebRequest();
                    if (req.result == UnityWebRequest.Result.Success)
                    {
                        var obj = MiniJson.Obj(MiniJson.Parse(req.downloadHandler.text));
                        var cur = MiniJson.Obj(obj != null && obj.TryGetValue("current", out var c) ? c : null);
                        if (cur != null)
                        {
                            WindKmh = (float)MiniJson.N(cur, "wind_speed_10m", WindKmh);
                            WindFrom = (float)MiniJson.N(cur, "wind_direction_10m", WindFrom);
                            CloudCover = (float)MiniJson.N(cur, "cloud_cover", CloudCover * 100) / 100f;
                            Debug.Log($"[Voxario] počasí (Pireus): vítr {WindKmh:0} km/h od {WindFrom:0}°, oblačnost {CloudCover * 100:0} %");
                            ApplyWind();
                            Atmosphere.ApplyCloudCover(CloudCover);
                        }
                    }
                    else Debug.Log("[Voxario] počasí nedostupné: " + req.error);
                }
                yield return new WaitForSecondsRealtime(600);
            }
        }
    }

    /// <summary>Loď na vlnách: houpání nahoru a dolů a náklon podle výšky vln.</summary>
    public class Boat : MonoBehaviour
    {
        Vector3 basePos;
        Quaternion baseRot;
        float seed;

        void Start()
        {
            basePos = transform.position;
            baseRot = transform.rotation;
            seed = basePos.x * 0.37f + basePos.z * 0.21f;
        }

        void Update()
        {
            float h = Ocean.Live ? Ocean.WaveHeight : 0.05f;
            float t = Time.time;
            float heave = (Mathf.Sin(t * 0.9f + seed) * 0.6f + Mathf.Sin(t * 1.7f + seed * 2.3f) * 0.4f) * h * 0.5f;
            float pitch = Mathf.Sin(t * 0.75f + seed * 1.3f) * h * 4f;
            float roll = Mathf.Sin(t * 0.6f + seed * 0.7f) * h * 6f;
            transform.position = basePos + Vector3.up * heave;
            transform.rotation = baseRot * Quaternion.Euler(pitch, 0, roll);
        }
    }
}

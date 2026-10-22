using System;
using System.Reflection;
using UnityEngine;
using UnityEngine.Rendering.HighDefinition;

namespace Voxario.Ashes
{
    /// <summary>
    /// Den a noc podle skutečného času v Praze: poloha slunce a měsíce se počítá astronomicky
    /// pro 50,08° s. š. / 14,44° v. d. (čas UTC, takže letní čas sedí sám), večer zapadá
    /// slunce, v noci svítí měsíc v aktuální fázi a hvězdy. S ray tracingem jsou zapnuté
    /// objemové paprsky (god rays) od slunce i měsíce.
    /// </summary>
    public class DayNight : MonoBehaviour
    {
        public GameBootstrap boot;
        public static DayNight Instance { get; private set; }

        const double Lat = 50.0755, Lon = 14.4378;

        Light sun, moon;
        HDAdditionalLightData sunHd, moonHd;
        Renderer stars;
        Material starMat;
        Transform sunDisc, moonDisc;
        Material sunMat, moonMat;
        Texture2D moonTex;
        float moonTexIllum = -1;
        bool moonTexWaxing;
        float nextAt;
        Vector3 lastSunDir = Vector3.up, lastMoonDir = Vector3.up;

        /// <summary>Výška slunce nad obzorem ve stupních (záporná = noc).</summary>
        public float SunAltitude { get; private set; } = 30;
        public float MoonAltitude { get; private set; }
        /// <summary>Osvětlená část měsíce 0..1.</summary>
        public float MoonIllumination { get; private set; }
        /// <summary>0 = plný den, 1 = hluboká noc.</summary>
        public float Night { get; private set; }

        void Awake() => Instance = this;

        // ---------------------------------------------------------------- čas v Praze
        /// <summary>Místní čas v Praze (SEČ / SELČ podle pravidel EU).</summary>
        public static DateTime PragueNow
        {
            get
            {
                var utc = DateTime.UtcNow;
                return utc.AddHours(IsSummerTime(utc) ? 2 : 1);
            }
        }

        static DateTime LastSunday(int year, int month)
        {
            var d = new DateTime(year, month, DateTime.DaysInMonth(year, month), 1, 0, 0, DateTimeKind.Utc);
            while (d.DayOfWeek != DayOfWeek.Sunday) d = d.AddDays(-1);
            return d; // přechod v 01:00 UTC
        }

        static bool IsSummerTime(DateTime utc) => utc >= LastSunday(utc.Year, 3) && utc < LastSunday(utc.Year, 10);

        // ---------------------------------------------------------------- astronomie
        static double Rad(double d) => d * Math.PI / 180.0;
        static double Deg(double r) => r * 180.0 / Math.PI;
        static double Norm360(double d) { d %= 360; return d < 0 ? d + 360 : d; }

        static double DaysJ2000(DateTime utc) => (utc - new DateTime(2000, 1, 1, 12, 0, 0, DateTimeKind.Utc)).TotalDays;

        /// <summary>Místní hvězdný čas ve stupních.</summary>
        static double Lst(double d) => Norm360(280.46061837 + 360.98564736629 * d + Lon);

        static void ToHorizontal(double ra, double dec, double lst, out double alt, out double az)
        {
            double ha = Rad(Norm360(lst - ra));
            double la = Rad(Lat), de = Rad(dec);
            double sinAlt = Math.Sin(de) * Math.Sin(la) + Math.Cos(de) * Math.Cos(la) * Math.Cos(ha);
            alt = Deg(Math.Asin(sinAlt));
            double y = -Math.Sin(ha);
            double x = Math.Tan(de) * Math.Cos(la) - Math.Sin(la) * Math.Cos(ha);
            az = Norm360(Deg(Math.Atan2(y, x))); // od severu po směru hodin
        }

        static void EclipticToEquatorial(double lon, double lat, double d, out double ra, out double dec)
        {
            double e = Rad(23.4393 - 3.563e-7 * d);
            double l = Rad(lon), b = Rad(lat);
            ra = Norm360(Deg(Math.Atan2(Math.Sin(l) * Math.Cos(e) - Math.Tan(b) * Math.Sin(e), Math.Cos(l))));
            dec = Deg(Math.Asin(Math.Sin(b) * Math.Cos(e) + Math.Cos(b) * Math.Sin(e) * Math.Sin(l)));
        }

        public static void SunPosition(DateTime utc, out double alt, out double az, out double sunLon)
        {
            double d = DaysJ2000(utc);
            double g = Rad(Norm360(357.529 + 0.98560028 * d));
            double q = Norm360(280.459 + 0.98564736 * d);
            sunLon = Norm360(q + 1.915 * Math.Sin(g) + 0.020 * Math.Sin(2 * g));
            EclipticToEquatorial(sunLon, 0, d, out double ra, out double dec);
            ToHorizontal(ra, dec, Lst(d), out alt, out az);
        }

        /// <summary>Měsíc (přesnost asi 1°, na hru víc než dost) a jeho osvětlení.</summary>
        public static void MoonPosition(DateTime utc, double sunLon, out double alt, out double az, out double illum)
        {
            double d = DaysJ2000(utc);
            double L = Norm360(218.316 + 13.176396 * d);
            double M = Rad(Norm360(134.963 + 13.064993 * d));
            double F = Rad(Norm360(93.272 + 13.229350 * d));
            double lon = L + 6.289 * Math.Sin(M);
            double lat = 5.128 * Math.Sin(F);
            EclipticToEquatorial(lon, lat, d, out double ra, out double dec);
            ToHorizontal(ra, dec, Lst(d), out alt, out az);
            double elong = Rad(Norm360(lon - sunLon));
            illum = (1 - Math.Cos(elong)) / 2;
        }

        /// <summary>Směr k nebeskému tělesu ve světě hry (sever = +Z, východ = +X).</summary>
        static Vector3 Dir(double alt, double az)
        {
            float a = (float)Rad(alt), z = (float)Rad(az);
            return new Vector3(Mathf.Sin(z) * Mathf.Cos(a), Mathf.Sin(a), Mathf.Cos(z) * Mathf.Cos(a)).normalized;
        }

        // ---------------------------------------------------------------- scéna
        static void SetProp(object o, string name, object value)
        {
            if (o == null) return;
            try
            {
                var p = o.GetType().GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
                if (p == null || !p.CanWrite) return;
                if (p.PropertyType.IsEnum) value = value is string s ? Enum.Parse(p.PropertyType, s) : Enum.ToObject(p.PropertyType, value);
                else value = Convert.ChangeType(value, p.PropertyType);
                p.SetValue(o, value);
            }
            catch { }
        }

        public void Build()
        {
            var sunGo = GameObject.Find("Sun");
            sun = sunGo != null ? sunGo.GetComponent<Light>() : null;
            sunHd = sunGo != null ? sunGo.GetComponent<HDAdditionalLightData>() : null;
            // slunce: viditelný kotouč a záře na obloze
            SetProp(sunHd, "angularDiameter", 1.4f);
            SetProp(sunHd, "flareSize", 3f);
            SetProp(sunHd, "flareFalloff", 4f);
            SetProp(sunHd, "flareTint", new Color(1f, 0.85f, 0.6f));
            SetProp(sunHd, "interactsWithSky", true);

            if (moon == null)
            {
                var mGo = new GameObject("Moon");
                DontDestroyOnLoad(mGo);
                moon = mGo.AddComponent<Light>();
                moon.type = LightType.Directional;
                moonHd = mGo.AddComponent<HDAdditionalLightData>();
                var unitProp = typeof(Light).GetProperty("lightUnit");
                if (unitProp != null) unitProp.SetValue(moon, Enum.Parse(unitProp.PropertyType, "Lux"));
                moon.useColorTemperature = true;
                moon.colorTemperature = 9000;
                moon.shadows = LightShadows.None;
                SetProp(moonHd, "angularDiameter", 2.2f);
                SetProp(moonHd, "flareSize", 1.2f);
                SetProp(moonHd, "flareFalloff", 8f);
                SetProp(moonHd, "flareTint", new Color(0.7f, 0.8f, 1f));
                SetProp(moonHd, "surfaceTint", new Color(0.9f, 0.92f, 1f));
                SetProp(moonHd, "interactsWithSky", true);
                // novější HDRP umí měsíc s fází (odraz slunce) – když vlastnost existuje, použijeme ji
                SetProp(moonHd, "celestialBodyShadingSource", "ReflectSunLight");
            }
            if (stars == null) stars = MakeStars();
            SetProp(sunHd, "volumetricDimmer", 1.6f);
            SetProp(moonHd, "volumetricDimmer", 8f);
            if (sunDisc == null) sunDisc = MakeDisc("SunDisc", MakeSunTexture(), out sunMat);
            if (moonDisc == null) { moonTex = new Texture2D(128, 128, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Clamp }; moonDisc = MakeDisc("MoonDisc", moonTex, out moonMat); }
            nextAt = 0;
            Update();
        }

        // ---------------------------------------------------------------- kotouče na obloze
        Transform MakeDisc(string name, Texture2D tex, out Material mat)
        {
            // kruhový disk (bez průhlednosti – rohy čtverce by byly na obloze vidět)
            const int seg = 48;
            var verts = new Vector3[seg + 1];
            var uvs = new Vector2[seg + 1];
            var tris = new int[seg * 3];
            verts[0] = Vector3.zero; uvs[0] = new Vector2(0.5f, 0.5f);
            for (int i = 0; i < seg; i++)
            {
                float a = i / (float)seg * Mathf.PI * 2;
                verts[i + 1] = new Vector3(Mathf.Cos(a), Mathf.Sin(a), 0) * 0.5f;
                uvs[i + 1] = new Vector2(0.5f + Mathf.Cos(a) * 0.5f, 0.5f + Mathf.Sin(a) * 0.5f);
                tris[i * 3] = 0; tris[i * 3 + 1] = 1 + (i + 1) % seg; tris[i * 3 + 2] = 1 + i;
            }
            var mesh = new Mesh { name = name, vertices = verts, uv = uvs, triangles = tris };
            mesh.RecalculateNormals();
            mesh.RecalculateBounds();
            var go = new GameObject(name);
            DontDestroyOnLoad(go);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            // oboustranný materiál – disk je vidět bez ohledu na pořadí vrcholů
            var dbl = ModelLibrary.Instance != null ? ModelLibrary.Instance.litDouble : null;
            mat = dbl != null ? new Material(dbl) : ModelLibrary.NewLit(Color.black, 0f);
            mat.SetColor("_BaseColor", Color.black);
            mat.SetTexture("_BaseColorMap", null);
            mat.SetTexture("_EmissiveColorMap", tex);
            mat.EnableKeyword("_EMISSIVE_COLOR_MAP");
            mat.SetFloat("_EmissiveExposureWeight", 0.15f);
            mr.sharedMaterial = mat;
            return go.transform;
        }

        static Texture2D MakeSunTexture()
        {
            const int n = 128;
            var t = new Texture2D(n, n, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Clamp };
            float h = (n - 1) / 2f;
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float r = Mathf.Sqrt((x - h) * (x - h) + (y - h) * (y - h)) / h;
                    float a = Mathf.Clamp01((1f - r) * 12f);
                    var c = Color.Lerp(new Color(1f, 0.98f, 0.9f), new Color(1f, 0.8f, 0.5f), r * r);
                    c.a = a;
                    t.SetPixel(x, y, c);
                }
            t.Apply(true);
            return t;
        }

        /// <summary>Měsíc s krátery a osvětlenou částí podle fáze (dorůstá = svítí vpravo).</summary>
        void PaintMoon(float illum, bool waxing)
        {
            const int n = 128;
            float h = (n - 1) / 2f;
            var rnd = new System.Random(7);
            var craters = new Vector3[18];
            for (int i = 0; i < craters.Length; i++) craters[i] = new Vector3((float)rnd.NextDouble() * 1.6f - 0.8f, (float)rnd.NextDouble() * 1.6f - 0.8f, 0.05f + (float)rnd.NextDouble() * 0.16f);
            float edge = 1 - 2 * illum; // poloha terminátoru (−1 … 1)
            for (int y = 0; y < n; y++)
                for (int x = 0; x < n; x++)
                {
                    float u = (x - h) / h, v = (y - h) / h;
                    float r = Mathf.Sqrt(u * u + v * v);
                    float a = Mathf.Clamp01((1f - r) * 14f);
                    float half = Mathf.Sqrt(Mathf.Max(0, 1 - v * v));
                    float side = waxing ? u : -u;
                    float lit = Mathf.Clamp01((side - edge * half) * 10f + 0.5f);
                    float tone = 0.86f;
                    foreach (var c in craters)
                    {
                        float d = Mathf.Sqrt((u - c.x) * (u - c.x) + (v - c.y) * (v - c.y));
                        if (d < c.z) tone -= 0.12f * (1 - d / c.z);
                    }
                    var col = new Color(tone, tone * 1.0f, tone * 1.04f) * Mathf.Lerp(0.06f, 1f, lit);
                    col.a = a;
                    moonTex.SetPixel(x, y, col);
                }
            moonTex.Apply(true);
        }

        void PlaceDisc(Transform disc, Vector3 dir, float sizeDeg, bool visible, Camera cam)
        {
            if (disc == null) return;
            disc.gameObject.SetActive(visible && cam != null);
            if (!visible || cam == null) return;
            const float dist = 300f;
            disc.position = cam.transform.position + dir * dist;
            disc.rotation = Quaternion.LookRotation(-dir); // quad svítí směrem ke kameře
            float size = 2 * dist * Mathf.Tan(sizeDeg * 0.5f * Mathf.Deg2Rad);
            disc.localScale = new Vector3(size, size, size);
        }

        Renderer MakeStars()
        {
            var rnd = new System.Random(1846);
            const int n = 1400;
            var verts = new Vector3[n * 4];
            var cols = new Color[n * 4];
            var tris = new int[n * 6];
            for (int i = 0; i < n; i++)
            {
                // rovnoměrně po horní polokouli (a kousek pod obzor)
                double u = rnd.NextDouble() * 2 - 1, th = rnd.NextDouble() * Math.PI * 2;
                float y = (float)Math.Abs(u) * 0.95f + 0.02f;
                float r = Mathf.Sqrt(1 - y * y);
                var c = new Vector3(r * (float)Math.Cos(th), y, r * (float)Math.Sin(th)) * 350f;
                var right = Vector3.Cross(c.normalized, Vector3.up).normalized;
                if (right.sqrMagnitude < 0.01f) right = Vector3.right;
                var up = Vector3.Cross(right, c.normalized).normalized;
                float s = 0.35f + (float)Math.Pow(rnd.NextDouble(), 4) * 1.1f;
                verts[i * 4] = c + (-right - up) * s;
                verts[i * 4 + 1] = c + (-right + up) * s;
                verts[i * 4 + 2] = c + (right + up) * s;
                verts[i * 4 + 3] = c + (right - up) * s;
                float b = 0.4f + (float)rnd.NextDouble() * 0.6f;
                var tint = Color.Lerp(new Color(0.75f, 0.85f, 1f), new Color(1f, 0.9f, 0.75f), (float)rnd.NextDouble()) * b;
                for (int k = 0; k < 4; k++) cols[i * 4 + k] = tint;
                tris[i * 6] = i * 4; tris[i * 6 + 1] = i * 4 + 1; tris[i * 6 + 2] = i * 4 + 2;
                tris[i * 6 + 3] = i * 4; tris[i * 6 + 4] = i * 4 + 2; tris[i * 6 + 5] = i * 4 + 3;
            }
            var mesh = new Mesh { name = "Stars" };
            mesh.vertices = verts;
            mesh.colors = cols;
            mesh.triangles = tris;
            mesh.bounds = new Bounds(Vector3.zero, Vector3.one * 800);
            var go = new GameObject("Stars");
            DontDestroyOnLoad(go);
            go.AddComponent<MeshFilter>().sharedMesh = mesh;
            var mr = go.AddComponent<MeshRenderer>();
            mr.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
            mr.receiveShadows = false;
            starMat = ModelLibrary.NewLit(Color.black, 0f);
            starMat.SetColor("_EmissiveColor", Color.white * 40f);
            starMat.EnableKeyword("_EMISSIVE_COLOR_MAP");
            mr.sharedMaterial = starMat;
            return mr;
        }

        void Update()
        {
            if (sun == null) return;
            // hvězdy putují s kamerou (jsou „nekonečně“ daleko)
            var cam = boot != null ? boot.cam : Camera.main;
            if (stars != null && cam != null) stars.transform.position = cam.transform.position;
            // kotouče slunce a měsíce drží stálou vzdálenost od kamery
            PlaceDisc(sunDisc, lastSunDir, 3.2f, SunAltitude > -3f, cam);
            PlaceDisc(moonDisc, lastMoonDir, 4.2f, MoonAltitude > -3f, cam);
            if (Time.unscaledTime < nextAt) return;
            nextAt = Time.unscaledTime + 1f;

            var utc = DateTime.UtcNow;
            SunPosition(utc, out double sAlt, out double sAz, out double sunLon);
            MoonPosition(utc, sunLon, out double mAlt, out double mAz, out double illum);
            SunAltitude = (float)sAlt;
            MoonAltitude = (float)mAlt;
            MoonIllumination = (float)illum;
            // dorůstá, když je měsíc východně od slunce (elongace 0–180°)
            double d0 = DaysJ2000(utc);
            double moonLon = Norm360(218.316 + 13.176396 * d0 + 6.289 * Math.Sin(Rad(Norm360(134.963 + 13.064993 * d0))));
            bool wax = Norm360(moonLon - sunLon) < 180;
            if (moonTex != null && (Mathf.Abs(MoonIllumination - moonTexIllum) > 0.02f || wax != moonTexWaxing))
            {
                moonTexIllum = MoonIllumination;
                moonTexWaxing = wax;
                PaintMoon(MoonIllumination, wax);
            }

            // slunce
            var sDir = Dir(Math.Max(sAlt, -10), sAz);
            lastSunDir = Dir(sAlt, sAz);
            lastMoonDir = Dir(mAlt, mAz);
            if (sunMat != null)
            {
                // nízko nad obzorem oranžovější a slabší
                float low = Mathf.InverseLerp(0f, 25f, (float)sAlt);
                sunMat.SetColor("_EmissiveColor", Color.Lerp(new Color(1f, 0.55f, 0.25f), new Color(1f, 0.95f, 0.85f), low) * Mathf.Lerp(60f, 160f, low));
            }
            if (moonMat != null)
            {
                moonMat.SetColor("_EmissiveColor", Color.white * Mathf.Lerp(2f, 9f, Night));
            }
            sun.transform.rotation = Quaternion.LookRotation(-sDir);
            float day = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(-6f, 12f, SunAltitude));
            Night = 1 - day;
            sun.intensity = Mathf.Lerp(0f, 100000f, Mathf.Pow(Mathf.InverseLerp(-1f, 45f, SunAltitude), 1.3f));
            sun.colorTemperature = Mathf.Lerp(2300f, 5600f, Mathf.InverseLerp(0f, 35f, SunAltitude));
            sun.enabled = SunAltitude > -8f;

            // měsíc: stylizovaně jasnější než ve skutečnosti, ať je v noci na co hrát
            if (moon != null)
            {
                var mDir = Dir(Math.Max(mAlt, -10), mAz);
                bool moonUp = mAlt > -2;
                // když je měsíc pod obzorem, svítí slabé „noční nebe“ shora, aby noc nebyla černá
                if (!moonUp) mDir = Dir(55, sAz + 180);
                moon.transform.rotation = Quaternion.LookRotation(-mDir);
                float phase = moonUp ? 0.35f + 0.65f * MoonIllumination : 0.25f;
                moon.intensity = Night * 40f * phase;
                moon.enabled = Night > 0.02f;
                SetProp(moonHd, "angularDiameter", moonUp ? 2.2f : 0f);
                // stíny vrhá vždy to silnější světlo (HDRP zvládne jen jedno směrové se stíny)
                bool moonShadows = Night > 0.6f;
                moon.shadows = moonShadows ? LightShadows.Soft : LightShadows.None;
                sun.shadows = moonShadows ? LightShadows.None : LightShadows.Soft;
                SetProp(moonHd, "moonPhase", (float)(1 - illum));
            }

            if (starMat != null)
            {
                stars.enabled = Night > 0.15f;
                starMat.SetColor("_EmissiveColor", Color.white * Mathf.Lerp(0f, 60f, Mathf.InverseLerp(0.15f, 1f, Night)));
            }
            Atmosphere.ApplyTimeOfDay(Night, SunAltitude);
        }

        /// <summary>Krátký text do rozhraní, např. „Praha 21:14 · noc“.</summary>
        public string ClockText()
        {
            var t = PragueNow;
            string part = SunAltitude > 6 ? "den" : SunAltitude > -6 ? (t.Hour < 12 ? "svítání" : "soumrak") : "noc";
            return $"Praha {t:HH:mm} · {part}";
        }
    }
}

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
        float nextAt;

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
            nextAt = 0;
            Update();
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
            if (Time.unscaledTime < nextAt) return;
            nextAt = Time.unscaledTime + 1f;

            var utc = DateTime.UtcNow;
            SunPosition(utc, out double sAlt, out double sAz, out double sunLon);
            MoonPosition(utc, sunLon, out double mAlt, out double mAz, out double illum);
            SunAltitude = (float)sAlt;
            MoonAltitude = (float)mAlt;
            MoonIllumination = (float)illum;

            // slunce
            var sDir = Dir(Math.Max(sAlt, -10), sAz);
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
                moon.intensity = Night * 14f * phase;
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

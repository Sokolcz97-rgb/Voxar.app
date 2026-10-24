using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Mapa 1. aktu převedená z webové verze (src/game/ashes/world/map.ts).
    /// Webové souřadnice (x, z) se v Unity kreslí jako (x, -z), takže pohled shora
    /// odpovídá webové mapě.
    /// </summary>
    public static class WorldMap
    {
        public const float WorldHalf = 125f;

        // ------------------------------------------------------------ jih: Solný průsmyk a Rudé písky
        /// <summary>Jižní okraj světa (web z). Původní mapa končí na 135, jižní díl terénu sahá až sem.</summary>
        public const float SouthEdge = 345f;
        /// <summary>Okraje celého světa ve webových souřadnicích.</summary>
        public const float MinX = -135f, MaxX = 135f, MinZ = -135f, MaxZ = SouthEdge;
        /// <summary>Dno kaňonu (Solný průsmyk) od Bezejmenného břehu do pouště.</summary>
        public static readonly Vector2[] CanyonPath = { V(-30, 122), V(-22, 140), V(-8, 156), V(-14, 174), V(2, 190), V(14, 206), V(20, 226) };
        public static readonly Vector2 Oasis = new Vector2(38, 272);
        public const float OasisR = 9f, OasisWater = 2.1f;
        public static readonly Vector2 Ruins = new Vector2(-22, 268);
        static readonly Vector4[] Mesas = { new Vector4(66, 244, 13, 17), new Vector4(-6, 300, 9, 14), new Vector4(92, 292, 12, 21), new Vector4(-58, 286, 8, 12) };

        public static bool InWorld(float x, float z) => x > MinX + 3 && x < MaxX - 3 && z > MinZ + 3 && z < MaxZ - 3;

        public static readonly Rect City = Rect.MinMaxRect(52, -14, 98, 44); // x0, z0, x1, z1 (web)
        public const float CityHeight = 3.2f;
        public static readonly Vector3 Cove = new Vector3(-64, 0, -74);
        public const float CoveR = 24f;

        public static readonly Vector2 SpawnKalidra = new Vector2(-52, 50);
        public static readonly Vector2 SpawnLegie = new Vector2(-44, -50);

        static readonly Vector2[][] Roads =
        {
            new[] { V(-50, 46), V(-40, 30), V(-33, 13), V(-12, 8), V(20, 12), V(46, 15), V(60, 15), V(74, 15) },
            new[] { V(-44, -52), V(-30, -45), V(-10, -47), V(4, -60), V(18, -54), V(32, -50), V(52, -62) },
            new[] { V(2, -47), V(8, -22), V(16, -2), V(20, 12) },
            new[] { V(20, 12), V(28, 30) },
            new[] { V(74, 15), V(74, -6) },
            new[] { V(74, 15), V(86, 28) },
        };

        public struct Building
        {
            public float x, z, w, d, h;
            public string kind;
        }

        public static readonly Building[] Buildings =
        {
            B(66, 0, 9, 7, 4.2f, "tavern"), B(82, 1, 8, 6, 3.6f, "smithy"), B(88, 33, 12, 9, 5.5f, "temple"),
            B(59, -7, 6, 5, 3.4f, "house"), B(92, -6, 6, 6, 3.8f, "house"), B(93, 14, 5, 7, 3.4f, "house"),
            B(58, 38, 6, 5, 3.2f, "house"), B(76, 38, 7, 5, 3.6f, "house"), B(72, -9, 5, 4, 3.0f, "house"),
        };

        public static readonly Vector2[] MarketStalls = { V(67, 12.4f), V(67, 20.6f), V(81, 17.5f), V(80, 22.5f) };

        public struct Npc
        {
            public string id, name, role, faction, cls;
            public float x, z, face;
        }

        public static readonly Npc[] Npcs =
        {
            N("nikias", "Nikias", "starý rybář", "kalidra", -50, 44, 2.4f, "vestec"),
            N("damon", "Damon", "velitel hradeb", "kalidra", 46, 9.5f, -1.4f, "hoplit"),
            N("eryon", "Eryon", "poslední štít", "kalidra", 47.5f, 16, -1.57f, "hoplit"),
            N("gorgias", "Gorgias", "hostinský", "kalidra", 66, 7, 3.14f, "vestec"),
            N("tharos", "Tharos", "kovář", "kalidra", 81, 7, 3.14f, "hoplit"),
            N("thalia", "Thalia", "kněžka moře", "kalidra", 82, 27, 2.2f, "vestec"),
            N("melos", "Melos", "bard", "kalidra", 74, 20, 3.14f, "vestec"),
            N("pylas", "Pylas", "strážný", "kalidra", -19, -55, 2.6f, "lucistnik"),
            N("arena-k", "Mistr arény", "kruh kamenů", "kalidra", 66, 29, 0, "hoplit"),
            N("varkas", "Varkas", "setník", "legie", -44, -55, 0.6f, "hoplit"),
            N("sabra", "Sabra", "markytánka", "legie", -38, -58, 0.3f, "vestec"),
            N("rukmar", "Rukmar", "kovář Legie", "legie", -50, -50, 1.0f, "hoplit"),
            N("oren", "Oren", "kněz Rudého slunce", "legie", 54, -60, -0.8f, "vestec"),
            N("azkar", "Azkar", "Syn Rudého slunce", "legie", 63, -71, -0.3f, "hoplit"),
            N("taras", "Taras", "bubeník", "legie", 50, -70, 0.8f, "lucistnik"),
            N("arena-l", "Mistr zápasů", "kruh v táboře", "legie", 70, -58, -2, "hoplit"),
        };

        // ------------------------------------------------------------ šum a terén (stejný jako na webu)
        static float Hash(float x, float z)
        {
            double s = System.Math.Sin(x * 127.1 + z * 311.7) * 43758.5453;
            return (float)(s - System.Math.Floor(s));
        }

        static float Smooth(float t) => t * t * (3 - 2 * t);

        static float ValueNoise(float x, float z)
        {
            float xi = Mathf.Floor(x), zi = Mathf.Floor(z);
            float xf = x - xi, zf = z - zi;
            float a = Hash(xi, zi), b = Hash(xi + 1, zi), c = Hash(xi, zi + 1), d = Hash(xi + 1, zi + 1);
            float u = Smooth(xf), v = Smooth(zf);
            return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
        }

        public static float Fbm(float x, float z) =>
            ValueNoise(x, z) * 0.55f + ValueNoise(x * 2.1f, z * 2.1f) * 0.3f + ValueNoise(x * 4.3f, z * 4.3f) * 0.15f;

        static float Step(float e0, float e1, float x) => Smooth(Mathf.Clamp01((x - e0) / (e1 - e0)));

        static float Mix(float a, float b, float t) => a + (b - a) * t;

        public static float CoastX(float z) => -80 + 7 * Mathf.Sin(z * 0.045f) + 3 * Mathf.Sin(z * 0.13f + 1.3f);

        /// <summary>Výška terénu ve webových souřadnicích (x, z). Pod 0 je moře.</summary>
        public static float HeightAt(float x, float z)
        {
            float h = 1.4f + (Fbm(x * 0.035f + 10, z * 0.035f) - 0.5f) * 2.4f;
            h += Step(-30, -62, z) * (5.5f + Fbm(x * 0.05f, z * 0.05f + 4) * 6);
            h += Step(-90, -118, z) * 16;
            if (z > 100) h = South(x, z, h);
            float cx = CoastX(z);
            float beach = Step(cx + 14, cx + 3, x);
            h = Mix(h, 0.55f, beach * 0.85f);
            h = Mix(h, -5, Step(cx, cx - 10, x));
            float dc = Mathf.Sqrt((x - Cove.x) * (x - Cove.x) + (z - Cove.z) * (z - Cove.z));
            h = Mix(h, 0.5f, Step(CoveR + 12, CoveR + 2, dc) * 0.8f);
            h = Mix(h, -4, Step(CoveR + 1, CoveR - 8, dc));
            float inCity = Step(City.xMin - 6, City.xMin + 2, x) * Step(City.yMin - 8, City.yMin + 2, z) * Step(City.yMax + 8, City.yMax - 2, z);
            h = Mix(h, CityHeight, inCity * Step(City.xMax + 14, City.xMax + 4, x));
            h = Mix(h, -7, Step(City.xMax + 8, City.xMax + 15, x));
            float road = RoadDistance(x, z);
            if (road < 3.2f) h = Mix(h, Mathf.Max(h * 0.85f, 0.7f), (1 - road / 3.2f) * 0.5f);
            return h;
        }

        static float Terrace(float h, float step, float soft)
        {
            float k = Mathf.Floor(h / step), f = h / step - k;
            return (k + Mathf.Clamp01((f - (1 - soft)) / soft)) * step;
        }

        /// <summary>Jih: skalní plošina s kaňonem, pobřežní pruh a poušť s dunami, stolovými horami a oázou.</summary>
        static float South(float x, float z, float h)
        {
            // poušť: duny místo travnaté krajiny
            float desert = Step(150, 215, z);
            float n = Fbm(x * 0.05f + 17, z * 0.05f + 3);
            float dunes = 1.6f + Fbm(x * 0.022f + 40, z * 0.03f) * 4.2f + Mathf.Abs(Mathf.Sin(x * 0.06f + z * 0.04f + n * 3)) * 1.5f;
            h = Mix(h, dunes, desert);
            // rudé útesy: plošina mezi břehem a pouští (na západě volný pruh u moře = pobřežní cesta)
            float ridge = Step(134, 150, z) * Step(216, 202, z) * Step(-48, -36, x);
            float plateau = Terrace(19 + Fbm(x * 0.04f + 7, z * 0.04f + 2) * 9, 3.2f, 0.55f);
            h = Mix(h, plateau, ridge);
            // stolové hory v poušti
            foreach (var m in Mesas)
            {
                float d = Mathf.Sqrt((x - m.x) * (x - m.x) + (z - m.y) * (z - m.y)) + (n - 0.5f) * 5;
                h = Mix(h, Terrace(m.w + n * 3, 3.2f, 0.55f), Step(m.z + 5, m.z, d));
            }
            // východ: skalní stěna nad mořem, jih: hory Rudého slunce (konec světa)
            h = Mix(h, 30 + n * 10, Step(78, 100, x) * Step(140, 165, z));
            h = Mix(h, 32 + n * 10, Step(310, 336, z));
            // Solný průsmyk: dno kaňonu prořízne plošinu
            float dc = PathDistance(x, z, CanyonPath);
            float floorH = 1.7f + Fbm(x * 0.12f, z * 0.12f) * 0.7f + Step(120, 200, z) * 0.8f;
            h = Mix(h, Mathf.Min(h, floorH), Step(13, 4.5f, dc));
            // oáza: mělká kotlina s vodou (vlastní hladina nad mořem)
            float doa = Mathf.Sqrt((x - Oasis.x) * (x - Oasis.x) + (z - Oasis.y) * (z - Oasis.y));
            h = Mix(h, OasisWater + 0.5f, Step(OasisR + 14, OasisR + 3, doa) * 0.9f);
            h = Mix(h, OasisWater - 1.2f, Step(OasisR + 1, OasisR - 3, doa));
            // ruiny Starého slunce: zarovnaná plocha
            float dr = Vector2.Distance(new Vector2(x, z), Ruins);
            h = Mix(h, 2.6f, Step(18, 11, dr));
            return h;
        }

        public static float PathDistance(float x, float z, Vector2[] path)
        {
            float best = float.MaxValue;
            for (int i = 0; i < path.Length - 1; i++) best = Mathf.Min(best, SegDist(x, z, path[i], path[i + 1]));
            return best;
        }

        public static float RoadDistance(float x, float z)
        {
            float best = float.MaxValue;
            foreach (var road in Roads)
                for (int i = 0; i < road.Length - 1; i++)
                    best = Mathf.Min(best, SegDist(x, z, road[i], road[i + 1]));
            return best;
        }

        static float SegDist(float px, float pz, Vector2 a, Vector2 b)
        {
            float dx = b.x - a.x, dz = b.y - a.y;
            float t = Mathf.Clamp01(((px - a.x) * dx + (pz - a.y) * dz) / (dx * dx + dz * dz));
            float ex = px - (a.x + dx * t), ez = pz - (a.y + dz * t);
            return Mathf.Sqrt(ex * ex + ez * ez);
        }

        public static bool InCity(float x, float z) => x > City.xMin && x < City.xMax && z > City.yMin && z < City.yMax;

        // ------------------------------------------------------------ převod souřadnic
        /// <summary>Webové (x, z) → pozice v Unity na terénu.</summary>
        public static Vector3 ToWorld(float x, float z) => new Vector3(x, Mathf.Max(HeightAt(x, z), 0), -z);

        /// <summary>Pozice v Unity → webové (x, z).</summary>
        public static Vector2 ToWeb(Vector3 p) => new Vector2(p.x, -p.z);

        /// <summary>Webový úhel natočení (dopředu = (sin a, cos a)) → rotace v Unity.</summary>
        public static Quaternion FaceToRotation(float a) =>
            Quaternion.LookRotation(new Vector3(Mathf.Sin(a), 0, -Mathf.Cos(a)), Vector3.up);

        static Vector2 V(float x, float z) => new Vector2(x, z);

        static Building B(float x, float z, float w, float d, float h, string kind) =>
            new Building { x = x, z = z, w = w, d = d, h = h, kind = kind };

        static Npc N(string id, string name, string role, string faction, float x, float z, float face, string cls) =>
            new Npc { id = id, name = name, role = role, faction = faction, x = x, z = z, face = face, cls = cls };
    }
}

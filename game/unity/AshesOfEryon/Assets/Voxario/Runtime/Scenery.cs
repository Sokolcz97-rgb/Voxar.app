using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Krajina podle webové verze (openWorld.ts): cypřiše, olivovníky, kameny, tráva,
    /// akvadukt, vraky na břehu, černé lodě v zátoce, ohně a prapory v táboře Legie.
    /// Stromy, kameny a tráva se slučují po dlaždicích 3 × 3 (málo objektů, rychlé kreslení).
    /// </summary>
    public static class Scenery
    {
        const float Half = WorldMap.WorldHalf;
        static readonly Vector2[] Spawns = { WorldMap.SpawnKalidra, WorldMap.SpawnLegie };
        static readonly Vector2[] BeaconPts = { new Vector2(-22, -58), new Vector2(2, -72), new Vector2(28, -60) };
        static readonly Vector2 Camp = new Vector2(60, -68);
        const float CampR = 20;

        // jednoduchý generátor (stejná krajina při každém spuštění)
        static uint seed;
        static float R() { seed = seed * 1664525u + 1013904223u; return (seed >> 8) / 16777216f; }

        static bool TreeOk(float x, float z)
        {
            float h = WorldMap.HeightAt(x, z);
            if (h < 1 || h > 14) return false;
            if (WorldMap.RoadDistance(x, z) < 4) return false;
            var c = WorldMap.City;
            if (x > c.xMin - 6 && x < c.xMax + 4 && z > c.yMin - 6 && z < c.yMax + 6) return false;
            if (Vector2.Distance(new Vector2(x, z), Camp) < CampR - 4) return false;
            foreach (var n in WorldMap.Npcs) if (Vector2.Distance(new Vector2(x, z), new Vector2(n.x, n.z)) < 9) return false;
            foreach (var s in Spawns) if (Vector2.Distance(new Vector2(x, z), s) < 12) return false;
            foreach (var b in BeaconPts) if (Vector2.Distance(new Vector2(x, z), b) < 5) return false;
            // mýtina kolem světového bosse (pirát Thalassos)
            if (Vector2.Distance(new Vector2(x, z), new Vector2(20, 50)) < 11) return false;
            // aquadukt
            if (SegDist(new Vector2(x, z), new Vector2(-64, 24), new Vector2(-15, -10)) < 3) return false;
            return true;
        }

        static float SegDist(Vector2 p, Vector2 a, Vector2 b)
        {
            var ab = b - a;
            float t = Mathf.Clamp01(Vector2.Dot(p - a, ab) / ab.sqrMagnitude);
            return Vector2.Distance(p, a + ab * t);
        }

        class Cells
        {
            readonly MeshKit[] kits = new MeshKit[9];
            public MeshKit At(Vector3 unityPos)
            {
                float cell = Half * 2 / 3;
                int cx = Mathf.Clamp(Mathf.FloorToInt((unityPos.x + Half) / cell), 0, 2);
                int cz = Mathf.Clamp(Mathf.FloorToInt((unityPos.z + Half) / cell), 0, 2);
                return kits[cx * 3 + cz] ??= new MeshKit();
            }
            public void Emit(Transform parent, string name, Material mat, bool shadows = true)
            {
                for (int i = 0; i < 9; i++)
                {
                    if (kits[i] == null || kits[i].Triangles == 0) continue;
                    var go = new GameObject($"{name} {i}");
                    go.transform.SetParent(parent, false);
                    go.AddComponent<MeshFilter>().sharedMesh = kits[i].Build(name);
                    var mr = go.AddComponent<MeshRenderer>();
                    mr.sharedMaterial = mat;
                    mr.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
                }
            }
        }

        static Material PaletteMat(Material template, Color c, float dark)
        {
            var src = template != null ? template : ModelLibrary.Instance?.lit;
            var m = src != null ? new Material(src) : ModelLibrary.NewLit(Color.white, 0.1f);
            m.SetTexture("_BaseColorMap", MeshKit.Palette(c, dark));
            m.SetColor("_BaseColor", Color.white);
            m.SetFloat("_Smoothness", 0.08f);
            return m;
        }

        public static void Build(Transform root, int quality)
        {
            var parent = new GameObject("Scenery").transform;
            parent.SetParent(root, false);
            var lib = ModelLibrary.Instance;
            seed = 1234;
            float density = quality switch { 0 => 0.45f, 1 => 0.7f, _ => 1f };
            var colliders = new GameObject("Colliders").transform;
            colliders.SetParent(parent, false);

            // ---------------------------------------------------------------- stromy
            var trunks = new Cells();
            var cypressCrowns = new Cells();
            var oliveCrowns = new Cells();
            var cypressTrunk = MeshKit.Cylinder(0.16f, 0.1f, 1.2f, 6);
            var cypressCrown = MeshKit.Transform(MeshKit.Organic(MeshKit.Cone(0.72f, 4.6f, 9, 6), 0.32f, 1), Matrix4x4.Translate(new Vector3(0, 0.9f, 0)));
            var oliveTrunk = MeshKit.Cylinder(0.3f, 0.16f, 1.9f, 7);
            var oliveCrown = new List<Vector3>();
            float[,] blobs = { { 0, 2.7f, 0, 1.25f }, { 0.8f, 2.4f, 0.3f, 0.9f }, { -0.7f, 2.5f, -0.4f, 0.95f }, { 0.1f, 3.2f, -0.6f, 0.85f }, { -0.3f, 2.3f, 0.8f, 0.8f } };
            for (int i = 0; i < 5; i++)
            {
                var b = MeshKit.Ico(blobs[i, 3], i == 0 ? 1 : 0);
                b = MeshKit.Transform(b, Matrix4x4.TRS(new Vector3(blobs[i, 0], blobs[i, 1], blobs[i, 2]), Quaternion.identity, new Vector3(1.15f, 0.75f, 1.15f)));
                oliveCrown.AddRange(MeshKit.Organic(b, 0.35f, i * 3.1f));
            }

            void Place(int count, System.Action<Matrix4x4, Vector3, float, int> build)
            {
                int placed = 0, tries = 0;
                while (placed < count && tries < count * 20)
                {
                    tries++;
                    float x = (R() - 0.5f) * Half * 2, z = (R() - 0.5f) * Half * 2;
                    float s = 0.7f + R() * 0.45f;
                    float yaw = R() * 360;
                    float sy = s * (0.9f + R() * 0.4f);
                    if (!TreeOk(x, z)) continue;
                    var pos = WorldMap.ToWorld(x, z) - Vector3.up * 0.1f;
                    var m = Matrix4x4.TRS(pos, Quaternion.Euler(0, yaw, 0), new Vector3(s, sy, s));
                    build(m, pos, s, placed);
                    placed++;
                }
            }

            Place(Mathf.RoundToInt(520 * density), (m, pos, s, i) =>
            {
                float tint = (i * 37 % 8 + 0.5f) / 8f;
                trunks.At(pos).Add(cypressTrunk, m, tint, 0, 1.2f);
                cypressCrowns.At(pos).Add(cypressCrown, m, tint, 0.9f, 5.5f);
                AddTrunkCollider(colliders, pos, 0.25f * s, 3f * s);
            });
            Place(Mathf.RoundToInt(380 * density), (m, pos, s, i) =>
            {
                float tint = (i * 53 % 8 + 0.5f) / 8f;
                trunks.At(pos).Add(oliveTrunk, m, tint, 0, 1.9f);
                oliveCrowns.At(pos).Add(oliveCrown, m, tint, 1.6f, 4f);
                AddTrunkCollider(colliders, pos, 0.35f * s, 2.5f * s);
            });
            trunks.Emit(parent, "Kmeny", PaletteMat(null, new Color(0.63f, 0.54f, 0.44f), 0.7f));
            cypressCrowns.Emit(parent, "Cypřiše", PaletteMat(null, new Color(0.24f, 0.29f, 0.17f), 0.55f));
            oliveCrowns.Emit(parent, "Olivovníky", PaletteMat(null, new Color(0.42f, 0.46f, 0.31f), 0.6f));

            // ---------------------------------------------------------------- kameny
            var rocks = new Cells();
            var rock = MeshKit.Organic(MeshKit.Ico(1, 1), 0.25f, 7);
            for (int i = 0; i < 420; i++)
            {
                float x = (R() - 0.5f) * Half * 2, z = (R() - 0.5f) * Half * 2;
                float h = WorldMap.HeightAt(x, z);
                float s = 0.3f + R() * (h > 6 ? 1.6f : 0.8f);
                var rot = Quaternion.Euler(R() * 180, R() * 360, R() * 180);
                if (h < 0.2f || WorldMap.InCity(x, z) || WorldMap.RoadDistance(x, z) < 3) continue;
                var pos = new Vector3(x, h + s * 0.2f, -z);
                rocks.At(pos).Add(rock, Matrix4x4.TRS(pos, rot, new Vector3(s, s * 0.7f, s)), (i % 8 + 0.5f) / 8f, -1, 1);
                if (s > 0.9f)
                {
                    var c = new GameObject("rock").AddComponent<SphereCollider>();
                    c.transform.SetParent(colliders, false);
                    c.transform.position = pos;
                    c.radius = s * 0.75f;
                }
            }
            rocks.Emit(parent, "Kameny", PaletteMat(null, new Color(0.85f, 0.82f, 0.75f), 0.75f));

            // ---------------------------------------------------------------- tráva
            int grassN = quality switch { 0 => 0, 1 => 3000, 2 => 6000, _ => 10000 };
            if (grassN > 0)
            {
                var grass = new Cells();
                var tuft = new List<Vector3>();
                for (int k = 0; k < 6; k++)
                {
                    float a = k / 6f * Mathf.PI * 2;
                    float ox = Mathf.Cos(a) * 0.12f, oz = Mathf.Sin(a) * 0.12f;
                    float px = -Mathf.Sin(a) * 0.035f, pz = Mathf.Cos(a) * 0.035f;
                    float hh = 0.35f + (k % 3) * 0.12f;
                    tuft.Add(new Vector3(ox - px, 0, oz - pz)); tuft.Add(new Vector3(ox * 2.2f, hh, oz * 2.2f)); tuft.Add(new Vector3(ox + px, 0, oz + pz));
                }
                int placed = 0;
                for (int i = 0; i < grassN * 3 && placed < grassN; i++)
                {
                    float x = (R() - 0.5f) * 200, z = (R() - 0.5f) * 200;
                    float h = WorldMap.HeightAt(x, z);
                    float sy = 0.7f + R() * 0.8f, yaw = R() * 360;
                    if (h < 0.9f || h > 9 || WorldMap.InCity(x, z) || WorldMap.RoadDistance(x, z) < 2.4f) continue;
                    var pos = new Vector3(x, h - 0.02f, -z);
                    grass.At(pos).Add(tuft, Matrix4x4.TRS(pos, Quaternion.Euler(0, yaw, 0), new Vector3(1, sy, 1)), (i % 8 + 0.5f) / 8f, 0, 0.6f);
                    placed++;
                }
                grass.Emit(parent, "Tráva", PaletteMat(lib != null ? lib.litDouble : null, new Color(0.64f, 0.6f, 0.36f), 0.5f), false);
            }

            BuildAqueduct(parent, colliders);
            BuildShips(parent);
            BuildCamp(parent);
        }

        static void AddTrunkCollider(Transform parent, Vector3 pos, float r, float h)
        {
            var go = new GameObject("tree");
            go.transform.SetParent(parent, false);
            go.transform.position = pos;
            var c = go.AddComponent<CapsuleCollider>();
            c.radius = r;
            c.height = h;
            c.center = new Vector3(0, h / 2, 0);
        }

        static void BuildAqueduct(Transform parent, Transform colliders)
        {
            var kit = new MeshKit();
            var a = new Vector2(-64, 24);
            var b = new Vector2(-15, -10);
            float len = Vector2.Distance(a, b);
            int n = Mathf.FloorToInt(len / 5);
            var dirU = (WorldMap.ToWorld(b.x, b.y) - WorldMap.ToWorld(a.x, a.y));
            dirU.y = 0;
            var rot = Quaternion.LookRotation(dirU.normalized);
            for (int i = 0; i <= n; i++)
            {
                float t = i / (float)n;
                float x = a.x + (b.x - a.x) * t, z = a.y + (b.y - a.y) * t;
                bool broken = Mathf.Sin(i * 12.9898f) > 0.55f;
                float h = broken ? 3 + Mathf.Abs(Mathf.Sin(i * 7)) * 3 : 8;
                float y = WorldMap.HeightAt(x, z);
                var basePos = new Vector3(x, y - 0.3f, -z);
                kit.Add(MeshKit.Box(new Vector3(1.4f, h, 1.4f)), Matrix4x4.TRS(basePos + Vector3.up * h / 2, rot, Vector3.one), (i % 8 + 0.5f) / 8f, -h / 2, h / 2);
                var col = new GameObject("pier").AddComponent<BoxCollider>();
                col.transform.SetParent(colliders, false);
                col.transform.SetPositionAndRotation(basePos + Vector3.up * h / 2, rot);
                col.size = new Vector3(1.6f, h, 1.6f);
                if (!broken && i < n)
                {
                    var mid = basePos + dirU.normalized * 2.5f + Vector3.up * (h - 0.2f + 0.3f);
                    kit.Add(MeshKit.Box(new Vector3(1.6f, 1.2f, 5f)), Matrix4x4.TRS(mid, rot, Vector3.one), 0.5f, -0.6f, 0.6f);
                    // oblouk z kvádrů
                    for (int k = 0; k <= 6; k++)
                    {
                        float ang = k / 6f * Mathf.PI;
                        var p = basePos + dirU.normalized * (2.5f - Mathf.Cos(ang) * 1.8f) + Vector3.up * (h - 2.3f + Mathf.Sin(ang) * 1.8f);
                        kit.Add(MeshKit.Box(new Vector3(1.5f, 0.6f, 0.8f)), Matrix4x4.TRS(p, rot * Quaternion.Euler(-(ang * Mathf.Rad2Deg - 90), 0, 0), Vector3.one), 0.6f, -0.3f, 0.3f);
                    }
                }
            }
            var go = new GameObject("Akvadukt");
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = kit.Build("Akvadukt");
            go.AddComponent<MeshRenderer>().sharedMaterial = PaletteMat(null, new Color(0.78f, 0.75f, 0.68f), 0.8f);
        }

        static void BuildShips(Transform parent)
        {
            var wood = new MeshKit();
            var black = new MeshKit();
            var sails = new MeshKit();
            // vraky na Bezejmenném břehu (napůl zahrabané trupy)
            (float x, float z, float r)[] wrecks = { (-71, 60, 0.6f), (-68, 74, 2.2f), (-73, 46, 1.2f) };
            foreach (var w in wrecks)
            {
                var pos = WorldMap.ToWorld(w.x, w.z) + Vector3.up * 0.2f;
                var rot = Quaternion.Euler(0, -w.r * Mathf.Rad2Deg, 25);
                wood.Add(MeshKit.Box(new Vector3(2.6f, 1.1f, 7f)), Matrix4x4.TRS(pos, rot, Vector3.one), 0.3f, -0.55f, 0.55f);
                for (int k = 0; k < 5; k++)
                    wood.Add(MeshKit.Box(new Vector3(0.2f, 2.2f, 0.25f)), Matrix4x4.TRS(pos + rot * new Vector3(1.2f, 0.9f, -3 + k * 1.5f), rot * Quaternion.Euler(0, 0, -20), Vector3.one), 0.6f, -1.1f, 1.1f);
            }
            // černé lodě v zátoce
            (float x, float z, float r)[] ships = { (-66, -78, 0.4f), (-74, -68, 1.0f), (-58, -86, 0.9f), (-78, -82, 0.6f) };
            foreach (var s in ships)
            {
                var pos = new Vector3(s.x, 0, -s.z);
                var rot = Quaternion.Euler(0, -s.r * Mathf.Rad2Deg, 0);
                black.Add(MeshKit.Box(new Vector3(2.6f, 1.2f, 10f)), Matrix4x4.TRS(pos + Vector3.up * 0.4f, rot, Vector3.one), 0.5f, -0.6f, 0.6f);
                black.Add(MeshKit.Cone(1.3f, 2.8f, 4, 1), Matrix4x4.TRS(pos + rot * new Vector3(0, 0.5f, 5f), rot * Quaternion.Euler(90, 0, 0), Vector3.one), 0.5f, 0, 2.8f);
                wood.Add(MeshKit.Cylinder(0.12f, 0.09f, 8, 6), Matrix4x4.TRS(pos + Vector3.up * 0.5f, rot, Vector3.one), 0.4f, 0, 8);
                sails.Add(MeshKit.Box(new Vector3(4.4f, 3.6f, 0.08f)), Matrix4x4.TRS(pos + Vector3.up * 5.3f + rot * new Vector3(0, 0, 0.2f), rot, Vector3.one), 0.5f, -1.8f, 1.8f);
            }
            Emit(parent, "Dřevo lodí", wood, PaletteMat(null, new Color(0.6f, 0.48f, 0.36f), 0.7f));
            Emit(parent, "Černé lodě", black, PaletteMat(null, new Color(0.09f, 0.08f, 0.08f), 0.8f));
            Emit(parent, "Plachty", sails, PaletteMat(null, new Color(0.12f, 0.09f, 0.09f), 0.9f));
        }

        static void Emit(Transform parent, string name, MeshKit kit, Material mat)
        {
            if (kit.Triangles == 0) return;
            var go = new GameObject(name);
            go.transform.SetParent(parent, false);
            go.AddComponent<MeshFilter>().sharedMesh = kit.Build(name);
            go.AddComponent<MeshRenderer>().sharedMaterial = mat;
        }

        static void BuildCamp(Transform parent)
        {
            Fire.Create(parent, WorldMap.ToWorld(Camp.x - 2, Camp.y + 2), 1.1f, true);
            Fire.Create(parent, WorldMap.ToWorld(-46, -52), 0.9f, true);
            Banner(parent, -40, -50);
            Banner(parent, 48, -58);
            // stany Legie
            var kit = new MeshKit();
            for (int i = 0; i < 6; i++)
            {
                float a = i / 6f * Mathf.PI * 2;
                float x = Camp.x + Mathf.Cos(a) * 11, z = Camp.y + Mathf.Sin(a) * 11;
                var pos = WorldMap.ToWorld(x, z);
                kit.Add(MeshKit.Cone(2.2f, 2.6f, 4, 1), Matrix4x4.TRS(pos, Quaternion.Euler(0, a * Mathf.Rad2Deg + 45, 0), Vector3.one), (i + 0.5f) / 8f, 0, 2.6f);
            }
            Emit(parent, "Stany", kit, PaletteMat(null, new Color(0.45f, 0.16f, 0.12f), 0.6f));
        }

        static void Banner(Transform parent, float x, float z)
        {
            var kit = new MeshKit();
            var pos = WorldMap.ToWorld(x, z);
            kit.Add(MeshKit.Cylinder(0.07f, 0.06f, 5.5f, 6), Matrix4x4.Translate(pos), 0.2f, 0, 5.5f);
            Emit(parent, "Žerď", kit, PaletteMat(null, new Color(0.35f, 0.27f, 0.2f), 0.8f));
            var cloth = new MeshKit();
            cloth.Add(MeshKit.Box(new Vector3(1.4f, 2.4f, 0.05f)), Matrix4x4.Translate(pos + new Vector3(0.75f, 4f, 0)), 0.5f, -1.2f, 1.2f);
            Emit(parent, "Prapor", cloth, PaletteMat(null, new Color(0.5f, 0.08f, 0.05f), 0.7f));
        }
    }

    /// <summary>Oheň: plápolající záře (bez textur) a světlo.</summary>
    public class Fire : MonoBehaviour
    {
        Transform[] flames;
        Light lightSrc;
        float baseIntensity, seed;
        public bool lit = true;

        public static Fire Create(Transform parent, Vector3 pos, float size, bool light)
        {
            var go = new GameObject("Oheň");
            go.transform.SetParent(parent, false);
            go.transform.position = pos;
            var f = go.AddComponent<Fire>();
            f.seed = Random.value * 10;
            // záře: tmavý základ + silná emise (v nitech, aby svítila i za denního světla)
            var mat = ModelLibrary.NewLit(new Color(0.1f, 0.04f, 0.01f), 0);
            mat.SetColor("_EmissiveColor", new Color(1f, 0.42f, 0.08f) * 60000f);
            f.flames = new Transform[3];
            for (int i = 0; i < 3; i++)
            {
                var s = GameObject.CreatePrimitive(PrimitiveType.Sphere);
                Destroy(s.GetComponent<Collider>());
                s.transform.SetParent(go.transform, false);
                s.transform.localPosition = new Vector3((i - 1) * 0.18f * size, 0.35f * size, (i % 2) * 0.15f * size);
                s.GetComponent<Renderer>().sharedMaterial = mat;
                s.GetComponent<Renderer>().shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.Off;
                f.flames[i] = s.transform;
            }
            // poleno
            var log = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            Destroy(log.GetComponent<Collider>());
            log.transform.SetParent(go.transform, false);
            log.transform.localScale = new Vector3(0.5f * size, 0.12f * size, 0.5f * size);
            log.GetComponent<Renderer>().sharedMaterial = ModelLibrary.NewLit(new Color(0.2f, 0.14f, 0.1f), 0.1f);
            if (light)
            {
                var lgo = new GameObject("Světlo");
                lgo.transform.SetParent(go.transform, false);
                lgo.transform.localPosition = Vector3.up * size;
                f.lightSrc = lgo.AddComponent<Light>();
                f.lightSrc.type = LightType.Point;
                f.lightSrc.color = new Color(1f, 0.55f, 0.2f);
                f.lightSrc.range = 10 * size + 4;
                lgo.AddComponent<UnityEngine.Rendering.HighDefinition.HDAdditionalLightData>();
                f.baseIntensity = 20000f * size;
                f.lightSrc.intensity = f.baseIntensity;
            }
            f.size = size;
            return f;
        }

        float size = 1;

        void Update()
        {
            float t = Time.time * 7 + seed;
            for (int i = 0; i < flames.Length; i++)
            {
                float k = lit ? 1 : 0;
                float flick = 0.75f + Mathf.PerlinNoise(t + i * 3.1f, i) * 0.5f;
                flames[i].localScale = new Vector3(0.45f, 0.9f * flick, 0.45f) * size * k * (i == 1 ? 1.2f : 0.85f);
            }
            if (lightSrc != null) lightSrc.intensity = lit ? baseIntensity * (0.8f + Mathf.PerlinNoise(t * 0.7f, 5) * 0.4f) : 0;
        }
    }
}

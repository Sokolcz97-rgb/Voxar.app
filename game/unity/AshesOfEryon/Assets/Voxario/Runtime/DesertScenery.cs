using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Jih mapy: Solný průsmyk, Rudé útesy, Rudé písky – rudé balvany, suché keře, palmy u oázy,
    /// ruiny Starého slunce, hlídka Legie v průsmyku a vybělený vrak na Solném pobřeží.
    /// </summary>
    public static class DesertScenery
    {
        static uint seed;
        static float R() { seed = seed * 1664525u + 1013904223u; return (seed >> 8) / 16777216f; }

        /// <summary>Dlaždice ~45 m, aby kamera kreslila jen to, co je v záběru.</summary>
        class Cells
        {
            const float Cell = 45f;
            readonly Dictionary<int, MeshKit> kits = new Dictionary<int, MeshKit>();
            public MeshKit At(Vector3 p)
            {
                int key = Mathf.FloorToInt((p.x + 200) / Cell) * 1000 + Mathf.FloorToInt((p.z + 400) / Cell);
                if (!kits.TryGetValue(key, out var k)) kits[key] = k = new MeshKit();
                return k;
            }
            public void Emit(Transform parent, string name, Material mat, bool shadows, int layer)
            {
                int i = 0;
                foreach (var k in kits.Values)
                {
                    if (k.Triangles == 0) continue;
                    var go = new GameObject($"{name} {i++}");
                    go.layer = layer;
                    go.transform.SetParent(parent, false);
                    go.AddComponent<MeshFilter>().sharedMesh = k.Build(name);
                    var mr = go.AddComponent<MeshRenderer>();
                    mr.sharedMaterial = mat;
                    mr.shadowCastingMode = shadows ? UnityEngine.Rendering.ShadowCastingMode.On : UnityEngine.Rendering.ShadowCastingMode.Off;
                }
            }
        }

        static float RandX() => WorldMap.MinX + 6 + R() * (WorldMap.MaxX - WorldMap.MinX - 12);
        static float RandZ() => 122 + R() * (WorldMap.SouthEdge - 128);

        static bool Clear(float x, float z)
        {
            var p = new Vector2(x, z);
            if (Vector2.Distance(p, WorldMap.Oasis) < WorldMap.OasisR + 2) return false;
            if (Vector2.Distance(p, WorldMap.Ruins) < 16) return false;
            return true;
        }

        public static void Build(Transform root, int quality)
        {
            var parent = new GameObject("Jih").transform;
            parent.SetParent(root, false);
            var colliders = new GameObject("Colliders").transform;
            colliders.SetParent(parent, false);
            seed = 4321;
            float density = quality switch { 0 => 0.5f, 1 => 0.75f, _ => 1f };

            // ---------------------------------------------------------------- rudé balvany
            var rocks = new Cells();
            var rock = MeshKit.Organic(MeshKit.Ico(1, 1), 0.3f, 3);
            int n = Mathf.RoundToInt(420 * density);
            for (int i = 0; i < n * 3 && n > 0; i++)
            {
                float x = RandX(), z = RandZ();
                float h = WorldMap.HeightAt(x, z);
                if (h < 1.2f || !Clear(x, z)) continue;
                bool canyon = WorldMap.PathDistance(x, z, WorldMap.CanyonPath) < 9;
                if (canyon && WorldMap.PathDistance(x, z, WorldMap.CanyonPath) < 3.5f) continue; // střed průsmyku volný
                float s = 0.4f + R() * (canyon || h > 8 ? 2.2f : 1.1f);
                var rot = Quaternion.Euler(R() * 40, R() * 360, R() * 40);
                var pos = new Vector3(x, h + s * 0.15f, -z);
                rocks.At(pos).Add(rock, Matrix4x4.TRS(pos, rot, new Vector3(s, s * 0.65f, s * 1.1f)), (i % 8 + 0.5f) / 8f, -1, 1);
                if (s > 1f)
                {
                    var c = new GameObject("rock").AddComponent<SphereCollider>();
                    c.transform.SetParent(colliders, false);
                    c.transform.position = pos;
                    c.radius = s * 0.7f;
                }
                n--;
            }
            rocks.Emit(parent, "Rudé balvany", Scenery.PaletteMat(null, new Color(0.62f, 0.36f, 0.25f), 0.7f), true, Scenery.SmallPropsLayer);

            // ---------------------------------------------------------------- suché keře
            var lib = ModelLibrary.Instance;
            var bushes = new Cells();
            var bush = new List<Vector3>();
            for (int k = 0; k < 7; k++)
            {
                float a = k / 7f * Mathf.PI * 2;
                bush.AddRange(MeshKit.Transform(MeshKit.Cone(0.05f, 0.9f, 3, 1), Matrix4x4.TRS(Vector3.zero, Quaternion.Euler(Mathf.Cos(a) * 45, 0, Mathf.Sin(a) * 45), Vector3.one)));
            }
            bush.AddRange(MeshKit.Transform(MeshKit.Organic(MeshKit.Ico(0.35f, 0), 0.4f, 2), Matrix4x4.TRS(Vector3.up * 0.25f, Quaternion.identity, new Vector3(1.3f, 0.6f, 1.3f))));
            int bn = Mathf.RoundToInt(700 * density);
            for (int i = 0; i < bn * 3 && bn > 0; i++)
            {
                float x = RandX(), z = RandZ();
                float h = WorldMap.HeightAt(x, z);
                if (h < 1.1f || h > 12 || !Clear(x, z)) continue;
                float s = 0.6f + R() * 0.9f;
                var pos = new Vector3(x, h - 0.05f, -z);
                bushes.At(pos).Add(bush, Matrix4x4.TRS(pos, Quaternion.Euler(0, R() * 360, 0), Vector3.one * s), (i % 8 + 0.5f) / 8f, 0, 0.9f);
                bn--;
            }
            bushes.Emit(parent, "Suché keře", Scenery.PaletteMat(lib != null ? lib.litDouble : null, new Color(0.5f, 0.4f, 0.27f), 0.6f), false, Scenery.GrassLayer);

            BuildOasis(parent, colliders);
            BuildRuins(parent, colliders);
            BuildOutpost(parent, colliders);
            BuildWreck(parent);
        }

        // ---------------------------------------------------------------- oáza: hladina, palmy, rákos
        static void BuildOasis(Transform parent, Transform colliders)
        {
            var water = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            water.name = "Oáza (voda)";
            Object.Destroy(water.GetComponent<Collider>());
            water.transform.SetParent(parent, false);
            var c = WorldMap.Oasis;
            water.transform.position = new Vector3(c.x, WorldMap.OasisWater, -c.y);
            water.transform.localScale = new Vector3((WorldMap.OasisR + 2.5f) * 2, 0.02f, (WorldMap.OasisR + 2.5f) * 2);
            var wm = ModelLibrary.NewLit(new Color(0.08f, 0.3f, 0.32f, 1), 0.92f);
            wm.SetFloat("_Metallic", 0.05f);
            water.GetComponent<Renderer>().sharedMaterial = wm;

            var trunks = new MeshKit();
            var leaves = new MeshKit();
            var reeds = new MeshKit();
            var seg = MeshKit.Cylinder(0.2f, 0.17f, 1.1f, 6);
            var leaf = MeshKit.Box(new Vector3(0.5f, 0.04f, 2.6f));
            for (int i = 0; i < 11; i++)
            {
                float a = i / 11f * Mathf.PI * 2 + R() * 0.4f;
                float r = WorldMap.OasisR + 1.5f + R() * 5;
                float x = c.x + Mathf.Cos(a) * r, z = c.y + Mathf.Sin(a) * r;
                var basePos = new Vector3(x, WorldMap.HeightAt(x, z) - 0.1f, -z);
                // kmen: lehce prohnutý (segmenty se naklánějí od vody)
                var lean = Quaternion.Euler(0, -a * Mathf.Rad2Deg + 90, 0);
                int segs = 5 + (int)(R() * 3);
                var p = basePos;
                for (int k = 0; k < segs; k++)
                {
                    var rot = lean * Quaternion.Euler(6 + k * 3, 0, 0);
                    trunks.Add(seg, Matrix4x4.TRS(p, rot, Vector3.one), (i % 8 + 0.5f) / 8f, 0, 1.1f);
                    p += rot * Vector3.up * 1.05f;
                }
                for (int k = 0; k < 8; k++)
                {
                    var rot = Quaternion.Euler(0, k * 45 + R() * 15, 0) * Quaternion.Euler(25 + R() * 15, 0, 0);
                    leaves.Add(leaf, Matrix4x4.TRS(p + rot * new Vector3(0, 0, 1.2f), rot, Vector3.one), (k % 8 + 0.5f) / 8f, -0.1f, 0.1f);
                }
                Scenery.AddTrunkCollider(colliders, basePos, 0.25f, 3f);
            }
            var reed = MeshKit.Cone(0.04f, 1.4f, 3, 1);
            for (int i = 0; i < 140; i++)
            {
                float a = R() * Mathf.PI * 2, r = WorldMap.OasisR - 0.5f + R() * 3;
                float x = c.x + Mathf.Cos(a) * r, z = c.y + Mathf.Sin(a) * r;
                var pos = new Vector3(x, Mathf.Max(WorldMap.HeightAt(x, z), WorldMap.OasisWater - 0.3f), -z);
                reeds.Add(reed, Matrix4x4.TRS(pos, Quaternion.Euler(R() * 14 - 7, 0, R() * 14 - 7), Vector3.one * (0.7f + R() * 0.6f)), (i % 8 + 0.5f) / 8f, 0, 1.4f);
            }
            Scenery.Emit(parent, "Palmy (kmeny)", trunks, Scenery.PaletteMat(null, new Color(0.55f, 0.42f, 0.3f), 0.7f));
            Scenery.Emit(parent, "Palmy (listy)", leaves, Scenery.PaletteMat(ModelLibrary.Instance != null ? ModelLibrary.Instance.litDouble : null, new Color(0.33f, 0.45f, 0.2f), 0.6f));
            Scenery.Emit(parent, "Rákos", reeds, Scenery.PaletteMat(ModelLibrary.Instance != null ? ModelLibrary.Instance.litDouble : null, new Color(0.55f, 0.55f, 0.3f), 0.6f));
        }

        // ---------------------------------------------------------------- ruiny Starého slunce
        static void BuildRuins(Transform parent, Transform colliders)
        {
            var kit = new MeshKit();
            var c = WorldMap.Ruins;
            float y0 = WorldMap.HeightAt(c.x, c.y);
            // podstava chrámu
            kit.Add(MeshKit.Box(new Vector3(16, 0.8f, 11)), Matrix4x4.TRS(new Vector3(c.x, y0 + 0.2f, -c.y), Quaternion.Euler(0, 12, 0), Vector3.one), 0.5f, -0.4f, 0.4f);
            var col = MeshKit.Cylinder(0.55f, 0.48f, 1f, 10);
            var rot = Quaternion.Euler(0, 12, 0);
            for (int i = 0; i < 12; i++)
            {
                bool longSide = i < 10;
                float lx = longSide ? -6.5f + (i % 5) * 3.25f : (i == 10 ? -7 : 7);
                float lz = longSide ? (i < 5 ? -4.3f : 4.3f) : 0;
                float h = Mathf.Abs(Mathf.Sin(i * 3.7f)) * 4 + 0.6f; // rozbité sloupy
                if (i == 3 || i == 8) h = 5.5f;
                var p = new Vector3(c.x, y0 + 0.6f, -c.y) + rot * new Vector3(lx, 0, lz);
                kit.Add(col, Matrix4x4.TRS(p, rot, new Vector3(1, h, 1)), (i % 8 + 0.5f) / 8f, 0, 1);
                var cc = new GameObject("sloup").AddComponent<CapsuleCollider>();
                cc.transform.SetParent(colliders, false);
                cc.transform.position = p;
                cc.radius = 0.6f; cc.height = h; cc.center = new Vector3(0, h / 2, 0);
                if (i == 3 || i == 8) kit.Add(MeshKit.Box(new Vector3(1.6f, 0.5f, 1.6f)), Matrix4x4.TRS(p + Vector3.up * h, rot, Vector3.one), 0.4f, -0.25f, 0.25f);
            }
            // povalené sloupy a kvádry v písku
            for (int i = 0; i < 4; i++)
            {
                var p = new Vector3(c.x, y0 + 0.4f, -c.y) + Quaternion.Euler(0, 40 + i * 85, 0) * new Vector3(0, 0, 10 + i);
                kit.Add(col, Matrix4x4.TRS(p, Quaternion.Euler(90, 30 + i * 50, 0), new Vector3(1, 3.5f, 1)), 0.6f, 0, 1);
                kit.Add(MeshKit.Box(new Vector3(1.2f, 0.8f, 1.6f)), Matrix4x4.TRS(p + new Vector3(2, 0, 1.5f), Quaternion.Euler(8, i * 37, 5), Vector3.one), 0.3f, -0.4f, 0.4f);
            }
            // socha Starého slunce: kotouč na podstavci (bez tváře – čas ji vymazal)
            var sp = new Vector3(c.x, y0 + 0.6f, -c.y) + rot * new Vector3(0, 0, 0);
            kit.Add(MeshKit.Box(new Vector3(1.6f, 2.2f, 1.6f)), Matrix4x4.TRS(sp + Vector3.up * 1.1f, rot, Vector3.one), 0.5f, -1.1f, 1.1f);
            kit.Add(MeshKit.Cylinder(1.5f, 1.5f, 0.3f, 16), Matrix4x4.TRS(sp + Vector3.up * 3.8f, rot * Quaternion.Euler(90, 0, 0), Vector3.one), 0.7f, 0, 0.3f);
            var b = new GameObject("socha").AddComponent<BoxCollider>();
            b.transform.SetParent(colliders, false);
            b.transform.SetPositionAndRotation(sp + Vector3.up * 1.1f, rot);
            b.size = new Vector3(1.7f, 2.2f, 1.7f);
            Scenery.Emit(parent, "Ruiny Starého slunce", kit, Scenery.PaletteMat(null, new Color(0.86f, 0.74f, 0.58f), 0.75f));
        }

        // ---------------------------------------------------------------- hlídka Legie v průsmyku
        static void BuildOutpost(Transform parent, Transform colliders)
        {
            var p0 = WorldMap.CanyonPath[2];
            Fire.Create(parent, WorldMap.ToWorld(p0.x + 3, p0.y + 1), 0.9f, true);
            Scenery.Banner(parent, p0.x - 3.5f, p0.y - 2);
            // dřevěná zátarasa napříč kaňonem (s mezerou na projití)
            var wood = new MeshKit();
            var a = WorldMap.CanyonPath[1]; var b = WorldMap.CanyonPath[2];
            var dir = (b - a).normalized; var side = new Vector2(-dir.y, dir.x);
            for (int i = -4; i <= 4; i++)
            {
                if (Mathf.Abs(i) <= 1) continue;
                var w = a + (b - a) * 0.55f + side * i * 1.1f;
                var pos = WorldMap.ToWorld(w.x, w.y);
                wood.Add(MeshKit.Cylinder(0.14f, 0.05f, 2.2f, 5), Matrix4x4.TRS(pos, Quaternion.Euler(-30 + (i % 2) * 8, Mathf.Atan2(dir.x, -dir.y) * Mathf.Rad2Deg, 0), Vector3.one), 0.5f, 0, 2.2f);
                var cc = new GameObject("kůl").AddComponent<CapsuleCollider>();
                cc.transform.SetParent(colliders, false);
                cc.transform.position = pos;
                cc.radius = 0.25f; cc.height = 1.6f; cc.center = new Vector3(0, 0.8f, 0);
            }
            Scenery.Emit(parent, "Zátarasa", wood, Scenery.PaletteMat(null, new Color(0.5f, 0.38f, 0.26f), 0.7f));
            // stan hlídky
            var tent = new MeshKit();
            tent.Add(MeshKit.Cone(2f, 2.4f, 4, 1), Matrix4x4.TRS(WorldMap.ToWorld(p0.x - 4, p0.y + 4), Quaternion.Euler(0, 30, 0), Vector3.one), 0.5f, 0, 2.4f);
            Scenery.Emit(parent, "Stan hlídky", tent, Scenery.PaletteMat(null, new Color(0.45f, 0.16f, 0.12f), 0.6f));
        }

        // ---------------------------------------------------------------- vybělený vrak na Solném pobřeží
        static void BuildWreck(Transform parent)
        {
            var kit = new MeshKit();
            float z = 232, x = WorldMap.CoastX(z) + 8;
            var pos = WorldMap.ToWorld(x, z) + Vector3.up * 0.3f;
            var rot = Quaternion.Euler(0, 20, -18);
            kit.Add(MeshKit.Box(new Vector3(3f, 1.2f, 9f)), Matrix4x4.TRS(pos, rot, Vector3.one), 0.3f, -0.6f, 0.6f);
            for (int k = 0; k < 7; k++)
                kit.Add(MeshKit.Box(new Vector3(0.22f, 2.6f, 0.25f)), Matrix4x4.TRS(pos + rot * new Vector3(1.4f, 1.1f, -4 + k * 1.3f), rot * Quaternion.Euler(0, 0, -25), Vector3.one), 0.6f, -1.3f, 1.3f);
            kit.Add(MeshKit.Cylinder(0.14f, 0.1f, 6, 6), Matrix4x4.TRS(pos + rot * new Vector3(0, 0.5f, 1), rot * Quaternion.Euler(0, 0, 70), Vector3.one), 0.4f, 0, 6);
            Scenery.Emit(parent, "Vybělený vrak", kit, Scenery.PaletteMat(null, new Color(0.78f, 0.72f, 0.62f), 0.7f));
        }
    }
}

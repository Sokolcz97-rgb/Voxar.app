using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Staví svět 1. aktu: terén, moře, město s budovami, tržiště, postavy a zvířata.</summary>
    public static class WorldBuilder
    {
        public static void Build(Transform root, ModelLibrary lib, string faction)
        {
            TerrainBuilder.Build(root);
            TerrainBuilder.BuildSea(root);
            BuildCity(root, lib);
            BuildNpcs(root, lib, faction);
            BuildAnimals(root, lib);
        }

        static void BuildCity(Transform root, ModelLibrary lib)
        {
            var city = new GameObject("Kalidra").transform;
            city.SetParent(root, false);
            var wallMat = Mat(new Color(0.93f, 0.9f, 0.84f));
            var roofMat = Mat(new Color(0.72f, 0.33f, 0.2f));
            // hradby
            float y = WorldMap.CityHeight;
            Wall(city, wallMat, 52, -1.5f, 1.6f, 25, y); // západ (jih od brány)
            Wall(city, wallMat, 52, 31.5f, 1.6f, 25, y); // západ (sever od brány)
            Wall(city, wallMat, 75, -14, 46, 1.6f, y);
            Wall(city, wallMat, 75, 44, 46, 1.6f, y);
            Wall(city, wallMat, 98, 15, 1.6f, 58, y, 3.6f);
            foreach (var b in WorldMap.Buildings)
            {
                string key = b.kind == "house" ? "villa" : b.kind == "temple" ? "temple" : null;
                var prefab = key != null ? lib.Building(key) : null;
                if (prefab != null) PlaceModel(city, prefab, b.x, b.z, b.kind == "temple" ? b.w + 2 : b.w, b.kind == "temple" ? b.d + 2 : b.d, Face(b.x, b.z, 74, 15));
                else Box(city, wallMat, roofMat, b);
            }
            var stall = lib.Building("stall");
            if (stall != null)
                foreach (var s in WorldMap.MarketStalls) PlaceModel(city, stall, s.x, s.y, 3.2f, 3.2f, Face(s.x, s.y, 74, 15));
            // kašna na agoře
            var fountain = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            fountain.name = "Fountain";
            fountain.transform.SetParent(city, false);
            fountain.transform.position = WorldMap.ToWorld(74, 15) + Vector3.up * 0.2f;
            fountain.transform.localScale = new Vector3(5, 0.4f, 5);
            fountain.GetComponent<Renderer>().sharedMaterial = wallMat;
        }

        static float Face(float x, float z, float tx, float tz)
        {
            float a = Mathf.Atan2(tx - x, tz - z);
            return Mathf.Round(a / (Mathf.PI / 2)) * (Mathf.PI / 2);
        }

        static void PlaceModel(Transform parent, GameObject prefab, float x, float z, float w, float d, float face)
        {
            var holder = new GameObject(prefab.name).transform;
            holder.SetParent(parent, false);
            holder.position = WorldMap.ToWorld(x, z) - Vector3.up * 0.08f;
            holder.rotation = WorldMap.FaceToRotation(face);
            var model = Object.Instantiate(prefab, holder);
            var renderers = model.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return;
            // vejít se do půdorysu w × d (v natočeném prostoru)
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            var local = holder.InverseTransformVector(b.size);
            float s = Mathf.Min(w / Mathf.Max(0.01f, Mathf.Abs(local.x)), d / Mathf.Max(0.01f, Mathf.Abs(local.z)));
            model.transform.localScale *= s;
            b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            var offset = holder.InverseTransformPoint(new Vector3(b.center.x, b.min.y, b.center.z));
            model.transform.localPosition -= offset;
            AddBoxCollider(holder.gameObject, renderers);
        }

        static void AddBoxCollider(GameObject go, Renderer[] renderers)
        {
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            var col = go.AddComponent<BoxCollider>();
            col.center = go.transform.InverseTransformPoint(b.center);
            var size = go.transform.InverseTransformVector(b.size);
            col.size = new Vector3(Mathf.Abs(size.x) * 0.9f, Mathf.Abs(size.y), Mathf.Abs(size.z) * 0.9f);
        }

        static void Wall(Transform parent, Material m, float x, float z, float w, float d, float baseY, float h = 6)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = "Wall";
            go.transform.SetParent(parent, false);
            go.transform.position = new Vector3(x, baseY + h / 2 - 0.5f, -z);
            go.transform.localScale = new Vector3(w, h, d);
            go.GetComponent<Renderer>().sharedMaterial = m;
        }

        static void Box(Transform parent, Material wall, Material roof, WorldMap.Building b)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Cube);
            go.name = b.kind;
            go.transform.SetParent(parent, false);
            var p = WorldMap.ToWorld(b.x, b.z);
            go.transform.position = p + Vector3.up * (b.h / 2 - 0.2f);
            go.transform.localScale = new Vector3(b.w, b.h, b.d);
            go.GetComponent<Renderer>().sharedMaterial = wall;
            var r = GameObject.CreatePrimitive(PrimitiveType.Cube);
            Object.Destroy(r.GetComponent<Collider>());
            r.transform.SetParent(go.transform, false);
            r.transform.localPosition = new Vector3(0, 0.55f, 0);
            r.transform.localScale = new Vector3(1.08f, 0.12f, 1.08f);
            r.GetComponent<Renderer>().sharedMaterial = roof;
        }

        static void BuildNpcs(Transform root, ModelLibrary lib, string faction)
        {
            var parent = new GameObject("NPCs").transform;
            parent.SetParent(root, false);
            foreach (var n in WorldMap.Npcs)
            {
                if (n.faction != faction) continue;
                var prefab = lib.Hero($"{n.cls}_m");
                var v = CharacterView.Create(prefab, parent, n.id == "eryon" || n.id == "azkar" ? 1.85f : 1.62f, n.name);
                v.transform.position = WorldMap.ToWorld(n.x, n.z);
                v.transform.rotation = WorldMap.FaceToRotation(n.face);
                var tag = v.gameObject.AddComponent<NameTag>();
                tag.title = n.name;
                tag.subtitle = n.role;
            }
        }

        static void BuildAnimals(Transform root, ModelLibrary lib)
        {
            var parent = new GameObject("Animals").transform;
            parent.SetParent(root, false);
            (string kind, float x, float z, float r, int n, float size)[] herds =
            {
                ("sheep", -30, 44, 10, 6, 0.95f), ("sheep", 10, 40, 9, 5, 0.95f), ("cow", 26, 18, 9, 4, 1.45f),
                ("goat", -14, -48, 10, 5, 1.05f), ("stag", -40, 6, 14, 2, 2.1f), ("doe", -40, 6, 14, 3, 1.45f),
                ("boar", -54, 10, 10, 3, 0.85f), ("horse", 52, -58, 6, 4, 1.75f), ("dog", -48, 46, 6, 1, 0.65f),
                ("chicken", 80, 22, 5, 5, 0.45f), ("gull", -64, 40, 10, 4, 0.5f),
            };
            var rnd = new System.Random(4242);
            foreach (var h in herds)
            {
                var prefab = lib.Animal(h.kind);
                if (prefab == null) continue;
                for (int i = 0; i < h.n; i++)
                {
                    float x = h.x + ((float)rnd.NextDouble() - 0.5f) * h.r, z = h.z + ((float)rnd.NextDouble() - 0.5f) * h.r;
                    var a = CharacterView.Create(prefab, parent, h.size, h.kind);
                    a.transform.position = WorldMap.ToWorld(x, z);
                    a.transform.rotation = Quaternion.Euler(0, (float)rnd.NextDouble() * 360, 0);
                    var wander = a.gameObject.AddComponent<Wanderer>();
                    wander.home = new Vector2(h.x, h.z);
                    wander.range = h.r;
                    wander.speed = h.kind == "dog" || h.kind == "horse" ? 1.6f : 0.8f;
                }
            }
        }

        static Material Mat(Color c)
        {
            var shader = Shader.Find("HDRP/Lit");
            var m = new Material(shader);
            m.SetColor("_BaseColor", c);
            m.SetFloat("_Smoothness", 0.15f);
            return m;
        }
    }
}

using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Terén z výškové funkce webové mapy (Unity Terrain, HDRP TerrainLit) a moře.</summary>
    public static class TerrainBuilder
    {
        const float Size = WorldMap.WorldHalf * 2 + 20; // jako na webu
        const float MinH = -10f, MaxH = 30f;

        /// <summary>Původní díl (pobřeží Kalidry) + jižní díl (Solný průsmyk, Rudé písky). Okraje na sebe přesně navazují.</summary>
        public static Terrain Build(Transform parent)
        {
            var north = BuildTile(parent, "Terrain", -Size / 2, -Size / 2, Size, Size, MinH, MaxH, NorthLayers(), NorthWeights);
            float depth = WorldMap.SouthEdge - Size / 2;
            var south = BuildTile(parent, "Terrain jih", -Size / 2, -WorldMap.SouthEdge, Size, depth, MinH, 50f, SouthLayers(), SouthWeights);
            // jižní díl leží v Unity pod severním (Unity z = -web z)
            north.SetNeighbors(null, null, null, south);
            south.SetNeighbors(null, north, null, null);
            return north;
        }

        static TerrainLayer[] NorthLayers() => new[]
        {
            Layer(new Color32(80, 95, 44, 255), 4),
            Layer(new Color32(140, 116, 78, 255), 4),
            Layer(new Color32(195, 172, 131, 255), 6),
            Layer(new Color32(150, 142, 126, 255), 3),
        };

        // jih: suchá tráva a písek stejné jako na severu (plynulý přechod), rudá skála, pouštní písek
        static TerrainLayer[] SouthLayers() => new[]
        {
            Layer(new Color32(140, 116, 78, 255), 4),
            Layer(new Color32(195, 172, 131, 255), 6),
            Layer(new Color32(156, 92, 62, 255), 3),
            Layer(new Color32(214, 160, 104, 255), 7),
        };

        delegate void Weights(float x, float z, float h, float slope, float n, float[] w);

        static void NorthWeights(float x, float z, float h, float slope, float n, float[] w)
        {
            float w0 = 0, w1 = 0, w2 = 0, w3 = 0, w4 = 0, w5 = 0;
            bool pave = WorldMap.InCity(x, z);
            if (pave) w5 = 1;
            else if (h < 1.1f) w2 = 1;
            else
            {
                float dry = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(0.35f, 0.7f, n));
                // směrem k jižnímu okraji krajina vysychá (navazuje na poušť)
                dry = Mathf.Max(dry, Mathf.SmoothStep(0, 1, Mathf.InverseLerp(104, 130, z)));
                w0 = 1 - dry;
                w1 = dry;
                float rock = Mathf.Max(Mathf.InverseLerp(5, 11, h), Mathf.InverseLerp(0.18f, 0.42f, slope));
                rock *= 1 - Mathf.SmoothStep(0, 1, Mathf.InverseLerp(118, 132, z)); // u švu bez šedé skály
                w0 *= 1 - rock; w1 *= 1 - rock; w3 = rock;
                float rd = WorldMap.RoadDistance(x, z);
                if (rd < 2.8f) { float r = 1 - Mathf.InverseLerp(1.4f, 2.8f, rd); w0 *= 1 - r; w1 *= 1 - r; w3 *= 1 - r; w4 = r; }
            }
            float sum = w0 + w1 + w2 + w3 + w4 + w5;
            if (sum <= 0) { w0 = 1; sum = 1; }
            // cesta → suchá vrstva, dlažba → kámen
            w[0] = w0 / sum; w[1] = (w1 + w4) / sum; w[2] = w2 / sum; w[3] = (w3 + w5) / sum;
        }

        static void SouthWeights(float x, float z, float h, float slope, float n, float[] w)
        {
            float dry = 0, beach = 0, rock = 0, sand = 0;
            float desert = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(140, 196, z));
            float canyon = WorldMap.PathDistance(x, z, WorldMap.CanyonPath);
            if (h < 1.1f) beach = 1;
            else
            {
                sand = Mathf.Clamp01(desert + (n - 0.5f) * 0.6f);
                if (canyon < 6) sand = Mathf.Max(sand, 0.7f); // navátý písek na dně kaňonu
                dry = 1 - sand;
                rock = Mathf.Max(Mathf.InverseLerp(0.2f, 0.45f, slope), Mathf.InverseLerp(9, 13, h) * (1 - Mathf.InverseLerp(0.12f, 0.05f, slope) * 0.5f));
                if (Vector2.Distance(new Vector2(x, z), WorldMap.Oasis) < WorldMap.OasisR + 7) { dry = 1; sand = 0; rock *= 0.3f; } // tráva u vody
                dry *= 1 - rock; sand *= 1 - rock;
            }
            float sum = dry + beach + rock + sand;
            if (sum <= 0) { sand = 1; sum = 1; }
            w[0] = dry / sum; w[1] = beach / sum; w[2] = rock / sum; w[3] = sand / sum;
        }

        /// <summary>Jeden díl terénu. ux0/uz0 = roh v Unity souřadnicích.</summary>
        static Terrain BuildTile(Transform parent, string name, float ux0, float uz0, float sizeX, float sizeZ, float minH, float maxH, TerrainLayer[] layers, Weights weights)
        {
            int res = 257;
            var data = new TerrainData { heightmapResolution = res };
            data.size = new Vector3(sizeX, maxH - minH, sizeZ);
            var heights = new float[res, res];
            for (int iz = 0; iz < res; iz++)
            for (int ix = 0; ix < res; ix++)
            {
                // z v Unity = -z na webu
                float ux = ux0 + ix / (float)(res - 1) * sizeX;
                float uz = uz0 + iz / (float)(res - 1) * sizeZ;
                float h = WorldMap.HeightAt(ux, -uz);
                heights[iz, ix] = Mathf.Clamp01((h - minH) / (maxH - minH));
            }
            data.SetHeights(0, 0, heights);

            // povrchy (HDRP kreslí v jednom průchodu jen 4)
            data.terrainLayers = layers;
            int ares = 256;
            data.alphamapResolution = ares;
            var alpha = new float[ares, ares, layers.Length];
            var w = new float[4];
            for (int iz = 0; iz < ares; iz++)
            for (int ix = 0; ix < ares; ix++)
            {
                float x = ux0 + ix / (float)(ares - 1) * sizeX;
                float z = -(uz0 + iz / (float)(ares - 1) * sizeZ);
                float h = WorldMap.HeightAt(x, z);
                float n = WorldMap.Fbm(x * 0.08f + 3, z * 0.08f);
                float dx = WorldMap.HeightAt(x + 1, z) - WorldMap.HeightAt(x - 1, z);
                float dz = WorldMap.HeightAt(x, z + 1) - WorldMap.HeightAt(x, z - 1);
                float slope = Mathf.Sqrt(dx * dx + dz * dz) * 0.5f;
                weights(x, z, h, slope, n, w);
                for (int k = 0; k < 4; k++) alpha[iz, ix, k] = w[k];
            }
            data.SetAlphamaps(0, 0, alpha);

            var go = Terrain.CreateTerrainGameObject(data);
            go.name = name;
            go.transform.SetParent(parent, false);
            go.transform.position = new Vector3(ux0, minH, uz0);
            var terrain = go.GetComponent<Terrain>();
            terrain.heightmapPixelError = 4;
            terrain.basemapDistance = 120;
            // instancované kreslení potřebuje normálovou mapu z editoru – u terénu vytvořeného za běhu vychází tmavý
            terrain.drawInstanced = false;
            terrain.groupingID = 1;
            data.SyncHeightmap();
            var lib = ModelLibrary.Instance;
            if (lib != null && lib.terrain != null) terrain.materialTemplate = lib.terrain;
            return terrain;
        }

        static TerrainLayer Layer(Color32 c, float tile)
        {
            // jemný šum v textuře, ať povrch není plochý
            var tex = new Texture2D(64, 64, TextureFormat.RGBA32, true) { wrapMode = TextureWrapMode.Repeat };
            var px = new Color32[64 * 64];
            var rnd = new System.Random(c.r * 31 + c.g * 7 + c.b);
            for (int i = 0; i < px.Length; i++)
            {
                float k = 0.85f + (float)rnd.NextDouble() * 0.3f;
                // alfa = hladkost v HDRP: matný povrch
                px[i] = new Color32((byte)Mathf.Clamp(c.r * k, 0, 255), (byte)Mathf.Clamp(c.g * k, 0, 255), (byte)Mathf.Clamp(c.b * k, 0, 255), 20);
            }
            tex.SetPixels32(px);
            tex.Apply(true);
            return new TerrainLayer { diffuseTexture = tex, tileSize = new Vector2(tile, tile), smoothness = 0f, metallic = 0f };
        }

        public static GameObject BuildSea(Transform parent)
        {
            var sea = GameObject.CreatePrimitive(PrimitiveType.Plane);
            sea.name = "Sea";
            sea.transform.SetParent(parent, false);
            sea.transform.position = new Vector3(0, 0.02f, 0);
            sea.transform.localScale = new Vector3(220, 1, 220);
            Object.Destroy(sea.GetComponent<Collider>());
            var r = sea.GetComponent<Renderer>();
            var m = ModelLibrary.NewLit(new Color(0.06f, 0.2f, 0.3f, 1), 0.82f);
            m.SetFloat("_Metallic", 0.1f);
            r.sharedMaterial = m;
            return sea;
        }
    }
}

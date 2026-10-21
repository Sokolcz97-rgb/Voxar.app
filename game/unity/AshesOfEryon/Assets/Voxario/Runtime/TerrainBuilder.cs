using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Terén z výškové funkce webové mapy (Unity Terrain, HDRP TerrainLit) a moře.</summary>
    public static class TerrainBuilder
    {
        const float Size = WorldMap.WorldHalf * 2 + 20; // jako na webu
        const float MinH = -10f, MaxH = 30f;

        public static Terrain Build(Transform parent)
        {
            int res = 257;
            var data = new TerrainData { heightmapResolution = res };
            data.size = new Vector3(Size, MaxH - MinH, Size);
            var heights = new float[res, res];
            for (int iz = 0; iz < res; iz++)
            for (int ix = 0; ix < res; ix++)
            {
                // terén leží od (-Size/2, -Size/2) v Unity; z v Unity = -z na webu
                float ux = -Size / 2 + ix / (float)(res - 1) * Size;
                float uz = -Size / 2 + iz / (float)(res - 1) * Size;
                float h = WorldMap.HeightAt(ux, -uz);
                heights[iz, ix] = Mathf.Clamp01((h - MinH) / (MaxH - MinH));
            }
            data.SetHeights(0, 0, heights);

            // povrchy: tráva, suchá tráva, písek, skála, cesta, dlažba (barvy jako webová verze)
            var layers = new[]
            {
                Layer(new Color32(80, 95, 44, 255), 4),
                Layer(new Color32(144, 126, 77, 255), 4),
                Layer(new Color32(195, 172, 131, 255), 6),
                Layer(new Color32(124, 117, 105, 255), 5),
                Layer(new Color32(125, 102, 74, 255), 3),
                Layer(new Color32(176, 166, 146, 255), 2),
            };
            data.terrainLayers = layers;
            int ares = 256;
            data.alphamapResolution = ares;
            var alpha = new float[ares, ares, layers.Length];
            for (int iz = 0; iz < ares; iz++)
            for (int ix = 0; ix < ares; ix++)
            {
                float ux = -Size / 2 + ix / (float)(ares - 1) * Size;
                float uz = -Size / 2 + iz / (float)(ares - 1) * Size;
                float x = ux, z = -uz;
                float h = WorldMap.HeightAt(x, z);
                float n = WorldMap.Fbm(x * 0.08f + 3, z * 0.08f);
                float dx = WorldMap.HeightAt(x + 1, z) - WorldMap.HeightAt(x - 1, z);
                float dz = WorldMap.HeightAt(x, z + 1) - WorldMap.HeightAt(x, z - 1);
                float slope = Mathf.Sqrt(dx * dx + dz * dz) * 0.5f;
                float w0 = 0, w1 = 0, w2 = 0, w3 = 0, w4 = 0, w5 = 0;
                bool pave = WorldMap.InCity(x, z);
                if (pave) w5 = 1;
                else if (h < 1.1f) w2 = 1;
                else
                {
                    float dry = Mathf.SmoothStep(0, 1, Mathf.InverseLerp(0.35f, 0.7f, n));
                    w0 = 1 - dry;
                    w1 = dry;
                    float rock = Mathf.Max(Mathf.InverseLerp(5, 11, h), Mathf.InverseLerp(0.18f, 0.42f, slope));
                    w0 *= 1 - rock; w1 *= 1 - rock; w3 = rock;
                    float rd = WorldMap.RoadDistance(x, z);
                    if (rd < 2.8f) { float r = 1 - Mathf.InverseLerp(1.4f, 2.8f, rd); w0 *= 1 - r; w1 *= 1 - r; w3 *= 1 - r; w4 = r; }
                }
                float sum = w0 + w1 + w2 + w3 + w4 + w5;
                if (sum <= 0) { w0 = 1; sum = 1; }
                alpha[iz, ix, 0] = w0 / sum; alpha[iz, ix, 1] = w1 / sum; alpha[iz, ix, 2] = w2 / sum;
                alpha[iz, ix, 3] = w3 / sum; alpha[iz, ix, 4] = w4 / sum; alpha[iz, ix, 5] = w5 / sum;
            }
            data.SetAlphamaps(0, 0, alpha);

            var go = Terrain.CreateTerrainGameObject(data);
            go.name = "Terrain";
            go.transform.SetParent(parent, false);
            go.transform.position = new Vector3(-Size / 2, MinH, -Size / 2);
            var terrain = go.GetComponent<Terrain>();
            terrain.heightmapPixelError = 4;
            terrain.basemapDistance = 120;
            terrain.drawInstanced = true;
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
                px[i] = new Color32((byte)Mathf.Clamp(c.r * k, 0, 255), (byte)Mathf.Clamp(c.g * k, 0, 255), (byte)Mathf.Clamp(c.b * k, 0, 255), 255);
            }
            tex.SetPixels32(px);
            tex.Apply(true);
            return new TerrainLayer { diffuseTexture = tex, tileSize = new Vector2(tile, tile) };
        }

        public static GameObject BuildSea(Transform parent)
        {
            var sea = GameObject.CreatePrimitive(PrimitiveType.Plane);
            sea.name = "Sea";
            sea.transform.SetParent(parent, false);
            sea.transform.position = new Vector3(0, 0.02f, 0);
            sea.transform.localScale = new Vector3(90, 1, 90);
            Object.Destroy(sea.GetComponent<Collider>());
            var r = sea.GetComponent<Renderer>();
            var m = ModelLibrary.NewLit(new Color(0.09f, 0.22f, 0.28f, 1), 0.92f);
            m.SetFloat("_Metallic", 0.1f);
            r.sharedMaterial = m;
            return sea;
        }
    }
}

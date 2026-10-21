using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

namespace Voxario.Ashes
{
    /// <summary>
    /// Skládání jednoduchých nízkopolygonových tvarů (kužel, válec, koule, kvádr) do jednoho
    /// meshe s plochým stínováním. UV: u = odstín (sloupec v paletě), v = výška (tmavší spodek).
    /// </summary>
    public class MeshKit
    {
        readonly List<Vector3> v = new List<Vector3>();
        readonly List<Vector3> n = new List<Vector3>();
        readonly List<Vector2> uv = new List<Vector2>();
        readonly List<int> t = new List<int>();

        public int Triangles => t.Count / 3;

        /// <summary>Přidá tvar (lokální trojúhelníky) s transformací; tint = 0…1 (sloupec palety).</summary>
        public void Add(List<Vector3> tris, Matrix4x4 m, float tint, float minY, float maxY, bool flat = true)
        {
            for (int i = 0; i < tris.Count; i += 3)
            {
                var a = m.MultiplyPoint3x4(tris[i]);
                var b = m.MultiplyPoint3x4(tris[i + 1]);
                var c = m.MultiplyPoint3x4(tris[i + 2]);
                var nn = Vector3.Cross(b - a, c - a).normalized;
                int baseIdx = v.Count;
                v.Add(a); v.Add(b); v.Add(c);
                n.Add(nn); n.Add(nn); n.Add(nn);
                uv.Add(new Vector2(tint, H(tris[i].y, minY, maxY)));
                uv.Add(new Vector2(tint, H(tris[i + 1].y, minY, maxY)));
                uv.Add(new Vector2(tint, H(tris[i + 2].y, minY, maxY)));
                t.Add(baseIdx); t.Add(baseIdx + 1); t.Add(baseIdx + 2);
            }
        }

        static float H(float y, float a, float b) => Mathf.Clamp01((y - a) / Mathf.Max(0.001f, b - a));

        public Mesh Build(string name)
        {
            var mesh = new Mesh { name = name, indexFormat = v.Count > 65000 ? IndexFormat.UInt32 : IndexFormat.UInt16 };
            mesh.SetVertices(v);
            mesh.SetNormals(n);
            mesh.SetUVs(0, uv);
            mesh.SetTriangles(t, 0);
            mesh.RecalculateBounds();
            mesh.RecalculateTangents();
            return mesh;
        }

        // ------------------------------------------------------------------ tvary (seznam trojúhelníků)
        public static List<Vector3> Cone(float r, float h, int seg, int rings)
        {
            var tris = new List<Vector3>();
            for (int ring = 0; ring < rings; ring++)
            {
                float y0 = h * ring / rings, y1 = h * (ring + 1) / rings;
                float r0 = r * (1 - (float)ring / rings), r1 = r * (1 - (float)(ring + 1) / rings);
                for (int s = 0; s < seg; s++)
                {
                    float a0 = s * Mathf.PI * 2 / seg, a1 = (s + 1) * Mathf.PI * 2 / seg;
                    var p00 = new Vector3(Mathf.Cos(a0) * r0, y0, Mathf.Sin(a0) * r0);
                    var p01 = new Vector3(Mathf.Cos(a1) * r0, y0, Mathf.Sin(a1) * r0);
                    var p10 = new Vector3(Mathf.Cos(a0) * r1, y1, Mathf.Sin(a0) * r1);
                    var p11 = new Vector3(Mathf.Cos(a1) * r1, y1, Mathf.Sin(a1) * r1);
                    tris.Add(p00); tris.Add(p10); tris.Add(p01);
                    if (ring < rings - 1) { tris.Add(p01); tris.Add(p10); tris.Add(p11); }
                }
            }
            // dno
            for (int s = 0; s < seg; s++)
            {
                float a0 = s * Mathf.PI * 2 / seg, a1 = (s + 1) * Mathf.PI * 2 / seg;
                tris.Add(Vector3.zero);
                tris.Add(new Vector3(Mathf.Cos(a0) * r, 0, Mathf.Sin(a0) * r));
                tris.Add(new Vector3(Mathf.Cos(a1) * r, 0, Mathf.Sin(a1) * r));
            }
            return tris;
        }

        public static List<Vector3> Cylinder(float rBottom, float rTop, float h, int seg, bool caps = true)
        {
            var tris = new List<Vector3>();
            for (int s = 0; s < seg; s++)
            {
                float a0 = s * Mathf.PI * 2 / seg, a1 = (s + 1) * Mathf.PI * 2 / seg;
                var b0 = new Vector3(Mathf.Cos(a0) * rBottom, 0, Mathf.Sin(a0) * rBottom);
                var b1 = new Vector3(Mathf.Cos(a1) * rBottom, 0, Mathf.Sin(a1) * rBottom);
                var t0 = new Vector3(Mathf.Cos(a0) * rTop, h, Mathf.Sin(a0) * rTop);
                var t1 = new Vector3(Mathf.Cos(a1) * rTop, h, Mathf.Sin(a1) * rTop);
                tris.Add(b0); tris.Add(t0); tris.Add(b1);
                tris.Add(b1); tris.Add(t0); tris.Add(t1);
                if (caps)
                {
                    tris.Add(new Vector3(0, h, 0)); tris.Add(t1); tris.Add(t0);
                    tris.Add(Vector3.zero); tris.Add(b0); tris.Add(b1);
                }
            }
            return tris;
        }

        public static List<Vector3> Box(Vector3 size)
        {
            var h = size * 0.5f;
            Vector3[] c =
            {
                new Vector3(-h.x, -h.y, -h.z), new Vector3(h.x, -h.y, -h.z), new Vector3(h.x, h.y, -h.z), new Vector3(-h.x, h.y, -h.z),
                new Vector3(-h.x, -h.y, h.z), new Vector3(h.x, -h.y, h.z), new Vector3(h.x, h.y, h.z), new Vector3(-h.x, h.y, h.z),
            };
            int[] f = { 0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2, 0, 4, 7, 0, 7, 3, 1, 2, 6, 1, 6, 5 };
            var tris = new List<Vector3>();
            foreach (var i in f) tris.Add(c[i]);
            return tris;
        }

        /// <summary>Ikosaedr (detail 0 nebo 1) – koule s plochými stěnami.</summary>
        public static List<Vector3> Ico(float r, int detail)
        {
            float g = (1 + Mathf.Sqrt(5)) / 2;
            var p = new List<Vector3>
            {
                new Vector3(-1, g, 0), new Vector3(1, g, 0), new Vector3(-1, -g, 0), new Vector3(1, -g, 0),
                new Vector3(0, -1, g), new Vector3(0, 1, g), new Vector3(0, -1, -g), new Vector3(0, 1, -g),
                new Vector3(g, 0, -1), new Vector3(g, 0, 1), new Vector3(-g, 0, -1), new Vector3(-g, 0, 1),
            };
            int[] f = { 0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1 };
            var tris = new List<Vector3>();
            for (int i = 0; i < f.Length; i += 3)
            {
                var a = p[f[i]].normalized; var b = p[f[i + 1]].normalized; var c = p[f[i + 2]].normalized;
                if (detail == 0) { tris.Add(a * r); tris.Add(b * r); tris.Add(c * r); continue; }
                var ab = ((a + b) / 2).normalized; var bc = ((b + c) / 2).normalized; var ca = ((c + a) / 2).normalized;
                foreach (var tri in new[] { new[] { a, ab, ca }, new[] { ab, b, bc }, new[] { ca, bc, c }, new[] { ab, bc, ca } })
                { tris.Add(tri[0] * r); tris.Add(tri[1] * r); tris.Add(tri[2] * r); }
            }
            return tris;
        }

        /// <summary>Organický tvar: vrcholy posunuté šumem (stejné vrcholy stejně).</summary>
        public static List<Vector3> Organic(List<Vector3> tris, float amount, float seed)
        {
            var moved = new Dictionary<Vector3, Vector3>();
            var outList = new List<Vector3>(tris.Count);
            foreach (var p in tris)
            {
                var key = new Vector3(Mathf.Round(p.x * 1000), Mathf.Round(p.y * 1000), Mathf.Round(p.z * 1000));
                if (!moved.TryGetValue(key, out var m))
                {
                    float nz = WorldMap.Fbm(p.x * 1.7f + seed, p.z * 1.7f + p.y * 1.3f) - 0.5f;
                    float len = Mathf.Max(0.001f, new Vector2(p.x, p.z).magnitude);
                    m = new Vector3(p.x + p.x / len * nz * amount, p.y + nz * amount * 0.4f, p.z + p.z / len * nz * amount);
                    moved[key] = m;
                }
                outList.Add(m);
            }
            return outList;
        }

        public static List<Vector3> Transform(List<Vector3> tris, Matrix4x4 m)
        {
            var o = new List<Vector3>(tris.Count);
            foreach (var p in tris) o.Add(m.MultiplyPoint3x4(p));
            return o;
        }

        /// <summary>Paleta: sloupce = odstíny barvy, řádky = přechod od tmavého spodku.</summary>
        public static Texture2D Palette(Color baseColor, float dark, int cols = 8)
        {
            var tex = new Texture2D(cols, 32, TextureFormat.RGBA32, false) { wrapMode = TextureWrapMode.Clamp, filterMode = FilterMode.Bilinear };
            for (int x = 0; x < cols; x++)
            {
                float k = 0.82f + x / (float)(cols - 1) * 0.3f;
                for (int y = 0; y < 32; y++)
                {
                    float t = y / 31f;
                    float c = dark + (1 - dark) * Mathf.Min(1, t * 1.3f);
                    var col = baseColor * k * c;
                    col.g *= 0.97f + (x % 5) * 0.012f;
                    col.a = 0.08f; // matný povrch (alfa = hladkost)
                    tex.SetPixel(x, y, col);
                }
            }
            tex.Apply();
            return tex;
        }
    }
}

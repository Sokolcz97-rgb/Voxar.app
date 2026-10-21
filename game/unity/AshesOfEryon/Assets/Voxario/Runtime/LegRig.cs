using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Chůze modelů bez kostry (stejně jako webová verze): vrcholy pod výškou nohou se
    /// kývají dopředu a dozadu. Lidé a ptáci střídají levou a pravou nohu, čtyřnožci
    /// diagonální páry. Počítá se jen u viditelných postav, které se hýbou.
    /// </summary>
    public class LegRig
    {
        public enum Gait { Biped, Quad }

        class Part
        {
            public Mesh mesh;
            public Vector3[] baseVerts;
            public Vector3[] verts;
            public int[] idx;          // vrcholy nohou
            public float[] k;          // síla pohybu (0 u kyčle, 1 u chodidla)
            public float[] side;       // −1 … 1 (strana / diagonála)
            public Matrix4x4 toLocal;  // směr z prostoru postavy do prostoru meshe
            public Renderer renderer;
        }

        readonly List<Part> parts = new List<Part>();
        readonly Gait gait;
        readonly float amp;
        bool dirty;

        public bool Valid => parts.Count > 0;

        /// <param name="root">kořen postavy (chodidla v y = 0, dopředu = +Z)</param>
        /// <param name="height">výška postavy v metrech</param>
        /// <param name="legRatio">do jaké výšky (podíl výšky) sahají nohy</param>
        public LegRig(Transform root, float height, float legRatio, Gait gait)
        {
            this.gait = gait;
            amp = gait == Gait.Biped ? 0.2f : height * 0.14f;
            float leg = Mathf.Max(0.05f, height * legRatio);
            var toRoot = root.worldToLocalMatrix;

            // střed těla v ose Z (pro rozdělení předních a zadních nohou)
            float zc = 0;
            var filters = root.GetComponentsInChildren<MeshFilter>();
            if (gait == Gait.Quad)
            {
                var b = new Bounds();
                bool first = true;
                foreach (var f in filters)
                {
                    var r = f.GetComponent<Renderer>();
                    if (r == null) continue;
                    var c = root.InverseTransformPoint(r.bounds.center);
                    if (first) { b = new Bounds(c, Vector3.zero); first = false; } else b.Encapsulate(c);
                }
                zc = b.center.z;
            }

            foreach (var f in filters)
            {
                var src = f.sharedMesh;
                if (src == null || !src.isReadable) continue;
                var m2r = toRoot * f.transform.localToWorldMatrix;
                var verts = src.vertices;
                var idx = new List<int>();
                var ks = new List<float>();
                var sides = new List<float>();
                for (int i = 0; i < verts.Length; i++)
                {
                    var p = m2r.MultiplyPoint3x4(verts[i]);
                    if (p.y >= leg) continue;
                    idx.Add(i);
                    ks.Add((leg - p.y) / leg);
                    if (gait == Gait.Biped) sides.Add(Mathf.SmoothStep(-1, 1, Mathf.InverseLerp(-0.07f, 0.07f, p.x)));
                    else sides.Add((p.z - zc) * p.x > 0 ? 1 : -1);
                }
                if (idx.Count == 0) continue;
                var mesh = Object.Instantiate(src);
                mesh.name = src.name + " (chůze)";
                mesh.MarkDynamic();
                // pohyb vrcholů nesmí model oříznout
                var bounds = mesh.bounds;
                bounds.Expand(amp * 2.5f);
                mesh.bounds = bounds;
                f.sharedMesh = mesh;
                parts.Add(new Part
                {
                    mesh = mesh,
                    baseVerts = verts,
                    verts = (Vector3[])verts.Clone(),
                    idx = idx.ToArray(),
                    k = ks.ToArray(),
                    side = sides.ToArray(),
                    toLocal = m2r.inverse,
                    renderer = f.GetComponent<Renderer>(),
                });
            }
        }

        /// <summary>phase = fáze kroku, amount = 0 (stojí) … 1 (chůze)</summary>
        public void Update(float phase, float amount)
        {
            if (amount < 0.01f)
            {
                if (!dirty) return;
                foreach (var p in parts) p.mesh.SetVertices(p.baseVerts);
                dirty = false;
                return;
            }
            dirty = true;
            foreach (var p in parts)
            {
                if (p.renderer != null && !p.renderer.isVisible) continue;
                var fwd = p.toLocal.MultiplyVector(Vector3.forward);
                var up = p.toLocal.MultiplyVector(Vector3.up);
                for (int j = 0; j < p.idx.Length; j++)
                {
                    int i = p.idx[j];
                    float k = p.k[j] * amount;
                    float dz, dy;
                    if (gait == Gait.Biped)
                    {
                        float s = p.side[j];
                        dz = Mathf.Sin(phase) * s * amp * k;
                        dy = Mathf.Max(0, Mathf.Cos(phase) * s) * 0.07f * k;
                    }
                    else
                    {
                        float ph = phase + (p.side[j] > 0 ? 0 : Mathf.PI);
                        dz = Mathf.Sin(ph) * amp * k;
                        dy = Mathf.Max(0, Mathf.Cos(ph)) * amp * 0.35f * k;
                    }
                    p.verts[i] = p.baseVerts[i] + fwd * dz + up * dy;
                }
                p.mesh.SetVertices(p.verts);
            }
        }
    }
}

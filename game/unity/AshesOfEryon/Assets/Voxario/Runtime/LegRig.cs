using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Chůze modelů bez kostry. Lidé: nohy se otáčejí v kyčlích (s pokrčením kolene při
    /// zvednutí), paže se kývají proti nohám v ramenou. Model se při vytvoření proměří:
    /// když má oddělené nohy, chodí plným krokem; když má sukni / róbu, kmitá jen lem látky
    /// (bez „roztrhávání“ šatů). Čtyřnožci střídají diagonální páry. Počítá se jen
    /// u viditelných postav, které se hýbou.
    /// </summary>
    public class LegRig
    {
        public enum Gait { Biped, Quad }

        class Part
        {
            public Mesh mesh;
            public Vector3[] baseVerts;   // v prostoru meshe
            public Vector3[] rootVerts;   // v prostoru postavy
            public Vector3[] verts;
            public int[] legIdx; public float[] legW; public float[] legSide;
            public int[] armIdx; public float[] armW; public float[] armSide;
            public Matrix4x4 toLocal;     // z prostoru postavy do meshe
            public Renderer renderer;
        }

        readonly List<Part> parts = new List<Part>();
        readonly Gait gait;
        readonly float height, hipY, kneeY, shoulderY, hipHalf, armX;
        float elbowY;
        readonly float quadAmp;
        bool dirty;

        public bool Valid => parts.Count > 0;
        /// <summary>Model má sukni / róbu (nohy nejsou oddělené).</summary>
        public bool Robe { get; }
        public bool HasArms { get; }

        /// <param name="root">kořen postavy (chodidla v y = 0, dopředu = +Z)</param>
        /// <param name="height">výška postavy v metrech</param>
        /// <param name="legRatio">do jaké výšky (podíl výšky) sahají nohy</param>
        public LegRig(Transform root, float height, float legRatio, Gait gait)
        {
            this.gait = gait;
            this.height = height;
            quadAmp = height * 0.14f;
            hipY = Mathf.Max(0.05f, height * legRatio);
            kneeY = hipY * 0.5f;
            var toRoot = root.worldToLocalMatrix;
            var filters = root.GetComponentsInChildren<MeshFilter>();

            // --- proměření modelu (jen lidé)
            var all = new List<Vector3>();
            foreach (var f in filters)
            {
                var src = f.sharedMesh;
                if (src == null || !src.isReadable) continue;
                var m2r = toRoot * f.transform.localToWorldMatrix;
                foreach (var v in src.vertices) all.Add(m2r.MultiplyPoint3x4(v));
            }
            float zc = 0;
            if (gait == Gait.Biped && all.Count > 0)
            {
                // nohy: v pásmu kotníků a lýtek je mezi nohama mezera, u sukně ne
                int band = 0, center = 0;
                float sumX = 0; int nx = 0;
                foreach (var p in all) if (p.y > height * 0.25f && p.y < height * 0.7f) { sumX += p.x; nx++; }
                float cx = nx > 0 ? sumX / nx : 0;
                foreach (var p in all)
                {
                    if (p.y < height * 0.04f || p.y > hipY * 0.75f) continue;
                    band++;
                    if (Mathf.Abs(p.x - cx) < height * 0.018f) center++;
                }
                Robe = band > 0 && center > band * 0.07f;
                hipHalf = height * 0.05f;
                // paže: pod rameny hledáme mezeru mezi trupem a paží
                shoulderY = height * 0.66f;
                var xs = new List<float>();
                foreach (var p in all) if (p.y > height * 0.44f && p.y < height * 0.56f) xs.Add(Mathf.Abs(p.x - cx));
                xs.Sort();
                float bestGap = 0, gapAt = 0;
                for (int i = 1; i < xs.Count; i++)
                {
                    if (xs[i - 1] < height * 0.04f || xs[i] > height * 0.3f) continue;
                    float g = xs[i] - xs[i - 1];
                    if (g > bestGap) { bestGap = g; gapAt = (xs[i] + xs[i - 1]) / 2; }
                }
                HasArms = bestGap > height * 0.006f;
                armX = gapAt;
                // rameno = nejvyšší vrchol paže
                if (HasArms)
                {
                    float top = 0;
                    foreach (var p in all) if (Mathf.Abs(p.x - cx) > armX && p.y < height * 0.8f && p.y > top) top = p.y;
                    shoulderY = Mathf.Clamp(top - height * 0.03f, height * 0.5f, height * 0.75f);
                    float bottom = shoulderY;
                    foreach (var p in all) if (Mathf.Abs(p.x - cx) > armX && p.y < shoulderY && p.y > height * 0.2f && p.y < bottom) bottom = p.y;
                    elbowY = shoulderY - (shoulderY - bottom) * 0.45f;
                }
                zc = cx; // zde střed v ose X
            }
            else if (gait == Gait.Quad)
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
                var rootV = new Vector3[verts.Length];
                var li = new List<int>(); var lw = new List<float>(); var ls = new List<float>();
                var ai = new List<int>(); var aw = new List<float>(); var asd = new List<float>();
                float legBand = Robe ? height * 0.16f : height * 0.035f;
                for (int i = 0; i < verts.Length; i++)
                {
                    var p = m2r.MultiplyPoint3x4(verts[i]);
                    rootV[i] = p;
                    if (gait == Gait.Quad)
                    {
                        if (p.y >= hipY) continue;
                        li.Add(i); lw.Add((hipY - p.y) / hipY); ls.Add((p.z - zc) * p.x > 0 ? 1 : -1);
                        continue;
                    }
                    float x = p.x - zc;
                    bool arm = HasArms && Mathf.Abs(x) > armX && p.y < shoulderY + height * 0.02f && p.y > height * 0.2f;
                    if (arm)
                    {
                        ai.Add(i);
                        aw.Add(Mathf.SmoothStep(0, 1, Mathf.InverseLerp(shoulderY + height * 0.02f, shoulderY - height * 0.12f, p.y)));
                        asd.Add(Mathf.Sign(x));
                        continue;
                    }
                    if (p.y >= hipY) continue;
                    li.Add(i);
                    // u kyčle 0, níž plná síla (plynulý přechod = žádné trhliny)
                    lw.Add(Mathf.SmoothStep(0, 1, Mathf.InverseLerp(hipY, hipY - height * 0.12f, p.y)));
                    ls.Add(Mathf.Lerp(-1, 1, Mathf.SmoothStep(0, 1, Mathf.InverseLerp(-legBand, legBand, x))));
                }
                if (li.Count == 0 && ai.Count == 0) continue;
                var mesh = Object.Instantiate(src);
                mesh.name = src.name + " (chůze)";
                mesh.MarkDynamic();
                var bounds = mesh.bounds;
                bounds.Expand(height * 0.5f);
                mesh.bounds = bounds;
                f.sharedMesh = mesh;
                parts.Add(new Part
                {
                    mesh = mesh, baseVerts = verts, rootVerts = rootV, verts = (Vector3[])verts.Clone(),
                    legIdx = li.ToArray(), legW = lw.ToArray(), legSide = ls.ToArray(),
                    armIdx = ai.ToArray(), armW = aw.ToArray(), armSide = asd.ToArray(),
                    toLocal = m2r.inverse, renderer = f.GetComponent<Renderer>(),
                });
            }
        }

        static Vector3 RotX(Vector3 v, Vector3 pivot, float deg)
        {
            float a = deg * Mathf.Deg2Rad, c = Mathf.Cos(a), s = Mathf.Sin(a);
            var d = v - pivot;
            return pivot + new Vector3(d.x, d.y * c - d.z * s, d.y * s + d.z * c);
        }

        /// <summary>
        /// phase = fáze kroku, amount = 0 (stojí) … 1 (chůze), run = 0 … 1 (běh);
        /// gait = zachycený pohyb z animace (běh), gaitW = jak moc ho použít (0 … 1).
        /// </summary>
        public void Update(float phase, float amount, float run = 0, float armIdle = 0, Voxario.Ashes.Gait motion = null, float gaitW = 0)
        {
            if (motion == null) gaitW = 0;
            float gt = gaitW > 0 ? motion.T(phase) : 0;
            float thL = 0, thR = 0, knL = 0, knR = 0, arL = 0, arR = 0, elL = 0, elR = 0;
            if (gaitW > 0)
            {
                thL = motion.Sample("thighL", gt); thR = motion.Sample("thighR", gt);
                knL = motion.Sample("kneeL", gt); knR = motion.Sample("kneeR", gt);
                arL = motion.Sample("armL", gt) - motion.Mean("armL"); arR = motion.Sample("armR", gt) - motion.Mean("armR");
                elL = motion.Sample("elbowL", gt); elR = motion.Sample("elbowR", gt);
            }
            if (amount < 0.01f && armIdle < 0.01f)
            {
                if (!dirty) return;
                foreach (var p in parts) p.mesh.SetVertices(p.baseVerts);
                dirty = false;
                return;
            }
            dirty = true;
            float sinP = Mathf.Sin(phase), cosP = Mathf.Cos(phase);
            foreach (var p in parts)
            {
                if (p.renderer != null && !p.renderer.isVisible) continue;
                if (gait == Gait.Quad)
                {
                    var fwd = p.toLocal.MultiplyVector(Vector3.forward);
                    var up = p.toLocal.MultiplyVector(Vector3.up);
                    for (int j = 0; j < p.legIdx.Length; j++)
                    {
                        int i = p.legIdx[j];
                        float k = p.legW[j] * amount;
                        float ph = phase + (p.legSide[j] > 0 ? 0 : Mathf.PI);
                        float dz = Mathf.Sin(ph) * quadAmp * k;
                        float dy = Mathf.Max(0, Mathf.Cos(ph)) * quadAmp * 0.35f * k;
                        p.verts[i] = p.baseVerts[i] + fwd * dz + up * dy;
                    }
                    p.mesh.SetVertices(p.verts);
                    continue;
                }

                // --- nohy: rotace v kyčli, koleno se pokrčí, když noda jde dopředu
                float legAmp = Robe ? Mathf.Lerp(9f, 13f, run) : Mathf.Lerp(24f, 36f, run);
                for (int j = 0; j < p.legIdx.Length; j++)
                {
                    int i = p.legIdx[j];
                    float side = p.legSide[j];
                    float w = p.legW[j] * amount;
                    var v = p.rootVerts[i];
                    float ang = -sinP * side * legAmp * w;
                    float lr = (side + 1) * 0.5f; // 0 = levá, 1 = pravá
                    if (gaitW > 0)
                    {
                        float fwd = Mathf.Lerp(thL, thR, lr) * (Robe ? 0.35f : 1f);
                        ang = Mathf.Lerp(ang, -fwd * w, gaitW);
                    }
                    var pivot = new Vector3(v.x, hipY, 0);
                    var r = RotX(v, pivot, ang);
                    if (!Robe && v.y < kneeY)
                    {
                        // zvednutí chodidla: koleno se ohne při švihu vpřed
                        float lift = Mathf.Max(0, cosP * side) * Mathf.Lerp(28f, 50f, run) * w;
                        if (gaitW > 0) lift = Mathf.Lerp(lift, Mathf.Max(0, Mathf.Lerp(knL, knR, lr)) * w, gaitW);
                        var knee = RotX(new Vector3(v.x, kneeY, 0), pivot, ang);
                        float kk = Mathf.InverseLerp(kneeY, kneeY - height * 0.05f, v.y);
                        r = RotX(r, knee, lift * kk);
                    }
                    else if (Robe)
                    {
                        // lem šatů: jemné vlnění a nadzvednutí podle kroku
                        float hem = Mathf.InverseLerp(hipY, 0, v.y);
                        r.z += Mathf.Sin(phase * 2 + v.x * 9f) * 0.012f * height * hem * w;
                        r.y += Mathf.Max(0, cosP * side) * 0.02f * height * hem * w;
                    }
                    p.verts[i] = p.toLocal.MultiplyPoint3x4(r);
                }
                // --- paže: kyv proti nohám, při běhu víc a pokrčené
                float armAmp = Mathf.Lerp(16f, 30f, run) * amount;
                for (int j = 0; j < p.armIdx.Length; j++)
                {
                    int i = p.armIdx[j];
                    var v = p.rootVerts[i];
                    float side = p.armSide[j];
                    float w = p.armW[j];
                    float ang = sinP * side * armAmp * w + armIdle * w;
                    float elbow = 0;
                    if (gaitW > 0)
                    {
                        bool left = side < 0;
                        ang = Mathf.Lerp(ang, -(left ? arL : arR) * 0.8f * w, gaitW);
                        // pokrčení lokte (předloktí dopředu), u postav s věcí v ruce méně
                        elbow = -Mathf.Clamp(left ? elL : elR, 0, 100) * 0.6f * gaitW;
                    }
                    var pivot = new Vector3(v.x, shoulderY, 0);
                    var r = RotX(v, pivot, ang);
                    if (elbow != 0 && elbowY > 0 && v.y < elbowY)
                    {
                        var e = RotX(new Vector3(v.x, elbowY, 0), pivot, ang);
                        float ek = Mathf.InverseLerp(elbowY, elbowY - height * 0.04f, v.y);
                        r = RotX(r, e, elbow * ek);
                    }
                    p.verts[i] = p.toLocal.MultiplyPoint3x4(r);
                }
                p.mesh.SetVertices(p.verts);
            }
        }
    }
}

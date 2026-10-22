using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Postava z 3D modelu (bez kostry): usadí model na zem, nastaví velikost a při chůzi
    /// ho pohupuje a naklání – stejně jako webová verze.
    /// </summary>
    public class CharacterView : Entity
    {
        public float speed;
        /// <summary>NPC: občas se rozhlédne a přešlápne.</summary>
        public bool idleLook;
        Transform body;
        float phase, amount, breath, height = 1.6f, lookSeed;
        LegRig legs;
        float lungeT = -1, flinchT = -1, fallT = -1;
        bool fallen;
        /// <summary>Ženská postava: kratší krok, víc pohupování v bocích.</summary>
        public bool feminine;
        float run;
        Gait jog, walk, idle;
        /// <summary>Hráč: v klidu se hýbou i ruce a nohy (u ostatních jen trup – šetří výkon).</summary>
        public bool detailedIdle;

        /// <summary>Výpad dopředu (útok).</summary>
        public void Lunge() => lungeT = 0;
        /// <summary>Zásah: krátce se zakloní.</summary>
        public void Flinch() => flinchT = 0;
        /// <summary>Pád (prohra / smrt).</summary>
        public void Fall() { fallT = 0; fallen = true; }
        public void Stand() { fallen = false; fallT = -1; }

        public static CharacterView Create(GameObject prefab, Transform parent, float height, string name,
            LegRig.Gait gait = LegRig.Gait.Biped, float legRatio = 0.3f, float yaw = 0)
        {
            var root = new GameObject(name);
            root.transform.SetParent(parent, false);
            var view = root.AddComponent<CharacterView>();
            view.height = height;
            view.lookSeed = Random.value * 100;
            view.body = new GameObject("Body").transform;
            view.body.SetParent(root.transform, false);
            if (prefab != null)
            {
                var model = Instantiate(prefab, view.body);
                view.feminine = prefab.name.Contains("_f");
                // běh z animace Mixamo (zatím mužský)
                if (gait == LegRig.Gait.Biped && !view.feminine)
                {
                    view.jog = Gait.Load("gait_jogging_m");
                    view.walk = Gait.Load("gait_walking_m");
                    view.idle = Gait.Load("gait_idle_m");
                }
                SharpenTextures(model);
                if (yaw != 0) model.transform.localRotation = Quaternion.Euler(0, yaw, 0) * model.transform.localRotation;
                Fit(model.transform, height);
                view.legs = new LegRig(root.transform, height, legRatio, gait);
                if (!view.legs.Valid) view.legs = null;
            }
            else
            {
                // náhrada, když model chybí
                var cap = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                Destroy(cap.GetComponent<Collider>());
                cap.transform.SetParent(view.body, false);
                cap.transform.localPosition = new Vector3(0, height / 2, 0);
                cap.transform.localScale = new Vector3(0.6f, height / 2, 0.6f);
            }
            return view;
        }

        static readonly System.Collections.Generic.HashSet<Material> sharpened = new System.Collections.Generic.HashSet<Material>();
        static readonly System.Collections.Generic.Dictionary<Texture, Texture2D> noMip = new System.Collections.Generic.Dictionary<Texture, Texture2D>();

        /// <summary>
        /// Textury postav jsou atlasy z mnoha malých ostrůvků – zmenšené úrovně (mipmapy)
        /// slévají sousední barvy a postava pak vypadá zašle. Použijeme jen plné rozlišení.
        /// </summary>
        public static void SharpenTextures(GameObject model)
        {
            foreach (var r in model.GetComponentsInChildren<Renderer>(true))
                foreach (var m in r.sharedMaterials)
                {
                    if (m == null || !sharpened.Add(m)) continue;
                    foreach (var prop in m.GetTexturePropertyNames())
                    {
                        if (!(m.GetTexture(prop) is Texture2D t) || t.mipmapCount <= 1) continue;
                        if (!noMip.TryGetValue(t, out var copy))
                        {
                            copy = null;
                            try
                            {
                                if (SystemInfo.copyTextureSupport != UnityEngine.Rendering.CopyTextureSupport.None)
                                {
                                    copy = new Texture2D(t.width, t.height, t.format, false, false) { name = t.name + " (ostrá)", filterMode = FilterMode.Bilinear, anisoLevel = 4, wrapMode = t.wrapMode };
                                    Graphics.CopyTexture(t, 0, 0, copy, 0, 0);
                                }
                            }
                            catch { copy = null; }
                            if (copy == null) { t.mipMapBias = -1.5f; t.anisoLevel = 8; }
                            noMip[t] = copy;
                        }
                        if (copy != null) m.SetTexture(prop, copy);
                    }
                }
        }

        /// <summary>Zmenší model na danou výšku a postaví chodidly na nulu, střed do osy.</summary>
        public static void Fit(Transform model, float height)
        {
            var renderers = model.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return;
            var b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            float s = height / Mathf.Max(0.001f, b.size.y);
            model.localScale *= s;
            b = renderers[0].bounds;
            foreach (var r in renderers) b.Encapsulate(r.bounds);
            var offset = model.parent.InverseTransformPoint(new Vector3(b.center.x, b.min.y, b.center.z));
            model.localPosition -= offset;
            foreach (var r in renderers) r.shadowCastingMode = UnityEngine.Rendering.ShadowCastingMode.On;
        }

        protected override void OnUpdate(float dt)
        {
            if (body == null) return;
            bool moving = speed > 0.05f;
            float target = moving ? Mathf.Min(1, 0.55f + speed * 0.15f) : 0;
            amount = Mathf.MoveTowards(amount, target, dt * 5);
            run = Mathf.MoveTowards(run, Mathf.InverseLerp(4.5f, 7f, speed), dt * 3);
            // délka kroku podle výšky (chodidla nekloužou); ženy kratší krok
            float step = height * (feminine ? 0.36f : 0.42f) * Mathf.Lerp(1f, 1.35f, run);
            if (moving) phase += dt * Mathf.PI * Mathf.Max(speed, 1.2f) / Mathf.Max(0.2f, step);
            breath += dt;
            float k = height / 1.6f;
            float look = 0;
            if (idleLook && !moving)
            {
                // pomalé rozhlížení: chvíli stojí, pak se podívá stranou
                float t = Time.time * 0.25f + lookSeed;
                look = Mathf.Sin(t) * Mathf.Max(0, Mathf.Sin(t * 0.37f)) * 18f;
            }
            // pohupování: dvakrát za cyklus nahoru (při běhu víc), boky do strany (ženy víc)
            float bob = (1 - Mathf.Abs(Mathf.Cos(phase))) * Mathf.Lerp(0.03f, 0.065f, run) * k * amount;
            float hip = Mathf.Sin(phase) * (feminine ? 0.022f : 0.01f) * k * amount;
            // v klidu jemné přenášení váhy
            float idleShift = moving ? 0 : Mathf.Sin(breath * 0.55f + lookSeed) * 0.008f * k;
            float gw = jog != null ? run * amount : 0;
            float ww = walk != null ? (1 - run) * amount : 0;
            float gaitRoll = 0, gaitLean = 0;
            float mw = gw + ww;
            if (mw > 0)
            {
                // pohupování pánve a náklon z animace (pánev ~ 0,5 výšky postavy u Mixamo, u našich menší)
                float jb = 0, jr = 0, jl = 0;
                if (gw > 0) { float t = jog.T(phase); jb += jog.Sample("bob", t) * gw; jr += (jog.Sample("roll", t) - jog.Mean("roll")) * gw; jl += jog.Mean("lean") * gw; }
                if (ww > 0) { float t = walk.T(phase); jb += walk.Sample("bob", t) * ww; jr += (walk.Sample("roll", t) - walk.Mean("roll")) * ww; jl += walk.Mean("lean") * ww; }
                bob = Mathf.Lerp(bob, jb / mw * height * 0.32f, Mathf.Clamp01(mw));
                gaitRoll = jr / mw;
                gaitLean = jl / mw;
            }
            float idleT = -1;
            if (!moving && idle != null)
            {
                idleT = idle.TTime(breath + lookSeed);
                // klid z animace: jemné pohupování a přenášení váhy trupu
                bob += (idle.Sample("bob", idleT) - idle.Mean("bob")) * height * 0.32f;
                gaitRoll = (idle.Sample("roll", idleT) - idle.Mean("roll")) * 0.7f;
                gaitLean = idle.Sample("lean", idleT) - idle.Mean("lean");
                if (!detailedIdle) idleT = -1;
            }
            var pos = new Vector3(hip + idleShift, bob + Mathf.Sin(breath * 1.8f) * 0.005f * k, 0);
            float pitch = Mathf.Lerp(3f, 9f, run) * amount;
            if (mw > 0) pitch = Mathf.Lerp(pitch, Mathf.Clamp(gaitLean, 0, 18) * amount, Mathf.Clamp01(mw));
            else if (!moving && idle != null) pitch += Mathf.Clamp(gaitLean, -4, 4);
            if (lungeT >= 0)
            {
                lungeT += dt;
                float l = Mathf.Sin(Mathf.Clamp01(lungeT / 0.42f) * Mathf.PI);
                pos.z += l * 0.55f;
                pitch += l * 14f;
                if (lungeT > 0.42f) lungeT = -1;
            }
            if (flinchT >= 0)
            {
                flinchT += dt;
                float l = Mathf.Sin(Mathf.Clamp01(flinchT / 0.32f) * Mathf.PI);
                pitch -= l * 10f;
                pos.z -= l * 0.12f;
                if (flinchT > 0.32f) flinchT = -1;
            }
            if (fallen)
            {
                fallT = Mathf.Min(1, fallT + dt / 0.8f);
                float e = 1 - Mathf.Pow(1 - fallT, 3);
                pitch = -83f * e;
                pos.y = 0.05f * e;
            }
            body.localPosition = pos;
            // trup se mírně stáčí proti krokům, ženy víc naklánějí boky
            float twist = Mathf.Sin(phase) * Mathf.Lerp(3f, 5f, run) * amount;
            float roll = Mathf.Sin(phase) * (feminine ? 3.2f : 1.8f) * amount + idleShift * 40f;
            roll = Mathf.Lerp(roll, gaitRoll, moving ? Mathf.Clamp01(mw) : (idle != null ? 1 : 0));
            body.localRotation = Quaternion.Euler(pitch, look + twist, roll);
            // dech: nepatrné „nadechnutí“ celé postavy
            float br = 1 + Mathf.Sin(breath * 1.8f) * 0.006f;
            body.localScale = new Vector3(1 + (br - 1) * 0.6f, br, 1 + (br - 1) * 0.6f);
            legs?.Update(phase, amount, run, 0, idleT >= 0 ? idle : walk, ww, jog, gw, idleT);
        }
    }
}

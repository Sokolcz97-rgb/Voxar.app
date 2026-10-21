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
            float target = moving ? Mathf.Min(1, 0.45f + speed * 0.12f) : 0;
            amount = Mathf.MoveTowards(amount, target, dt * 6);
            // menší zvířata dělají rychlejší kroky
            float stride = Mathf.Clamp(1.6f / Mathf.Max(0.3f, height), 0.6f, 2.5f);
            if (moving) phase += dt * (4 + speed * 1.6f) * stride;
            breath += dt;
            float k = height / 1.6f;
            float look = 0;
            if (idleLook && !moving)
            {
                // pomalé rozhlížení: chvíli stojí, pak se podívá stranou
                float t = Time.time * 0.25f + lookSeed;
                look = Mathf.Sin(t) * Mathf.Max(0, Mathf.Sin(t * 0.37f)) * 18f;
            }
            var pos = new Vector3(0, Mathf.Abs(Mathf.Sin(phase)) * 0.045f * k * amount + Mathf.Sin(breath * 1.8f) * 0.006f * k, 0);
            float pitch = 4.5f * amount;
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
            body.localRotation = Quaternion.Euler(pitch, look, Mathf.Sin(phase) * 2f * amount);
            legs?.Update(phase, amount);
        }
    }
}

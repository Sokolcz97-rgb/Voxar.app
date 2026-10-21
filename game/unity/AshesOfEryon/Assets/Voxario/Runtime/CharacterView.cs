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
        Transform body;
        float phase, amount, breath;

        public static CharacterView Create(GameObject prefab, Transform parent, float height, string name)
        {
            var root = new GameObject(name);
            root.transform.SetParent(parent, false);
            var view = root.AddComponent<CharacterView>();
            view.body = new GameObject("Body").transform;
            view.body.SetParent(root.transform, false);
            if (prefab != null)
            {
                var model = Instantiate(prefab, view.body);
                Fit(model.transform, height);
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
            if (moving) phase += dt * (4 + speed * 1.6f);
            breath += dt;
            body.localPosition = new Vector3(0, Mathf.Abs(Mathf.Sin(phase)) * 0.045f * amount + Mathf.Sin(breath * 1.8f) * 0.006f, 0);
            body.localRotation = Quaternion.Euler(4.5f * amount, 0, Mathf.Sin(phase) * 2f * amount);
        }
    }
}

using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Zvíře se pomalu toulá kolem svého domova a občas se zastaví.</summary>
    public class Wanderer : Entity
    {
        public Vector2 home;
        public float range = 8;
        public float speed = 0.8f;
        Vector2 target;
        float wait;
        CharacterView view;

        protected override void OnStart()
        {
            view = GetComponent<CharacterView>();
            target = WorldMap.ToWeb(transform.position);
            wait = Random.Range(0f, 5f);
        }

        protected override void OnUpdate(float dt)
        {
            var pos = WorldMap.ToWeb(transform.position);
            var d = target - pos;
            if (d.magnitude < 0.3f)
            {
                if (view != null) view.speed = 0;
                wait -= dt;
                if (wait <= 0)
                {
                    target = home + Random.insideUnitCircle * range;
                    if (WorldMap.HeightAt(target.x, target.y) < 0.5f) target = home;
                    wait = Random.Range(2f, 8f);
                }
                return;
            }
            var step = d.normalized * speed * dt;
            pos += step;
            transform.position = WorldMap.ToWorld(pos.x, pos.y);
            var dir = new Vector3(step.x, 0, -step.y);
            transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(dir, Vector3.up), 1 - Mathf.Exp(-6 * dt));
            if (view != null) view.speed = speed;
        }
    }
}

using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Pohyb hráče (WASD / šipky, Shift = běh) po terénu, směr podle kamery.</summary>
    [RequireComponent(typeof(CharacterController))]
    public class PlayerController : Entity
    {
        public CharacterView view;
        public Transform cameraPivot;
        public float walkSpeed = 4.2f;
        public float runSpeed = 7f;
        public bool inputEnabled = true;
        CharacterController cc;
        float vy;

        protected override void OnStart()
        {
            cc = GetComponent<CharacterController>();
            cc.height = 1.6f;
            cc.radius = 0.35f;
            cc.center = new Vector3(0, 0.82f, 0);
            cc.stepOffset = 0.45f;
            cc.slopeLimit = 55;
        }

        protected override void OnUpdate(float dt)
        {
            Vector2 input = inputEnabled ? new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical")) : Vector2.zero;
            Vector3 fwd = cameraPivot != null ? Vector3.ProjectOnPlane(cameraPivot.forward, Vector3.up).normalized : Vector3.forward;
            Vector3 right = Vector3.Cross(Vector3.up, fwd);
            Vector3 move = (fwd * input.y + right * input.x);
            if (move.sqrMagnitude > 1) move.Normalize();
            float spd = Input.GetKey(KeyCode.LeftShift) ? runSpeed : walkSpeed;
            Vector3 vel = move * spd;
            if (cc.isGrounded) vy = -2f; else vy -= 20f * dt;
            vel.y = vy;
            cc.Move(vel * dt);
            if (move.sqrMagnitude > 0.01f)
            {
                var want = Quaternion.LookRotation(move, Vector3.up);
                transform.rotation = Quaternion.Slerp(transform.rotation, want, 1 - Mathf.Exp(-12 * dt));
            }
            if (view != null) view.speed = move.magnitude * spd;
            // pád do moře: zpět na břeh
            if (transform.position.y < -3) Respawn(WorldMap.SpawnKalidra);
        }

        public void Respawn(Vector2 web)
        {
            if (cc == null) cc = GetComponent<CharacterController>();
            cc.enabled = false;
            transform.position = WorldMap.ToWorld(web.x, web.y) + Vector3.up * 0.2f;
            cc.enabled = true;
        }
    }
}

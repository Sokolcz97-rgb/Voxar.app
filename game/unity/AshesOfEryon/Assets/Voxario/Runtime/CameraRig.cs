using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Kamera ve třetí osobě: pravé tlačítko myši = otáčení, kolečko = vzdálenost.</summary>
    public class CameraRig : MonoBehaviour
    {
        public Transform target;
        public Camera cam;
        public float distance = 7f;
        public float yaw, pitch = 22f;
        public bool inputEnabled = true;

        void LateUpdate()
        {
            float dt = Time.deltaTime;
            if (target == null || cam == null) return;
            if (inputEnabled)
            {
                if (Input.GetMouseButton(1))
                {
                    yaw += Input.GetAxis("Mouse X") * 4f;
                    pitch = Mathf.Clamp(pitch - Input.GetAxis("Mouse Y") * 3f, 5, 70);
                }
                if (Input.GetKey(KeyCode.Q)) yaw -= 90 * dt;
                if (Input.GetKey(KeyCode.E)) yaw += 90 * dt;
                distance = Mathf.Clamp(distance - Input.mouseScrollDelta.y * 0.8f, 2.5f, 22f);
            }
            transform.position = target.position + Vector3.up * 1.3f;
            transform.rotation = Quaternion.Euler(pitch, yaw, 0);
            var want = transform.position - transform.forward * distance;
            // kamera nesmí pod terén
            float ground = WorldMap.HeightAt(want.x, -want.z) + 0.6f;
            if (want.y < ground) want.y = ground;
            cam.transform.position = Vector3.Lerp(cam.transform.position, want, 1 - Mathf.Exp(-14 * dt));
            cam.transform.LookAt(transform.position);
        }
    }
}

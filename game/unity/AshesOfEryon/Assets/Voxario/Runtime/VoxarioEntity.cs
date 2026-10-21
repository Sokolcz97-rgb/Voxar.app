using UnityEngine;

namespace Voxario
{
    /// <summary>
    /// Základ herních objektů podle architektury Voxario (OnStart / OnUpdate).
    /// V Unity stojí na MonoBehaviour, takže jde kdykoli přenést do vlastního enginu.
    /// </summary>
    public abstract class Entity : MonoBehaviour
    {
        protected virtual void OnStart() { }
        protected virtual void OnUpdate(float deltaTime) { }

        void Start() => OnStart();
        void Update() => OnUpdate(Time.deltaTime);
    }
}

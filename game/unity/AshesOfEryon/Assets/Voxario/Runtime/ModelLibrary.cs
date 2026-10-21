using System;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Odkazy na modely (GLB importované přes glTFast). Vyplní je sestavovací skript.</summary>
    public class ModelLibrary : MonoBehaviour
    {
        [Serializable]
        public struct Entry
        {
            public string key;
            public GameObject prefab;
        }

        public Entry[] heroes = Array.Empty<Entry>();
        public Entry[] buildings = Array.Empty<Entry>();
        public Entry[] animals = Array.Empty<Entry>();
        /// <summary>Šablony materiálů (HDRP/Lit a HDRP/TerrainLit), aby se shadery dostaly do sestavení.</summary>
        public Material lit;
        public Material terrain;

        public static ModelLibrary Instance { get; private set; }
        void Awake() => Instance = this;

        public static Material NewLit(Color c, float smoothness)
        {
            var src = Instance != null ? Instance.lit : null;
            var m = src != null ? new Material(src) : new Material(Shader.Find("HDRP/Lit"));
            m.SetColor("_BaseColor", c);
            m.SetFloat("_Smoothness", smoothness);
            return m;
        }

        public GameObject Hero(string key) => Find(heroes, key);
        public GameObject Building(string key) => Find(buildings, key);
        public GameObject Animal(string key) => Find(animals, key);

        static GameObject Find(Entry[] list, string key)
        {
            foreach (var e in list) if (e.key == key) return e.prefab;
            return null;
        }
    }
}

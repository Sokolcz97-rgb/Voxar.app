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

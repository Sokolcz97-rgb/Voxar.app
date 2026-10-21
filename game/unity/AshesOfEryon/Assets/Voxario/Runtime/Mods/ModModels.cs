using System;
using System.Collections.Generic;
using System.IO;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>Načítání GLB modelů z módů za běhu (glTFast). Modely se ukládají do mezipaměti.</summary>
    public static class ModModels
    {
        static readonly Dictionary<string, GameObject> cache = new Dictionary<string, GameObject>();
        static Transform holder;

        public static async void LoadAsync(string path, Action<GameObject> done)
        {
            try
            {
                if (cache.TryGetValue(path, out var cached)) { done(cached); return; }
                if (!File.Exists(path) || new FileInfo(path).Length > 64 * 1024 * 1024) { done(null); return; }
                if (holder == null)
                {
                    holder = new GameObject("Modely módů").transform;
                    UnityEngine.Object.DontDestroyOnLoad(holder.gameObject);
                    holder.gameObject.SetActive(false); // šablony – neviditelné
                }
                var gltf = new GLTFast.GltfImport();
                bool ok = await gltf.LoadFile(path, new Uri(path));
                if (!ok) { done(null); return; }
                var root = new GameObject(Path.GetFileNameWithoutExtension(path));
                root.transform.SetParent(holder, false);
                ok = await gltf.InstantiateMainSceneAsync(root.transform);
                if (!ok) { UnityEngine.Object.Destroy(root); done(null); return; }
                cache[path] = root;
                done(root);
            }
            catch (Exception e)
            {
                Debug.Log("[Voxario] model módu: " + e.Message);
                done(null);
            }
        }
    }
}

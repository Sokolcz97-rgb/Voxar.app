using System;
using System.Reflection;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace Voxario.Ashes
{
    /// <summary>
    /// Volitelný ray tracing (DirectX 12 + karta s DXR, např. NVIDIA RTX nebo AMD RX 6000+):
    /// paprskově sledované odrazy, stíny slunce a okluze. Bez podpory zůstává klasické
    /// zobrazení. Nastavení se ukládá do gfx.raytracing.
    /// </summary>
    public static class RayTracing
    {
        public static bool Supported
        {
            get
            {
                try
                {
                    if (!SystemInfo.supportsRayTracing) return false;
                    var asset = GraphicsSettings.currentRenderPipeline as HDRenderPipelineAsset;
                    return asset != null && asset.currentPlatformRenderPipelineSettings.supportRayTracing;
                }
                catch { return false; }
            }
        }

        public static bool Enabled => Supported && PlayerPrefs.GetInt("gfx.raytracing", 0) == 1;

        public static void Set(bool on)
        {
            PlayerPrefs.SetInt("gfx.raytracing", on ? 1 : 0);
            Atmosphere.ApplyRayTracing();
        }

        /// <summary>Nastaví hodnotu VolumeParameter (přes reflexi – názvy se mezi verzemi HDRP mírně liší).</summary>
        internal static void Param(object component, string field, object value)
        {
            if (component == null) return;
            try
            {
                var f = component.GetType().GetField(field, BindingFlags.Public | BindingFlags.Instance);
                var p = f?.GetValue(component);
                if (p == null) return;
                var vt = p.GetType().GetProperty("value");
                if (vt == null) return;
                object v = value;
                if (vt.PropertyType.IsEnum) v = value is string s ? Enum.Parse(vt.PropertyType, s) : Enum.ToObject(vt.PropertyType, value);
                p.GetType().GetMethod("Override", new[] { vt.PropertyType })?.Invoke(p, new[] { v });
            }
            catch (Exception e) { Debug.LogWarning($"[Voxario] ray tracing {field}: {e.Message}"); }
        }

        internal static void LightShadows(bool on)
        {
            foreach (var l in UnityEngine.Object.FindObjectsByType<HDAdditionalLightData>(FindObjectsSortMode.None))
            {
                try
                {
                    var p = l.GetType().GetProperty("useRayTracedShadows", BindingFlags.Public | BindingFlags.Instance);
                    if (p != null && p.CanWrite && l.GetComponent<Light>()?.type == LightType.Directional) p.SetValue(l, on);
                }
                catch { }
            }
        }
    }
}

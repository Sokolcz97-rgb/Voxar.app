using System;
using System.Reflection;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace Voxario.Ashes
{
    /// <summary>
    /// Zvětšování obrazu: NVIDIA DLSS (karty RTX, DirectX 12 / Vulkan přes HDRP),
    /// jinak AMD FSR 2 nebo TAA Upscale v HDRP. Nastavení se ukládá do PlayerPrefs.
    /// HDRP API se mezi verzemi mění, proto se pole nastavují přes reflexi a chybějící
    /// pole jen zapíší do logu (hra kvůli tomu nespadne).
    /// </summary>
    public static class Upscaling
    {
        public enum Mode { Off, DLSS, FSR2, TAAU }
        public enum Quality { MaximumPerformance = 0, Balanced = 1, MaximumQuality = 2, UltraPerformance = 3, DLAA = 5 }

        public static Mode CurrentMode => (Mode)PlayerPrefs.GetInt("gfx.upscaler", (int)DefaultMode);
        public static Quality CurrentQuality => (Quality)PlayerPrefs.GetInt("gfx.upscaleQuality", (int)Quality.Balanced);

        public static bool DlssSupported
        {
            get
            {
                var t = typeof(HDRenderPipeline).Assembly.GetType("UnityEngine.Rendering.HighDefinition.HDDynamicResolutionPlatformCapabilities");
                var p = t?.GetProperty("DLSSDetected", BindingFlags.Public | BindingFlags.Static);
                return p != null && (bool)p.GetValue(null);
            }
        }

        static Mode DefaultMode => DlssSupported ? Mode.DLSS : Mode.FSR2;

        public static void Save(Mode mode, Quality quality)
        {
            PlayerPrefs.SetInt("gfx.upscaler", (int)mode);
            PlayerPrefs.SetInt("gfx.upscaleQuality", (int)quality);
            PlayerPrefs.Save();
        }

        /// <summary>Použije nastavení na kameru.</summary>
        public static void Apply(Camera cam)
        {
            if (cam == null) return;
            var hd = cam.GetComponent<HDAdditionalCameraData>();
            if (hd == null) hd = cam.gameObject.AddComponent<HDAdditionalCameraData>();
            var mode = CurrentMode;
            if (mode == Mode.DLSS && !DlssSupported) mode = Mode.FSR2;
            uint q = (uint)CurrentQuality;

            Set(hd, "allowDynamicResolution", mode != Mode.Off);
            // DLSS
            Set(hd, "allowDeepLearningSuperSampling", mode == Mode.DLSS);
            Set(hd, "deepLearningSuperSamplingUseCustomQualitySettings", mode == Mode.DLSS);
            Set(hd, "deepLearningSuperSamplingQuality", q);
            Set(hd, "deepLearningSuperSamplingUseOptimalSettings", true);
            Set(hd, "deepLearningSuperSamplingUseCustomAttributes", false);
            // AMD FSR 2
            Set(hd, "allowFidelityFX2SuperResolution", mode == Mode.FSR2);
            Set(hd, "fidelityFX2SuperResolutionUseCustomQualitySettings", mode == Mode.FSR2);
            Set(hd, "fidelityFX2SuperResolutionQuality", Math.Min(q, 3u));
            Set(hd, "fidelityFX2SuperResolutionUseOptimalSettings", true);
            // vyhlazování: DLSS/FSR mají vlastní, jinak TAA
            hd.antialiasing = mode == Mode.Off ? HDAdditionalCameraData.AntialiasingMode.SubpixelMorphologicalAntiAliasing
                                               : HDAdditionalCameraData.AntialiasingMode.TemporalAntialiasing;

            // pro FSR 2 / TAAU je potřeba měřítko rozlišení
            float scale = mode switch
            {
                Mode.Off => 100f,
                _ => CurrentQuality switch
                {
                    Quality.MaximumQuality => 67f,
                    Quality.Balanced => 58f,
                    Quality.MaximumPerformance => 50f,
                    Quality.UltraPerformance => 33f,
                    _ => 100f,
                },
            };
            DynamicResolutionHandler.SetDynamicResScaler(() => scale, DynamicResScalePolicyType.ReturnsPercentage);
            Debug.Log($"[Voxario] Upscaling {mode} quality={CurrentQuality} dlssSupported={DlssSupported}");
        }

        static void Set(object target, string name, object value)
        {
            var t = target.GetType();
            var f = t.GetField(name, BindingFlags.Public | BindingFlags.Instance);
            try
            {
                if (f != null) { f.SetValue(target, Convert.ChangeType(value, f.FieldType)); return; }
                var p = t.GetProperty(name, BindingFlags.Public | BindingFlags.Instance);
                if (p != null && p.CanWrite) { p.SetValue(target, Convert.ChangeType(value, p.PropertyType)); return; }
            }
            catch (Exception e)
            {
                Debug.LogWarning($"[Voxario] {name}: {e.Message}");
                return;
            }
            Debug.LogWarning($"[Voxario] HDRP nemá pole {name}");
        }
    }
}

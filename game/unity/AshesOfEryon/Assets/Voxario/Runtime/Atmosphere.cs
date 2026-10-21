using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;

namespace Voxario.Ashes
{
    /// <summary>
    /// Globální prostředí HDRP: automatická expozice s rozumnými mezemi (ať zdi
    /// nepřesvítí a tráva nezčerná), vzdušná mlha nad mořem, jemná záře a stíny
    /// podle zvolené kvality grafiky.
    /// </summary>
    public static class Atmosphere
    {
        static Volume volume;
        static Fog fog;
        static Bloom bloom;
        static HDShadowSettings shadows;
        static ContactShadows contact;
        static ScreenSpaceAmbientOcclusion ssao;

        public static void Create()
        {
            if (volume != null) return;
            var go = new GameObject("Atmosphere");
            Object.DontDestroyOnLoad(go);
            volume = go.AddComponent<Volume>();
            volume.isGlobal = true;
            volume.priority = 10;
            var profile = ScriptableObject.CreateInstance<VolumeProfile>();
            volume.sharedProfile = profile;

            var exposure = profile.Add<Exposure>(true);
            exposure.mode.Override(ExposureMode.AutomaticHistogram);
            exposure.limitMin.Override(11.5f);
            exposure.limitMax.Override(15.5f);
            exposure.compensation.Override(0.3f);
            exposure.adaptationSpeedDarkToLight.Override(2f);
            exposure.adaptationSpeedLightToDark.Override(1.5f);

            fog = profile.Add<Fog>(true);
            fog.enabled.Override(true);
            fog.meanFreePath.Override(650f);
            fog.baseHeight.Override(0f);
            fog.maximumHeight.Override(60f);
            fog.maxFogDistance.Override(900f);
            fog.albedo.Override(new Color(0.86f, 0.82f, 0.76f));

            bloom = profile.Add<Bloom>(true);
            bloom.intensity.Override(0.12f);
            bloom.scatter.Override(0.6f);

            shadows = profile.Add<HDShadowSettings>(true);
            shadows.maxShadowDistance.Override(150f);

            contact = profile.Add<ContactShadows>(true);
            contact.enable.Override(true);
            contact.length.Override(0.25f);

            ssao = profile.Add<ScreenSpaceAmbientOcclusion>(true);
            ssao.intensity.Override(0.8f);
            ssao.radius.Override(1.2f);

            var tone = profile.Add<Tonemapping>(true);
            tone.mode.Override(TonemappingMode.ACES);

            ApplyQuality(PlayerPrefs.GetInt("gfx.quality", 2));
        }

        /// <summary>0 = nízká, 1 = střední, 2 = vysoká, 3 = ultra</summary>
        public static void ApplyQuality(int q)
        {
            PlayerPrefs.SetInt("gfx.quality", q);
            if (volume == null) return;
            shadows.maxShadowDistance.Override(q switch { 0 => 50f, 1 => 90f, 2 => 150f, _ => 250f });
            contact.enable.Override(q >= 2);
            ssao.active = q >= 1;
            fog.enableVolumetricFog.Override(q >= 3);
            bloom.active = q >= 1;
            foreach (var t in Object.FindObjectsByType<Terrain>(FindObjectsSortMode.None))
                t.heightmapPixelError = q switch { 0 => 12, 1 => 7, 2 => 4, _ => 2 };
            var sun = Object.FindObjectsByType<HDAdditionalLightData>(FindObjectsSortMode.None);
            foreach (var l in sun)
            {
                try { l.SetShadowResolutionLevel(q switch { 0 => 0, 1 => 1, 2 => 2, _ => 3 }); } catch { }
            }
            var cam = Camera.main;
            if (cam != null) cam.farClipPlane = q switch { 0 => 400f, 1 => 650f, _ => 900f };
            QualitySettings.lodBias = q switch { 0 => 0.6f, 1 => 1f, 2 => 1.5f, _ => 2.5f };
        }
    }
}

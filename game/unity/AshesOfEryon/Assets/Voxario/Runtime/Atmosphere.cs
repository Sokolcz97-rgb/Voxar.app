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
        static ScreenSpaceReflection ssr;
        static VolumeComponent cloudLayer;
        static VolumeComponent volClouds;
        static Exposure exposure;
        static IndirectLightingController indirect;
        static ColorAdjustments grading;
        static VolumeComponent lensFlare;
        static float night;

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

            // obloha s fyzikálním modelem: slunce i měsíc jsou vidět jako kotouče, v noci tmavne
            var env = profile.Add<VisualEnvironment>(true);
            env.skyType.Override((int)SkyType.PhysicallyBased);
            env.skyAmbientMode.Override(SkyAmbientMode.Dynamic);
            var pbs = profile.Add<PhysicallyBasedSky>(true);
            // „zem“ planety pod obzorem = moře (jinak se v hladině zrcadlí zelenohnědá)
            RayTracing.Param(pbs, "groundTint", new Color(0.05f, 0.16f, 0.24f));
            RayTracing.Param(pbs, "groundColorTexture", null);

            // mraky: 2D vrstva vždy, objemové mraky od kvality Vysoká
            RayTracing.Param(env, "cloudType", 1); // 1 = vrstva mraků
            var clType = typeof(Exposure).Assembly.GetType("UnityEngine.Rendering.HighDefinition.CloudLayer");
            if (clType != null)
            {
                try { cloudLayer = profile.Add(clType, true); RayTracing.Param(cloudLayer, "opacity", 0.85f); }
                catch { cloudLayer = null; }
            }
            var vcType = typeof(Exposure).Assembly.GetType("UnityEngine.Rendering.HighDefinition.VolumetricClouds");
            if (vcType != null)
            {
                try
                {
                    volClouds = profile.Add(vcType, true);
                    RayTracing.Param(volClouds, "enable", true);
                    RayTracing.Param(volClouds, "cloudPreset", "Sparse");
                }
                catch { volClouds = null; }
            }

            indirect = profile.Add<IndirectLightingController>(true);

            exposure = profile.Add<Exposure>(true);
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

            // záblesky a paprsky od jasných zdrojů (slunce, měsíc) – zapnuto s ray tracingem
            var lfType = typeof(Volume).Assembly.GetType("UnityEngine.Rendering.ScreenSpaceLensFlare")
                         ?? typeof(Exposure).Assembly.GetType("UnityEngine.Rendering.HighDefinition.ScreenSpaceLensFlare");
            if (lfType != null)
            {
                try { lensFlare = profile.Add(lfType, true); } catch { lensFlare = null; }
            }

            ssr = profile.Add<ScreenSpaceReflection>(true);
            ssr.enabled.Override(true);

            grading = profile.Add<ColorAdjustments>(true);

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
            fog.enableVolumetricFog.Override(q >= 3 || RayTracing.Enabled);
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
            if (ssr != null) ssr.active = q >= 2 || RayTracing.Enabled;
            if (volClouds != null) volClouds.active = q >= 2;
            Ocean.Instance?.Apply(q);
            if (cloudLayer != null) cloudLayer.active = q < 2 || volClouds == null;
            ApplyRayTracing();
        }

        /// <summary>Oblačnost ze skutečného počasí (0 = jasno, 1 = zataženo).</summary>
        public static void ApplyCloudCover(float cover)
        {
            if (volume == null) return;
            string preset = cover < 0.25f ? "Sparse" : cover < 0.6f ? "Cloudy" : cover < 0.9f ? "Overcast" : "Stormy";
            RayTracing.Param(volClouds, "cloudPreset", preset);
            RayTracing.Param(cloudLayer, "opacity", Mathf.Lerp(0.35f, 1f, cover));
        }

        /// <summary>Denní doba: expozice a barva mlhy (night 0 = den, 1 = noc).</summary>
        public static void ApplyTimeOfDay(float n, float sunAlt)
        {
            if (volume == null) return;
            bool changed = Mathf.Abs(n - night) > 0.02f;
            night = n;
            // v noci kamera „otevře clonu“, ať je měsícem nasvícený svět čitelný, ale pořád tmavší
            // v noci kamera „otevře clonu“ jen trochu – svět je čitelný, ale je jasně tma
            exposure.limitMin.Override(Mathf.Lerp(11.5f, 3.8f, n));
            exposure.limitMax.Override(Mathf.Lerp(15.5f, 7.2f, n));
            exposure.compensation.Override(Mathf.Lerp(0.3f, -0.2f, n));
            if (indirect != null) indirect.indirectDiffuseLightingMultiplier.Override(Mathf.Lerp(1f, 3f, n));
            // noční barvy: méně sytosti, chladný modrý nádech (jako při měsíčním světle)
            if (grading != null)
            {
                grading.saturation.Override(Mathf.Lerp(0f, -38f, n));
                grading.colorFilter.Override(Color.Lerp(Color.white, new Color(0.72f, 0.82f, 1.08f), n));
                grading.postExposure.Override(Mathf.Lerp(0f, -0.35f, n));
            }
            float dusk = Mathf.Clamp01(1 - Mathf.Abs(sunAlt - 2f) / 10f); // zlatá hodinka kolem obzoru
            var dayCol = new Color(0.86f, 0.82f, 0.76f);
            var duskCol = new Color(0.95f, 0.68f, 0.48f);
            var nightCol = new Color(0.35f, 0.42f, 0.6f);
            fog.albedo.Override(Color.Lerp(Color.Lerp(dayCol, duskCol, dusk), nightCol, n));
            if (changed) ApplyRayTracing();
        }

        /// <summary>Přepne odrazy, okluzi a stíny slunce mezi klasickým a paprskovým výpočtem.</summary>
        public static void ApplyRayTracing()
        {
            if (volume == null) return;
            bool rt = RayTracing.Enabled;
            RayTracing.Param(ssr, "tracing", rt ? "RayTracing" : "RayMarching");
            RayTracing.Param(ssao, "rayTracing", rt);
            if (ssr != null) ssr.active = rt || PlayerPrefs.GetInt("gfx.quality", 2) >= 2;
            RayTracing.LightShadows(rt);
            // paprsky od slunce a měsíce: objemová mlha + záblesky na obrazovce
            fog.enableVolumetricFog.Override(rt || PlayerPrefs.GetInt("gfx.quality", 2) >= 3);
            if (rt) { fog.meanFreePath.Override(Mathf.Lerp(420f, 260f, night)); fog.anisotropy.Override(0.65f); }
            else fog.meanFreePath.Override(Mathf.Lerp(650f, 400f, night));
            if (lensFlare != null)
            {
                lensFlare.active = rt;
                RayTracing.Param(lensFlare, "intensity", rt ? 0.6f : 0f);
                RayTracing.Param(lensFlare, "streaksIntensity", rt ? 0.5f : 0f);
            }
            Debug.Log($"[Voxario] ray tracing: {(rt ? "zapnuto" : "vypnuto")} (podpora: {RayTracing.Supported})");
        }
    }
}

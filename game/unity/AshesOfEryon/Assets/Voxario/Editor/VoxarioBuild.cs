using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using UnityEditor;
using UnityEditor.Build.Reporting;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.Rendering;
using UnityEngine.Rendering.HighDefinition;
using Voxario.Ashes;

/// <summary>
/// Sestavení Windows verze z příkazové řádky (GitHub Actions / GameCI):
///   -executeMethod VoxarioBuild.BuildWindows -customBuildPath build/AshesOfEryon.exe
/// Připraví HDRP (DirectX 12, DLSS, dynamické rozlišení), scénu a modely.
/// </summary>
public static class VoxarioBuild
{
    const string Settings = "Assets/Voxario/Settings";
    const string ScenePath = "Assets/Voxario/Scenes/Ashes.unity";

    [MenuItem("Voxario/Připravit projekt")]
    public static void Prepare()
    {
        Directory.CreateDirectory(Settings);
        Directory.CreateDirectory(Path.GetDirectoryName(ScenePath));
        SetupPipeline();
        ReimportModels();
        ExtractGaits();
        SetupPlayer();
        BuildScene();
        AssetDatabase.SaveAssets();
    }

    // ------------------------------------------------------------------ pohyb z Mixamo
    /// <summary>
    /// Z animací Mixamo (Assets/Voxario/Anim/*.fbx, jen kostra) vytáhne průběh úhlů kloubů
    /// v rovině kroku: kyčle, kolena, ramena, lokty, pohupování pánve a náklon trupu.
    /// Uloží je do Resources/gait_*.json – hra jimi pohání vlastní chůzi modelů bez kostry.
    /// </summary>
    static void ExtractGaits()
    {
        const string dir = "Assets/Voxario/Anim";
        if (!Directory.Exists(dir)) return;
        Directory.CreateDirectory("Assets/Voxario/Resources");
        foreach (var path in Directory.GetFiles(dir, "*.fbx"))
        {
            string p = path.Replace('\\', '/');
            try
            {
                var imp = AssetImporter.GetAtPath(p) as ModelImporter;
                if (imp != null && imp.animationType != ModelImporterAnimationType.Generic)
                {
                    imp.animationType = ModelImporterAnimationType.Generic;
                    imp.SaveAndReimport();
                }
                var clip = AssetDatabase.LoadAllAssetsAtPath(p).OfType<AnimationClip>().FirstOrDefault(c => !c.name.StartsWith("__preview__"));
                var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(p);
                if (clip == null || prefab == null) { Debug.LogWarning("[Voxario] gait: chybí klip nebo kostra v " + p); continue; }
                var go = (GameObject)UnityEngine.Object.Instantiate(prefab);
                Transform Bone(string n) => go.GetComponentsInChildren<Transform>().FirstOrDefault(t => t.name.EndsWith(":" + n) || t.name == n);
                var hips = Bone("Hips"); var spine = Bone("Spine2") ?? Bone("Spine1");
                var lUp = Bone("LeftUpLeg"); var lLeg = Bone("LeftLeg"); var lFoot = Bone("LeftFoot");
                var rUp = Bone("RightUpLeg"); var rLeg = Bone("RightLeg"); var rFoot = Bone("RightFoot");
                var lArm = Bone("LeftArm"); var lFore = Bone("LeftForeArm"); var lHand = Bone("LeftHand");
                var rArm = Bone("RightArm"); var rFore = Bone("RightForeArm"); var rHand = Bone("RightHand");
                if (hips == null || lUp == null || lLeg == null || lFoot == null || rUp == null || rLeg == null || rFoot == null || lArm == null || lFore == null || lHand == null || rArm == null || rFore == null || rHand == null)
                { Debug.LogWarning("[Voxario] gait: neúplná kostra v " + p); UnityEngine.Object.DestroyImmediate(go); continue; }
                var root = go.transform;
                // úhel úsečky v rovině kroku (0 = svisle dolů, + = dopředu)
                float Ang(Transform a, Transform b)
                {
                    var v = root.InverseTransformDirection(b.position - a.position);
                    return Mathf.Atan2(v.z, -v.y) * Mathf.Rad2Deg;
                }
                const int N = 48;
                var data = new Dictionary<string, float[]>();
                foreach (var k in new[] { "thighL", "thighR", "kneeL", "kneeR", "armL", "armR", "elbowL", "elbowR", "bob", "lean", "roll" })
                    data[k] = new float[N];
                // výška pánve v klidu (pro pohupování) a délka nohy (pro měřítko)
                clip.SampleAnimation(go, 0);
                float legLen = Vector3.Distance(lUp.position, lLeg.position) + Vector3.Distance(lLeg.position, lFoot.position);
                float minY = float.MaxValue;
                var hy = new float[N];
                for (int i = 0; i < N; i++)
                {
                    clip.SampleAnimation(go, clip.length * i / N);
                    float tl = Ang(lUp, lLeg), sl = Ang(lLeg, lFoot), tr = Ang(rUp, rLeg), sr = Ang(rLeg, rFoot);
                    float al = Ang(lArm, lFore), fl = Ang(lFore, lHand), ar = Ang(rArm, rFore), fr = Ang(rFore, rHand);
                    data["thighL"][i] = tl; data["kneeL"][i] = tl - sl;
                    data["thighR"][i] = tr; data["kneeR"][i] = tr - sr;
                    data["armL"][i] = al; data["elbowL"][i] = fl - al;
                    data["armR"][i] = ar; data["elbowR"][i] = fr - ar;
                    var sp = root.InverseTransformDirection((spine != null ? spine.position : hips.position + Vector3.up) - hips.position);
                    data["lean"][i] = Mathf.Atan2(sp.z, sp.y) * Mathf.Rad2Deg;
                    data["roll"][i] = Mathf.Atan2(-sp.x, sp.y) * Mathf.Rad2Deg;
                    hy[i] = root.InverseTransformPoint(hips.position).y;
                    minY = Mathf.Min(minY, hy[i]);
                }
                for (int i = 0; i < N; i++) data["bob"][i] = (hy[i] - minY) / Mathf.Max(0.01f, legLen); // podíl délky nohy
                // kolik krokových cyklů klip obsahuje (průchody levého stehna středem nahoru)
                float mean = data["thighL"].Average();
                int cycles = 0;
                for (int i = 0; i < N; i++) if (data["thighL"][i] < mean && data["thighL"][(i + 1) % N] >= mean) cycles++;
                var sb = new System.Text.StringBuilder();
                sb.Append("{\"cycles\":").Append(Mathf.Max(1, cycles)).Append(",\"length\":").Append(clip.length.ToString(System.Globalization.CultureInfo.InvariantCulture));
                foreach (var kv in data)
                    sb.Append(",\"").Append(kv.Key).Append("\":[").Append(string.Join(",", kv.Value.Select(f => f.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture)))).Append("]");
                sb.Append("}");
                string name = "gait_" + Path.GetFileNameWithoutExtension(p).ToLowerInvariant();
                File.WriteAllText($"Assets/Voxario/Resources/{name}.json", sb.ToString());
                AssetDatabase.ImportAsset($"Assets/Voxario/Resources/{name}.json", ImportAssetOptions.ForceSynchronousImport);
                Debug.Log($"[Voxario] gait {name}: {clip.length:0.00} s, cyklů {cycles}, stehno {data["thighL"].Min():0}…{data["thighL"].Max():0}°, koleno {data["kneeL"].Min():0}…{data["kneeL"].Max():0}°, paže {data["armL"].Min():0}…{data["armL"].Max():0}°, loket {data["elbowL"].Min():0}…{data["elbowL"].Max():0}°, náklon {data["lean"].Average():0}°");
                UnityEngine.Object.DestroyImmediate(go);
            }
            catch (Exception e) { Debug.LogWarning("[Voxario] gait " + p + ": " + e.Message); }
        }
    }

    public static void BuildWindows()
    {
        try
        {
            Prepare();
            string output = Arg("-customBuildPath") ?? "Builds/Windows/AshesOfEryon.exe";
            if (!output.EndsWith(".exe")) output = Path.Combine(output, "AshesOfEryon.exe");
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(output)));
            var report = BuildPipeline.BuildPlayer(new BuildPlayerOptions
            {
                scenes = new[] { ScenePath },
                locationPathName = output,
                target = BuildTarget.StandaloneWindows64,
                targetGroup = BuildTargetGroup.Standalone,
                options = BuildOptions.None,
            });
            var s = report.summary;
            Debug.Log($"[Voxario] Build {s.result}: {s.totalSize / 1048576} MB, {s.totalErrors} chyb, {s.totalTime}");
            foreach (var step in report.steps)
                foreach (var m in step.messages)
                    if (m.type == LogType.Error || m.type == LogType.Exception) Debug.Log($"[Voxario] ERR {m.content}");
            EditorApplication.Exit(s.result == BuildResult.Succeeded ? 0 : 1);
        }
        catch (Exception e)
        {
            Debug.LogError("[Voxario] Build selhal: " + e);
            EditorApplication.Exit(1);
        }
    }

    static string Arg(string name)
    {
        var a = Environment.GetCommandLineArgs();
        int i = Array.IndexOf(a, name);
        return i >= 0 && i + 1 < a.Length ? a[i + 1] : null;
    }

    // ------------------------------------------------------------------ HDRP
    static void SetupPipeline()
    {
        string path = Settings + "/HDRP.asset";
        var asset = AssetDatabase.LoadAssetAtPath<HDRenderPipelineAsset>(path);
        if (asset == null)
        {
            asset = ScriptableObject.CreateInstance<HDRenderPipelineAsset>();
            AssetDatabase.CreateAsset(asset, path);
        }

        var so = new SerializedObject(asset);
        var it = so.GetIterator();
        var names = new List<string>();
        while (it.Next(true))
        {
            string p = it.propertyPath;
            string low = p.ToLowerInvariant();
            if (low.Contains("dlss") || low.Contains("fsr") || low.Contains("dynamicresolution") || low.Contains("fidelity"))
                names.Add($"{p}={(it.propertyType == SerializedPropertyType.Boolean ? it.boolValue.ToString() : it.propertyType.ToString())}");
        }
        Debug.Log("[Voxario] HDRP vlastnosti: " + string.Join(", ", names));

        SetBool(so, "m_RenderPipelineSettings.dynamicResolutionSettings.enabled", true);
        SetBool(so, "m_RenderPipelineSettings.dynamicResolutionSettings.enableDLSS", true);
        // pořadí pokročilých upscalerů: DLSS, pak FSR 2 (STP vynecháme – na Linuxu nejde zkompilovat pro DirectX)
        var ups = so.FindProperty("m_RenderPipelineSettings.dynamicResolutionSettings.advancedUpscalersByPriority");
        if (ups != null && ups.isArray)
        {
            ups.arraySize = 1;
            var names0 = ups.GetArrayElementAtIndex(0).enumNames;
            Debug.Log("[Voxario] upscalery: " + string.Join("/", names0));
            var wanted = new[] { "DLSS", "FSR2" }.Where(n => Array.IndexOf(names0, n) >= 0).ToArray();
            ups.arraySize = wanted.Length;
            for (int i = 0; i < wanted.Length; i++) ups.GetArrayElementAtIndex(i).enumValueIndex = Array.IndexOf(names0, wanted[i]);
        }
        else Debug.LogWarning("[Voxario] chybí advancedUpscalersByPriority");
        SetBool(so, "m_RenderPipelineSettings.dynamicResolutionSettings.DLSSUseOptimalSettings", true);
        SetBool(so, "m_RenderPipelineSettings.dynamicResolutionSettings.FSR2UseOptimalSettings", true);
        SetFloat(so, "m_RenderPipelineSettings.dynamicResolutionSettings.minPercentage", 33f);
        SetFloat(so, "m_RenderPipelineSettings.dynamicResolutionSettings.maxPercentage", 100f);
        SetInt(so, "m_RenderPipelineSettings.dynamicResolutionSettings.dynResType", 1); // Hardware
        SetBool(so, "m_RenderPipelineSettings.supportSSAO", true);
        SetBool(so, "m_RenderPipelineSettings.supportVolumetrics", true);
        // ray tracing (DXR) – ve hře volitelný, zapne se jen na kartách, které ho umí
        SetBool(so, "m_RenderPipelineSettings.supportSSR", true);
        SetBool(so, "m_RenderPipelineSettings.supportRayTracing", true);
        SetBool(so, "m_RenderPipelineSettings.supportScreenSpaceLensFlare", true);
        SetBool(so, "m_RenderPipelineSettings.supportVolumetricClouds", true);
        // vodní systém: moře s vlnami, pěnou, kaustikami a příbojem
        SetBool(so, "m_RenderPipelineSettings.supportWater", true);
        SetBool(so, "m_RenderPipelineSettings.supportWaterDeformation", true);
        SetBool(so, "m_RenderPipelineSettings.supportWaterFoam", true);
        SetBool(so, "m_RenderPipelineSettings.supportWaterExclusion", true);
        SetBool(so, "m_RenderPipelineSettings.supportDataDrivenLensFlare", true);
        var rtMode = so.FindProperty("m_RenderPipelineSettings.supportedRayTracingMode");
        if (rtMode != null)
        {
            Debug.Log("[Voxario] režimy ray tracingu: " + string.Join("/", rtMode.enumNames));
            int both = Array.IndexOf(rtMode.enumNames, "Both");
            if (both >= 0) rtMode.enumValueIndex = both;
        }
        else Debug.LogWarning("[Voxario] chybí supportedRayTracingMode");
        so.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(asset);
        var check = new SerializedObject(asset);
        Debug.Log("[Voxario] DLSS zapnuto: " + check.FindProperty("m_RenderPipelineSettings.dynamicResolutionSettings.enableDLSS")?.boolValue
            + ", dynamické rozlišení: " + check.FindProperty("m_RenderPipelineSettings.dynamicResolutionSettings.enabled")?.boolValue);

        GraphicsSettings.defaultRenderPipeline = asset;
        for (int i = 0; i < QualitySettings.names.Length; i++)
        {
            QualitySettings.SetQualityLevel(i, false);
            QualitySettings.renderPipeline = asset;
        }

        // globální nastavení HDRP (zdroje shaderů, výchozí profil prostředí)
        var gs = typeof(HDRenderPipelineAsset).Assembly.GetType("UnityEngine.Rendering.HighDefinition.HDRenderPipelineGlobalSettings");
        var ensure = gs?.GetMethod("Ensure", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic);
        try
        {
            if (ensure != null)
            {
                var args = ensure.GetParameters().Select(p => p.HasDefaultValue ? p.DefaultValue : (p.ParameterType == typeof(bool) ? (object)true : null)).ToArray();
                ensure.Invoke(null, args);
                Debug.Log("[Voxario] HDRenderPipelineGlobalSettings.Ensure hotovo");
            }
            else Debug.LogWarning("[Voxario] Ensure nenalezeno");
        }
        catch (Exception e) { Debug.LogWarning("[Voxario] Ensure: " + e.InnerException?.Message ?? e.Message); }
        Debug.Log("[Voxario] Global settings: " + GraphicsSettings.GetSettingsForRenderPipeline<HDRenderPipeline>());
    }

    static void SetBool(SerializedObject so, string path, bool v)
    {
        var p = so.FindProperty(path);
        if (p != null) p.boolValue = v; else Debug.LogWarning("[Voxario] chybí " + path);
    }

    static void SetFloat(SerializedObject so, string path, float v)
    {
        var p = so.FindProperty(path);
        if (p != null) p.floatValue = v; else Debug.LogWarning("[Voxario] chybí " + path);
    }

    static void SetInt(SerializedObject so, string path, int v)
    {
        var p = so.FindProperty(path);
        if (p == null) { Debug.LogWarning("[Voxario] chybí " + path); return; }
        if (p.propertyType == SerializedPropertyType.Enum) p.enumValueIndex = v; else p.intValue = v;
    }

    /// <summary>
    /// GLB modely se při prvním otevření projektu naimportují dřív, než je zapnuté HDRP,
    /// a glTFast jim pak dá shadery pro vestavěné vykreslování (v HDRP neviditelné).
    /// Po nastavení HDRP je proto naimportujeme znovu.
    /// </summary>
    static void ReimportModels()
    {
        // glTFast si typ vykreslování a generátor materiálů pamatuje ve statických polích – vynulovat
        var rpUtils = Type.GetType("GLTFast.RenderPipelineUtils, glTFast");
        var rpField = rpUtils?.GetField("s_RenderPipeline", BindingFlags.Static | BindingFlags.NonPublic);
        if (rpField != null) rpField.SetValue(null, Enum.Parse(rpField.FieldType, "Unknown"));
        var genField = Type.GetType("GLTFast.Materials.MaterialGenerator, glTFast")?.GetField("s_DefaultMaterialGenerator", BindingFlags.Static | BindingFlags.NonPublic);
        genField?.SetValue(null, null);
        Debug.Log($"[Voxario] glTFast reset: pole {(rpField != null)}/{(genField != null)}, vykreslování = {rpUtils?.GetProperty("RenderPipeline", BindingFlags.Static | BindingFlags.Public)?.GetValue(null)}");
        int n = 0;
        foreach (var guid in AssetDatabase.FindAssets("", new[] { "Assets/Models" }))
        {
            string p = AssetDatabase.GUIDToAssetPath(guid);
            if (!p.EndsWith(".glb")) continue;
            AssetDatabase.ImportAsset(p, ImportAssetOptions.ForceUpdate | ImportAssetOptions.ForceSynchronousImport);
            n++;
        }
        AssetDatabase.Refresh();
        var sample = AssetDatabase.LoadAssetAtPath<GameObject>("Assets/Models/buildings/villa.glb");
        var r = sample ? sample.GetComponentInChildren<Renderer>() : null;
        Debug.Log($"[Voxario] znovu naimportováno {n} modelů, shader vily: {(r && r.sharedMaterial ? r.sharedMaterial.shader.name : "?")}");
    }

    /// <summary>HDRP potřebuje u materiálů vytvořených skriptem nastavit klíčová slova a průchody.</summary>
    static void ValidateHdrpMaterial(Material m)
    {
        var t = Type.GetType("UnityEditor.Rendering.HighDefinition.HDShaderUtils, Unity.RenderPipelines.HighDefinition.Editor");
        var reset = t?.GetMethod("ResetMaterialKeywords", BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic, null, new[] { typeof(Material) }, null);
        try { reset?.Invoke(null, new object[] { m }); } catch (Exception e) { Debug.LogWarning("[Voxario] ResetMaterialKeywords: " + e.Message); }
        Debug.Log($"[Voxario] materiál {m.name}: {m.shader.name}, klíčová slova: {string.Join(" ", m.shaderKeywords)}");
    }

    // ------------------------------------------------------------------ přehrávač
    static void SetupPlayer()
    {
        PlayerSettings.companyName = "StudioVoxario";
        PlayerSettings.productName = "Ashes of Eryon";
        var ver = Arg("-buildVersion");
        PlayerSettings.bundleVersion = string.IsNullOrEmpty(ver) || ver == "none" ? "0.8.1" : ver;
        PlayerSettings.colorSpace = ColorSpace.Linear;
        PlayerSettings.SetUseDefaultGraphicsAPIs(BuildTarget.StandaloneWindows64, false);
        PlayerSettings.SetGraphicsAPIs(BuildTarget.StandaloneWindows64,
            new[] { UnityEngine.Rendering.GraphicsDeviceType.Direct3D12, UnityEngine.Rendering.GraphicsDeviceType.Direct3D11, UnityEngine.Rendering.GraphicsDeviceType.Vulkan });
        PlayerSettings.SetScriptingBackend(UnityEditor.Build.NamedBuildTarget.Standalone, ScriptingImplementation.Mono2x);
        PlayerSettings.fullScreenMode = FullScreenMode.FullScreenWindow;
        PlayerSettings.defaultIsNativeResolution = true;
        PlayerSettings.runInBackground = true;
        PlayerSettings.resizableWindow = true;
        PlayerSettings.visibleInBackground = true;
        PlayerSettings.SplashScreen.show = false;
        PlayerSettings.gpuSkinning = true;
        var icon = AssetDatabase.LoadAssetAtPath<Texture2D>("Assets/Voxario/icon.png");
        if (icon != null) PlayerSettings.SetIcons(UnityEditor.Build.NamedBuildTarget.Unknown, new[] { icon }, IconKind.Any);
    }

    // ------------------------------------------------------------------ scéna
    static void BuildScene()
    {
        var scene = EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);
        var go = new GameObject("Ashes of Eryon");
        var lib = go.AddComponent<ModelLibrary>();
        lib.heroes = Load("Assets/Models/heroes");
        lib.buildings = Load("Assets/Models/buildings");
        lib.animals = Load("Assets/Models/animals");
        Debug.Log($"[Voxario] modely: postavy {lib.heroes.Length}, stavby {lib.buildings.Length}, zvířata {lib.animals.Length}");
        lib.lit = MaterialAsset("Lit", "HDRP/Lit");
        lib.litDouble = MaterialAsset("LitDouble", "HDRP/Lit", m =>
        {
            m.SetFloat("_DoubleSidedEnable", 1);
            m.SetFloat("_DoubleSidedNormalMode", 0); // zrcadlit normály
            m.SetFloat("_CullMode", 0);
            m.SetFloat("_CullModeForward", 0);
        });
        // terén: výchozí materiál terénu z HDRP (správně nastavený), jinak vlastní
        Material defTerrain = null;
        try { defTerrain = GraphicsSettings.defaultRenderPipeline?.defaultTerrainMaterial; } catch { }
        Debug.Log("[Voxario] výchozí materiál terénu HDRP: " + (defTerrain ? defTerrain.name + " / " + defTerrain.shader.name : "žádný"));
        lib.terrain = defTerrain != null ? defTerrain : MaterialAsset("Terrain", "HDRP/TerrainLit");
        var boot = go.AddComponent<GameBootstrap>();
        boot.library = lib;
        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
    }

    static Material MaterialAsset(string name, string shader, Action<Material> setup = null)
    {
        string path = $"{Settings}/{name}.mat";
        var m = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (m != null) return m;
        var sh = Shader.Find(shader);
        if (sh == null) { Debug.LogWarning("[Voxario] shader nenalezen: " + shader); return null; }
        m = new Material(sh);
        setup?.Invoke(m);
        AssetDatabase.CreateAsset(m, path);
        ValidateHdrpMaterial(m);
        EditorUtility.SetDirty(m);
        return m;
    }

    static ModelLibrary.Entry[] Load(string dir)
    {
        var list = new List<ModelLibrary.Entry>();
        foreach (var guid in AssetDatabase.FindAssets("", new[] { dir }))
        {
            string p = AssetDatabase.GUIDToAssetPath(guid);
            if (!p.EndsWith(".glb")) continue;
            var prefab = AssetDatabase.LoadAssetAtPath<GameObject>(p);
            if (prefab == null) { Debug.LogWarning("[Voxario] model se nenačetl: " + p); continue; }
            list.Add(new ModelLibrary.Entry { key = Path.GetFileNameWithoutExtension(p), prefab = prefab });
        }
        return list.ToArray();
    }
}

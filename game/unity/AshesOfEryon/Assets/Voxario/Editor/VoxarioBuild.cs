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
        SetupPlayer();
        BuildScene();
        AssetDatabase.SaveAssets();
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
        SetBool(so, "m_RenderPipelineSettings.dynamicResolutionSettings.enableFSR2", true);
        SetBool(so, "m_RenderPipelineSettings.dynamicResolutionSettings.DLSSUseOptimalSettings", true);
        SetBool(so, "m_RenderPipelineSettings.dynamicResolutionSettings.FSR2UseOptimalSettings", true);
        SetFloat(so, "m_RenderPipelineSettings.dynamicResolutionSettings.minPercentage", 33f);
        SetFloat(so, "m_RenderPipelineSettings.dynamicResolutionSettings.maxPercentage", 100f);
        SetInt(so, "m_RenderPipelineSettings.dynamicResolutionSettings.dynResType", 1); // Hardware
        SetBool(so, "m_RenderPipelineSettings.supportSSAO", true);
        SetBool(so, "m_RenderPipelineSettings.supportVolumetrics", true);
        so.ApplyModifiedPropertiesWithoutUndo();
        EditorUtility.SetDirty(asset);

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

    // ------------------------------------------------------------------ přehrávač
    static void SetupPlayer()
    {
        PlayerSettings.companyName = "StudioVoxario";
        PlayerSettings.productName = "Ashes of Eryon";
        PlayerSettings.bundleVersion = Arg("-buildVersion") ?? "0.1.0";
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
        lib.terrain = MaterialAsset("Terrain", "HDRP/TerrainLit");
        var boot = go.AddComponent<GameBootstrap>();
        boot.library = lib;
        EditorSceneManager.SaveScene(scene, ScenePath);
        EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(ScenePath, true) };
    }

    static Material MaterialAsset(string name, string shader)
    {
        string path = $"{Settings}/{name}.mat";
        var m = AssetDatabase.LoadAssetAtPath<Material>(path);
        if (m != null) return m;
        var sh = Shader.Find(shader);
        if (sh == null) { Debug.LogWarning("[Voxario] shader nenalezen: " + shader); return null; }
        m = new Material(sh);
        AssetDatabase.CreateAsset(m, path);
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

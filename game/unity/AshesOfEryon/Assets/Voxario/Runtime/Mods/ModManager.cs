using System;
using System.Collections.Generic;
using System.IO;
using MoonSharp.Interpreter;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Módy (doplňky) v jazyce Lua – podobně jako doplňky ve World of Warcraft.
    /// Složka: Dokumenty\Ashes of Eryon\Mods\&lt;mód&gt;\ (mod.json + main.lua + obrázky/modely).
    /// Módy běží v pískovišti (bez přístupu k souborům a systému) a nemohou měnit
    /// pravidla hry – server rozhoduje o soubojích, odměnách i úkolech.
    /// </summary>
    public class ModManager : MonoBehaviour
    {
        public GameBootstrap boot;
        public static ModManager Instance { get; private set; }

        [Serializable]
        public class ModInfo
        {
            public string id, name, version, author, description, main = "main.lua";
            [NonSerialized] public string folder, error;
            [NonSerialized] public Script script;
            [NonSerialized] public Dictionary<string, List<DynValue>> handlers = new Dictionary<string, List<DynValue>>();
            [NonSerialized] public Dictionary<string, Texture2D> images = new Dictionary<string, Texture2D>();
        }

        public readonly List<ModInfo> Mods = new List<ModInfo>();
        readonly List<(string text, float until)> toasts = new List<(string, float)>();
        readonly List<string> console = new List<string>();
        ModInfo current; // mód, jehož kód právě běží

        public static string ModsFolder => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Ashes of Eryon", "Mods");

        void Awake()
        {
            Instance = this;
            UserData.RegistrationPolicy = MoonSharp.Interpreter.Interop.InteropRegistrationPolicy.Explicit;
        }

        void Start()
        {
            try { ModSamples.Ensure(ModsFolder); } catch (Exception e) { Debug.Log("[Voxario] módy: " + e.Message); }
            Reload();
        }

        public static void OpenFolder()
        {
            try { Directory.CreateDirectory(ModsFolder); Application.OpenURL("file:///" + ModsFolder.Replace('\\', '/')); } catch { }
        }

        public bool IsEnabled(string id) => PlayerPrefs.GetInt("mod.on." + id, 1) == 1;

        public void SetEnabled(string id, bool on)
        {
            PlayerPrefs.SetInt("mod.on." + id, on ? 1 : 0);
            Reload();
        }

        public void Reload()
        {
            Mods.Clear();
            if (!Directory.Exists(ModsFolder)) return;
            foreach (var dir in Directory.GetDirectories(ModsFolder))
            {
                var info = LoadInfo(dir);
                if (info == null) continue;
                Mods.Add(info);
                if (IsEnabled(info.id)) Run(info);
            }
            Debug.Log($"[Voxario] módy: {Mods.Count} (zapnuto {Mods.FindAll(m => m.script != null).Count})");
            if (boot != null && boot.inWorld) Fire("enter_world");
        }

        static ModInfo LoadInfo(string dir)
        {
            var path = Path.Combine(dir, "mod.json");
            ModInfo info;
            try
            {
                info = File.Exists(path) ? JsonUtility.FromJson<ModInfo>(File.ReadAllText(path)) : new ModInfo();
            }
            catch (Exception e) { info = new ModInfo { error = "mod.json: " + e.Message }; }
            info.folder = dir;
            if (string.IsNullOrEmpty(info.id)) info.id = Path.GetFileName(dir);
            if (string.IsNullOrEmpty(info.name)) info.name = info.id;
            if (string.IsNullOrEmpty(info.main)) info.main = "main.lua";
            info.version ??= "1.0";
            info.author ??= "neznámý autor";
            return File.Exists(Path.Combine(dir, info.main)) ? info : null;
        }

        void Run(ModInfo m)
        {
            try
            {
                var script = new Script(CoreModules.Preset_SoftSandbox);
                script.Options.DebugPrint = s => Log(m, s);
                m.script = script;
                ModApi.Install(this, m, script);
                var code = File.ReadAllText(SafePath(m, m.main));
                current = m;
                script.DoString(code, null, m.main);
                m.error = null;
            }
            catch (Exception e)
            {
                m.error = Short(e);
                m.script = null;
                Log(m, "CHYBA: " + m.error);
            }
            finally { current = null; }
        }

        static string Short(Exception e) => e is InterpreterException ie ? ie.DecoratedMessage ?? ie.Message : e.Message;

        /// <summary>Cesta k souboru módu – jen uvnitř jeho složky.</summary>
        public static string SafePath(ModInfo m, string rel)
        {
            var full = Path.GetFullPath(Path.Combine(m.folder, rel ?? ""));
            var root = Path.GetFullPath(m.folder) + Path.DirectorySeparatorChar;
            if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase)) throw new ScriptRuntimeException("soubor mimo složku módu: " + rel);
            return full;
        }

        public void On(ModInfo m, string ev, DynValue fn)
        {
            if (fn.Type != DataType.Function) throw new ScriptRuntimeException("eryon.on: očekávám funkci");
            if (!m.handlers.TryGetValue(ev, out var list)) m.handlers[ev] = list = new List<DynValue>();
            list.Add(fn);
        }

        /// <summary>Událost pro všechny zapnuté módy.</summary>
        public static void Fire(string ev, params object[] args)
        {
            var mm = Instance;
            if (mm == null) return;
            foreach (var m in mm.Mods)
            {
                if (m.script == null || !m.handlers.TryGetValue(ev, out var list)) continue;
                foreach (var fn in list.ToArray())
                {
                    try
                    {
                        mm.current = m;
                        m.script.Call(fn, args);
                    }
                    catch (Exception e)
                    {
                        // chybný mód se vypne, hra běží dál
                        m.error = $"{ev}: {Short(e)}";
                        mm.Log(m, "CHYBA – mód vypnut: " + m.error);
                        m.script = null;
                        break;
                    }
                    finally { mm.current = null; }
                }
            }
        }

        public void Log(ModInfo m, string s)
        {
            console.Add($"[{m.name}] {s}");
            if (console.Count > 8) console.RemoveAt(0);
            Debug.Log($"[Mod {m.id}] {s}");
        }

        public void Toast(string s) => toasts.Add((s, Time.time + 5));

        public Texture2D Image(ModInfo m, string file)
        {
            if (m.images.TryGetValue(file, out var t)) return t;
            t = null;
            try
            {
                var bytes = File.ReadAllBytes(SafePath(m, file));
                if (bytes.Length < 8 * 1024 * 1024)
                {
                    t = new Texture2D(2, 2);
                    if (!t.LoadImage(bytes)) t = null;
                }
            }
            catch { t = null; }
            m.images[file] = t;
            return t;
        }

        void Update()
        {
            if (Input.GetKeyDown(KeyCode.F8)) { Reload(); Toast("Módy znovu načteny."); }
            if (Mods.Count == 0) return;
            Fire("update", Time.deltaTime);
            if (Input.anyKeyDown && Input.inputString.Length > 0) Fire("key", Input.inputString.Substring(0, 1).ToLowerInvariant());
        }

        void OnGUI()
        {
            if (Mods.Count == 0 && toasts.Count == 0) return;
            EryonSkin.Begin();
            GUI.depth = -5;
            if (boot != null && boot.inWorld) Fire("draw");
            float W = EryonSkin.W, y = 240;
            for (int i = toasts.Count - 1; i >= 0; i--) if (Time.time > toasts[i].until) toasts.RemoveAt(i);
            foreach (var t in toasts)
            {
                var r = new Rect(W / 2 - 300, y, 600, 46);
                GUI.Box(r, GUIContent.none, EryonSkin.PanelStyle);
                EryonSkin.Shadowed(r, t.text, new GUIStyle(EryonSkin.Center) { font = EryonSkin.CormorantBold, normal = { textColor = EryonSkin.GoldBright } });
                y += 52;
            }
            // chyby módů vlevo dole (jen krátce po načtení)
            if (console.Count > 0 && Time.realtimeSinceStartup < 600 && console.Exists(c => c.Contains("CHYBA")))
            {
                float cy = EryonSkin.H - 90 - console.Count * 22;
                foreach (var c in console)
                {
                    if (!c.Contains("CHYBA")) continue;
                    GUI.Label(new Rect(20, cy, 900, 22), $"<color=#e0672a>{c}</color>", EryonSkin.Small);
                    cy += 22;
                }
            }
        }
    }
}

using System;
using System.IO;
using System.Linq;
using MoonSharp.Interpreter;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Funkce dostupné módům (tabulky <c>eryon</c> a <c>ui</c>). Popis pro autory módů je
    /// v souboru Mods\README.txt (vytvoří se při prvním spuštění hry).
    /// </summary>
    public static class ModApi
    {
        delegate DynValue Fn(ScriptExecutionContext c, CallbackArguments a);

        static void Set(Table t, string name, Fn f) => t[name] = DynValue.NewCallback((c, a) => f(c, a), name);

        static string S(CallbackArguments a, int i, string def = "") => a.Count > i && !a[i].IsNil() ? a[i].CastToString() ?? def : def;
        static float N(CallbackArguments a, int i, float def = 0) => a.Count > i && a[i].Type == DataType.Number ? (float)a[i].Number : def;

        static Color C(CallbackArguments a, int i, Color def)
        {
            var s = S(a, i, null);
            if (s == null) return def;
            switch (s)
            {
                case "gold": return EryonSkin.GoldBright;
                case "text": return EryonSkin.Text;
                case "muted": return EryonSkin.Muted;
                case "ember": return EryonSkin.Ember;
                case "blood": return EryonSkin.Blood;
                case "good": return EryonSkin.Good;
                case "sky": return EryonSkin.Sky;
            }
            return ColorUtility.TryParseHtmlString(s, out var c) ? c : def;
        }

        public static void Install(ModManager mm, ModManager.ModInfo m, Script script)
        {
            var boot = mm.boot;
            var eryon = new Table(script);
            script.Globals["eryon"] = eryon;
            var ui = new Table(script);
            script.Globals["ui"] = ui;

            // ------------------------------------------------------------ obecné
            Set(eryon, "print", (c, a) => { mm.Log(m, string.Join(" ", a.GetArray().Select(x => x.ToPrintString()))); return DynValue.Nil; });
            Set(eryon, "notify", (c, a) => { mm.Toast(S(a, 0)); return DynValue.Nil; });
            Set(eryon, "on", (c, a) => { mm.On(m, S(a, 0), a[1]); return DynValue.Nil; });
            Set(eryon, "time", (c, a) => DynValue.NewNumber(Time.time));
            Set(eryon, "mod", (c, a) => DynValue.NewString(m.id));
            Set(eryon, "save", (c, a) => { PlayerPrefs.SetString($"mod.{m.id}.{S(a, 0)}", S(a, 1)); return DynValue.Nil; });
            Set(eryon, "load", (c, a) =>
            {
                string k = $"mod.{m.id}.{S(a, 0)}";
                return PlayerPrefs.HasKey(k) ? DynValue.NewString(PlayerPrefs.GetString(k)) : (a.Count > 1 ? a[1] : DynValue.Nil);
            });
            Set(eryon, "key", (c, a) =>
            {
                var name = S(a, 0);
                if (name.Length == 1) name = name.ToUpperInvariant();
                return DynValue.NewBoolean(Enum.TryParse<KeyCode>(name, true, out var kc) && Input.GetKey(kc));
            });
            Set(eryon, "screen", (c, a) => DynValue.NewTuple(DynValue.NewNumber(EryonSkin.W), DynValue.NewNumber(EryonSkin.H)));

            // ------------------------------------------------------------ hráč a úkoly (jen čtení)
            Set(eryon, "player", (c, a) =>
            {
                var t = new Table(script);
                var ch = boot.state?.character;
                if (ch == null) return DynValue.Nil;
                t["name"] = string.IsNullOrEmpty(ch.display_name) ? ch.name : ch.display_name;
                t["class"] = ch.@class;
                t["faction"] = ch.faction;
                t["level"] = ch.level;
                t["xp"] = (double)ch.xp;
                t["xp_need"] = (double)ch.xp_need;
                t["gold"] = (double)ch.gold;
                t["honor"] = ch.honor;
                t["wins"] = ch.wins;
                t["losses"] = ch.losses;
                t["chapter"] = ch.chapter;
                if (boot.player != null)
                {
                    var p = WorldMap.ToWeb(boot.player.transform.position);
                    t["x"] = p.x;
                    t["z"] = p.y;
                    t["region"] = Minimap.RegionName(p);
                }
                return DynValue.NewTable(t);
            });
            Set(eryon, "quests", (c, a) =>
            {
                var list = new Table(script);
                foreach (var wq in boot.state?.wquests ?? new WQuest[0])
                {
                    var def = Content.Data.Quest(wq.quest_id);
                    var q = new Table(script);
                    q["id"] = wq.quest_id;
                    q["state"] = wq.state;
                    q["progress"] = wq.progress;
                    q["count"] = def?.count ?? 1;
                    q["title"] = def?.title ?? wq.quest_id;
                    q["objective"] = def?.objective ?? "";
                    list.Append(DynValue.NewTable(q));
                }
                return DynValue.NewTable(list);
            });

            // ------------------------------------------------------------ modely (GLB, např. z AI generátoru)
            Set(eryon, "replace_player_model", (c, a) =>
            {
                string path = ModManager.SafePath(m, S(a, 0));
                float height = N(a, 1, 1.62f);
                ModModels.LoadAsync(path, go => { if (go != null) boot.ReplacePlayerModel(go, height); else mm.Log(m, "model se nenačetl: " + S(a, 0)); });
                return DynValue.Nil;
            });
            Set(eryon, "spawn_model", (c, a) =>
            {
                string path = ModManager.SafePath(m, S(a, 0));
                float x = N(a, 1), z = N(a, 2), size = N(a, 3, 2), yaw = N(a, 4);
                ModModels.LoadAsync(path, go =>
                {
                    if (go == null || boot.WorldRoot == null) { mm.Log(m, "model se nenačetl: " + S(a, 0)); return; }
                    var inst = UnityEngine.Object.Instantiate(go, boot.WorldRoot);
                    inst.SetActive(true);
                    inst.name = $"Mod {m.id}";
                    CharacterView.Fit(inst.transform, size);
                    inst.transform.position += WorldMap.ToWorld(x, z);
                    inst.transform.rotation = Quaternion.Euler(0, yaw, 0) * inst.transform.rotation;
                });
                return DynValue.Nil;
            });

            // ------------------------------------------------------------ rozhraní (jen v události „draw“)
            Set(ui, "panel", (c, a) => { EryonSkin.DrawPanel(new Rect(N(a, 0), N(a, 1), N(a, 2, 300), N(a, 3, 200)), S(a, 4, null)); return DynValue.Nil; });
            Set(ui, "text", (c, a) =>
            {
                var st = new GUIStyle(EryonSkin.Body) { fontSize = Mathf.RoundToInt(N(a, 5, 20)), normal = { textColor = C(a, 6, EryonSkin.Text) } };
                var align = S(a, 7, "left");
                st.alignment = align == "center" ? TextAnchor.UpperCenter : align == "right" ? TextAnchor.UpperRight : TextAnchor.UpperLeft;
                EryonSkin.Shadowed(new Rect(N(a, 0), N(a, 1), N(a, 2, 300), N(a, 3, 30)), S(a, 4), st);
                return DynValue.Nil;
            });
            Set(ui, "title", (c, a) =>
            {
                var st = new GUIStyle(EryonSkin.H2) { fontSize = Mathf.RoundToInt(N(a, 5, 22)), normal = { textColor = C(a, 6, EryonSkin.Gold) } };
                GUI.Label(new Rect(N(a, 0), N(a, 1), N(a, 2, 300), N(a, 3, 30)), S(a, 4), st);
                return DynValue.Nil;
            });
            Set(ui, "button", (c, a) =>
            {
                bool primary = S(a, 5, "") == "primary";
                return DynValue.NewBoolean(GUI.Button(new Rect(N(a, 0), N(a, 1), N(a, 2, 160), N(a, 3, 40)), S(a, 4), primary ? EryonSkin.ButtonPrimary : EryonSkin.Button));
            });
            Set(ui, "bar", (c, a) => { EryonSkin.Bar(new Rect(N(a, 0), N(a, 1), N(a, 2, 200), N(a, 3, 20)), N(a, 4), C(a, 5, EryonSkin.Good), S(a, 6, "")); return DynValue.Nil; });
            Set(ui, "image", (c, a) =>
            {
                var tex = mm.Image(m, S(a, 4));
                if (tex != null) GUI.DrawTexture(new Rect(N(a, 0), N(a, 1), N(a, 2, 64), N(a, 3, 64)), tex, ScaleMode.ScaleToFit);
                return DynValue.Nil;
            });
            Set(ui, "ornament", (c, a) => { EryonSkin.Ornament(new Rect(N(a, 0), N(a, 1), N(a, 2, 200), 10)); return DynValue.Nil; });
            Set(ui, "mouse", (c, a) => { var p = Event.current != null ? Event.current.mousePosition : Vector2.zero; return DynValue.NewTuple(DynValue.NewNumber(p.x), DynValue.NewNumber(p.y)); });
        }
    }
}

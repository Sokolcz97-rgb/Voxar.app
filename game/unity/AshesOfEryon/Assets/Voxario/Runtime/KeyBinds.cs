using System.Collections.Generic;
using UnityEngine;

namespace Voxario
{
    /// <summary>Přenastavitelné klávesy (uložené v PlayerPrefs).</summary>
    public static class KeyBinds
    {
        public class Bind
        {
            public string id, label, group;
            public KeyCode def;
            public Bind(string id, string label, string group, KeyCode def) { this.id = id; this.label = label; this.group = group; this.def = def; }
        }

        public static readonly Bind[] All =
        {
            new Bind("attack", "Útok", "Boj", KeyCode.Mouse0),
            new Bind("skill", "Schopnost", "Boj", KeyCode.Alpha1),
            new Bind("dodge", "Úskok", "Boj", KeyCode.Q),
            new Bind("block", "Krytí (držet)", "Boj", KeyCode.F),
            new Bind("run", "Běh (držet)", "Pohyb", KeyCode.LeftShift),
            new Bind("jump", "Skok", "Pohyb", KeyCode.Space),
            new Bind("autorun", "Automatický běh", "Pohyb", KeyCode.R),
            new Bind("recall", "Návrat do bezpečí", "Pohyb", KeyCode.T),
            new Bind("cam_left", "Otočit kameru vlevo", "Pohyb", KeyCode.Q),
            new Bind("cam_right", "Otočit kameru vpravo", "Pohyb", KeyCode.E),
            new Bind("interact", "Mluvit / použít", "Svět", KeyCode.E),
            new Bind("character", "Postava a trénink", "Okna", KeyCode.C),
            new Bind("bag", "Batoh a výbava", "Okna", KeyCode.I),
            new Bind("chronicle", "Kronika", "Okna", KeyCode.K),
            new Bind("map", "Mapa světa", "Okna", KeyCode.M),
            new Bind("oddil", "Oddíl", "Okna", KeyCode.O),
            new Bind("guide", "Rádce", "Okna", KeyCode.H),
            new Bind("feedback", "Nahlásit chybu", "Okna", KeyCode.F1),
        };

        static readonly Dictionary<string, KeyCode> cache = new Dictionary<string, KeyCode>();

        static Bind Find(string id) { foreach (var b in All) if (b.id == id) return b; return null; }

        public static KeyCode Get(string id)
        {
            if (cache.TryGetValue(id, out var k)) return k;
            var b = Find(id);
            k = b != null ? b.def : KeyCode.None;
            string s = PlayerPrefs.GetString("ashes.key." + id, "");
            if (!string.IsNullOrEmpty(s) && System.Enum.TryParse<KeyCode>(s, out var parsed)) k = parsed;
            cache[id] = k;
            return k;
        }

        public static void Set(string id, KeyCode k)
        {
            cache[id] = k;
            PlayerPrefs.SetString("ashes.key." + id, k.ToString());
            PlayerPrefs.Save();
        }

        public static void ResetAll()
        {
            foreach (var b in All) PlayerPrefs.DeleteKey("ashes.key." + b.id);
            PlayerPrefs.Save();
            cache.Clear();
        }

        /// <summary>Právě se v nastavení zachytává nová klávesa – akce ve hře se nespouštějí.</summary>
        public static bool Capturing;

        public static bool Down(string id) { if (Capturing) return false; var k = Get(id); return k != KeyCode.None && Input.GetKeyDown(k); }
        public static bool Held(string id) { if (Capturing) return false; var k = Get(id); return k != KeyCode.None && Input.GetKey(k); }

        /// <summary>Jiná akce se stejnou klávesou ve stejné skupině (kolize).</summary>
        public static string Conflict(string id)
        {
            // kamera klávesami se smí překrývat (v boji se klávesy kamery ignorují)
            if (id.StartsWith("cam")) return null;
            var k = Get(id);
            if (k == KeyCode.None) return null;
            foreach (var o in All)
                if (o.id != id && !o.id.StartsWith("cam") && Get(o.id) == k) return o.label;
            return null;
        }

        public static string Label(string id) => KeyName(Get(id));

        public static string KeyName(KeyCode k)
        {
            switch (k)
            {
                case KeyCode.None: return "—";
                case KeyCode.Mouse0: return "LMB";
                case KeyCode.Mouse1: return "RMB";
                case KeyCode.Mouse2: return "Kolečko";
                case KeyCode.Mouse3: return "Myš 4";
                case KeyCode.Mouse4: return "Myš 5";
                case KeyCode.Space: return "Mezerník";
                case KeyCode.LeftShift: return "Shift";
                case KeyCode.RightShift: return "P. Shift";
                case KeyCode.LeftControl: return "Ctrl";
                case KeyCode.RightControl: return "P. Ctrl";
                case KeyCode.LeftAlt: return "Alt";
                case KeyCode.RightAlt: return "AltGr";
                case KeyCode.Tab: return "Tab";
                case KeyCode.BackQuote: return "`";
            }
            if (k >= KeyCode.Alpha0 && k <= KeyCode.Alpha9) return ((int)(k - KeyCode.Alpha0)).ToString();
            if (k >= KeyCode.Keypad0 && k <= KeyCode.Keypad9) return "Num " + (int)(k - KeyCode.Keypad0);
            return k.ToString();
        }
    }
}

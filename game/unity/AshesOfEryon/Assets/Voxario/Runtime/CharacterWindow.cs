using System.Collections;
using System.Collections.Generic;
using UnityEngine;

namespace Voxario.Ashes
{
    /// <summary>
    /// Okno postavy (klávesa C): vlastnosti a trénink, výbava a batoh, kovář.
    /// Veškerá pravidla (ceny, úrovně, plný batoh) drží server – okno jen volá
    /// ashes_train / ashes_equip / ashes_sell / ashes_shop / ashes_buy a zobrazí nový stav.
    /// </summary>
    public class CharacterWindow : MonoBehaviour
    {
        public GameBootstrap boot;
        public static CharacterWindow Instance { get; private set; }

        bool open;
        int tab; // 0 postava, 1 výbava, 2 kovář
        bool busy;
        string error, ok;
        float msgUntil;
        Item[] shop;
        bool shopLoaded;
        string smithName = "Kovář";
        Vector2 bagScroll, shopScroll;
        string hover;

        static readonly string[] Tabs = { "Postava", "Výbava a batoh", "Kovář" };
        static readonly string[] Slots = { "zbran", "stit", "helma", "zbroj", "rukavice", "boty", "amulet" };
        static readonly string[] Stats = { "sila", "obratnost", "intelekt", "vydrz", "stesti" };

        public bool IsOpen => open;
        void Awake() => Instance = this;

        public void Open(int t)
        {
            open = true;
            tab = t;
            error = ok = null;
            if (t == 2) shopLoaded = false;
        }

        /// <summary>Otevře obchod kováře (z rozhovoru s Tharosem / Rukmarem).</summary>
        public void OpenSmith(string name)
        {
            smithName = name;
            Open(2);
        }

        public void Close() => open = false;

        public void TestOpen(int t)
        {
            open = true;
            tab = t;
            if (t == 2)
            {
                shopLoaded = true;
                shop = new[]
                {
                    new Item { id = "a", slot = "zbran", name = "Bronzový meč", rarity = 1, level = 3, wmin = 6, wmax = 11, sila = 2, price = 140, in_shop = true },
                    new Item { id = "b", slot = "helma", name = "Helma s hřebenem z Kalidry", rarity = 3, level = 4, armor = 9, vydrz = 3, price = 520, in_shop = true },
                    new Item { id = "c", slot = "boty", name = "Měděné sandály", rarity = 0, level = 3, armor = 3, price = 60, in_shop = true },
                };
            }
        }

        void Update()
        {
            if (!boot.inWorld) { open = false; return; }
            if (Chat.Typing) return;
            if (Input.GetKeyDown(KeyCode.C)) { if (open && tab == 0) open = false; else Open(0); }
            if (Input.GetKeyDown(KeyCode.I) || Input.GetKeyDown(KeyCode.B)) { if (open && tab == 1) open = false; else Open(1); }
            if (open && Input.GetKeyDown(KeyCode.Escape)) { open = false; UiFocus.MarkClosed(); }
            if (open && tab == 2 && !shopLoaded && !busy) StartCoroutine(LoadShop());
        }

        // ------------------------------------------------------------------ server
        IEnumerator LoadShop()
        {
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc("ashes_shop", "{}", (j, e) => { json = j; err = e; });
            busy = false;
            shopLoaded = true;
            if (err != null) { Msg(err, true); shop = new Item[0]; yield break; }
            shop = JsonUtility.FromJson<ItemList>("{\"items\":" + (string.IsNullOrEmpty(json) ? "[]" : json) + "}")?.items ?? new Item[0];
        }

        IEnumerator Call(string fn, string args, string success, bool reloadShop = false)
        {
            string ev = fn == "ashes_equip" ? "equip" : fn == "ashes_sell" ? "sell" : fn == "ashes_buy" ? "buy" : null;
            busy = true;
            string json = null, err = null;
            yield return boot.api.Rpc(fn, args, (j, e) => { json = j; err = e; });
            busy = false;
            if (err != null) { Msg(err, true); yield break; }
            var st = JsonUtility.FromJson<GameState>(json);
            if (st?.character != null)
            {
                int before = boot.state?.character?.level ?? 0;
                boot.state = st;
                if (st.character.level > before && before > 0) success += "  ·  NOVÁ ÚROVEŇ!";
            }
            Msg(success, false);
            if (ev != null) ModManager.Fire("item", ev, success);
            Sfx.Play(success.Contains("NOVÁ ÚROVEŇ") ? "level" : "coin", 0.8f);
            if (reloadShop) yield return LoadShop();
        }

        void Msg(string s, bool isError)
        {
            if (isError) { error = s; ok = null; } else { ok = s; error = null; }
            msgUntil = Time.time + 5;
        }

        static string Q(string s) => MiniJson.Write(s ?? "");

        // ------------------------------------------------------------------ texty
        public static string SlotName(string s) => s switch
        {
            "zbran" => "Zbraň",
            "stit" => "Štít",
            "helma" => "Helma",
            "zbroj" => "Zbroj",
            "rukavice" => "Rukavice",
            "boty" => "Boty",
            "amulet" => "Amulet",
            _ => s,
        };

        public static string StatName(string s) => s switch
        {
            "sila" => "Síla",
            "obratnost" => "Obratnost",
            "intelekt" => "Intelekt",
            "vydrz" => "Výdrž",
            "stesti" => "Štěstí",
            _ => s,
        };

        static string StatHint(string s, string cls) => s switch
        {
            "sila" => cls == "hoplit" ? "Hlavní vlastnost štítonoše – zvyšuje poškození." : "Mírně snižuje poškození od protivníků.",
            "obratnost" => cls == "lucistnik" ? "Hlavní vlastnost lučištníka – zvyšuje poškození." : "Šance uhnout ranám.",
            "intelekt" => cls == "vestec" ? "Hlavní vlastnost věštce ohně – zvyšuje poškození." : "Odolnost proti kouzlům věštců.",
            "vydrz" => "Více životů v boji.",
            "stesti" => "Šance na kritický zásah.",
            _ => "",
        };

        static string MainStat(string cls) => cls == "lucistnik" ? "obratnost" : cls == "vestec" ? "intelekt" : "sila";

        public static Color RarityColor(int r) => r switch
        {
            1 => new Color(0.55f, 0.85f, 0.45f),
            2 => new Color(0.45f, 0.7f, 1f),
            3 => new Color(0.78f, 0.55f, 1f),
            4 => new Color(1f, 0.6f, 0.2f),
            _ => EryonSkin.Text,
        };

        public static string RarityName(int r) => r switch
        {
            1 => "neobvyklý",
            2 => "vzácný",
            3 => "epický",
            4 => "legendární",
            _ => "běžný",
        };

        static string Hex(Color c) => ColorUtility.ToHtmlStringRGB(c);

        public static string ItemLine(Item it)
        {
            var parts = new List<string>();
            if (it.slot == "zbran") parts.Add($"poškození {it.wmin}–{it.wmax}");
            if (it.armor > 0) parts.Add($"zbroj {it.armor}");
            foreach (var s in Stats)
            {
                int v = StatOf(it, s);
                if (v != 0) parts.Add($"{StatName(s)} {(v > 0 ? "+" : "")}{v}");
            }
            return string.Join("  ·  ", parts);
        }

        static int StatOf(Item it, string s) => s switch
        {
            "sila" => it.sila,
            "obratnost" => it.obratnost,
            "intelekt" => it.intelekt,
            "vydrz" => it.vydrz,
            _ => it.stesti,
        };

        static int StatOf(Character c, string s) => s switch
        {
            "sila" => c.sila,
            "obratnost" => c.obratnost,
            "intelekt" => c.intelekt,
            "vydrz" => c.vydrz,
            _ => c.stesti,
        };

        static int StatOf(FighterStats f, string s) => f == null ? 0 : s switch
        {
            "sila" => f.sila,
            "obratnost" => f.obratnost,
            "intelekt" => f.intelekt,
            "vydrz" => f.vydrz,
            _ => f.stesti,
        };

        static int CostOf(TrainCost t, string s) => t == null ? 0 : s switch
        {
            "sila" => t.sila,
            "obratnost" => t.obratnost,
            "intelekt" => t.intelekt,
            "vydrz" => t.vydrz,
            _ => t.stesti,
        };

        /// <summary>Hrubé srovnání s nasazeným předmětem stejného slotu (zelená = lepší).</summary>
        string Compare(Item it)
        {
            var st = boot.state;
            if (st?.items == null) return "";
            Item cur = null;
            foreach (var x in st.items) if (x.equipped && x.slot == it.slot && x.id != it.id) cur = x;
            if (cur == null) return it.equipped ? "" : "<color=#8cc06b>nový slot</color>";
            string main = MainStat(st.character.@class);
            float Score(Item i) => (i.wmin + i.wmax) * 1.5f + i.armor + StatOf(i, main) * 2f + i.vydrz * 1.5f + (i.sila + i.obratnost + i.intelekt + i.stesti) * 0.5f;
            float d = Score(it) - Score(cur);
            if (Mathf.Abs(d) < 0.5f) return "<color=#a8998a>podobné</color>";
            return d > 0 ? "<color=#8cc06b>▲ lepší než nasazené</color>" : "<color=#e0672a>▼ horší než nasazené</color>";
        }

        // ------------------------------------------------------------------ vykreslení
        void OnGUI()
        {
            if (!open || !boot.inWorld || boot.state?.character == null) return;
            var gameUi = boot.GetComponent<GameUI>();
            if (gameUi != null && gameUi.SettingsOpen) return;
            EryonSkin.Begin();
            GUI.depth = -12;
            float W = EryonSkin.W, H = EryonSkin.H;
            float w = Mathf.Min(1180, W - 60), h = Mathf.Min(760, H - 120);
            var r = new Rect((W - w) / 2, (H - h) / 2 - 10, w, h);
            var ch = boot.state.character;
            var inner = EryonSkin.DrawPanel(r, string.IsNullOrEmpty(ch.display_name) ? ch.name : ch.display_name);

            // záložky
            GUILayout.BeginArea(new Rect(inner.x, inner.y, inner.width, 44));
            GUILayout.BeginHorizontal();
            for (int i = 0; i < Tabs.Length; i++)
                if (EryonSkin.Toggle(tab == i, Tabs[i], GUILayout.Height(38), GUILayout.Width(220))) { tab = i; error = ok = null; if (i == 2) shopLoaded = false; }
            GUILayout.FlexibleSpace();
            GUILayout.Label(EryonSkin.GoldContent($"{ch.gold} zlata"), new GUIStyle(EryonSkin.BodyBold) { fontSize = 22, wordWrap = false, normal = { textColor = new Color(0.94f, 0.82f, 0.54f) } }, GUILayout.Height(38));
            GUILayout.EndHorizontal();
            GUILayout.EndArea();

            var body = new Rect(inner.x, inner.y + 54, inner.width, inner.height - 54 - 56);
            GUI.enabled = !busy;
            if (tab == 0) StatsTab(body);
            else if (tab == 1) GearTab(body);
            else ShopTab(body);
            GUI.enabled = true;

            // spodní řádek: zpráva + zavřít
            var foot = new Rect(inner.x, inner.yMax - 48, inner.width, 48);
            if (Time.time < msgUntil)
            {
                if (error != null) GUI.Label(new Rect(foot.x, foot.y, foot.width - 260, foot.height), $"<color=#e0672a>{error}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true, alignment = TextAnchor.MiddleLeft });
                else if (ok != null) GUI.Label(new Rect(foot.x, foot.y, foot.width - 260, foot.height), $"<color=#8cc06b>{ok}</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true, alignment = TextAnchor.MiddleLeft });
            }
            else if (busy) GUI.Label(new Rect(foot.x, foot.y, 400, foot.height), "Kovář počítá…", new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleLeft });
            if (GUI.Button(new Rect(foot.xMax - 240, foot.y + 2, 240, 44), "ZAVŘÍT (Esc)", EryonSkin.ButtonPrimary)) open = false;
        }

        void StatsTab(Rect body)
        {
            var st = boot.state;
            var ch = st.character;
            var f = st.fighter;
            // levý sloupec: portrét a souhrn
            var left = new Rect(body.x, body.y, 360, body.height);
            EryonSkin.Portrait(new Rect(left.x + 70, left.y, 220, 220), EryonSkin.PortraitFor(ch.@class, ch.appearance?.gender));
            GUILayout.BeginArea(new Rect(left.x, left.y + 232, left.width, left.height - 232));
            GUILayout.Label($"{EryonSkin.ClassName(ch.@class)}  ·  úroveň {ch.level}", new GUIStyle(EryonSkin.H2) { alignment = TextAnchor.MiddleCenter, normal = { textColor = EryonSkin.GoldBright } });
            GUILayout.Label(EryonSkin.FactionName(ch.faction), new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleCenter });
            GUILayout.Space(10);
            float xpK = ch.xp_need > 0 ? ch.xp / (float)ch.xp_need : 0;
            var xr = GUILayoutUtility.GetRect(left.width, 22);
            EryonSkin.Bar(xr, xpK, new Color(0.62f, 0.48f, 0.9f), $"{ch.xp} / {ch.xp_need} zkušeností");
            GUILayout.Space(10);
            var line = new GUIStyle(EryonSkin.Body) { fontSize = 21, richText = true };
            GUILayout.Label($"<color=#8cc06b>❤</color>  Životy v boji: <b>{Mathf.RoundToInt(st.hp)}</b>", line);
            if (f != null)
            {
                GUILayout.Label($"⚔  Poškození zbraně: <b>{f.wmin}–{f.wmax}</b>", line);
                GUILayout.Label($"⛨  Zbroj: <b>{f.armor}</b>{(f.shield ? "  ·  štít (blok)" : "")}", line);
            }
            GUILayout.Label($"✦  Čest: <b>{ch.honor}</b>", line);
            GUILayout.Label($"Vítězství {ch.wins}  ·  porážky {ch.losses}", new GUIStyle(EryonSkin.Small) { alignment = TextAnchor.MiddleLeft });
            GUILayout.EndArea();

            // pravý sloupec: vlastnosti a trénink
            var right = new Rect(body.x + 400, body.y, body.width - 400, body.height);
            GUILayout.BeginArea(right);
            GUILayout.Label("VLASTNOSTI A TRÉNINK", EryonSkin.Caps);
            GUILayout.Label("Trénink stojí zlato a trvale zvýší vlastnost o 1. Čím vyšší hodnota, tím dražší další bod.", EryonSkin.Small);
            GUILayout.Space(8);
            string main = MainStat(ch.@class);
            foreach (var s in Stats)
            {
                int baseV = StatOf(ch, s), total = StatOf(f, s), cost = CostOf(st.train_cost, s);
                GUILayout.BeginHorizontal(GUILayout.Height(78));
                GUILayout.BeginVertical();
                string star = s == main ? "  <color=#f0d08a>★ hlavní</color>" : "";
                GUILayout.Label($"<b>{StatName(s)}</b>{star}", new GUIStyle(EryonSkin.Body) { fontSize = 23, richText = true });
                GUILayout.Label(StatHint(s, ch.@class), EryonSkin.Small);
                GUILayout.EndVertical();
                GUILayout.FlexibleSpace();
                int bonus = total - baseV;
                GUILayout.Label($"<b>{baseV}</b>{(bonus > 0 ? $"<color=#8cc06b> +{bonus}</color>" : "")}", new GUIStyle(EryonSkin.H2) { fontSize = 26, richText = true, alignment = TextAnchor.MiddleRight }, GUILayout.Width(120), GUILayout.Height(60));
                GUI.enabled = !busy && cost > 0 && ch.gold >= cost;
                if (GUILayout.Button(EryonSkin.GoldContent($"Trénovat  {cost}"), EryonSkin.Button, GUILayout.Width(210), GUILayout.Height(52)))
                {
                    string ss = s;
                    StartCoroutine(Call("ashes_train", $"{{\"p_stat\":{Q(ss)}}}", $"{StatName(ss)} +1"));
                }
                GUI.enabled = !busy;
                GUILayout.EndHorizontal();
                EryonSkin.Fill(GUILayoutUtility.GetRect(right.width, 1), EryonSkin.Line);
            }
            GUILayout.EndArea();
        }

        void GearTab(Rect body)
        {
            var st = boot.state;
            var items = st.items ?? new Item[0];
            // výbava (sloty)
            var left = new Rect(body.x, body.y, 470, body.height);
            GUILayout.BeginArea(left);
            GUILayout.Label("NASAZENÁ VÝBAVA", EryonSkin.Caps);
            GUILayout.Space(4);
            foreach (var slot in Slots)
            {
                Item eq = null;
                foreach (var it in items) if (it.equipped && it.slot == slot) eq = it;
                var rr = GUILayoutUtility.GetRect(left.width, 72);
                EryonSkin.Fill(rr, new Color(0.08f, 0.06f, 0.05f, 0.7f));
                EryonSkin.Fill(new Rect(rr.x, rr.yMax - 1, rr.width, 1), EryonSkin.Line);
                GUI.Label(new Rect(rr.x + 12, rr.y + 6, 120, 22), SlotName(slot).ToUpperInvariant(), EryonSkin.Caps);
                if (eq != null)
                {
                    GUI.Label(new Rect(rr.x + 12, rr.y + 26, rr.width - 140, 26), $"<color=#{Hex(RarityColor(eq.rarity))}>{eq.name}</color>  <size=15><color=#a8998a>úr. {eq.level}</color></size>", new GUIStyle(EryonSkin.BodyBold) { richText = true, fontSize = 20 });
                    GUI.Label(new Rect(rr.x + 12, rr.y + 48, rr.width - 140, 22), ItemLine(eq), EryonSkin.Small);
                    if (GUI.Button(new Rect(rr.xMax - 118, rr.y + 18, 106, 36), "Sundat", EryonSkin.Button))
                    {
                        var id = eq.id;
                        StartCoroutine(Call("ashes_equip", $"{{\"p_item\":{Q(id)},\"p_on\":false}}", $"{eq.name} je v batohu."));
                    }
                }
                else GUI.Label(new Rect(rr.x + 12, rr.y + 28, rr.width - 24, 26), "<color=#6f6458>— prázdné —</color>", new GUIStyle(EryonSkin.Body) { richText = true });
            }
            GUILayout.EndArea();

            // batoh
            var right = new Rect(body.x + 500, body.y, body.width - 500, body.height);
            GUILayout.BeginArea(right);
            int bagMax = st.bag_max > 0 ? st.bag_max : 12;
            GUILayout.Label($"BATOH  {st.BagCount} / {bagMax}", EryonSkin.Caps);
            GUILayout.Label("Kořist padá z nepřátel ve světě. Lepší výbavu koupíš u kováře v Kalidře (Tharos) nebo v táboře Legie (Rukmar).", EryonSkin.Small);
            bagScroll = GUILayout.BeginScrollView(bagScroll, GUIStyle.none, GUI.skin.verticalScrollbar);
            bool any = false;
            foreach (var it in items)
            {
                if (it.equipped) continue;
                any = true;
                GUILayout.BeginHorizontal(GUILayout.Height(80));
                GUILayout.BeginVertical();
                GUILayout.Label($"<color=#{Hex(RarityColor(it.rarity))}>{it.name}</color>  <size=15><color=#a8998a>{SlotName(it.slot)} · úr. {it.level} · {RarityName(it.rarity)}</color></size>", new GUIStyle(EryonSkin.BodyBold) { richText = true, fontSize = 20 });
                GUILayout.Label(ItemLine(it) + "   " + Compare(it), new GUIStyle(EryonSkin.Small) { richText = true });
                GUILayout.EndVertical();
                GUILayout.FlexibleSpace();
                bool tooHigh = it.level > st.character.level + 2;
                GUI.enabled = !busy && !tooHigh;
                if (GUILayout.Button(tooHigh ? $"od úr. {it.level - 2}" : "Nasadit", EryonSkin.Button, GUILayout.Width(150), GUILayout.Height(46)))
                {
                    var id = it.id; var nm = it.name;
                    StartCoroutine(Call("ashes_equip", $"{{\"p_item\":{Q(id)},\"p_on\":true}}", $"Nasazeno: {nm}"));
                }
                GUI.enabled = !busy;
                if (GUILayout.Button(EryonSkin.GoldContent($"Prodat  {Mathf.Max(1, it.price / 4)}"), EryonSkin.Button, GUILayout.Width(150), GUILayout.Height(46)))
                {
                    var id = it.id; var nm = it.name;
                    StartCoroutine(Call("ashes_sell", $"{{\"p_item\":{Q(id)}}}", $"Prodáno: {nm}"));
                }
                GUILayout.EndHorizontal();
                EryonSkin.Fill(GUILayoutUtility.GetRect(right.width - 20, 1), EryonSkin.Line);
            }
            if (!any) GUILayout.Label("Batoh je prázdný.", EryonSkin.Body);
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }

        void ShopTab(Rect body)
        {
            var st = boot.state;
            GUILayout.BeginArea(body);
            GUILayout.Label($"{smithName.ToUpperInvariant()}  ·  ZBOŽÍ NA DNEŠEK", EryonSkin.Caps);
            GUILayout.Label("Kovář každý den ukove nové zboží pro tvé povolání a úroveň. Nákup jde rovnou do batohu.", EryonSkin.Small);
            GUILayout.Space(6);
            if (!shopLoaded) { GUILayout.Label("Načítám zboží…", EryonSkin.Body); GUILayout.EndArea(); return; }
            if (shop == null || shop.Length == 0) { GUILayout.Label("Dnes už kovář nic nemá. Zastav se zítra.", EryonSkin.Body); GUILayout.EndArea(); return; }
            int bagMax = st.bag_max > 0 ? st.bag_max : 12;
            bool full = st.BagCount >= bagMax;
            if (full) GUILayout.Label("<color=#e0672a>Batoh je plný – nejdřív něco prodej.</color>", new GUIStyle(EryonSkin.BodyBold) { richText = true });
            shopScroll = GUILayout.BeginScrollView(shopScroll, GUIStyle.none, GUI.skin.verticalScrollbar);
            foreach (var it in shop)
            {
                GUILayout.BeginHorizontal(GUILayout.Height(84));
                GUILayout.BeginVertical();
                GUILayout.Label($"<color=#{Hex(RarityColor(it.rarity))}>{it.name}</color>  <size=15><color=#a8998a>{SlotName(it.slot)} · úr. {it.level} · {RarityName(it.rarity)}</color></size>", new GUIStyle(EryonSkin.BodyBold) { richText = true, fontSize = 21 });
                GUILayout.Label(ItemLine(it) + "   " + Compare(it), new GUIStyle(EryonSkin.Small) { richText = true });
                GUILayout.EndVertical();
                GUILayout.FlexibleSpace();
                GUI.enabled = !busy && !full && st.character.gold >= it.price;
                if (GUILayout.Button(EryonSkin.GoldContent($"Koupit  {it.price}"), EryonSkin.ButtonPrimary, GUILayout.Width(220), GUILayout.Height(50)))
                {
                    var id = it.id; var nm = it.name;
                    StartCoroutine(Call("ashes_buy", $"{{\"p_item\":{Q(id)}}}", $"Koupeno: {nm} (v batohu)", true));
                }
                GUI.enabled = !busy;
                GUILayout.EndHorizontal();
                EryonSkin.Fill(GUILayoutUtility.GetRect(body.width - 20, 1), EryonSkin.Line);
            }
            GUILayout.EndScrollView();
            GUILayout.EndArea();
        }
    }
}

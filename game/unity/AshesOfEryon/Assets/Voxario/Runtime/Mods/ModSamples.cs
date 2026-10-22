using System.IO;

namespace Voxario.Ashes
{
    /// <summary>Při prvním spuštění vytvoří složku módů s návodem a ukázkovým módem.</summary>
    public static class ModSamples
    {
        public static void Ensure(string folder)
        {
            Directory.CreateDirectory(folder);
            File.WriteAllText(Path.Combine(folder, "README.txt"), Readme);
            var sample = Path.Combine(folder, "UkazkaEryon");
            if (Directory.Exists(sample)) return;
            Directory.CreateDirectory(sample);
            File.WriteAllText(Path.Combine(sample, "mod.json"), SampleJson);
            File.WriteAllText(Path.Combine(sample, "main.lua"), SampleLua);
        }

        const string SampleJson = @"{
  ""id"": ""UkazkaEryon"",
  ""name"": ""Deník poutníka"",
  ""version"": ""1.0"",
  ""author"": ""StudioVoxario"",
  ""description"": ""Ukázkový mód: okno s přehledem postavy, počítadlo vítězství a upozornění na nové úkoly. Klávesa J."",
  ""main"": ""main.lua""
}";

        const string SampleLua = @"-- Deník poutníka – ukázkový mód pro Ashes of Eryon
-- Klávesa J otevře/zavře okno. Upravuj a zkoušej: F8 v nabídce módy znovu načte.

local open = eryon.load(""open"", ""1"") == ""1""
local wins = tonumber(eryon.load(""wins"", ""0"")) or 0

eryon.on(""enter_world"", function()
  eryon.notify(""Deník poutníka je připraven – klávesa J."")
end)

eryon.on(""key"", function(k)
  if k == ""j"" then
    open = not open
    eryon.save(""open"", open and ""1"" or ""0"")
  end
end)

eryon.on(""fight_end"", function(result, enemy)
  if result == ""won"" then
    wins = wins + 1
    eryon.save(""wins"", tostring(wins))
    eryon.notify(""Deník: poražen "" .. enemy .. "" ("" .. wins .. "". vítězství)"")
  end
end)

eryon.on(""quest_accepted"", function(id, title)
  eryon.notify(""Deník: nový úkol – "" .. title)
end)

eryon.on(""draw"", function()
  if not open then return end
  local p = eryon.player()
  if not p then return end
  local x, y = 24, 170
  ui.panel(x, y, 380, 270, ""Deník poutníka"")
  ui.text(x + 26, y + 84, 330, 28, p.name .. ""  ·  úroveň "" .. p.level, 22, ""gold"")
  ui.text(x + 26, y + 116, 330, 26, ""Oblast: "" .. (p.region or ""?""), 19)
  ui.text(x + 26, y + 142, 330, 26, ""Vítězství (tento počítač): "" .. wins, 19)
  local k = 0
  if p.xp_need > 0 then k = p.xp / p.xp_need end
  ui.bar(x + 26, y + 180, 320, 20, k, ""#9f7ae6"", p.xp .. "" / "" .. p.xp_need .. "" zk."")
  ui.text(x + 26, y + 220, 330, 24, ""J – skrýt deník"", 16, ""muted"")
end)
";

        const string Readme = @"ASHES OF ERYON – MÓDY (DOPLŇKY)
================================

Módy jsou doplňky v jazyce Lua (stejně jako ve World of Warcraft). Každý mód je
složka v této složce:

  Mods\MujMod\mod.json     – popis (id, name, version, author, description, main)
  Mods\MujMod\main.lua     – kód módu
  Mods\MujMod\*.png        – obrázky pro ui.image
  Mods\MujMod\*.glb        – 3D modely (např. vytvořené AI – Meshy, Tripo, Blender…)

Zapnutí / vypnutí: ve hře Esc → Nastavení → Módy. F8 módy znovu načte.
Módy běží v pískovišti: nemají přístup k souborům, internetu ani systému
a nemohou měnit pravidla hry (souboje, odměny a úkoly hlídá server).

UDÁLOSTI  –  eryon.on(""nazev"", function(...) ... end)
  update (dt)                 každý snímek
  draw ()                     kreslení rozhraní (jen tady volej ui.*)
  enter_world ()              vstup do světa
  key (znak)                  stisknutá klávesa (malé písmeno)
  npc_talk (id, jmeno)        začátek rozhovoru s NPC
  quest_accepted (id, nazev)  přijatý úkol
  quest_done (id, nazev)      odevzdaný úkol
  fight_start (id, jmeno)     začátek souboje
  fight_end (""won""/""lost"", jmeno)
  chat (""svet""/""oddil"", jmeno, text)   nová zpráva v chatu
  level_up (uroven)           nová úroveň postavy
  item (""equip""/""sell""/""buy"", nazev)  změna výbavy
  expedition (""start""/""end"", nazev)  výprava z Kroniky

FUNKCE
  eryon.print(...)                    zápis do logu
  eryon.notify(text)                  zlaté upozornění uprostřed obrazovky
  eryon.player()                      tabulka: name, class, faction, level, xp, xp_need,
                                      gold, honor, wins, losses, chapter, x, z, region
  eryon.quests()                      seznam úkolů: id, title, objective, state, progress, count
  eryon.time()                        čas hry v sekundách
  eryon.key(""F"")                      je klávesa držena? (názvy jako v Unity: Space, LeftShift, F1…)
  eryon.screen()                      šířka, výška rozhraní (výška je vždy 1080)
  eryon.save(klic, text) / eryon.load(klic, vychozi)   uložení nastavení módu
  eryon.replace_player_model(""soubor.glb"", vyska)      vlastní model hráče (jen u tebe)
  eryon.spawn_model(""soubor.glb"", x, z, velikost, otoceni)   dekorace ve světě (jen u tebe)

ROZHRANÍ (souřadnice v obrazovce 1920 × 1080, levý horní roh = 0, 0)
  ui.panel(x, y, w, h, nadpis)
  ui.title(x, y, w, h, text, velikost, barva)
  ui.text(x, y, w, h, text, velikost, barva, ""left""/""center""/""right"")
  ui.button(x, y, w, h, text, ""primary"")  → true při kliknutí
  ui.bar(x, y, w, h, hodnota0az1, barva, popisek)
  ui.image(x, y, w, h, ""obrazek.png"")
  ui.ornament(x, y, w)
  ui.mouse()                          → x, y
  Barvy: ""gold"", ""text"", ""muted"", ""ember"", ""blood"", ""good"", ""sky"" nebo ""#rrggbb"".

Ukázka je ve složce UkazkaEryon (Deník poutníka, klávesa J).
";
    }
}

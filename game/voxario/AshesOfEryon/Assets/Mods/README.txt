ASHES OF ERYON – MÓDY (DOPLŇKY)
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

UDÁLOSTI  –  eryon.on("nazev", function(...) ... end)
  update (dt)                 každý snímek
  draw ()                     kreslení rozhraní (jen tady volej ui.*)
  enter_world ()              vstup do světa
  key (znak)                  stisknutá klávesa (malé písmeno)
  npc_talk (id, jmeno)        začátek rozhovoru s NPC
  quest_accepted (id, nazev)  přijatý úkol
  quest_done (id, nazev)      odevzdaný úkol
  fight_start (id, jmeno)     začátek souboje
  fight_end ("won"/"lost", jmeno)
  chat ("svet"/"oddil", jmeno, text)   nová zpráva v chatu
  level_up (uroven)           nová úroveň postavy
  item ("equip"/"sell"/"buy", nazev)  změna výbavy
  expedition ("start"/"end", nazev)  výprava z Kroniky

FUNKCE
  eryon.print(...)                    zápis do logu
  eryon.notify(text)                  zlaté upozornění uprostřed obrazovky
  eryon.player()                      tabulka: name, class, faction, level, xp, xp_need,
                                      gold, honor, wins, losses, chapter, x, z, region
  eryon.quests()                      seznam úkolů: id, title, objective, state, progress, count
  eryon.time()                        čas hry v sekundách
  eryon.key("F")                      je klávesa držena? (názvy: Space, LeftShift nebo Shift, F1, A…)
  eryon.screen()                      šířka, výška rozhraní (výška je vždy 1080)
  eryon.save(klic, text) / eryon.load(klic, vychozi)   uložení nastavení módu
  eryon.replace_player_model("soubor.glb", vyska)      vlastní model hráče (jen u tebe)
  eryon.spawn_model("soubor.glb", x, z, velikost, otoceni)   dekorace ve světě (jen u tebe)

ROZHRANÍ (souřadnice v obrazovce 1920 × 1080, levý horní roh = 0, 0)
  ui.panel(x, y, w, h, nadpis)
  ui.title(x, y, w, h, text, velikost, barva)
  ui.text(x, y, w, h, text, velikost, barva, "left"/"center"/"right")
  ui.button(x, y, w, h, text, "primary")  → true při kliknutí
  ui.bar(x, y, w, h, hodnota0az1, barva, popisek)
  ui.image(x, y, w, h, "obrazek.png")
  ui.ornament(x, y, w)
  ui.mouse()                          → x, y
  Barvy: "gold", "text", "muted", "ember", "blood", "good", "sky" nebo "#rrggbb".

Ukázka je ve složce UkazkaEryon (Deník poutníka, klávesa J).

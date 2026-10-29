-- Deník poutníka – ukázkový mód pro Ashes of Eryon
-- Klávesa J otevře/zavře okno. Upravuj a zkoušej: F8 módy znovu načte.

local open = eryon.load("open", "1") == "1"
local wins = tonumber(eryon.load("wins", "0")) or 0

eryon.on("enter_world", function()
  eryon.notify("Deník poutníka je připraven – klávesa J.")
end)

eryon.on("key", function(k)
  if k == "j" then
    open = not open
    eryon.save("open", open and "1" or "0")
  end
end)

eryon.on("fight_end", function(result, enemy)
  if result == "won" then
    wins = wins + 1
    eryon.save("wins", tostring(wins))
    eryon.notify("Deník: poražen " .. enemy .. " (" .. wins .. ". vítězství)")
  end
end)

eryon.on("quest_accepted", function(id, title)
  eryon.notify("Deník: nový úkol – " .. title)
end)

eryon.on("draw", function()
  if not open then return end
  local p = eryon.player()
  if not p then return end
  local x, y = 24, 170
  ui.panel(x, y, 380, 270, "Deník poutníka")
  ui.text(x + 26, y + 84, 330, 28, p.name .. "  ·  úroveň " .. p.level, 22, "gold")
  ui.text(x + 26, y + 116, 330, 26, "Oblast: " .. (p.region or "?"), 19)
  ui.text(x + 26, y + 142, 330, 26, "Vítězství (tento počítač): " .. wins, 19)
  local k = 0
  if p.xp_need > 0 then k = p.xp / p.xp_need end
  ui.bar(x + 26, y + 180, 320, 20, k, "#9f7ae6", p.xp .. " / " .. p.xp_need .. " zk.")
  ui.text(x + 26, y + 220, 330, 24, "J – skrýt deník", 16, "muted")
end)

-- Oblékání postav (KayKit Adventurers, CC0 – Kay Lousberg): všechny postavy mají stejnou kostru,
-- takže díly jdou kombinovat. Každý model nese celou svou výbavu (zbraně v handslot.l / .r, helmu,
-- plášť) – entity.show_part zvolí, co je vidět; entity.equip oblékne díl z jiného modelu.
local M = {}

-- díly, které model nese (výbava), podle zdrojové postavy
M.Gear = {
    knight = { "1H_Sword", "1H_Sword_Offhand", "2H_Sword", "Badge_Shield", "Rectangle_Shield", "Round_Shield", "Spike_Shield", "Knight_Helmet", "Knight_Cape" },
    mage = { "Spellbook", "Spellbook_open", "1H_Wand", "2H_Staff", "Mage_Hat", "Mage_Cape" },
    barbarian = { "1H_Axe", "1H_Axe_Offhand", "2H_Axe", "Barbarian_Round_Shield", "Mug", "Barbarian_Hat", "Barbarian_Cape" },
    rogue = { "Knife", "Knife_Offhand", "1H_Crossbow", "2H_Crossbow", "Throwable", "Rogue_Cape" },
}

-- zdrojová postava podle modelu varianty
local BASE = { knight_sylvaria = "knight", knight_aethel = "knight", mage_sylvaria = "mage", lyrise = "mage",
               ranger_sylvaria = "rogue", engineer_aethel = "rogue", cultist = "rogue",
               warden_aethel = "barbarian", crusher = "barbarian" }
M.Base = BASE

-- Ukáže jen vybranou výbavu (ostatní díly výbavy schová; tělo zůstává)
function M.Wear(id, model, keep)
    local base = BASE[model]
    entity.show_part(id)
    local want = {}
    for _, n in ipairs(keep or {}) do want[n] = true end
    for _, n in ipairs(M.Gear[base] or {}) do
        if not want[n] then entity.show_part(id, n, false) end
    end
end

-- Oblékne díl z jiné postavy (helma, klobouk, plášť, zbraň): vytvoří model dílu, schová v něm vše
-- kromě dílu a naváže ho na kostru nositele. Vrací id dílu (entity.destroy ho svlékne).
function M.Equip(wearer, fromModel, part)
    local p = entity.get_position(wearer)
    local id = _G.world.spawn("Models/heroes/" .. fromModel .. ".glb", p.x or p[1], p.y or p[2], p.z or p[3], { name = part })
    entity.show_part(id, "*", false)
    entity.show_part(id, part, true)
    entity.equip(id, wearer)
    return id
end

return M

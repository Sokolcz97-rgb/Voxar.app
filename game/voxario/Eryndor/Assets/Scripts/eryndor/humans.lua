-- Realistické postavy (MakeHuman CC0, tools/mh_build.py): oblékání a zbraně.
-- Model nese celý svůj oděv jako díly glTF (Helm, Cape, Armor_Chest…); entity.show_part je zapíná a vypíná.
-- Zbraně KayKit (CC0) se připínají na úchyty handslot.r / handslot.l (stejně jako u postav KayKit).
local M = {}

M.Items = { sword = "sword_1handed", sword2 = "sword_2handed", shield = "shield_round", shield_badge = "shield_badge_color",
            staff = "staff", wand = "wand", book = "spellbook_open", crossbow = "crossbow_1handed", crossbow2 = "crossbow_2handed",
            dagger = "dagger", axe = "axe_1handed", axe2 = "axe_2handed" }

-- spawn postavy: path = "syl_knight_m" …, opts = {right, left, helm, scale, yaw, name, tag}
function M.Spawn(path, x, y, z, opts)
    opts = opts or {}
    local id = _G.world.spawn("Models/humans/" .. path .. ".glb", x, y, z, { yaw = opts.yaw or 0, name = opts.name or path,
        scale = opts.scale or 1, tag = opts.tag })
    M.Dress(id, opts)
    return id
end

function M.Dress(id, opts)
    entity.show_part(id)
    if opts.helm == false then
        entity.show_part(id, "Helm*", false)
    elseif opts.helm then
        entity.show_part(id, "Hair", false)   -- vlasy pod helmou
    end
    if opts.cape == false then entity.show_part(id, "Cape", false) end
    local items = {}
    for _, side in ipairs({ { "right", "handslot.r" }, { "left", "handslot.l" } }) do
        local item = opts[side[1]]
        if item then
            -- zbraně KayKit jsou dělané pro menší postavy -> 80 %
            local w = _G.world.spawn("Models/kaykit/items/" .. (M.Items[item] or item) .. ".gltf", 0, 0, 0, { name = item, scale = 0.8 })
            entity.attach(w, id, side[2])
            entity.set_position(w, 0, 0, 0)
            entity.set_rotation(w, 0, 0, 0)
            items[#items + 1] = w
        end
    end
    return items
end

return M

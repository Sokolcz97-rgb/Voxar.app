-- Svět Aethelgard (podle „Herní dokumentace: Svět Aethelgard“): kontinent 8 x 8 km v Azure Ocean.
-- Terén, povrchy a mapa jsou vygenerované nástrojem tools/aethelgard_world.py (Assets/Terrain, UI/aethelgard_map.jpg,
-- eryndor/world_data.lua). Souřadnice: +X východ, +Z jih (sever je nahoře mapy), hladina moře Y = 0.
local D = require("eryndor.world_data")
local M = {}

local floor, max, min = math.floor, math.max, math.min

M.Data = D
M.Size = D.Size                  -- strana světa (m), střed v 0, 0
M.SeaY = D.SeaY                  -- hladina oceánu a řeky Serpentine (stejná voda – nikde nevisí ve vzduchu)
M.Start = D.POI.Start            -- hraniční základna Aethelgardu uprostřed kontinentu
M.Lyrise = D.POI.Lyrise
M.Tower = D.POI.Tower
M.Giant = D.POI.Giant            -- tisíciletý strom (Verdant Canopy)
M.Shrine = D.POI.Shrine          -- elfí svatyně (Verdant Canopy)
M.Rift = D.POI.Rift              -- Stínová trhlina (Crystalarium)
M.DragonLair = D.POI.DragonLair  -- zamrzlé jezero (Frostfang Peaks)
M.SpiderNest = D.POI.SpiderNest  -- sopky (Ignis Scar)
M.FrozenLake = D.FrozenLake

M.RegionNames = {
    v = "Verdant Canopy", f = "Frostfang Peaks", i = "Ignis Scar", c = "Crystalarium", m = "Údolí Serpentine",
    r = "Serpentine River", o = "Azure Ocean", b = "Pobřeží", l = "Ignis Scar", k = "Frostfang Peaks",
}

-- výška terénu (engine: velký terén z výškové mapy); mimo terén = dno oceánu
function M.HeightAt(x, z)
    local h = _G.world.height(x, z)
    return h or -40
end

-- výška a normála (pro rozmisťování podle sklonu)
function M.Ground(x, z)
    local h, n = _G.world.height(x, z)
    if not h then return -40, 0 end
    return h, n and n.y or 1
end

-- kód regionu v mřížce (viz world_data.lua): v f i c m r o b l k
function M.Region(x, z)
    local g = D.Grid
    local c = floor((x / D.Size + 0.5) * g) + 1
    local r = floor((z / D.Size + 0.5) * g) + 1
    if c < 1 or r < 1 or c > g or r > g then return "o" end
    return D.Rows[r]:sub(c, c)
end

function M.RegionName(x, z) return M.RegionNames[M.Region(x, z)] or "Aethelgard" end

-- poloha ve světě -> 0..1 na mapě (u vpravo, v dolů)
function M.ToMap(x, z) return x / D.Size + 0.5, z / D.Size + 0.5 end

return M

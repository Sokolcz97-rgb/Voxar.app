-- Stavba počáteční lokace: terén, jezero, les Sylvarie, tábor Aethelgardu, Stínová trhlina.
-- Všechny modely jsou vlastní (tools/eryndor_nature.py), rozmístění je deterministické.
local map = require("eryndor.map")
local M = {}

local sin, cos, sqrt, floor, max, min, pi = math.sin, math.cos, math.sqrt, math.floor, math.max, math.min, math.pi
local W = _G.world

-- deterministický generátor (ať je svět vždy stejný)
local seed = 1234567
local function rnd()
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
end
local function rr(a, b) return a + (b - a) * rnd() end

local function ground(x, z) return map.HeightAt(x, z) end
M.Ground = ground

-- rozmístí n kusů v obdélníku, kde test(x, z) projde; vrací seznam pro world.instances
local function scatter(n, x0, x1, z0, z1, test, sMin, sMax, tries)
    local out = {}
    tries = tries or n * 6
    for _ = 1, tries do
        if #out >= n then break end
        local x, z = rr(x0, x1), rr(z0, z1)
        if test(x, z) then
            out[#out + 1] = { x, ground(x, z) - 0.05, z, rr(0, 360), rr(sMin or 0.8, sMax or 1.2) }
        end
    end
    return out
end

local function inRegion(name, minY)
    return function(x, z)
        return map.Region(x, z) == name and ground(x, z) > (minY or map.LakeY + 0.4)
    end
end
local function farFrom(test, points, d)
    return function(x, z)
        if not test(x, z) then return false end
        for _, p in ipairs(points) do
            if (x - p.x) ^ 2 + (z - p.z) ^ 2 < d * d then return false end
        end
        return true
    end
end

local function c255(r, g, b) return { r / 255, g / 255, b / 255 } end

function M.BuildTerrain()
    local half = map.Size / 2
    M.terrain = W.terrain({ size = { map.Size, map.Size }, cell = 1, origin = { -half, -half }, height = map.HeightAt,
        splat = map.Splat, tiling = 4,
        -- 1 louka, 2 tyrkysový mech Sylvarie, 3 popel a hlína Aethelgardu, 4 skála / zkažená zem trhliny
        layers = { { color = c255(58, 104, 30) }, { color = c255(26, 92, 84) },
                   { color = c255(66, 54, 46) }, { color = c255(64, 58, 70) } } })
    -- křišťálové jezero (průzračné, tyrkysové) a vzdálené moře mlhy za horami se nevykresluje
    W.water(map.Lake.x, map.LakeY, map.Lake.z, map.Lake.r * 2.9, map.Lake.r * 2.6,
        { color = { 0.38, 0.86, 0.92 }, wave = 0.06, wavelength = 6, foam = 0.35 })
end

local avoid = {}   -- místa staveb a cest (bez stromů)

function M.BuildSylvaria()
    -- obří živý strom
    local g = map.Giant
    W.spawn("Models/nature/giant_tree.glb", g.x, ground(g.x, g.z) - 0.6, g.z, { yaw = 30, scale = 1.9,
        name = "Strom Půlměsíce", collider = "capsule" })
    W.spawn("light", g.x, ground(g.x, g.z) + 26, g.z, { light = { color = { 0.4, 0.9, 1.0 }, intensity = 140, range = 48 } })
    -- svatyně s krystalem Aetheria
    local s = map.Shrine
    W.spawn("Models/build/shrine.glb", s.x, 4.2 - 0.35, s.z, { yaw = 15, name = "Svatyně Zřídla", collider = "mesh" })
    W.spawn("light", s.x, 4.2 + 3.2, s.z, { light = { color = { 0.35, 0.8, 1.0 }, intensity = 45, range = 22 } })
    avoid[#avoid + 1] = { x = g.x, z = g.z, r = 16 }
    avoid[#avoid + 1] = { x = s.x, z = s.z, r = 10 }
    -- ruiny: oblouky a sloupy podél cesty k jezeru
    local ruins = { { -52, -8, 80, "arch" }, { -62, 18, 20, "column" }, { -58, 24, 0, "column_broken" },
                    { -96, -44, 40, "column" }, { -90, -50, 0, "column_broken" }, { -130, -6, 0, "arch" } }
    for _, r in ipairs(ruins) do
        W.spawn("Models/build/" .. r[4] .. ".glb", r[1], ground(r[1], r[2]) - 0.15, r[2], { yaw = r[3], collider = "mesh",
            name = "Ruina Zřídla" })
        avoid[#avoid + 1] = { x = r[1], z = r[2], r = 4 }
    end
    -- lucerny podél stezky (svítí v noci i za šera)
    for i = 0, 6 do
        local x, z = -40 - i * 9, -30 + sin(i * 0.9) * 6 + i * 1.5
        W.spawn("Models/build/lamp.glb", x, ground(x, z) - 0.05, z, { yaw = i * 40, name = "Lucerna" })
        W.spawn("light", x, ground(x, z) + 2.6, z + 0.5, { light = { color = { 0.4, 0.88, 1.0 }, intensity = 9, range = 9 } })
    end
    local forest = farFrom(inRegion("sylvaria"), avoid, 7)
    for k = 0, 2 do
        W.instances("Models/nature/tree_" .. k .. ".glb", scatter(55, -250, -45, -150, 170, forest, 1.1, 1.8),
            { collider = "capsule", radius = 0.35, height = 4, distance = 360, wind = 0.1 })
    end
    W.instances("Models/nature/mushroom_big.glb", scatter(18, -200, -45, -120, 140, forest, 0.8, 1.4),
        { distance = 260, collider = "capsule", radius = 0.3, height = 3 })
    W.instances("Models/nature/mushrooms.glb", scatter(260, -220, -40, -140, 150, inRegion("sylvaria"), 0.8, 1.6),
        { distance = 140, detail = true })
    W.instances("Models/nature/fern.glb", scatter(420, -230, -38, -150, 160, inRegion("sylvaria"), 0.8, 1.5),
        { distance = 110, detail = true, wind = 0.08 })
    W.instances("Models/nature/grass_teal.glb", scatter(5000, -230, -30, -150, 160, inRegion("sylvaria"), 1.3, 2.2, 9000),
        { distance = 80, detail = true, wind = 0.12 })
    W.instances("Models/nature/aetherium.glb", scatter(26, -200, -45, -120, 140, forest, 0.6, 1.3),
        { distance = 260 })
end

function M.BuildMeadow()
    -- louka a břeh jezera: tráva, kameny, pár stromů, krystaly Aetheria v mělčině
    local meadow = function(x, z)
        local r = map.Region(x, z)
        return (r == "meadow" or r == "lake") and ground(x, z) > map.LakeY + 0.35
    end
    W.instances("Models/nature/grass.glb", scatter(7000, -80, 90, -150, 120, meadow, 1.4, 2.4, 14000),
        { distance = 85, detail = true, wind = 0.14 })
    W.instances("Models/nature/tree_1.glb", scatter(26, -60, 70, -150, 110, farFrom(meadow, { map.Start, map.Lyrise }, 12), 1.0, 1.6),
        { collider = "capsule", radius = 0.35, height = 4, distance = 360, wind = 0.1 })
    for k = 0, 2 do
        W.instances("Models/nature/rock_" .. k .. ".glb", scatter(16, -90, 100, -150, 120, meadow, 0.6, 1.6),
            { distance = 260, collider = "capsule", radius = 0.8, height = 1.2 })
    end
    local shallow = function(x, z)
        local h = ground(x, z)
        return h < map.LakeY + 0.3 and h > map.LakeY - 1.6
    end
    W.instances("Models/nature/aetherium.glb", scatter(22, -60, 60, -40, 60, shallow, 0.7, 1.5), { distance = 300 })
    W.instances("Models/nature/aetherium_big.glb", { { 18, ground(18, 34) - 0.6, 34, 20, 1.0 }, { -22, ground(-22, -8) - 0.6, -8, 140, 0.8 } },
        { distance = 400 })
end

function M.BuildAethelgard()
    local t = map.Tower
    local ty = ground(t.x, t.z)
    W.spawn("Models/build/watchtower.glb", t.x, ty - 0.3, t.z, { yaw = -90, name = "Strážní věž Ocelového slunce",
        collider = "mesh" })
    W.spawn("light", t.x - 3, ty + 8.4, t.z, { light = { color = { 1.0, 0.6, 0.25 }, intensity = 40, range = 18, flicker = true } })
    avoid[#avoid + 1] = { x = t.x, z = t.z, r = 12 }
    -- palisáda půlkruhem k údolí, bedny s krystaly (palivo)
    for i = -4, 4 do
        local a = i * 0.24
        local x, z = t.x - 16 * cos(a), t.z + 16 * sin(a)
        W.spawn("Models/build/palisade.glb", x, ground(x, z) - 0.2, z, { yaw = 90 - math.deg(a), collider = "box",
            name = "Palisáda" })
    end
    for i = 0, 5 do
        local x, z = t.x - 8 + (i % 3) * 1.3, t.z + 9 + floor(i / 3) * 1.1
        W.spawn("Models/build/crate.glb", x, ground(x, z), z, { yaw = i * 17, collider = "box", name = "Bedna s Aetheriem" })
    end
    local camp = farFrom(inRegion("aethel"), avoid, 8)
    for k = 0, 2 do
        W.instances("Models/nature/pine_" .. k .. ".glb", scatter(45, 50, 250, -150, 170, camp, 0.9, 1.4),
            { collider = "capsule", radius = 0.3, height = 4, distance = 380, wind = 0.06 })
    end
    W.instances("Models/nature/rock_dark.glb", scatter(40, 50, 250, -150, 170, camp, 0.6, 1.8),
        { distance = 300, collider = "capsule", radius = 1.0, height = 1.6 })
    W.instances("Models/nature/grass_ash.glb", scatter(3000, 45, 240, -150, 170, inRegion("aethel"), 1.3, 2.0, 6000),
        { distance = 75, detail = true, wind = 0.1 })
end

function M.BuildRift()
    local r = map.Rift
    W.spawn("Models/build/rift.glb", r.x, ground(r.x, r.z) - 0.2, r.z, { yaw = 0, scale = 1.4, name = "Stínová trhlina" })
    W.spawn("light", r.x, ground(r.x, r.z) + 4, r.z, { light = { color = { 0.75, 0.3, 1.0 }, intensity = 70, range = 34, flicker = true } })
    local near = function(x, z)
        local d = sqrt((x - r.x) ^ 2 + (z - r.z) ^ 2)
        return d > 9 and d < 50
    end
    W.instances("Models/nature/umbrium.glb", scatter(40, r.x - 50, r.x + 50, r.z - 50, r.z + 50, near, 0.6, 1.6),
        { distance = 300 })
    W.instances("Models/nature/rock_dark.glb", scatter(14, r.x - 50, r.x + 50, r.z - 50, r.z + 50, near, 0.5, 1.2),
        { distance = 260 })
end

function M.Build()
    M.BuildTerrain()
    M.BuildSylvaria()
    M.BuildMeadow()
    M.BuildAethelgard()
    M.BuildRift()
end

return M

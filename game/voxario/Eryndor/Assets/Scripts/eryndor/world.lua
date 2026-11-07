-- Stavba světa Aethelgard: terén 8 x 8 km (výšková mapa, 8 povrchů ze splat map), Azure Ocean a řeka Serpentine
-- (jedna hladina v úrovni moře – voda je jen tam, kde je terén pod ní, nikdy ve vzduchu), mosty, a obsah
-- čtyř regionů podle dokumentace. Modely jsou vlastní (tools/eryndor_nature.py), rozmístění deterministické.
local map = require("eryndor.map")
local D = map.Data
local M = {}

local sin, cos, sqrt, floor, max, min, pi, rad = math.sin, math.cos, math.sqrt, math.floor, math.max, math.min, math.pi, math.rad
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

-- místa, kde nemá nic růst (stavby, cesty k nim)
local avoid = {}
local function free(x, z)
    for _, p in ipairs(avoid) do
        if (x - p.x) ^ 2 + (z - p.z) ^ 2 < p.r * p.r then return false end
    end
    return true
end

-- rozmístí n kusů v regionech `codes` (řetězec kódů mřížky), na výšce hmin..hmax a se sklonem do maxSlope
-- (1 - normála.y); okolí bodu (cx, cz, radius) nebo celý svět
-- buňky mřížky regionů podle kódu (náhodné body se berou jen z buněk daného regionu)
local cellsByCode = {}
local function cellsFor(codes)
    if cellsByCode[codes] then return cellsByCode[codes] end
    local list = {}
    for r = 1, D.Grid do
        local row = D.Rows[r]
        for c = 1, D.Grid do
            if codes:find(row:sub(c, c), 1, true) then list[#list + 1] = (r - 1) * D.Grid + (c - 1) end
        end
    end
    cellsByCode[codes] = list
    return list
end

local function scatter(n, codes, opt)
    opt = opt or {}
    local out = {}
    local half = map.Size / 2
    local cell = map.Size / D.Grid
    local cx, cz, radius = opt.x, opt.z, opt.radius
    local hmin, hmax, maxSlope = opt.hmin or 1.2, opt.hmax or 2000, opt.slope or 0.35
    local cells = cellsFor(codes)
    if #cells == 0 then return out end
    for _ = 1, n * (opt.tries or 8) do
        if #out >= n then break end
        local x, z
        if radius then
            local a, d = rr(0, 2 * pi), radius * sqrt(rnd())
            x, z = cx + cos(a) * d, cz + sin(a) * d
        else
            local i = cells[floor(rnd() * #cells) + 1]
            x = (i % D.Grid + rnd()) * cell - half
            z = (floor(i / D.Grid) + rnd()) * cell - half
        end
        if codes:find(map.Region(x, z), 1, true) and free(x, z) then
            local h, ny = map.Ground(x, z)
            if h >= hmin and h <= hmax and 1 - ny <= maxSlope and (not opt.test or opt.test(x, z, h)) then
                out[#out + 1] = { x, h - (opt.sink or 0.05), z, rr(0, 360), rr(opt.smin or 0.8, opt.smax or 1.2) }
            end
        end
    end
    return out
end
M.Scatter = scatter

local function c255(r, g, b) return { r / 255, g / 255, b / 255 } end

function M.BuildTerrain()
    local half = map.Size / 2
    M.terrain = W.terrain({ size = { map.Size, map.Size }, cell = 2, origin = { -half, -half },
        heightmap = "Terrain/aethelgard_height.png", base_height = D.HeightBase, height_scale = D.HeightRange,
        detail = 0.45, detail_scale = 0.16,
        splatmap = "Terrain/aethelgard_splat0.png", splatmap2 = "Terrain/aethelgard_splat1.png", tiling = 5,
        -- textury z listu přírodních textur (tools/eryndor_textures.sh); barva = záloha bez textury
        layers = { { texture = "Textures/terrain/trava.jpg", color = c255(58, 104, 30) },      -- 1 tráva (louky, Verdant)
                   { texture = "Textures/terrain/zeme.jpg", color = c255(66, 54, 46) },        -- 2 lesní půda a hlína
                   { texture = "Textures/terrain/pisek.jpg", color = c255(200, 180, 130) },    -- 3 písek (pláže, břehy)
                   { texture = "Textures/terrain/skala.jpg", color = c255(110, 100, 90) },     -- 4 skála (svahy)
                   { texture = "Textures/terrain/snih_led.jpg", color = c255(230, 236, 245) }, -- 5 sníh a led (Frostfang)
                   { texture = "Textures/terrain/lava.jpg", color = c255(240, 100, 20), emissive = 7 },   -- 6 láva (svítí)
                   { texture = "Textures/terrain/cedic.jpg", color = c255(50, 44, 44) },       -- 7 čedič a popel (Ignis)
                   { texture = "Textures/terrain/ametyst.jpg", color = c255(140, 80, 180) } } }) -- 8 ametyst (Crystalarium)
    -- Azure Ocean + Serpentine River: jedna hladina v úrovni moře kolem kamery až k obzoru; voda se kreslí jen tam,
    -- kde je terén pod hladinou (koryto řeky je vyhloubené pod úroveň moře), dno mělčin je písek
    W.water(0, map.SeaY, 0, 1200, 1200, { color = { 0.32, 0.72, 0.95 }, wave = 0.22, wavelength = 11, foam = 0.45,
        shallow = 6, bed = "Textures/terrain/pisek.jpg" })
end

-- mosty přes Serpentine River (dřevěná mostovka na kamenných pilířích, s kolizí)
function M.BuildBridges()
    for _, b in ipairs(D.Bridges) do
        local y = map.SeaY + 2.2
        W.spawn("cube", b.x, y, b.z, { size = { 7, 0.5, b.length }, rotation = { 0, b.yaw, 0 }, color = c255(110, 78, 48),
            collider = "box", name = "Most přes Serpentine" })
        local dx, dz = sin(rad(b.yaw)), cos(rad(b.yaw))
        for k = -1, 1, 2 do   -- zábradlí
            local ox, oz = cos(rad(b.yaw)) * 3.3 * k, -sin(rad(b.yaw)) * 3.3 * k
            W.spawn("cube", b.x + ox, y + 0.75, b.z + oz, { size = { 0.25, 1.0, b.length }, rotation = { 0, b.yaw, 0 },
                color = c255(90, 62, 38), collider = "box" })
        end
        local piles = floor(b.length / 18)
        for i = 0, piles do   -- pilíře
            local t = (i / max(piles, 1) - 0.5) * (b.length - 6)
            local px, pz = b.x + dx * t, b.z + dz * t
            W.spawn("cylinder", px, map.SeaY - 6, pz, { size = { 1.6, 8.4, 1.6 }, color = c255(120, 116, 108) })
        end
        avoid[#avoid + 1] = { x = b.x, z = b.z, r = b.length * 0.5 + 6 }
    end
end

-- hraniční základna Aethelgardu (start): věž, palisáda, lucerny
function M.BuildOutpost()
    local t = map.Tower
    local ty = ground(t.x, t.z)
    W.spawn("Models/build/watchtower.glb", t.x, ty - 0.3, t.z, { yaw = -90, name = "Strážní věž Serpentine", collider = "mesh" })
    W.spawn("light", t.x - 3, ty + 8.4, t.z, { light = { color = { 1.0, 0.6, 0.25 }, intensity = 40, range = 18, flicker = true } })
    for i = -4, 4 do
        local a = i * 0.24
        local x, z = t.x - 16 * cos(a), t.z + 16 * sin(a)
        W.spawn("Models/build/palisade.glb", x, ground(x, z) - 0.2, z, { yaw = 90 - math.deg(a), collider = "box", name = "Palisáda" })
    end
    for i = 0, 5 do
        local x, z = t.x - 8 + (i % 3) * 1.3, t.z + 9 + floor(i / 3) * 1.1
        W.spawn("Models/build/crate.glb", x, ground(x, z), z, { yaw = i * 17, collider = "box", name = "Bedna s Aetheriem" })
    end
    local s = map.Start
    for i = 0, 5 do   -- lucerny kolem tábora
        local a = i / 6 * 2 * pi
        local x, z = s.x + cos(a) * 14, s.z + sin(a) * 14
        W.spawn("Models/build/lamp.glb", x, ground(x, z) - 0.05, z, { yaw = i * 60, name = "Lucerna" })
        W.spawn("light", x, ground(x, z) + 2.6, z, { light = { color = { 1.0, 0.75, 0.4 }, intensity = 9, range = 10 } })
    end
    avoid[#avoid + 1] = { x = t.x, z = t.z, r = 22 }
    avoid[#avoid + 1] = { x = s.x, z = s.z, r = 16 }
    avoid[#avoid + 1] = { x = map.Lyrise.x, z = map.Lyrise.z, r = 6 }
end

-- Verdant Canopy: prastaré husté lesy, tisícileté stromy, elfí svatyně a ruiny zarostlé mechem
function M.BuildVerdant()
    local g = map.Giant
    W.spawn("Models/nature/giant_tree.glb", g.x, ground(g.x, g.z) - 0.6, g.z, { yaw = 30, scale = 2.1,
        name = "Tisíciletý strom", collider = "capsule" })
    W.spawn("light", g.x, ground(g.x, g.z) + 28, g.z, { light = { color = { 0.7, 1.0, 0.55 }, intensity = 160, range = 55 } })
    local s = map.Shrine
    W.spawn("Models/build/shrine.glb", s.x, ground(s.x, s.z) - 0.35, s.z, { yaw = 15, name = "Elfí svatyně", collider = "mesh" })
    W.spawn("light", s.x, ground(s.x, s.z) + 3.2, s.z, { light = { color = { 0.5, 1.0, 0.6 }, intensity = 45, range = 22 } })
    avoid[#avoid + 1] = { x = g.x, z = g.z, r = 20 }
    avoid[#avoid + 1] = { x = s.x, z = s.z, r = 12 }
    -- ruiny kolem svatyně a cesty
    local ruins = { "arch", "column", "column_broken", "column", "arch", "column_broken" }
    for i, r in ipairs(ruins) do
        local a = i / #ruins * 2 * pi
        local x, z = s.x + cos(a) * (18 + i * 3), s.z + sin(a) * (18 + i * 3)
        W.spawn("Models/build/" .. r .. ".glb", x, ground(x, z) - 0.15, z, { yaw = i * 47, collider = "mesh", name = "Elfí ruina" })
        avoid[#avoid + 1] = { x = x, z = z, r = 4 }
    end
    -- další obří stromy rozeseté lesem
    local giants = scatter(24, "v", { hmin = 4, slope = 0.18, smin = 1.6, smax = 2.4 })
    W.instances("Models/nature/giant_tree.glb", giants, { collider = "capsule", radius = 2.4, height = 16, distance = 1500 })
    for k = 0, 2 do
        W.instances("Models/nature/tree_" .. k .. ".glb", scatter(6000, "v", { hmin = 2.5, slope = 0.32, smin = 1.1, smax = 2.2 }),
            { collider = "capsule", radius = 0.35, height = 4, distance = 550, wind = 0.1 })
    end
    W.instances("Models/nature/fern.glb", scatter(9000, "v", { hmin = 2.5, smin = 0.8, smax = 1.6 }),
        { distance = 110, detail = true, wind = 0.08 })
    W.instances("Models/nature/mushrooms.glb", scatter(2500, "v", { hmin = 2.5 }), { distance = 120, detail = true })
    W.instances("Models/nature/mushroom_big.glb", scatter(300, "v", { hmin = 2.5, smin = 0.8, smax = 1.5 }),
        { distance = 260, collider = "capsule", radius = 0.3, height = 3 })
    W.instances("Models/nature/grass.glb", scatter(30000, "v", { hmin = 2.0, smin = 1.3, smax = 2.2, tries = 3 }),
        { distance = 85, detail = true, wind = 0.14 })
end

-- louky kolem řeky (střed kontinentu) a pobřeží
function M.BuildMeadows()
    W.instances("Models/nature/grass.glb", scatter(40000, "m", { hmin = 2.0, smin = 1.3, smax = 2.4, tries = 3 }),
        { distance = 85, detail = true, wind = 0.14 })
    W.instances("Models/nature/tree_1.glb", scatter(700, "m", { hmin = 3, slope = 0.25, smin = 1.0, smax = 1.7 }),
        { collider = "capsule", radius = 0.35, height = 4, distance = 600, wind = 0.1 })
    for k = 0, 2 do
        W.instances("Models/nature/rock_" .. k .. ".glb", scatter(350, "mbv", { hmin = 0.5, smin = 0.6, smax = 2.0, slope = 0.5 }),
            { distance = 400, collider = "capsule", radius = 0.8, height = 1.2 })
    end
end

-- Frostfang Peaks: zasněžené štíty, smrky na nižších svazích, zamrzlé jezero (led = povrch terénu, žádná voda)
function M.BuildFrostfang()
    for k = 0, 2 do
        W.instances("Models/nature/pine_" .. k .. ".glb", scatter(1800, "f", { hmin = 3, hmax = 240, slope = 0.35, smin = 0.9, smax = 1.5 }),
            { collider = "capsule", radius = 0.3, height = 4, distance = 700, wind = 0.06 })
    end
    W.instances("Models/nature/rock_dark.glb", scatter(900, "fk", { hmin = 3, slope = 0.6, smin = 0.8, smax = 2.6 }),
        { distance = 450, collider = "capsule", radius = 1.0, height = 1.6 })
    W.instances("Models/nature/aetherium.glb", scatter(160, "fk", { x = map.FrozenLake.x, z = map.FrozenLake.z, radius = 520,
        hmin = 140, slope = 0.4, smin = 1.2, smax = 2.6 }), { distance = 500 })
    local l = map.FrozenLake
    W.spawn("light", l.x, l.y + 12, l.z, { light = { color = { 0.6, 0.85, 1.0 }, intensity = 80, range = 70 } })
end

-- Ignis Scar: čedičová pustina, sopky s krátery a řeky lávy (svítící povrch terénu), žhnoucí světla
function M.BuildIgnis()
    W.instances("Models/nature/rock_dark.glb", scatter(3200, "il", { hmin = 3, slope = 0.7, smin = 0.8, smax = 3.2 }),
        { distance = 500, collider = "capsule", radius = 1.0, height = 1.6 })
    W.instances("Models/nature/grass_ash.glb", scatter(9000, "i", { hmin = 3, slope = 0.4, smin = 1.2, smax = 2.0, tries = 3 }),
        { distance = 75, detail = true, wind = 0.1 })
    for _, v in ipairs(D.Volcanoes) do
        local y = ground(v.x, v.z)
        W.spawn("light", v.x, y + 25, v.z, { light = { color = { 1.0, 0.42, 0.1 }, intensity = 400, range = 160, flicker = true } })
    end
    -- žár podél lávových řek
    local lava = scatter(70, "l", { hmin = 3, slope = 1.0, tries = 40 })
    for _, p in ipairs(lava) do
        W.spawn("light", p[1], p[2] + 3, p[3], { light = { color = { 1.0, 0.45, 0.12 }, intensity = 35, range = 26, flicker = true } })
    end
end

-- Crystalarium: gigantické zářící krystaly (fialová, růžová, azurová), magické světlo, Stínová trhlina
function M.BuildCrystalarium()
    local r = map.Rift
    W.spawn("Models/build/rift.glb", r.x, ground(r.x, r.z) - 0.2, r.z, { yaw = 0, scale = 1.6, name = "Stínová trhlina" })
    W.spawn("light", r.x, ground(r.x, r.z) + 4, r.z, { light = { color = { 0.75, 0.3, 1.0 }, intensity = 90, range = 40, flicker = true } })
    avoid[#avoid + 1] = { x = r.x, z = r.z, r = 70 }
    W.instances("Models/nature/umbrium.glb", scatter(1400, "c", { hmin = 3, slope = 0.5, smin = 1.5, smax = 7.0 }),
        { distance = 900 })
    W.instances("Models/nature/aetherium.glb", scatter(1400, "c", { hmin = 3, slope = 0.5, smin = 1.0, smax = 3.5 }),
        { distance = 600 })
    W.instances("Models/nature/aetherium_big.glb", scatter(320, "c", { hmin = 3, slope = 0.45, smin = 4.0, smax = 10.0, sink = 1.5 }),
        { distance = 2500 })
    W.instances("Models/nature/grass_teal.glb", scatter(9000, "c", { hmin = 3, smin = 1.2, smax = 2.0, tries = 3 }),
        { distance = 80, detail = true, wind = 0.12 })
    local glow = scatter(40, "c", { hmin = 3, slope = 0.5, tries = 20 })
    for i, p in ipairs(glow) do
        local col = i % 3 == 0 and { 0.3, 0.9, 1.0 } or (i % 3 == 1 and { 0.85, 0.35, 1.0 } or { 1.0, 0.4, 0.75 })
        W.spawn("light", p[1], p[2] + 6, p[3], { light = { color = col, intensity = 70, range = 45 } })
    end
end

function M.Build()
    M.BuildTerrain()
    M.BuildBridges()
    M.BuildOutpost()
    M.BuildVerdant()
    M.BuildMeadows()
    M.BuildFrostfang()
    M.BuildIgnis()
    M.BuildCrystalarium()
end

return M

-- Stavba světa 1. aktu (WorldBuilder.cs, TerrainBuilder.cs, Scenery.cs, DesertScenery.cs):
-- terén (sever + jih), moře, oáza, Kalidra s hradbami a budovami, NPC, zvířata a krajina.
local map = require("ashes.worldmap")
local pose = require("ashes.pose")

local M = { npcs = {}, animals = {}, fires = {} }

local Ground, HeightAt, Step = map.Ground, map.HeightAt, map.Step
local sqrt, sin, cos, abs, min, max, floor = math.sqrt, math.sin, math.cos, math.abs, math.min, math.max, math.floor

local function c255(r, g, b) return { r / 255, g / 255, b / 255 } end
local function dist(ax, az, bx, bz) return sqrt((ax - bx) ^ 2 + (az - bz) ^ 2) end

-- ---------------------------------------------------------------- terén (TerrainBuilder.cs)
-- Unity: slope = |grad h|; engine dává 1 - n.y -> převod na sklon
local function gradient(slope)
    local ny = 1 - slope
    if ny <= 0.01 then return 10 end
    return sqrt(1 / (ny * ny) - 1)
end

local function northWeights(x, z, h, slope)
    local w0, w1, w2, w3, w4, w5 = 0, 0, 0, 0, 0, 0
    local n = map.Fbm(x * 0.08 + 3, z * 0.08)
    if map.InCity(x, z) then w5 = 1
    elseif h < 1.1 then w2 = 1
    else
        local function ss(a, b, t) local u = map.Clamp01((t - a) / (b - a)); return u * u * (3 - 2 * u) end
        local dry = ss(0.35, 0.7, n)
        dry = max(dry, ss(104, 130, z))
        w0, w1 = 1 - dry, dry
        local g = gradient(slope)
        local rock = max(map.Clamp01((h - 5) / 6), map.Clamp01((g - 0.18) / 0.24))
        rock = rock * (1 - ss(118, 132, z))
        w0, w1, w3 = w0 * (1 - rock), w1 * (1 - rock), rock
        local rd = map.RoadDistance(x, z)
        if rd < 2.8 then
            local r = 1 - map.Clamp01((rd - 1.4) / 1.4)
            w0, w1, w3, w4 = w0 * (1 - r), w1 * (1 - r), w3 * (1 - r), r
        end
    end
    local sum = w0 + w1 + w2 + w3 + w4 + w5
    if sum <= 0 then return 1, 0, 0, 0 end
    return w0 / sum, (w1 + w4) / sum, w2 / sum, (w3 + w5) / sum
end

local function southWeights(x, z, h, slope)
    local dry, beach, rock, sand = 0, 0, 0, 0
    local function ss(a, b, t) local u = map.Clamp01((t - a) / (b - a)); return u * u * (3 - 2 * u) end
    local n = map.Fbm(x * 0.08 + 3, z * 0.08)
    local desert = ss(140, 196, z)
    local canyon = map.PathDistance(x, z, map.CanyonPath)
    if h < 1.1 then beach = 1
    else
        sand = map.Clamp01(desert + (n - 0.5) * 0.6)
        if canyon < 6 then sand = max(sand, 0.7) end
        dry = 1 - sand
        local g = gradient(slope)
        rock = max(map.Clamp01((g - 0.2) / 0.25), map.Clamp01((h - 9) / 4) * (1 - map.Clamp01((0.12 - g) / 0.07) * 0.5))
        if dist(x, z, map.Oasis.x, map.Oasis.z) < map.OasisR + 7 then dry, sand, rock = 1, 0, rock * 0.3 end
        dry, sand = dry * (1 - rock), sand * (1 - rock)
    end
    local sum = dry + beach + rock + sand
    if sum <= 0 then return 0, 0, 0, 1 end
    return dry / sum, beach / sum, rock / sum, sand / sum
end

function M.BuildTerrain()
    -- sever (pobřeží Kalidry) 270 x 270 m a jih (Solný průsmyk, Rudé písky) – okraje přesně navazují
    M.north = world.terrain({ size = { 270, 270 }, cell = 1, origin = { -135, -135 }, height = HeightAt,
        splat = northWeights, tiling = 4,
        layers = { { color = c255(80, 95, 44) }, { color = c255(140, 116, 78) },
                   { color = c255(195, 172, 131) }, { color = c255(150, 142, 126) } } })
    M.south = world.terrain({ size = { 270, map.SouthEdge - 135 }, cell = 1, origin = { -135, 135 }, height = HeightAt,
        splat = southWeights, tiling = 5,
        layers = { { color = c255(140, 116, 78) }, { color = c255(195, 172, 131) },
                   { color = c255(156, 92, 62) }, { color = c255(214, 160, 104) } } })
    -- moře (sleduje kameru až k obzoru) a oáza s vlastní hladinou
    world.water(0, 0.02, 100, 2000, 2000, { color = { 0.55, 0.85, 0.95 }, wave = 0.22, wavelength = 13 })
    world.water(map.Oasis.x, map.OasisWater, map.Oasis.z, (map.OasisR + 2.5) * 2, (map.OasisR + 2.5) * 2,
        { color = { 0.45, 0.8, 0.8 }, wave = 0.03, wavelength = 4, foam = 0.25 })
end

-- ---------------------------------------------------------------- Kalidra (WorldBuilder.BuildCity)
local WALL = { 0.93, 0.9, 0.84 }
local ROOF = { 0.72, 0.33, 0.2 }

local function wall(x, z, w, d, baseY, h)
    h = h or 6
    world.spawn("cube", x, baseY + h / 2 - 0.5, z, { size = { w, h, d }, color = WALL, collider = "box", name = "Hradba" })
end

local function faceTo(x, z, tx, tz)
    local a = math.atan(tx - x, tz - z)
    return floor(a / (math.pi / 2) + 0.5) * (math.pi / 2)
end

local function placeModel(path, x, z, w, d, face, name)
    world.spawn(path, x, Ground(x, z) - 0.08, z, { fit_footprint = { w, d }, yaw = map.FaceToYaw(face),
        collider = "box", name = name, lod = "auto", lod_distance = 45 })
end

function M.BuildCity()
    local y = map.CityHeight
    wall(52, -1.5, 1.6, 25, y)
    wall(52, 31.5, 1.6, 25, y)
    wall(75, -14, 46, 1.6, y)
    wall(75, 44, 46, 1.6, y)
    wall(98, 15, 1.6, 58, y, 3.6)
    for _, b in ipairs(map.Buildings) do
        local key = b.kind == "house" and "villa" or (b.kind == "temple" and "temple" or nil)
        if key then
            local big = b.kind == "temple" and 2 or 0
            placeModel("Models/buildings/" .. key .. ".glb", b.x, b.z, b.w + big, b.d + big, faceTo(b.x, b.z, 74, 15), b.kind)
        else
            local p = Ground(b.x, b.z)
            world.spawn("cube", b.x, p + b.h / 2 - 0.2, b.z, { size = { b.w, b.h, b.d }, color = WALL, collider = "box", name = b.kind })
            world.spawn("cube", b.x, p + b.h - 0.2 + b.h * 0.05, b.z, { size = { b.w * 1.08, b.h * 0.12, b.d * 1.08 }, color = ROOF })
        end
    end
    for _, s in ipairs(map.MarketStalls) do
        placeModel("Models/buildings/stall.glb", s.x, s.z, 3.2, 3.2, faceTo(s.x, s.z, 74, 15), "Stánek")
    end
    -- kašna na agoře
    world.spawn("cylinder", 74, Ground(74, 15) + 0.2, 15, { size = { 5, 0.4, 5 }, color = WALL, collider = "box", name = "Kašna" })
end

-- ---------------------------------------------------------------- postavy (WorldBuilder.BuildNpcs)
function M.BuildNpcs(faction)
    M.npcs = {}
    for _, n in ipairs(map.Npcs) do
        if n.faction == faction then
            local fem = n.id == "thalia" or n.id == "sabra"
            local h = (n.id == "eryon" or n.id == "azkar") and 1.85 or (fem and 1.55 or 1.62)
            local model = "Models/heroes/" .. n.cls .. "_" .. (fem and "f" or "m") .. ".glb"
            local id = world.spawn(model, n.x, Ground(n.x, n.z), n.z, { fit = h, yaw = map.FaceToYaw(n.face),
                lod = "auto", lod_distance = 30, name = n.name, tag = "npc" })
            -- kapsle proti procházení (statická)
            world.spawn("cylinder", n.x, Ground(n.x, n.z) + h / 2, n.z, { size = { 0.7, h, 0.7 }, visible = false,
                collider = "capsule", name = n.name .. " (kolize)", tag = "npc" })
            M.npcs[#M.npcs + 1] = { id = id, def = n, height = h, x = n.x, z = n.z }
        end
    end
end

-- ---------------------------------------------------------------- zvířata (WorldBuilder.BuildAnimals + Wanderer)
local HERDS = {
    { "sheep", -30, 44, 10, 6, 0.95 }, { "sheep", 10, 40, 9, 5, 0.95 }, { "cow", 26, 18, 9, 4, 1.45 },
    { "goat", -14, -48, 10, 5, 1.05 }, { "stag", -40, 6, 14, 2, 2.1 }, { "doe", -40, 6, 14, 3, 1.45 },
    { "boar", -54, 10, 10, 3, 0.85 }, { "horse", 52, -58, 6, 4, 1.75 }, { "dog", -48, 46, 6, 1, 0.65 },
    { "chicken", 80, 22, 5, 5, 0.45 }, { "gull", -64, 40, 10, 4, 0.5 },
}
local YAW_FIX = { chicken = -90 }
local QUAD = { dog = true, horse = true, sheep = true, cow = true, goat = true, stag = true, doe = true, boar = true }

function M.BuildAnimals()
    local R = map.Rng(4242)
    M.animals = {}
    for _, h in ipairs(HERDS) do
        local kind, hx, hz, range, count, size = table.unpack(h)
        for _ = 1, count do
            local x, z = hx + (R() - 0.5) * range, hz + (R() - 0.5) * range
            local yaw = R() * 360
            local id = world.spawn("Models/animals/" .. kind .. ".glb", x, Ground(x, z), z,
                { fit = size, yaw = yaw + (YAW_FIX[kind] or 0), name = kind, tag = "animal" })
            M.animals[#M.animals + 1] = { id = id, kind = kind, x = x, z = z, home = { hx, hz }, range = range,
                speed = (kind == "dog" or kind == "horse") and 1.6 or 0.8, yaw = yaw, wait = R() * 5,
                tx = x, tz = z, rng = map.Rng(math.floor(x * 1000 + z) & 0xFFFF) }
        end
    end
end

-- Toulání kolem domova (Wanderer.cs)
function M.UpdateAnimals(frameDt)
    local vx, vz = M.viewerX or 0, M.viewerZ or 0
    for _, a in ipairs(M.animals) do
        -- vzdálená zvířata 4× za sekundu
        local dt = frameDt
        if (a.x - vx) ^ 2 + (a.z - vz) ^ 2 > 70 * 70 then
            a.acc = (a.acc or 0) + frameDt
            if a.acc < 0.25 then goto continue end
            dt, a.acc = a.acc, 0
        end
        do
        local dx, dz = a.tx - a.x, a.tz - a.z
        local d = sqrt(dx * dx + dz * dz)
        if d < 0.3 then
            a.wait = a.wait - dt
            if a.wait <= 0 then
                local ang, r = a.rng() * math.pi * 2, sqrt(a.rng()) * a.range
                a.tx, a.tz = a.home[1] + cos(ang) * r, a.home[2] + sin(ang) * r
                if HeightAt(a.tx, a.tz) < 0.5 then a.tx, a.tz = a.home[1], a.home[2] end
                a.wait = 2 + a.rng() * 6
            end
        else
            local step = math.min(a.speed * dt, d)
            a.x, a.z = a.x + dx / d * step, a.z + dz / d * step
            local want = math.deg(math.atan(dx, dz))
            local diff = (want - a.yaw + 540) % 360 - 180
            a.yaw = a.yaw + diff * (1 - math.exp(-6 * dt))
            -- krok: čtyřnožci střídají diagonální páry (LegRig.cs), drůbež se jen pohupuje
            a.phase = (a.phase or 0) + dt * a.speed * 6
            local bob = abs(sin(a.phase)) * 0.04
            if QUAD[a.kind] then pose.Gait(a.id, a.phase, a.speed, pose.QuadOptions, a.speed) end
            entity.set_position(a.id, a.x, Ground(a.x, a.z) + bob, a.z)
            entity.set_rotation(a.id, 0, a.yaw + (YAW_FIX[a.kind] or 0), 0)
            a.walking = true
        end
        if d < 0.3 and a.walking then
            a.walking = false
            if QUAD[a.kind] then pose.Gait(a.id, 0, 0) end
        end
        end
        ::continue::
    end
end

-- ---------------------------------------------------------------- krajina (Scenery.cs – stejný generátor)
local SPAWNS = { map.SpawnKalidra, map.SpawnLegie }
local BEACONS = { { -22, -58 }, { 2, -72 }, { 28, -60 } }
local CAMP = { 60, -68 }
local CAMP_R = 20
local COURSE = { { 0, 15 }, { 30, -15 }, { 45, 25 }, { -5, 40 } }

local function segDist(px, pz, ax, az, bx, bz)
    return map.SegDist(px, pz, { x = ax, z = az }, { x = bx, z = bz })
end

local function treeOk(x, z)
    local h = HeightAt(x, z)
    if h < 1 or h > 14 then return false end
    if z > 112 + map.Fbm(x * 0.1, 9) * 10 then return false end
    if map.RoadDistance(x, z) < 4 then return false end
    local c = map.City
    if x > c.xMin - 6 and x < c.xMax + 4 and z > c.yMin - 6 and z < c.yMax + 6 then return false end
    if dist(x, z, CAMP[1], CAMP[2]) < CAMP_R - 4 then return false end
    for _, n in ipairs(map.Npcs) do if dist(x, z, n.x, n.z) < 9 then return false end end
    for _, s in ipairs(SPAWNS) do if dist(x, z, s.x, s.z) < 12 then return false end end
    for _, b in ipairs(BEACONS) do if dist(x, z, b[1], b[2]) < 5 then return false end end
    if dist(x, z, 20, 50) < 11 then return false end
    for i = 1, #COURSE do
        local a, b = COURSE[i], COURSE[i % #COURSE + 1]
        if segDist(x, z, a[1], a[2], b[1], b[2]) < 3.5 then return false end
    end
    if segDist(x, z, -64, 24, -15, -10) < 3 then return false end
    return true
end

-- ------------------------------------------------------------------ koruny stromů pro kameru
-- Kolizi mají jen kmeny; kamera se ale nesmí zanořit ani do koruny. Koruna = svislý válec.
local CELL = 8
local canopyGrid = {}
local function cellKey(cx, cz) return cx * 4096 + cz end
function M.AddCanopy(x, z, y0, y1, r)
    local c = { x = x, z = z, y0 = y0, y1 = y1, r = r }
    for cx = floor((x - r) / CELL), floor((x + r) / CELL) do
        for cz = floor((z - r) / CELL), floor((z + r) / CELL) do
            local k = cellKey(cx, cz)
            local list = canopyGrid[k]
            if not list then list = {}; canopyGrid[k] = list end
            list[#list + 1] = c
        end
    end
end

-- Nejbližší koruna k bodu (samotest kamery)
function M.NearestCanopy(x, z)
    local best, bd
    for _, list in pairs(canopyGrid) do
        for _, c in ipairs(list) do
            local d = (c.x - x) ^ 2 + (c.z - z) ^ 2
            if not bd or d < bd then best, bd = c, d end
        end
    end
    return best
end

-- Kde úsečka A→B poprvé vstoupí do koruny: t v 0..1, nebo nil
function M.CanopyHit(ax, ay, az, bx, by, bz)
    local dx, dy, dz = bx - ax, by - ay, bz - az
    local best
    local seen = {}
    local x0, x1 = math.min(ax, bx), math.max(ax, bx)
    local z0, z1 = math.min(az, bz), math.max(az, bz)
    for cx = floor(x0 / CELL), floor(x1 / CELL) do
        for cz = floor(z0 / CELL), floor(z1 / CELL) do
            for _, c in ipairs(canopyGrid[cellKey(cx, cz)] or {}) do
                if not seen[c] then
                    seen[c] = true
                    local ox, oz = ax - c.x, az - c.z
                    local qa = dx * dx + dz * dz
                    local qb = 2 * (ox * dx + oz * dz)
                    local qc = ox * ox + oz * oz - c.r * c.r
                    -- hráč stojí pod korunou: pohled zespodu nevadí, jen průchod korunou
                    local t
                    if qc <= 0 then
                        if ay < c.y0 and dy > 0 then t = (c.y0 - ay) / dy
                        elseif ay > c.y1 and dy < 0 then t = (c.y1 - ay) / dy end
                    elseif qa > 1e-6 then
                        local disc = qb * qb - 4 * qa * qc
                        if disc >= 0 then
                            local sq = math.sqrt(disc)
                            local tin, tout = (-qb - sq) / (2 * qa), (-qb + sq) / (2 * qa)
                            local yin = ay + dy * tin
                            if yin >= c.y0 and yin <= c.y1 then t = tin
                            else
                                -- vstup víkem nebo dnem válce
                                local cap = (yin > c.y1) and c.y1 or c.y0
                                if math.abs(dy) > 1e-6 then
                                    local tc = (cap - ay) / dy
                                    if tc >= tin and tc <= tout then t = tc end
                                end
                            end
                        end
                    end
                    if t and t >= 0 and t <= 1 and (not best or t < best) then best = t end
                end
            end
        end
    end
    return best
end

function M.BuildScenery(quality)
    quality = quality or 2
    local half = map.WorldHalf
    local R = map.Rng(1234)
    local density = quality == 0 and 0.45 or (quality == 1 and 0.7 or 1)

    local function place(count)
        local list, placed, tries = {}, 0, 0
        while placed < count and tries < count * 20 do
            tries = tries + 1
            local x, z = (R() - 0.5) * half * 2, (R() - 0.5) * half * 2
            local s = 0.7 + R() * 0.45
            local yaw = R() * 360
            local sy = s * (0.9 + R() * 0.4)
            if treeOk(x, z) then
                list[#list + 1] = { x, Ground(x, z) - 0.1, z, yaw, s, sy, s }
                placed = placed + 1
            end
        end
        return list
    end
    local cypress = place(floor(520 * density + 0.5))
    local olive = place(floor(380 * density + 0.5))
    -- koruny pro kolizi kamery (rozměry z tools/make_scenery_models.py)
    for _, t in ipairs(cypress) do M.AddCanopy(t[1], t[3], t[2] + 0.9 * t[6], t[2] + 5.5 * t[6], 0.72 * t[5]) end
    for _, t in ipairs(olive) do M.AddCanopy(t[1], t[3], t[2] + 1.6 * t[6], t[2] + 4.0 * t[6], 1.7 * t[5]) end
    world.instances("Models/scenery/cypress.gltf", cypress, { collider = "capsule", radius = 0.25, height = 3, distance = 320, wind = 0.12 })
    world.instances("Models/scenery/olive.gltf", olive, { collider = "capsule", radius = 0.35, height = 2.5, distance = 320, wind = 0.08 })

    -- kameny (stejné pořadí volání generátoru jako v Unity)
    local rocks = {}
    for _ = 1, 420 do
        local x, z = (R() - 0.5) * half * 2, (R() - 0.5) * half * 2
        local h = HeightAt(x, z)
        local s = 0.3 + R() * (h > 6 and 1.6 or 0.8)
        local rx, ry, rz = R() * 180, R() * 360, R() * 180
        if not (h < 0.2 or map.InCity(x, z) or map.RoadDistance(x, z) < 3 or z > 120) then
            rocks[#rocks + 1] = { x, h + s * 0.2, z, ry, s, s * 0.7, s, rx, rz }
        end
    end
    world.instances("Models/scenery/rock.gltf", rocks, { distance = 180 })

    -- tráva (jen blízko kamery)
    -- hodně trávy: hustotu za běhu ztenčí nastavení (graphics.detail_density)
    local grassN = quality == 0 and 7000 or (quality == 1 and 12000 or (quality == 2 and 20000 or 28000))
    local grass, placed = {}, 0
    for _ = 1, grassN * 3 do
        if placed >= grassN then break end
        local x, z = (R() - 0.5) * 200, (R() - 0.5) * 200
        local h = HeightAt(x, z)
        local sy, yaw = 0.7 + R() * 0.8, R() * 360
        if not (h < 0.9 or h > 9 or map.InCity(x, z) or map.RoadDistance(x, z) < 2.4 or z > 112) then
            grass[#grass + 1] = { x, h - 0.02, z, yaw, 1, sy, 1 }
            placed = placed + 1
        end
    end
    world.instances("Models/scenery/grass.gltf", grass, { distance = 75, detail = true, wind = 0.12 })
    -- zelené keře na severu (louky, okraje lesa)
    local bushes = {}
    for _ = 1, floor(900 * density + 0.5) * 3 do
        if #bushes >= floor(900 * density + 0.5) then break end
        local x, z = (R() - 0.5) * half * 2, (R() - 0.5) * half * 2
        local h = HeightAt(x, z)
        local s, yaw = 0.6 + R() * 0.8, R() * 360
        if h > 1.0 and h < 11 and z < 108 and not map.InCity(x, z) and map.RoadDistance(x, z) > 3 then
            bushes[#bushes + 1] = { x, h - 0.05, z, yaw, s }
        end
    end
    world.instances("Models/scenery/bush_green.gltf", bushes, { distance = 120, detail = true, wind = 0.06 })

    M.BuildAqueduct()
    M.BuildShips()
    M.BuildCamp()
end

-- akvadukt: pilíře s oblouky, některé rozbité
function M.BuildAqueduct()
    local ax, az, bx, bz = -64, 24, -15, -10
    local len = dist(ax, az, bx, bz)
    local n = floor(len / 5)
    local dx, dz = (bx - ax) / len, (bz - az) / len
    local yaw = math.deg(math.atan(dx, dz))
    for i = 0, n do
        local t = i / n
        local x, z = ax + (bx - ax) * t, az + (bz - az) * t
        local broken = sin(i * 12.9898) > 0.55
        local h = broken and (3 + abs(sin(i * 7)) * 3) or 8
        local y = HeightAt(x, z) - 0.3
        world.spawn("cube", x, y + h / 2, z, { size = { 1.4, h, 1.4 }, yaw = yaw, color = { 0.78, 0.75, 0.68 }, collider = "box" })
        if not broken and i < n then
            world.spawn("cube", x + dx * 2.5, y + h - 0.2 + 0.3, z + dz * 2.5, { size = { 1.6, 1.2, 5 }, yaw = yaw, color = { 0.78, 0.75, 0.68 } })
        end
    end
end

-- vraky na Bezejmenném břehu a černé lodě Legie v zátoce
function M.BuildShips()
    for _, w in ipairs({ { -71, 60, 0.6 }, { -68, 74, 2.2 }, { -73, 46, 1.2 } }) do
        local x, z, r = w[1], w[2], w[3]
        world.spawn("cube", x, Ground(x, z) + 0.2, z, { size = { 2.6, 1.1, 7 }, rotation = { 0, math.deg(r), -25 }, color = { 0.6, 0.48, 0.36 } })
    end
    M.ships = {}
    for _, s in ipairs({ { -66, -78, 0.4 }, { -74, -68, 1.0 }, { -58, -86, 0.9 }, { -78, -82, 0.6 } }) do
        local x, z, r = s[1], s[2], s[3]
        -- trup s přídí (jehlan), stěžeň a plachta jako jeden model (Scenery.cs)
        local ship = world.spawn("Models/scenery/ship.gltf", x, 0, z, { yaw = -math.deg(r), name = "Černá loď" })
        M.ships[#M.ships + 1] = { parts = { ship }, base = { 0 }, x = x, z = z, phase = r * 3 }
    end
end

function M.UpdateShips()
    if not M.ships then return end
    local t = game.time()
    for _, s in ipairs(M.ships) do
        local bob = sin(t * 0.9 + s.phase) * 0.12
        for i, id in ipairs(s.parts) do
            local p = entity.get_position(id)
            entity.set_position(id, p.x, s.base[i] + bob, p.z)
        end
    end
end

-- tábor Legie: ohně, stany, prapory
local function fire(x, z, size, night_only)
    local y = Ground(x, z)
    world.spawn("cylinder", x, y + 0.15 * size, z, { size = { 0.9 * size, 0.3 * size, 0.9 * size }, color = { 0.15, 0.08, 0.04 } })
    local id = world.spawn("light", x, y, z, { light = { color = { 1, 0.5, 0.18 }, intensity = 26 * size, range = 12 * size,
        flicker = true, y = 1.0, night_only = night_only } })
    M.fires[#M.fires + 1] = id
end

-- prapor Legie na žerdi (Scenery.Banner)
local function banner(x, z)
    world.spawn("cylinder", x, Ground(x, z) + 2.75, z, { size = { 0.14, 5.5, 0.14 }, color = { 0.35, 0.27, 0.2 } })
    world.spawn("cube", x + 0.75, Ground(x, z) + 4, z, { size = { 1.4, 2.4, 0.05 }, color = { 0.5, 0.08, 0.05 } })
end

function M.BuildCamp()
    fire(CAMP[1] - 2, CAMP[2] + 2, 1.1, false)
    fire(-46, -52, 0.9, false)
    -- stany: jehlany o čtyřech stranách (Scenery.BuildCamp: Cone(2.2, 2.6, 4, 1)), natočené o 45°
    for i = 0, 5 do
        local a = i / 6 * math.pi * 2
        local x, z = CAMP[1] + cos(a) * 11, CAMP[2] + sin(a) * 11
        world.spawn("Models/scenery/tent.gltf", x, Ground(x, z), z, { yaw = -(math.deg(a) + 45), collider = "box", name = "Stan" })
    end
    banner(-40, -50)
    banner(48, -58)
end

-- ---------------------------------------------------------------- jih (DesertScenery.cs)
function M.BuildDesert(quality)
    quality = quality or 2
    local R = map.Rng(4321)
    local density = quality == 0 and 0.5 or (quality == 1 and 0.75 or 1)
    local function randX() return map.MinX + 6 + R() * (map.MaxX - map.MinX - 12) end
    local function randZ() return 122 + R() * (map.SouthEdge - 128) end
    local function clear(x, z)
        if dist(x, z, map.Oasis.x, map.Oasis.z) < map.OasisR + 2 then return false end
        if dist(x, z, map.Ruins.x, map.Ruins.z) < 16 then return false end
        return true
    end
    -- rudé balvany
    local rocks = {}
    local n = floor(420 * density + 0.5)
    local i = 0
    while i < n * 3 and n > 0 do
        i = i + 1
        local x, z = randX(), randZ()
        local h = HeightAt(x, z)
        if h >= 1.2 and clear(x, z) then
            local pd = map.PathDistance(x, z, map.CanyonPath)
            local canyon = pd < 9
            if not (canyon and pd < 3.5) then
                local s = 0.4 + R() * ((canyon or h > 8) and 2.2 or 1.1)
                local rx, ry, rz = R() * 40, R() * 360, R() * 40
                rocks[#rocks + 1] = { x, h + s * 0.15, z, ry, s, s * 0.65, s * 1.1, rx, rz }
                n = n - 1
            end
        end
    end
    world.instances("Models/scenery/rock_red.gltf", rocks, { distance = 220 })
    -- suché keře (DesertScenery: 700 × hustota)
    local bushes = {}
    local bn = floor(700 * density + 0.5)
    i = 0
    while i < bn * 3 and bn > 0 do
        i = i + 1
        local x, z = randX(), randZ()
        local h = HeightAt(x, z)
        if h >= 1.1 and h <= 12 and clear(x, z) and map.PathDistance(x, z, map.CanyonPath) > 3 then
            local sc = 0.6 + R() * 0.9
            bushes[#bushes + 1] = { x, h - 0.05, z, R() * 360, sc }
            bn = bn - 1
        end
    end
    world.instances("Models/scenery/bush.gltf", bushes, { distance = 110, detail = true, wind = 0.05 })
    -- palmy kolem oázy
    local palms = {}
    for k = 0, 10 do
        local a = k / 11 * math.pi * 2 + R() * 0.4
        local r = map.OasisR + 1.5 + R() * 5
        local x, z = map.Oasis.x + cos(a) * r, map.Oasis.z + sin(a) * r
        palms[#palms + 1] = { x, HeightAt(x, z) - 0.1, z, R() * 360, 0.9 + R() * 0.3 }
    end
    for _, t in ipairs(palms) do M.AddCanopy(t[1], t[3], t[2] + 4.2 * t[5], t[2] + 5.1 * t[5], 2.4 * t[5]) end
    world.instances("Models/scenery/palm.gltf", palms, { collider = "capsule", radius = 0.25, height = 3, wind = 0.15 })
    -- rákos na břehu oázy
    local reeds = {}
    for _ = 1, 140 do
        local a, r = R() * math.pi * 2, map.OasisR - 0.5 + R() * 3
        local x, z = map.Oasis.x + cos(a) * r, map.Oasis.z + sin(a) * r
        reeds[#reeds + 1] = { x, math.max(HeightAt(x, z), map.OasisWater - 0.3), z, R() * 360, 0.7 + R() * 0.6, 0.7 + R() * 0.6, 0.7 + R() * 0.6,
                              R() * 14 - 7, R() * 14 - 7 }
    end
    world.instances("Models/scenery/reed.gltf", reeds, { distance = 90, detail = true, wind = 0.1 })
    -- hlídka Legie v Solném průsmyku: oheň, prapor, zátarasa s průchodem, stan
    local p0, pa, pb = map.CanyonPath[3], map.CanyonPath[2], map.CanyonPath[3]
    fire(p0.x + 3, p0.z + 1, 0.9, false)
    banner(p0.x - 3.5, p0.z - 2)
    do
        local dx, dz = pb.x - pa.x, pb.z - pa.z
        local l = sqrt(dx * dx + dz * dz)
        dx, dz = dx / l, dz / l
        local sx, sz = -dz, dx
        local stakes = {}
        for k = -4, 4 do
            if abs(k) > 1 then
                local wx = pa.x + (pb.x - pa.x) * 0.55 + sx * k * 1.1
                local wz = pa.z + (pb.z - pa.z) * 0.55 + sz * k * 1.1
                stakes[#stakes + 1] = { wx, HeightAt(wx, wz), wz, math.deg(math.atan(dx, dz)), 1, 1, 1, -30 + (k % 2) * 8, 0 }
            end
        end
        world.instances("Models/scenery/stake.gltf", stakes, { collider = "capsule", radius = 0.25, height = 1.6 })
    end
    world.spawn("Models/scenery/tent.gltf", p0.x - 4, HeightAt(p0.x - 4, p0.z + 4), p0.z + 4,
        { size = { 2 / 2.2, 2.4 / 2.6, 2 / 2.2 }, yaw = -30, collider = "box", name = "Stan hlídky" })
    -- vybělený vrak na Solném pobřeží
    do
        local wz = 232
        local wx = map.CoastX(wz) + 8
        world.spawn("Models/scenery/wreck.gltf", wx, HeightAt(wx, wz) + 0.3, wz, { rotation = { 0, -20, -18 }, name = "Vybělený vrak" })
    end
    -- ruiny Starého slunce: podstava, sloupy (rozbité)
    local cx, cz = map.Ruins.x, map.Ruins.z
    local y0 = HeightAt(cx, cz)
    world.spawn("cube", cx, y0 + 0.2, cz, { size = { 16, 0.8, 11 }, yaw = -12, color = { 0.8, 0.68, 0.52 }, collider = "box" })
    local rad = math.rad(-12)
    for k = 0, 11 do
        local longSide = k < 10
        local lx = longSide and (-6.5 + (k % 5) * 3.25) or (k == 10 and -7 or 7)
        local lz = longSide and (k < 5 and -4.3 or 4.3) or 0
        local h = abs(sin(k * 3.7)) * 4 + 0.6
        if k == 3 or k == 8 then h = 5.5 end
        local px = cx + lx * cos(rad) + lz * sin(rad)
        local pz = cz - lx * sin(rad) + lz * cos(rad)
        world.spawn("cylinder", px, y0 + 0.6 + h / 2, pz, { size = { 1.1, h, 1.1 }, color = { 0.82, 0.72, 0.56 }, collider = "capsule" })
        -- hlavice na dvou celých sloupech
        if k == 3 or k == 8 then
            world.spawn("cube", px, y0 + 0.6 + h + 0.25, pz, { size = { 1.6, 0.5, 1.6 }, yaw = -12, color = { 0.82, 0.72, 0.56 } })
        end
    end
    -- povalené sloupy a kvádry v písku
    for k = 0, 3 do
        local a = math.rad(40 + k * 85)
        local d = 10 + k
        local px, pz = cx + math.sin(a) * d, cz - math.cos(a) * d
        local yaw = -(30 + k * 50)
        local fy = math.rad(yaw)
        -- válec ležící podél směru yaw (v Unity začíná v bodě p, ne ve středu)
        local mx, mz = px + math.sin(fy) * 1.75, pz + math.cos(fy) * 1.75
        world.spawn("cylinder", mx, y0 + 0.4 + 0.5, mz, { size = { 1.0, 3.5, 1.0 }, rotation = { 90, yaw, 0 }, color = { 0.86, 0.74, 0.58 }, collider = "box" })
        world.spawn("cube", px + 2, y0 + 0.4, pz - 1.5, { size = { 1.2, 0.8, 1.6 }, rotation = { 8, -k * 37, 5 }, color = { 0.8, 0.68, 0.52 } })
    end
    -- socha Starého slunce: kotouč na podstavci (bez tváře)
    world.spawn("cube", cx, y0 + 0.6 + 1.1, cz, { size = { 1.6, 2.2, 1.6 }, yaw = -12, color = { 0.86, 0.74, 0.58 }, collider = "box" })
    world.spawn("cylinder", cx, y0 + 0.6 + 3.8, cz, { size = { 3.0, 0.3, 3.0 }, rotation = { 90, -12, 0 }, color = { 0.9, 0.78, 0.6 } })
end

-- Celý svět
function M.Build(faction, quality)
    M.BuildTerrain()
    M.BuildCity()
    M.BuildNpcs(faction)
    M.BuildAnimals()
    M.BuildScenery(quality)
    M.BuildDesert(quality)
end

function M.Update(dt)
    M.UpdateAnimals(dt)
    M.UpdateShips()
end

return M

-- Mapa 1. aktu – přesný převod WorldMap.cs (a webové src/game/ashes/world/map.ts).
-- Souřadnice jsou webové (x, z) a engine je kreslí stejně (pravotočivá soustava jako Three.js),
-- takže na rozdíl od Unity se z neobrací.
local M = {}

M.WorldHalf = 125
M.SouthEdge = 345
M.MinX, M.MaxX, M.MinZ, M.MaxZ = -135, 135, -135, 345

local function V(x, z) return { x = x, z = z } end

M.CanyonPath = { V(-30, 122), V(-22, 140), V(-8, 156), V(-14, 174), V(2, 190), V(14, 206), V(20, 226) }
M.Oasis = V(38, 272)
M.OasisR, M.OasisWater = 9, 2.1
M.Ruins = V(-22, 268)
local Mesas = { { 66, 244, 13, 17 }, { -6, 300, 9, 14 }, { 92, 292, 12, 21 }, { -58, 286, 8, 12 } }

function M.InWorld(x, z) return x > M.MinX + 3 and x < M.MaxX - 3 and z > M.MinZ + 3 and z < M.MaxZ - 3 end

M.City = { xMin = 52, yMin = -14, xMax = 98, yMax = 44 }   -- x0, z0, x1, z1 (web)
M.CityHeight = 3.2
M.Cove = { x = -64, z = -74 }
M.CoveR = 24

M.SpawnKalidra = V(-52, 50)
M.SpawnLegie = V(-44, -50)

local Roads = {
    { V(-50, 46), V(-40, 30), V(-33, 13), V(-12, 8), V(20, 12), V(46, 15), V(60, 15), V(74, 15) },
    { V(-44, -52), V(-30, -45), V(-10, -47), V(4, -60), V(18, -54), V(32, -50), V(52, -62) },
    { V(2, -47), V(8, -22), V(16, -2), V(20, 12) },
    { V(20, 12), V(28, 30) },
    { V(74, 15), V(74, -6) },
    { V(74, 15), V(86, 28) },
}
M.Roads = Roads

local function B(x, z, w, d, h, kind) return { x = x, z = z, w = w, d = d, h = h, kind = kind } end
M.Buildings = {
    B(66, 0, 9, 7, 4.2, "tavern"), B(82, 1, 8, 6, 3.6, "smithy"), B(88, 33, 12, 9, 5.5, "temple"),
    B(59, -7, 6, 5, 3.4, "house"), B(92, -6, 6, 6, 3.8, "house"), B(93, 14, 5, 7, 3.4, "house"),
    B(58, 38, 6, 5, 3.2, "house"), B(76, 38, 7, 5, 3.6, "house"), B(72, -9, 5, 4, 3.0, "house"),
}

M.MarketStalls = { V(67, 12.4), V(67, 20.6), V(81, 17.5), V(80, 22.5) }

local function N(id, name, role, faction, x, z, face, cls)
    return { id = id, name = name, role = role, faction = faction, x = x, z = z, face = face, cls = cls }
end
M.Npcs = {
    N("nikias", "Nikias", "starý rybář", "kalidra", -50, 44, 2.4, "vestec"),
    N("damon", "Damon", "velitel hradeb", "kalidra", 46, 9.5, -1.4, "hoplit"),
    N("eryon", "Eryon", "poslední štít", "kalidra", 47.5, 16, -1.57, "hoplit"),
    N("gorgias", "Gorgias", "hostinský", "kalidra", 66, 7, 3.14, "vestec"),
    N("tharos", "Tharos", "kovář", "kalidra", 81, 7, 3.14, "hoplit"),
    N("thalia", "Thalia", "kněžka moře", "kalidra", 82, 27, 2.2, "vestec"),
    N("melos", "Melos", "bard", "kalidra", 74, 20, 3.14, "vestec"),
    N("pylas", "Pylas", "strážný", "kalidra", -19, -55, 2.6, "lucistnik"),
    N("arena-k", "Mistr arény", "kruh kamenů", "kalidra", 66, 29, 0, "hoplit"),
    N("varkas", "Varkas", "setník", "legie", -44, -55, 0.6, "hoplit"),
    N("sabra", "Sabra", "markytánka", "legie", -38, -58, 0.3, "vestec"),
    N("rukmar", "Rukmar", "kovář Legie", "legie", -50, -50, 1.0, "hoplit"),
    N("oren", "Oren", "kněz Rudého slunce", "legie", 54, -60, -0.8, "vestec"),
    N("azkar", "Azkar", "Syn Rudého slunce", "legie", 63, -71, -0.3, "hoplit"),
    N("taras", "Taras", "bubeník", "legie", 50, -70, 0.8, "lucistnik"),
    N("arena-l", "Mistr zápasů", "kruh v táboře", "legie", 70, -58, -2, "hoplit"),
}

-- ------------------------------------------------------------ šum a terén (stejný jako na webu)
local floor, sqrt, sin, abs, min, max = math.floor, math.sqrt, math.sin, math.abs, math.min, math.max

local function Hash(x, z)
    local s = sin(x * 127.1 + z * 311.7) * 43758.5453
    return s - floor(s)
end

local function Smooth(t) return t * t * (3 - 2 * t) end

local function ValueNoise(x, z)
    local xi, zi = floor(x), floor(z)
    local xf, zf = x - xi, z - zi
    local a, b, c, d = Hash(xi, zi), Hash(xi + 1, zi), Hash(xi, zi + 1), Hash(xi + 1, zi + 1)
    local u, v = Smooth(xf), Smooth(zf)
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v
end

function M.Fbm(x, z)
    return ValueNoise(x, z) * 0.55 + ValueNoise(x * 2.1, z * 2.1) * 0.3 + ValueNoise(x * 4.3, z * 4.3) * 0.15
end
local Fbm = M.Fbm

local function Clamp01(x) if x < 0 then return 0 elseif x > 1 then return 1 end return x end
local function Step(e0, e1, x) return Smooth(Clamp01((x - e0) / (e1 - e0))) end
local function Mix(a, b, t) return a + (b - a) * t end
M.Step, M.Mix, M.Clamp01 = Step, Mix, Clamp01

function M.CoastX(z) return -80 + 7 * sin(z * 0.045) + 3 * sin(z * 0.13 + 1.3) end

local function SegDist(px, pz, a, b)
    local dx, dz = b.x - a.x, b.z - a.z
    local t = Clamp01(((px - a.x) * dx + (pz - a.z) * dz) / (dx * dx + dz * dz))
    local ex, ez = px - (a.x + dx * t), pz - (a.z + dz * t)
    return sqrt(ex * ex + ez * ez)
end
M.SegDist = SegDist

function M.PathDistance(x, z, path)
    local best = math.huge
    for i = 1, #path - 1 do best = min(best, SegDist(x, z, path[i], path[i + 1])) end
    return best
end

function M.RoadDistance(x, z)
    local best = math.huge
    for _, road in ipairs(Roads) do
        for i = 1, #road - 1 do best = min(best, SegDist(x, z, road[i], road[i + 1])) end
    end
    return best
end

local function Terrace(h, step, soft)
    local k = floor(h / step)
    local f = h / step - k
    return (k + Clamp01((f - (1 - soft)) / soft)) * step
end

-- Jih: skalní plošina s kaňonem, pobřežní pruh a poušť s dunami, stolovými horami a oázou.
local function South(x, z, h)
    local desert = Step(150, 215, z)
    local n = Fbm(x * 0.05 + 17, z * 0.05 + 3)
    local dunes = 1.6 + Fbm(x * 0.022 + 40, z * 0.03) * 4.2 + abs(sin(x * 0.06 + z * 0.04 + n * 3)) * 1.5
    h = Mix(h, dunes, desert)
    local wz = (Fbm(x * 0.025 + 31, z * 0.025 + 11) - 0.5) * 26
    local wx = (Fbm(x * 0.025 + 5, z * 0.025 + 77) - 0.5) * 22
    local jag = (Fbm(x * 0.09 + 3, z * 0.09 + 8) - 0.5) * 9
    wz = wz + jag
    wx = wx + jag
    local north = 141 + max(0, wz + 13) * 0.45
    local ridge = Step(north, north + 14, z) * Step(218 + wz, 202 + wz, z) * Step(-52 + wx * 1.2, -38 + wx * 1.2, x)
    local plateau = Terrace(19 + Fbm(x * 0.04 + 7, z * 0.04 + 2) * 9, 3.2, 0.55)
    h = Mix(h, plateau, ridge)
    for _, m in ipairs(Mesas) do
        local d = sqrt((x - m[1]) * (x - m[1]) + (z - m[2]) * (z - m[2])) + (n - 0.5) * 5
        h = Mix(h, Terrace(m[4] + n * 3, 3.2, 0.55), Step(m[3] + 5, m[3], d))
    end
    h = Mix(h, 30 + n * 10, Step(78 + wx * 1.5, 100 + wx * 1.5, x) * Step(140 + wz * 0.3, 165 + wz * 0.3, z))
    h = Mix(h, 32 + n * 10, Step(300 + wz * 0.8, 324 + wz * 0.8, z))
    local dc = M.PathDistance(x, z, M.CanyonPath)
    local floorH = 1.7 + Fbm(x * 0.12, z * 0.12) * 0.7 + Step(120, 200, z) * 0.8
    h = Mix(h, min(h, floorH), Step(13, 4.5, dc))
    local doa = sqrt((x - M.Oasis.x) * (x - M.Oasis.x) + (z - M.Oasis.z) * (z - M.Oasis.z))
    h = Mix(h, M.OasisWater + 0.5, Step(M.OasisR + 14, M.OasisR + 3, doa) * 0.9)
    h = Mix(h, M.OasisWater - 1.2, Step(M.OasisR + 1, M.OasisR - 3, doa))
    local dr = sqrt((x - M.Ruins.x) ^ 2 + (z - M.Ruins.z) ^ 2)
    h = Mix(h, 2.6, Step(18, 11, dr))
    return h
end

local City = M.City
-- Výška terénu ve webových souřadnicích (x, z). Pod 0 je moře.
function M.HeightAt(x, z)
    local h = 1.4 + (Fbm(x * 0.035 + 10, z * 0.035) - 0.5) * 2.4
    h = h + Step(-30, -62, z) * (5.5 + Fbm(x * 0.05, z * 0.05 + 4) * 6)
    h = h + Step(-90, -118, z) * 16
    if z > 100 then h = South(x, z, h) end
    local cx = M.CoastX(z)
    local beach = Step(cx + 14, cx + 3, x)
    h = Mix(h, 0.55, beach * 0.85)
    h = Mix(h, -5, Step(cx, cx - 10, x))
    local dc = sqrt((x - M.Cove.x) * (x - M.Cove.x) + (z - M.Cove.z) * (z - M.Cove.z))
    h = Mix(h, 0.5, Step(M.CoveR + 12, M.CoveR + 2, dc) * 0.8)
    h = Mix(h, -4, Step(M.CoveR + 1, M.CoveR - 8, dc))
    local inCity = Step(City.xMin - 6, City.xMin + 2, x) * Step(City.yMin - 8, City.yMin + 2, z) * Step(City.yMax + 8, City.yMax - 2, z)
    h = Mix(h, M.CityHeight, inCity * Step(City.xMax + 14, City.xMax + 4, x))
    h = Mix(h, -7, Step(City.xMax + 8, City.xMax + 15, x))
    local road = M.RoadDistance(x, z)
    if road < 3.2 then h = Mix(h, max(h * 0.85, 0.7), (1 - road / 3.2) * 0.5) end
    return h
end

function M.InCity(x, z) return x > City.xMin and x < City.xMax and z > City.yMin and z < City.yMax end

-- Výška pro postavy a stavby (moře = 0)
function M.Ground(x, z) return max(M.HeightAt(x, z), 0) end

-- Webový úhel natočení (dopředu = (sin a, cos a)) -> yaw ve stupních pro modely (glTF: +Z dopředu)
function M.FaceToYaw(a) return math.deg(a) end

-- Jednoduchý generátor jako v Unity (Scenery.R): stejná krajina při každém spuštění
function M.Rng(seed)
    local s = seed & 0xFFFFFFFF
    return function()
        s = (s * 1664525 + 1013904223) & 0xFFFFFFFF
        return (s >> 8) / 16777216
    end
end

return M

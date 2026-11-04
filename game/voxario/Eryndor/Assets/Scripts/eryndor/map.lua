-- Hraniční údolí Zlomu: počáteční lokace (testovací). Terén, oblasti a jejich barvy.
--   západ  (x < -40): les Sylvarie – bioluminiscenční houby, tyrkysový mech, obří živý strom, mramor
--   střed:            křišťálové jezero
--   východ (x > 45):  popelavé návrší Aethelgardu – strážní věž, palisáda, sopečné skály
--   sever  (z > 90):  Stínová trhlina – zčernalá zem, krystaly Umbria, Zkažení
--   jih    (z < -50): břeh, kde Ozvěna přichází k sobě (start)
local M = {}

M.Size = 520                 -- strana mapy (m), střed v 0, 0
M.LakeY = 2.0                -- hladina jezera
M.Lake = { x = 0, z = 10, r = 46 }
M.Start = { x = 4, z = -58 }
M.Giant = { x = -112, z = 24 }
M.Shrine = { x = -78, z = -22 }
M.Tower = { x = 112, z = 4 }
M.Rift = { x = 6, z = 132 }
M.Lyrise = { x = -2, z = -46 }

local floor, sin, cos, sqrt, max, min, abs = math.floor, math.sin, math.cos, math.sqrt, math.max, math.min, math.abs

-- hodnotový šum (deterministický)
local function hash(ix, iz)
    local h = (ix * 374761393 + iz * 668265263) % 2147483647
    h = (h ~ (h >> 13)) * 1274126177 % 2147483647
    return (h % 100000) / 100000
end
local function noise(x, z)
    local ix, iz = floor(x), floor(z)
    local fx, fz = x - ix, z - iz
    fx, fz = fx * fx * (3 - 2 * fx), fz * fz * (3 - 2 * fz)
    local a, b = hash(ix, iz), hash(ix + 1, iz)
    local c, d = hash(ix, iz + 1), hash(ix + 1, iz + 1)
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz
end
local function fbm(x, z, oct)
    local t, amp, n = 0, 1, 0
    for o = 0, (oct or 4) - 1 do
        t = t + noise(x * 2 ^ o, z * 2 ^ o) * amp
        n = n + amp
        amp = amp * 0.5
    end
    return t / n
end
M.Noise, M.Fbm = noise, fbm

local function smooth(a, b, x)
    local t = max(0, min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
end
M.Smooth = smooth

function M.HeightAt(x, z)
    local h = 3.5 + (fbm(x * 0.012, z * 0.012, 4) - 0.5) * 7
    -- východ: zvedá se k popelavému návrší a sopečnému hřebeni
    h = h + smooth(30, 150, x) * 12 + smooth(150, 230, x) * 30 * (0.6 + fbm(x * 0.02, z * 0.02, 3))
    -- západ: les v mírné kotlině, za ním vysoké skály
    h = h - smooth(-30, -90, x) * 1.5 + smooth(-170, -240, x) * 34 * (0.5 + fbm(x * 0.018, z * 0.03, 3))
    -- sever za trhlinou a jih za břehem: horské hřebeny (údolí je uzavřené)
    h = h + smooth(170, 240, z) * 40 * (0.5 + fbm(x * 0.02, z * 0.015, 3))
    h = h + smooth(-130, -230, z) * 26 * (0.5 + fbm(x * 0.025, z * 0.02, 3))
    -- křišťálové jezero: mísa
    local dl = sqrt((x - M.Lake.x) ^ 2 + (z - M.Lake.z) ^ 2 * 1.3)
    h = h - (1 - smooth(M.Lake.r * 0.4, M.Lake.r * 1.35, dl)) * 7.5
    -- trhlina: kráter s propadlým středem
    local dr = sqrt((x - M.Rift.x) ^ 2 + (z - M.Rift.z) ^ 2)
    h = h - (1 - smooth(6, 30, dr)) * 2.5
    -- plošiny pod stavbami
    for _, p in ipairs({ { M.Shrine, 9, 4.2 }, { M.Tower, 9, nil }, { M.Giant, 12, nil } }) do
        local d = sqrt((x - p[1].x) ^ 2 + (z - p[1].z) ^ 2)
        local w = 1 - smooth(p[2], p[2] + 10, d)
        if w > 0 then
            local target = p[3] or M.BaseHeight(p[1].x, p[1].z)
            h = h + (target - h) * w
        end
    end
    return h
end

-- výška bez plošin (pro určení výšky plošiny)
function M.BaseHeight(x, z)
    local h = 3.5 + (fbm(x * 0.012, z * 0.012, 4) - 0.5) * 7
    h = h + smooth(30, 150, x) * 12 + smooth(150, 230, x) * 30 * (0.6 + fbm(x * 0.02, z * 0.02, 3))
    h = h - smooth(-30, -90, x) * 1.5 + smooth(-170, -240, x) * 34 * (0.5 + fbm(x * 0.018, z * 0.03, 3))
    return h
end

-- oblast: "sylvaria" | "aethel" | "rift" | "lake" | "meadow"
function M.Region(x, z)
    local dr = sqrt((x - M.Rift.x) ^ 2 + (z - M.Rift.z) ^ 2)
    if dr < 48 then return "rift" end
    local dl = sqrt((x - M.Lake.x) ^ 2 + (z - M.Lake.z) ^ 2 * 1.3)
    if dl < M.Lake.r * 1.05 then return "lake" end
    if x < -45 + fbm(x * 0.03, z * 0.03, 2) * 20 then return "sylvaria" end
    if x > 50 + fbm(x * 0.03, z * 0.03 + 7, 2) * 20 then return "aethel" end
    return "meadow"
end

-- váhy vrstev terénu: 1 tráva, 2 tyrkysový mech Sylvarie, 3 popel a hlína, 4 skála / zkažená zem
function M.Splat(x, z, h, slope)
    local syl = smooth(-30, -70, x)
    local ash = smooth(40, 90, x)
    local rift = 1 - smooth(18, 50, sqrt((x - M.Rift.x) ^ 2 + (z - M.Rift.z) ^ 2))
    local rock = smooth(0.45, 0.75, slope) + smooth(22, 34, h) * 0.6
    local shore = 1 - smooth(M.LakeY + 0.1, M.LakeY + 0.7, h)
    local n = fbm(x * 0.08, z * 0.08, 2)
    local w2 = syl * (0.7 + 0.5 * n)
    local w3 = ash * (0.6 + 0.6 * n) + shore * 0.6
    local w4 = rock + rift * 1.6
    local w1 = max(0.05, 1 - w2 - w3 - w4)
    local s = w1 + w2 + w3 + w4
    return w1 / s, w2 / s, w3 / s, w4 / s
end

return M

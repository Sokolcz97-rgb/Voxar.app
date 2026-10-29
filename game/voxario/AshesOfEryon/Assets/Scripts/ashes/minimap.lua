-- Minimapa vpravo nahoře a velká mapa na M (Minimap.cs). Obrázek se vykreslí jednou z terénu.
local map = require("ashes.worldmap")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")

local M = { big = false, built = false }

local X0, X1, Z0, Z1 = map.MinX, map.MaxX, map.MinZ, map.MaxZ
local RES_Y = 480
local RES_X = math.floor(RES_Y * (X1 - X0) / (Z1 - Z0) + 0.5)
local ASPECT = (X1 - X0) / (Z1 - Z0)

local function lerp3(a, b, t)
    t = math.max(0, math.min(1, t))
    return a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t
end

-- Barvy jako terén (stejné jako Unity verze); výška z postaveného terénu (rychlé)
function M.Build()
    local rows = {}
    local char, floor, min, max = string.char, math.floor, math.min, math.max
    local prev = {}
    local oasis, oasisR = map.Oasis, map.OasisR
    for iy = 0, RES_Y - 1 do
        local z = Z0 + iy / (RES_Y - 1) * (Z1 - Z0)
        local row = {}
        local cur = {}
        for ix = 0, RES_X - 1 do
            local x = X0 + ix / (RES_X - 1) * (X1 - X0)
            local h = world.height(x, z) or -6
            cur[ix] = h
            local r, g, b
            if h < 0 then r, g, b = lerp3({ 0.12, 0.27, 0.33 }, { 0.05, 0.13, 0.19 }, -h / 6)
            elseif map.InCity(x, z) then r, g, b = 0.72, 0.67, 0.58
            elseif h < 1.1 then r, g, b = 0.78, 0.69, 0.52
            elseif h > 9 then r, g, b = lerp3({ 0.45, 0.43, 0.39 }, { 0.75, 0.73, 0.7 }, (h - 9) / 12)
            else r, g, b = lerp3({ 0.33, 0.4, 0.19 }, { 0.5, 0.45, 0.28 }, (h - 1) / 8) end
            if z > 100 and h >= 1.1 then
                local t = map.Clamp01((z - 104) / 96)
                local arid = t * t * (3 - 2 * t)
                local dr, dg, db = lerp3({ 0.8, 0.6, 0.38 }, { 0.86, 0.68, 0.45 }, (h - 1) / 6)
                if h > 9 then dr, dg, db = lerp3({ 0.58, 0.34, 0.24 }, { 0.72, 0.46, 0.32 }, (h - 9) / 20) end
                local k = h > 9 and max(arid, map.Clamp01((z - 126) / 14)) or arid
                r, g, b = r + (dr - r) * k, g + (dg - g) * k, b + (db - b) * k
                local d = math.sqrt((x - oasis.x) ^ 2 + (z - oasis.z) ^ 2)
                if d < oasisR then r, g, b = 0.12, 0.36, 0.4 elseif d < oasisR + 6 then r, g, b = 0.38, 0.46, 0.22 end
            end
            -- stínování svahů (soused vlevo nahoře)
            local hn = (prev[ix - 1] or h)
            local shade = 0.85 + max(-1, min(1, hn - h)) * 0.15
            row[#row + 1] = char(floor(min(1, r * shade) * 255), floor(min(1, g * shade) * 255), floor(min(1, b * shade) * 255), 255)
        end
        prev = cur
        rows[#rows + 1] = table.concat(row)
    end
    ui.create_image("minimap", RES_X, RES_Y, table.concat(rows))
    M.built = true
end

local function toUv(x, z) return (x - X0) / (X1 - X0), (z - Z0) / (Z1 - Z0) end

-- Název oblasti podle polohy (Minimap.RegionName)
function M.RegionName(x, z)
    if map.InCity(x, z) then return "Kalidra" end
    local function d(px, pz) return math.sqrt((x - px) ^ 2 + (z - pz) ^ 2) end
    if z > 118 then
        if d(map.Oasis.x, map.Oasis.z) < map.OasisR + 16 then return "Oáza Posledního doušku" end
        if d(map.Ruins.x, map.Ruins.z) < 22 then return "Ruiny Starého slunce" end
        if map.PathDistance(x, z, map.CanyonPath) < 12 then return "Solný průsmyk" end
        if z > 206 then return "Rudé písky" end
        if x < -44 then return "Solné pobřeží" end
        if z > 134 then return "Rudé útesy" end
    end
    if d(60, -68) < 22 then return "Tábor Legie" end
    if d(-64, -74) < 30 then return "Zátoka černých plachet" end
    if z < -30 then return "Kopce strážních ohňů" end
    if x < -40 and z > 26 then return "Bezejmenný břeh" end
    if x < 0 and z > -26 then return "Akvadukt" end
    return "Pláň před branou"
end

local VERSES = {
    ["Solný průsmyk"] = "„Třetí den jsme stáli v průsmyku, vítr nesl sůl a dým.“",
    ["Rudé útesy"] = "„Za městem se kopce zvedly, v dálce rudě hořel kraj.“",
    ["Solné pobřeží"] = "„Moře si pamatuje. Kámen si pamatuje.“",
    ["Rudé písky"] = "„Krev mizí v písku, však jméno zůstává.“",
    ["Ruiny Starého slunce"] = "„A tam, kde kdysi stál poslední štít, dodnes vítr nese jeho jméno.“",
    ["Oáza Posledního doušku"] = "„Jen podaly chléb a vodu a řekly tiše: Jděte dál.“",
}
local lastRegion, banner, bannerAt, seen = nil, nil, -100, {}

local function regionBanner(region, W, H)
    if region ~= lastRegion then
        lastRegion = region
        if VERSES[region] and not seen[region] then
            seen[region] = true
            banner, bannerAt = { region, VERSES[region] }, game.time()
        end
    end
    local t = game.time() - bannerAt
    if not banner or t > 6 then return end
    local a = math.min(1, t / 0.8) * math.min(1, (6 - t) / 1.2)
    ui.text(W / 2, H * 0.2, string.upper(banner[1]), { size = 46, font = "title", color = { 1, 0.86, 0.55, a }, align = "center" })
    ui.text(W / 2, H * 0.2 + 66, banner[2], { size = 24, font = "bold", color = { 0.95, 0.9, 0.8, a }, align = "center" })
end

function M.Update(boot)
    if not boot.typing and keys.Down("map") then M.big = not M.big end
end

local function marks(boot, rx, ry, rw, rh, u0, v0, u1, v1, names, markerFn)
    local faction = (boot.state and boot.state.character and boot.state.character.faction) or "kalidra"
    local function screen(x, z)
        local u, v = toUv(x, z)
        local fx, fy = (u - u0) / (u1 - u0), (v - v0) / (v1 - v0)
        return rx + fx * rw, ry + fy * rh, fx >= 0 and fx <= 1 and fy >= 0 and fy <= 1
    end
    for _, n in ipairs(map.Npcs) do
        if n.faction == faction then
            local sx, sy, ok = screen(n.x, n.z)
            if ok then
                local mark = markerFn(boot.state, n.id)
                local s = mark and 9 or 6
                ui.rect(sx - s / 2, sy - s / 2, s, s, mark and { 1, 0.8, 0.2 } or { 0.95, 0.92, 0.85 }, s / 2)
                if names then ui.text(sx, sy + 4, n.name, { size = 16, font = "bold", color = skin.Text, align = "center" }) end
            end
        end
    end
    return screen
end

function M.Draw(boot, player, markerFn)
    if not M.built then return end
    local W, H = ui.screen()
    local px, _, pz = player.Position()
    local region = M.RegionName(px, pz)
    regionBanner(region, W, H)
    local facing = math.rad(player.facing or 0)
    local function arrow(sx, sy, size)
        -- šipka hráče ve směru pohledu (mapa: x doprava, z dolů)
        local fx, fy = math.sin(facing), math.cos(facing)
        local lx, ly = -fy, fx
        ui.line(sx + fx * size, sy + fy * size, sx - fx * size * 0.6 + lx * size * 0.6, sy - fy * size * 0.6 + ly * size * 0.6, skin.GoldBright, 2.5)
        ui.line(sx + fx * size, sy + fy * size, sx - fx * size * 0.6 - lx * size * 0.6, sy - fy * size * 0.6 - ly * size * 0.6, skin.GoldBright, 2.5)
        ui.rect(sx - 3, sy - 3, 6, 6, skin.GoldBright, 3)
    end
    if M.big then
        ui.rect(0, 0, W, H, { 0, 0, 0, 0.6 })
        local mh = H - 180
        local mw = mh * ASPECT
        if mw > W - 120 then mw = W - 120; mh = mw / ASPECT end
        local x, y = (W - mw) / 2, (H - mh) / 2
        ui.panel("Textures/ui/panel.png", x - 16, y - 56, mw + 32, mh + 88, 16, 16)
        ui.text(W / 2, y - 46, "POBŘEŽÍ KALIDRY", { size = 24, font = "h1", color = skin.Gold, align = "center" })
        ui.draw_image("minimap", x, y, mw, mh)
        ui.rect(x, y, mw, mh, skin.Gold, 0, false, 2)
        local screen = marks(boot, x, y, mw, mh, 0, 0, 1, 1, true, markerFn)
        local sx, sy = screen(px, pz)
        arrow(sx, sy, 10)
        ui.text(W / 2, y + mh + 6, keys.Label("map") .. " – zavřít mapu", { size = 15, font = "caps", color = skin.Muted, align = "center" })
        return
    end
    local size = 250
    local rx, ry = W - size - 24, 60
    -- výřez ~81 × 81 m kolem hráče
    local zx, zy = 81 / (X1 - X0), 81 / (Z1 - Z0)
    local u, v = toUv(px, pz)
    local u0, v0, u1, v1 = u - zx / 2, v - zy / 2, u + zx / 2, v + zy / 2
    ui.rect(rx - 6, ry - 6, size + 12, size + 12, { 0.04, 0.03, 0.02, 0.9 })
    ui.draw_image("minimap", rx, ry, size, size, nil, u0, v0, u1, v1)
    marks(boot, rx, ry, size, size, u0, v0, u1, v1, false, markerFn)
    arrow(rx + size / 2, ry + size / 2, 8)
    ui.rect(rx, ry, size, size, skin.Gold, 0, false, 2)
    ui.text(rx + size / 2, ry + size + 8, region, { size = 15, font = "caps", color = skin.GoldBright, align = "center" })
    local p = time.prague()
    ui.text(rx + size / 2, ry + size + 30, string.format("%02d:%02d", p.hour, p.min), { size = 14, font = "body", color = skin.Muted, align = "center" })
end

return M

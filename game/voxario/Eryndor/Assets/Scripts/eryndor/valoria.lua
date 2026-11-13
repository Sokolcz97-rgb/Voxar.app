-- Initial reconstruction; models are placeholders rather than final AAA assets.
local map = require("eryndor.map")
local M = {}
local W = _G.world
local cx, cz = 3000, 2400

M.Spawn = { x = cx, z = cz + 200 }
M.CityPortal = { x = cx + 15, z = cz + 60 }
M.OutpostPortal = { x = map.Start.x + 15, z = map.Start.z + 12 }

local function model(name, x, z, options)
    W.spawn("Models/valoria/" .. name .. ".glb", x, map.HeightAt(x, z), z, options)
end

local function portal(p)
    local y = map.HeightAt(p.x, p.z)
    W.spawn("Models/nature/aetherium_big.glb", p.x, y, p.z, { name = "Portál", scale = 1.0 })
    W.spawn("light", p.x, y + 3, p.z, { light = { color = { 0.4, 0.7, 1.0 }, intensity = 25, range = 12 } })
end

-- Most hrdinů: mostovka 20 x 200 m (horní plocha modelu v y = 0). Terén pod ním má jemný detail (± 0,45 m
-- šumu nad výškovou mapou) – mostovka se proto posadí nad nejvyšší místo terénu pod celou plochou, jinak
-- tráva prorůstala skrz dlažbu mostu.
local BRIDGE = { z = 170, length = 200, width = 20 }
local function bridgeHeight()
    local highest = -math.huge
    for dz = -BRIDGE.length / 2, BRIDGE.length / 2, 1 do
        for dx = -BRIDGE.width / 2, BRIDGE.width / 2, 1 do
            highest = math.max(highest, map.HeightAt(cx + dx, cz + BRIDGE.z + dz))
        end
    end
    return highest + 0.06
end
M.BridgeY = nil

local function paving()
    local tiles = {}
    local bridgeStart = cz + BRIDGE.z - BRIDGE.length / 2
    local function addTile(px, pz)
        local highest = -math.huge
        for dx = -1, 1 do
            for dz = -1, 1 do
                highest = math.max(highest, map.HeightAt(px + dx, pz + dz))
            end
        end
        local y = highest + 0.03
        -- posledních 12 m ulice plynule stoupá k mostovce (žádný schod na začátku mostu)
        local toBridge = bridgeStart - pz
        if M.BridgeY and toBridge < 12 then
            local t = 1 - math.max(toBridge, 0) / 12
            y = math.max(y, y + (M.BridgeY - y) * t)
        end
        tiles[#tiles + 1] = { px, y, pz, 0, 1 }
    end
    for x = -8, 8, 2 do
        for z = -89, 69, 2 do
            addTile(cx + x, cz + z)
        end
    end
    W.instances("Models/valoria/paving.glb", tiles, { distance = 600 })
end

function M.Build()
    M.BridgeY = bridgeHeight()
    W.spawn("Models/valoria/bridge.glb", cx, M.BridgeY, cz + BRIDGE.z, { name = "Most hrdinů", collider = "mesh" })
    paving()
    model("gate", cx, cz + 90, { name = "Brána Valorie", collider = "mesh" })
    for _, x in ipairs({ -13, 13 }) do
        for z = 130, 250, 40 do
            model("hero", cx + x, cz + z, { name = "Hrdina", collider = "box" })
        end
    end
    for z = -60, 60, 24 do
        model("house_blue", cx - 25, cz + z, { yaw = -90, name = "Dům", collider = "mesh" })
        model("house_red", cx + 25, cz + z, { yaw = 90, name = "Dům", collider = "mesh" })
    end
    model("keep", cx, cz - 235, { name = "Královský hrad", collider = "mesh" })
    local floorY = -math.huge
    -- Sample all 2 m terrain vertices bordering the floor footprint, including the threshold.
    for x = -16, 16, 2 do
        for z = -11, 13, 2 do
            floorY = math.max(floorY, map.HeightAt(cx + x, cz - 235 + z))
        end
    end
    M.KeepFloorY = floorY + 0.05
    M.KeepFloor = W.spawn("Models/valoria/keep_floor.glb", cx, M.KeepFloorY - 0.02, cz - 235,
        { name = "Podlaha hradu", collider = "mesh" })
    for i = 1, 2 do
        W.spawn("Models/valoria/keep_step.glb", cx, M.KeepFloorY - 0.02 - i * 0.2, cz - 223 + (i * 2 - 1),
            { name = "Schod hradu", collider = "mesh" })
    end
    for _, x in ipairs({ -8, 8 }) do
        local z = cz - 235
        W.spawn("light", cx + x, map.HeightAt(cx + x, z) + 4, z,
            { light = { color = { 1.0, 0.72, 0.42 }, intensity = 22, range = 13 } })
    end
    portal(M.CityPortal)
    portal(M.OutpostPortal)
end

function M.NearPortal(x, z)
    local function near(p)
        return (x - p.x) ^ 2 + (z - p.z) ^ 2 < 7 ^ 2
    end
    if near(M.CityPortal) then return M.OutpostPortal end
    if near(M.OutpostPortal) then return M.CityPortal end
end

return M

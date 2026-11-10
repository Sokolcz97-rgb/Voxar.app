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

local function paving()
    local tiles = {}
    for x = -8, 8, 2 do
        for z = -89, 69, 2 do
            local px, pz = cx + x, cz + z
            local highest = -math.huge
            for dx = -1, 1 do
                for dz = -1, 1 do
                    highest = math.max(highest, map.HeightAt(px + dx, pz + dz))
                end
            end
            tiles[#tiles + 1] = { px, highest + 0.03, pz, 0, 1 }
        end
    end
    W.instances("Models/valoria/paving.glb", tiles, { distance = 600 })
end

function M.Build()
    model("bridge", cx, cz + 170, { name = "Most hrdinů", collider = "mesh" })
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

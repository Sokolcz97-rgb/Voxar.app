package.path = "game/voxario/Eryndor/Assets/Scripts/?.lua;" .. package.path

local calls = {}
local instanceCalls = {}
local function ground(x, z)
    return 12 + (x - 3000) * 0.03 + (z - 2400) * 0.02 + ((x == 3000 and z == 2400) and 1 or 0)
end
world = {
    height = function(x, z) return ground(x, z), { y = 1 } end,
    spawn = function(...)
        calls[#calls + 1] = { ... }
        return #calls
    end,
    instances = function(...)
        instanceCalls[#instanceCalls + 1] = { ... }
        return #instanceCalls
    end,
}

local valoria = require("eryndor.valoria")
valoria.Build()
assert(valoria.NearPortal(valoria.CityPortal.x, valoria.CityPortal.z) == valoria.OutpostPortal)
assert(valoria.NearPortal(valoria.OutpostPortal.x, valoria.OutpostPortal.z) == valoria.CityPortal)
assert(valoria.NearPortal(0, 0) == nil)

local found = {}
for _, call in ipairs(calls) do found[call[1]] = (found[call[1]] or 0) + 1 end
for _, name in ipairs({ "bridge", "gate", "hero", "house_blue", "house_red", "keep" }) do
    assert(found["Models/valoria/" .. name .. ".glb"], "missing city model " .. name)
end
assert(found["Models/nature/aetherium_big.glb"] == 2, "both portals must be visible")
assert(found["Models/valoria/keep_floor.glb"] == 1, "castle floor must have its own collider")
assert(found["Models/valoria/keep_step.glb"] == 2, "castle entrance must have two steps")
assert(found["light"] == 4, "castle and both portals must have lights")
local maxGround = -math.huge
for x = -16, 16, 2 do
    for z = -11, 13, 2 do
        maxGround = math.max(maxGround, ground(3000 + x, 2165 + z))
    end
end
assert(math.abs(valoria.KeepFloorY - maxGround - 0.05) < 1e-8, "floor must clear terrain vertices")
local floor = calls[valoria.KeepFloor]
assert(floor[1] == "Models/valoria/keep_floor.glb" and floor[5].collider == "mesh")
assert(math.abs(floor[3] + 0.02 - valoria.KeepFloorY) < 1e-8)
local steps = {}
for _, call in ipairs(calls) do
    if call[1] == "Models/valoria/keep_step.glb" then steps[#steps + 1] = call end
end
for i, step in ipairs(steps) do
    assert(step[2] == 3000 and step[4] == 2177 + i * 2 - 1 and step[5].collider == "mesh")
    assert(math.abs(step[3] + 0.02 - (valoria.KeepFloorY - i * 0.2)) < 1e-8)
end
assert(#instanceCalls == 1 and instanceCalls[1][1] == "Models/valoria/paving.glb")
local tiles = instanceCalls[1][2]
assert(#tiles == 9 * 80, "street must cover its full footprint")
local positions = {}
for _, tile in ipairs(tiles) do
    local x, y, z = tile[1], tile[2], tile[3]
    assert(x >= 2992 and x <= 3008 and z >= 2311 and z <= 2469, "tile is outside the street footprint")
    local key = x .. ":" .. z
    assert(not positions[key], "duplicate street tile")
    positions[key] = true
    local highest = -math.huge
    for dx = -1, 1 do
        for dz = -1, 1 do
            highest = math.max(highest, ground(x + dx, z + dz))
        end
    end
    assert(math.abs(y - highest - 0.03) < 1e-8, "tile must clear sampled ground")
end
print("Valoria scene and portals: OK")

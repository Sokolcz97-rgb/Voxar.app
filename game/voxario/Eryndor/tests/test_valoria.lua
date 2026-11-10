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
assert(found["light"] == 4, "castle and both portals must have lights")
assert(#instanceCalls == 1 and instanceCalls[1][1] == "Models/valoria/paving.glb")
local tiles = instanceCalls[1][2]
assert(#tiles == 9 * 80 + 125, "street and castle floor must cover their footprints")
local positions = {}
for _, tile in ipairs(tiles) do
    local x, y, z = tile[1], tile[2], tile[3]
    local street = x >= 2992 and x <= 3008 and z >= 2311 and z <= 2469
    local floor = x >= 2986 and x <= 3014 and z >= 2157 and z <= 2175
    assert(street or floor, "tile is outside both paving footprints")
    if floor then
        assert(math.abs(x - 3000) >= 6 or math.abs(z - 2165) >= 6, "floor overlaps the central tower")
    end
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

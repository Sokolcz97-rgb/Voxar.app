package.path = "game/voxario/Eryndor/Assets/Scripts/?.lua;" .. package.path

local calls = {}
world = {
    height = function() return 12, { y = 1 } end,
    spawn = function(...)
        calls[#calls + 1] = { ... }
        return #calls
    end,
}

local valoria = require("eryndor.valoria")
valoria.Build()
assert(valoria.NearPortal(valoria.CityPortal.x, valoria.CityPortal.z) == valoria.OutpostPortal)
assert(valoria.NearPortal(valoria.OutpostPortal.x, valoria.OutpostPortal.z) == valoria.CityPortal)
assert(valoria.NearPortal(0, 0) == nil)

local found = {}
for _, call in ipairs(calls) do found[call[1]] = (found[call[1]] or 0) + 1 end
for _, name in ipairs({ "bridge", "paving", "gate", "hero", "house_blue", "house_red", "keep" }) do
    assert(found["Models/valoria/" .. name .. ".glb"], "missing city model " .. name)
end
assert(found["Models/nature/aetherium_big.glb"] == 2, "both portals must be visible")
print("Valoria scene and portals: OK")

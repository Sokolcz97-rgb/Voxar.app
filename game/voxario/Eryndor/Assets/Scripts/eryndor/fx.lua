-- Efekty dovedností: letící střely (kouzla, šipky), záblesky plošných útoků, záře léčení.
-- Svítící koule a světla z enginu (krátce žijí, pak se smažou).
local map = require("eryndor.map")
local M = { list = {} }

local function glowColor(c, k) return { c[1] * k, c[2] * k, c[3] * k } end

-- střela z bodu do cíle (cílová entita se může hýbat); onHit po doletu
function M.Bolt(x, y, z, target, color, speed, onHit, size)
    size = size or 0.35
    local id = _G.world.spawn("sphere", x, y, z, { size = { size, size, size }, color = color, emissive = glowColor(color, 6) })
    local light = _G.world.spawn("light", x, y, z, { light = { color = color, intensity = 12, range = 6 } })
    M.list[#M.list + 1] = { kind = "bolt", id = id, light = light, x = x, y = y, z = z, target = target, speed = speed or 22, onHit = onHit }
end

-- záblesk (kruh na zemi a světlo), r = poloměr
function M.Burst(x, z, r, color)
    local y = map.HeightAt(x, z)
    local id = _G.world.spawn("cylinder", x, y + 0.05, z, { size = { r * 2, 0.06, r * 2 }, color = color, emissive = glowColor(color, 3) })
    local light = _G.world.spawn("light", x, y + 1.5, z, { light = { color = color, intensity = 40, range = r * 3 } })
    M.list[#M.list + 1] = { kind = "burst", id = id, light = light, t = game.time(), dur = 0.45 }
end

-- záře kolem postavy (léčení, posílení)
function M.Aura(x, z, color)
    local y = map.HeightAt(x, z)
    local id = _G.world.spawn("cylinder", x, y + 1.0, z, { size = { 1.4, 2.0, 1.4 }, color = color, emissive = glowColor(color, 2) })
    local light = _G.world.spawn("light", x, y + 1.2, z, { light = { color = color, intensity = 25, range = 6 } })
    M.list[#M.list + 1] = { kind = "burst", id = id, light = light, t = game.time(), dur = 0.6 }
end

function M.Update(dt, posOf)
    local keep = {}
    local now = game.time()
    for _, f in ipairs(M.list) do
        local alive = true
        if f.kind == "bolt" then
            local tx, ty, tz = posOf(f.target)
            ty = ty + 1.1
            local dx, dy, dz = tx - f.x, ty - f.y, tz - f.z
            local d = math.sqrt(dx * dx + dy * dy + dz * dz)
            local step = f.speed * dt
            if d <= step or d < 0.3 then
                alive = false
                if f.onHit then f.onHit() end
            else
                f.x, f.y, f.z = f.x + dx / d * step, f.y + dy / d * step, f.z + dz / d * step
                entity.set_position(f.id, f.x, f.y, f.z)
                entity.set_position(f.light, f.x, f.y, f.z)
            end
        elseif now - f.t > f.dur then
            alive = false
        end
        if alive then keep[#keep + 1] = f else entity.destroy(f.id); entity.destroy(f.light) end
    end
    M.list = keep
end

return M

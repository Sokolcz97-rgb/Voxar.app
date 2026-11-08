-- Efekty dovedností: částice enginu (world.particles) – oheň, mráz, arkána, blesk, léčení, svatost, jed, stín,
-- jiskry, výbuch; střely nechávají stopu a při zásahu vybuchnou, plošná kouzla mají kruh a vlnu částic,
-- posílení a léčení stoupající spirálu. Svítící jádro a světla z enginu (krátce žijí, pak se smažou).
local map = require("eryndor.map")
local M = { list = {} }

local function glowColor(c, k) return { c[1] * k, c[2] * k, c[3] * k } end
local function particles(x, y, z, opts)
    local f = _G.world.particles
    if not f then return nil end
    return f(x, y, z, opts)
end

-- výbuch živlu při zásahu / plošném útoku
local IMPACT = {
    fire = { preset = "explosion" }, frost = { preset = "frost_burst" },
    arcane = { preset = "arcane", rate = 0, burst = 90, duration = 0, speed = 3.5, spread = 1, life = 0.6 },
    lightning = { preset = "lightning", rate = 0, burst = 110, duration = 0, speed = 5, life = 0.35 },
    holy = { preset = "holy", rate = 0, burst = 80, duration = 0, speed = 3, spread = 1, ring = false, life = 0.8 },
    heal = { preset = "heal", rate = 0, burst = 70, duration = 0, speed = 2.5, spread = 1, ring = false },
    poison = { preset = "poison", rate = 0, burst = 70, duration = 0, speed = 2.2, spread = 1 },
    shadow = { preset = "shadow", rate = 0, burst = 80, duration = 0, speed = 3, spread = 1 },
    spark = { preset = "spark", rate = 0, burst = 60, duration = 0 },
}
local TRAIL = { fire = "fire", frost = "frost", arcane = "arcane", lightning = "lightning", holy = "holy", heal = "heal",
                poison = "poison", shadow = "shadow", spark = "spark" }

local function track(id, dur, extra)
    if not id then return end
    local f = extra or {}
    f.kind, f.id, f.t, f.dur = f.kind or "temp", id, game.time(), dur
    M.list[#M.list + 1] = f
end

-- jednorázový výbuch živlu v bodě
function M.Impact(x, y, z, element, scale)
    local o = IMPACT[element or "spark"] or IMPACT.spark
    local opts = {}
    for k, v in pairs(o) do opts[k] = v end
    if scale then opts.size = scale end
    track(particles(x, y, z, opts), 1.6)
end

-- střela z bodu do cíle (cílová entita se může hýbat); onHit po doletu
function M.Bolt(x, y, z, target, color, speed, onHit, size, element)
    size = size or 0.35
    local id = _G.world.spawn("sphere", x, y, z, { size = { size, size, size }, color = color, emissive = glowColor(color, 6) })
    local light = _G.world.spawn("light", x, y, z, { light = { color = color, intensity = 12, range = 6 } })
    local trail = particles(x, y, z, { preset = TRAIL[element or "arcane"] or "arcane", rate = 120, speed = 0.4, spread = 1,
                                       gravity = 0, life = 0.45, size = 0.9 })
    M.list[#M.list + 1] = { kind = "bolt", id = id, light = light, trail = trail, x = x, y = y, z = z, target = target,
                            speed = speed or 22, onHit = onHit, element = element }
end

-- záblesk (kruh na zemi, vlna částic a světlo), r = poloměr
function M.Burst(x, z, r, color, element)
    local y = map.HeightAt(x, z)
    local light = _G.world.spawn("light", x, y + 1.5, z, { light = { color = color, intensity = 40, range = r * 3 } })
    M.list[#M.list + 1] = { kind = "burst", id = light, t = game.time(), dur = 0.5 }
    element = element or "spark"
    -- vlna po obvodu + výbuch uprostřed
    track(particles(x, y + 0.3, z, { preset = TRAIL[element] or "spark", rate = 0, burst = math.floor(40 + r * 18), duration = 0,
                                     radius = r * 0.9, ring = true, speed = 2.2, spread = 0.35, dir = { 0, 1, 0 }, life = 0.8 }), 1.4)
    M.Impact(x, y + 0.6, z, element)
end

-- záře kolem postavy (léčení, posílení): stoupající spirála částic
function M.Aura(x, z, color, element)
    local y = map.HeightAt(x, z)
    local light = _G.world.spawn("light", x, y + 1.2, z, { light = { color = color, intensity = 25, range = 6 } })
    M.list[#M.list + 1] = { kind = "burst", id = light, t = game.time(), dur = 0.8 }
    element = element or "heal"
    local preset = (element == "heal" or element == "holy") and element or (TRAIL[element] or "heal")
    track(particles(x, y + 0.1, z, { preset = preset, duration = 0.9, radius = 0.65, ring = true, dir = { 0, 1, 0 }, spread = 0.08,
                                     speed = 1.8, swirl = 2.5 }), 3.0)
end

-- efekt sesílání v rukou (dokud trvá sesílání)
function M.Cast(x, y, z, element, dur)
    track(particles(x, y, z, { preset = TRAIL[element or "arcane"] or "arcane", radius = 0.25, duration = dur or 1, speed = 0.6,
                               spread = 1, swirl = 3, size = 0.8 }), (dur or 1) + 1.2)
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
                M.Impact(tx, ty, tz, f.element or "arcane")
                if f.onHit then f.onHit() end
            else
                f.x, f.y, f.z = f.x + dx / d * step, f.y + dy / d * step, f.z + dz / d * step
                entity.set_position(f.id, f.x, f.y, f.z)
                entity.set_position(f.light, f.x, f.y, f.z)
                if f.trail then entity.set_position(f.trail, f.x, f.y, f.z) end
            end
            if not alive then
                entity.destroy(f.id); entity.destroy(f.light)
                if f.trail then track(f.trail, 0.6) end   -- stopa dohasne
            end
        elseif now - f.t > f.dur then
            alive = false
            entity.destroy(f.id)
            if f.light then entity.destroy(f.light) end
        end
        if alive then keep[#keep + 1] = f end
    end
    M.list = keep
end

return M

-- Eryndor – testovací fantasy kanál (Voxario Studio Engine).
-- Počáteční lokace Hraniční údolí Zlomu podle lore „Svět Eryndor a Velký Rozkol“.
local map = require("eryndor.map")
local world = require("eryndor.world")

local deg, atan, sqrt = math.deg, math.atan, math.sqrt
local game_ = { built = false, camera = nil, shot = nil }
_G.eryndor = game_

local function lookFrom(x, y, z, tx, ty, tz)
    local cam = game_.camera or entity.find("Camera")
    game_.camera = cam
    local dx, dy, dz = tx - x, ty - y, tz - z
    entity.set_position(cam, x, y, z)
    entity.set_rotation(cam, deg(atan(dy, sqrt(dx * dx + dz * dz))), deg(atan(-dx, -dz)), 0)
end
game_.LookFrom = lookFrom

local function shot(name) game.screenshot(name .. ".png"); timer.sleep(0.3) end
local G = map.HeightAt

-- ------------------------------------------------------------------ samotest: záběry lokace a počasí
local function Selftest()
    local only = game.env and game.env("VOXARIO_SELFTEST_ONLY")
    _G.world.environment({ real_time = false, day_night = true, time_of_day = 15, day_length = 0 })
    _G.world.weather({ rain = 0, snow = 0, storm = 0, wind = 0.3, instant = true })
    timer.sleep(3)
    local function view(name, x, y, z, tx, ty, tz, wait)
        lookFrom(x, G(x, z) + y, z, tx, G(tx, tz) + ty, tz)
        timer.sleep(wait or 2.5)
        shot(name)
    end
    if only ~= "weather" then
        view("01-udoli", 6, 22, -96, 0, 2, 30, 4)
        view("02-sylvaria", -40, 6, -36, -100, 6, 10)
        view("03-strom", -88, 4, -6, map.Giant.x, 12, map.Giant.z)
        view("04-svatyne", -66, 4, -36, map.Shrine.x, 3, map.Shrine.z)
        view("05-jezero", -30, 3, -30, 20, 1, 30)
        view("06-aethelgard", 82, 5, -14, map.Tower.x, 6, map.Tower.z)
        view("07-trhlina", -8, 7, 96, map.Rift.x, 3, map.Rift.z)
        _G.world.environment({ time_of_day = 22.5 })
        view("08-noc-les", -40, 6, -36, -100, 6, 10, 3)
        view("09-noc-trhlina", -8, 7, 96, map.Rift.x, 3, map.Rift.z, 2)
    end
    -- počasí
    _G.world.environment({ time_of_day = 14 })
    _G.world.weather({ rain = 0.9, wind = 0.6, instant = true })
    view("10-dest", -30, 3, -30, 20, 2, 30, 3)
    view("10b-dest-les", -40, 2.5, -36, -80, 3, -20, 2)
    _G.world.weather({ rain = 1, storm = 1, wind = 1, instant = true })
    _G.world.environment({ time_of_day = 19.5 })
    for i = 1, 40 do   -- počkat na blesk
        timer.sleep(0.25)
        if _G.world.weather().flash > 0.4 then break end
    end
    view("11-bourka-blesk", 4, 9, -62, 0, 3, 40, 0.05)
    _G.world.weather({ rain = 0, storm = 0, snow = 1, wind = 0.4, instant = true })
    _G.world.environment({ time_of_day = 11 })
    view("12-snih", 82, 5, -14, map.Tower.x, 6, map.Tower.z, 3)
    _G.world.weather({ snow = 0, wind = 0.25, instant = true })
    game.log("SELFTEST hotovo")
    game.quit()
end

function on_start()
    _G.world.environment({ day_night = true, real_time = false, time_of_day = 15, day_length = 60, fog = 0.0022,
                           shadow_distance = 220, haze = 0.45, exposure = 0.85, night_exposure = 1.6,
                           contrast = 1.1, saturation = 1.22, clouds = 0.45, bloom = 0.12 })
    world.Build()
    game_.built = true
    if game.selftest() then timer.start(Selftest); return end
    lookFrom(6, G(6, -96) + 22, -96, 0, G(0, 30) + 2, 30)
end

function on_update(dt)
end

function on_gui()
end

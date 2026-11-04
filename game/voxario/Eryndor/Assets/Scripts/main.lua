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
    if graphics and graphics.detail_density then graphics.detail_density(0.35) end   -- software Vulkan v CI
    _G.world.environment({ real_time = false, day_night = true, time_of_day = 15, day_length = 0 })
    _G.world.weather({ rain = 0, snow = 0, storm = 0, wind = 0.3, instant = true })
    timer.sleep(3)
    local function view(name, x, y, z, tx, ty, tz, wait)
        lookFrom(x, G(x, z) + y, z, tx, G(tx, tz) + ty, tz)
        timer.sleep(wait or 2.5)
        shot(name)
    end
    if only == "chars" then
        -- postavy vedle sebe s výbavou (show_part) a oblečenými díly z jiných postav (equip)
        local outfit = require("eryndor.outfit")
        _G.world.environment({ time_of_day = 16 })
        local bx, bz = 8, -64
        local row = {
            { "knight_sylvaria", { "1H_Sword", "Round_Shield", "Knight_Helmet", "Knight_Cape" } },
            { "mage_sylvaria", { "2H_Staff", "Mage_Hat", "Mage_Cape" } },
            { "ranger_sylvaria", { "2H_Crossbow", "Rogue_Cape" } },
            { "knight_aethel", { "2H_Sword", "Knight_Cape" }, { { "mage_sylvaria", "Mage_Hat" } } },
            { "warden_aethel", { "2H_Axe", "Barbarian_Hat", "Barbarian_Cape" } },
            { "engineer_aethel", { "1H_Crossbow", "Knife_Offhand" }, { { "warden_aethel", "Barbarian_Cape" } } },
            { "cultist", { "Knife", "Knife_Offhand", "Rogue_Cape" } },
            { "crusher", { "2H_Axe" } },
            { "lyrise", { "Spellbook_open", "1H_Wand", "Mage_Cape" } },
        }
        local ids = {}
        for i, r in ipairs(row) do
            local x = bx + (i - 5) * 1.7
            local id = _G.world.spawn("Models/heroes/" .. r[1] .. ".glb", x, G(x, bz), bz, { yaw = 0, name = r[1],
                scale = r[1] == "crusher" and 1.2 or 1.0 })
            outfit.Wear(id, r[1], r[2])
            for _, e in ipairs(r[3] or {}) do outfit.Equip(id, e[1], e[2]) end
            ids[i] = id
        end
        lookFrom(bx + 1.0, G(bx, bz) + 1.6, bz + 9.0, bx, G(bx, bz) + 1.0, bz)
        timer.sleep(3)
        game.log("DILY: " .. table.concat(entity.parts(ids[1]), ", "))
        local function all(clip, t, name)
            for _, id in ipairs(ids) do anim.play(id, clip, 0, not clip:find("Death")) end
            timer.sleep(t); shot(name)
        end
        all("Idle", 1.0, "c1-klid")
        all("2H_Melee_Idle", 0.8, "c2-boj-postoj")
        all("Running_A", 0.2, "c3-beh")
        all("1H_Melee_Attack_Chop", 0.45, "c4-utok1")
        all("2H_Melee_Attack_Spin", 0.5, "c5-utok-rotace")
        all("Spellcasting", 0.5, "c6-kouzlo")
        all("Block", 0.4, "c7-blok")
        all("Death_A", 1.6, "c8-pad")
        lookFrom(bx + 7, G(bx, bz) + 1.4, bz + 1, bx, G(bx, bz) + 1.0, bz)
        all("Walking_A", 0.3, "c9-chuze-bok")
        lookFrom(bx - 6.1, G(bx, bz) + 1.5, bz + 3.0, bx - 6.6, G(bx, bz) + 1.3, bz)
        all("Idle", 0.6, "c10-detail")
        game.log("SELFTEST hotovo")
        game.quit()
        return
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

-- Eryndor – testovací fantasy kanál (Voxario Studio Engine).
-- Počáteční lokace Hraniční údolí Zlomu podle lore „Svět Eryndor a Velký Rozkol“.
local map = require("eryndor.map")
local world = require("eryndor.world")
local player = require("eryndor.player")
local combat = require("eryndor.combat")
local hud = require("eryndor.hud")
local quest = require("eryndor.quest")
local outfit = require("eryndor.outfit")

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
local Selftest
function Selftest()
    local only = game.env and game.env("VOXARIO_SELFTEST_ONLY")
    game_.SetMode("test")
    if graphics and graphics.detail_density then graphics.detail_density(0.35) end   -- software Vulkan v CI
    _G.world.environment({ real_time = false, day_night = true, time_of_day = 15, day_length = 0 })
    _G.world.weather({ rain = 0, snow = 0, storm = 0, wind = 0.3, instant = true })
    timer.sleep(3)
    local function view(name, x, y, z, tx, ty, tz, wait)
        lookFrom(x, G(x, z) + y, z, tx, G(tx, tz) + ty, tz)
        timer.sleep(wait or 2.5)
        shot(name)
    end
    if only == "game" then
        -- výběr povolání, vstup, boj s vlky (Tab, automatický útok, dovednosti), rozhovor s Lyrise
        _G.world.environment({ time_of_day = 15.5 })
        game_.SetMode("select"); game_.Preview(1)
        timer.sleep(2.5); shot("g0-vyber")
        game_.EnterWorld(1)
        timer.sleep(2)
        player.Teleport(16, -72)
        player.cam.yaw = 50
        timer.sleep(2); shot("g1-hrac")
        combat.TabTarget(); combat.StartAttack()
        timer.sleep(3.5); shot("g2-boj")
        combat.UseSkill(1); timer.sleep(0.45); shot("g3-dovednost")
        timer.sleep(1.2); combat.UseSkill(3); timer.sleep(0.5); shot("g4-vir-cepele")
        timer.sleep(5); shot("g5-boj-dal")
        player.Teleport(map.Lyrise.x + 1.5, map.Lyrise.z - 2.5)
        player.cam.yaw = -20
        timer.sleep(1.5); quest.Talk(); timer.sleep(0.6); shot("g6-lyrise")
        quest.dialog = nil
        -- mág u trhliny
        game_.Reset()
        game_.EnterWorld(2)
        player.Teleport(-12, 92); player.cam.yaw = 25
        timer.sleep(2)
        combat.TabTarget(); combat.UseSkill(1)
        timer.sleep(0.8); shot("g7-mag-sesilani")
        timer.sleep(2.5); shot("g8-mag-boj")
        game.log("SELFTEST hotovo")
        game.quit()
        return
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

-- ------------------------------------------------------------------ výběr povolání a vstup do hry
local sel = { index = 1, changed = true }
local mode = "select"

local function showPreview()
    if sel.preview then entity.destroy(sel.preview) end
    local c = combat.Classes[sel.index]
    local x, z = map.Start.x, map.Start.z
    sel.preview = _G.world.spawn("Models/heroes/" .. c.model .. ".glb", x, G(x, z), z, { yaw = 200, name = c.name })
    outfit.Wear(sel.preview, c.model, c.gear)
    anim.play(sel.preview, "Cheer", 0.1, false, true)
    sel.anim = game.time() + 1.6
    lookFrom(x - 1.2, G(x, z) + 1.5, z - 4.6, x, G(x, z) + 1.0, z)
end

local function enterWorld()
    if sel.preview then entity.destroy(sel.preview); sel.preview = nil end
    local c = combat.Classes[sel.index]
    player.Create(c, map.Start)
    combat.SetupPlayer(c)
    combat.SpawnAll()
    quest.Spawn()
    combat.Log("Vítej v Hraničním údolí Zlomu, Ozvěno.", { 0.8, 0.9, 1.0 })
    combat.Log("Tab cíl · R útok · 1–5 dovednosti · F mluvit · pravé tlačítko kamera", { 0.7, 0.7, 0.7 })
    mode = "play"
    game_.mode = mode
end
game_.EnterWorld = function(i) sel.index = i or sel.index; enterWorld() end
game_.SetMode = function(m) mode = m; game_.mode = m; sel.changed = false end
game_.Preview = function(i) sel.index = i; showPreview() end
-- (samotest) zpět před vstup: hráč, nepřátelé a Lyrise pryč
game_.Reset = function()
    for _, m in ipairs(combat.mobs) do entity.destroy(m.id) end
    combat.mobs, combat.target, combat.auto, combat.floats = {}, nil, false, {}
    if player.view then entity.destroy(player.view); entity.destroy(player.body); entity.destroy(player.lamp) end
    if quest.npc then entity.destroy(quest.npc); entity.destroy(quest.light) end
    player.dead = false
end

-- počasí se v údolí střídá (jasno, oblačno, déšť, bouřka; v noci občas mlha)
local nextWeather = 0
local function weatherCycle()
    if game.time() < nextWeather then return end
    nextWeather = game.time() + 150 + math.random() * 150
    local r = math.random()
    if r < 0.45 then _G.world.weather({ rain = 0, storm = 0, wind = 0.25 })
    elseif r < 0.7 then _G.world.weather({ rain = 0, storm = 0, wind = 0.55 }); _G.world.environment({ clouds = 0.75 })
    elseif r < 0.9 then _G.world.weather({ rain = 0.8, storm = 0, wind = 0.5 })
    else _G.world.weather({ rain = 1, storm = 1, wind = 0.9 }) end
end

function on_start()
    hud.Init()
    _G.world.environment({ day_night = true, real_time = false, time_of_day = 15, day_length = 60, fog = 0.0022,
                           shadow_distance = 220, haze = 0.45, exposure = 0.85, night_exposure = 1.6,
                           contrast = 1.1, saturation = 1.22, clouds = 0.45, bloom = 0.12 })
    world.Build()
    game_.built = true
    if game.custom_pause then game.custom_pause(true) end
    if game.selftest() then timer.start(Selftest); return end
    showPreview()
    nextWeather = game.time() + 120
end

local lastThunder = 0
function on_update(dt)
    if mode ~= "play" and mode ~= "select" then return end
    if mode == "select" then
        if sel.anim and game.time() > sel.anim and sel.preview then anim.play(sel.preview, "Idle", 0.3); sel.anim = nil end
        return
    end
    if not ui.wants_keyboard() and not quest.dialog then
        if input.pressed("Tab") then combat.TabTarget() end
        if input.pressed("R") then combat.StartAttack() end
        if input.pressed("Escape") then combat.target, combat.auto = nil, false end
        for i = 1, 6 do if input.pressed(tostring(i)) then combat.UseSkill(i) end end
        if input.pressed("F") then quest.Talk() end
    end
    combat.Update(dt)
    player.Update(dt, combat.inCombat, combat.moveTo, combat.me and combat.me.casting ~= nil)
    player.UpdateCamera(dt)
    weatherCycle()
    local w = _G.world.weather()
    if w.lightning ~= lastThunder then lastThunder = w.lightning end
end

-- výběr cíle myší: nejbližší nepřítel u kurzoru (levé tlačítko vybere, pravé vybere a zaútočí)
local rightDown
local function pick()
    local mx, my = ui.mouse()
    local best, bd = nil, 70 * 70
    for _, m in ipairs(combat.Hostiles()) do
        local x, y, vis = ui.world_to_screen(m.x, G(m.x, m.z) + 1.0 * (m.t.scale or 1), m.z)
        if vis then
            local d = (x - mx) ^ 2 + (y - my) ^ 2
            if d < bd then best, bd = m, d end
        end
    end
    return best
end

function on_gui()
    if mode == "select" then
        hud.DrawSelect(sel)
        if sel.changed then sel.changed = false; showPreview() end
        if sel.enter then sel.enter = false; enterWorld() end
        return
    end
    if mode ~= "play" then return end
    if not ui.wants_mouse() then
        if input.pressed("Mouse1") then
            local m = pick()
            if m then combat.Select(m) end
        end
        if input.pressed("Mouse2") then rightDown = { game.time(), ui.mouse() } end
        if rightDown and not input.key("Mouse2") then
            if game.time() - rightDown[1] < 0.3 then
                local m = pick()
                if m then combat.Select(m); combat.StartAttack() end
            end
            rightDown = nil
        end
    end
    -- jmenovka Lyrise
    local l = map.Lyrise
    ui.world_label(l.x, G(l.x, l.z) + 2.6, l.z, quest.step == 1 and "! Archivářka Lyrise" or "Archivářka Lyrise",
        { color = "#9fc8ff", size = 20, max_distance = 40 })
    if quest.NearNpc() and not quest.dialog then
        local sw, sh = ui.screen()
        ui.font("body"); ui.text(sw / 2, sh - 190, "[F] Mluvit", { align = "center", color = "#ffe8b0", shadow = true }); ui.pop_font()
    end
    hud.DrawGame()
    hud.DrawQuest(quest.Tracker())
    hud.DrawDialog(quest.dialog)
end

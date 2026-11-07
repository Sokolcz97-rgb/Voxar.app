-- Eryndor – testovací fantasy kanál (Voxario Studio Engine).
-- Počáteční lokace Hraniční údolí Zlomu podle lore „Svět Eryndor a Velký Rozkol“.
local map = require("eryndor.map")
local world = require("eryndor.world")
local player = require("eryndor.player")
local combat = require("eryndor.combat")
local hud = require("eryndor.hud")
local quest = require("eryndor.quest")

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
        -- rytíř proti lávovému pavoukovi (Creature Forge) na popelavém návrší
        game_.Reset()
        game_.EnterWorld(1)
        player.Teleport(68, 76); player.cam.yaw = 40
        timer.sleep(2.5); shot("g9-lavovy-pavouk")
        combat.TabTarget(); combat.StartAttack()
        timer.sleep(3.0); shot("g10-boj-s-pavoukem")
        combat.UseSkill(1); timer.sleep(0.5); shot("g11-uder-zridla-pavouk")
        timer.sleep(3.5); shot("g12-pavouk-utoci")
        -- ledový drak (elitní, Creature Forge): řev při zahlédnutí, boj
        game_.Reset()
        game_.EnterWorld(3)
        player.Teleport(-46, 138); player.cam.yaw = -40
        timer.sleep(2.5); shot("g13-ledovy-drak")
        combat.TabTarget(); combat.StartAttack()
        timer.sleep(1.2); shot("g14-drak-rve")
        timer.sleep(3.0); shot("g15-boj-s-drakem")
        combat.UseSkill(1); timer.sleep(0.5); shot("g16-drak-utok")
        game.log("SELFTEST hotovo")
        game.quit()
        return
    end
    if only == "spider" or only == "dragon" then
        -- tvor z Creature Forge zblízka: klid, chůze, útok, smrt, ve dne a v noci
        combat.SpawnAll()
        local sp
        for _, m in ipairs(combat.mobs) do if m.kind == only then sp = m; break end end
        if only == "dragon" then
            local x, z = sp.x, sp.z
            local function at(name, dx, dy, dz, ty, wait)
                lookFrom(x + dx, G(x, z) + dy, z + dz, x, G(x, z) + ty, z); timer.sleep(wait or 1.5); shot(name)
            end
            entity.set_rotation(sp.id, 0, 200, 0)
            at("d1-drak", -6.5, 3.2, -7.5, 2.2, 3)
            at("d2-drak-bok", -9.5, 2.6, 1.5, 2.2)
            at("d3-drak-hlava", -2.4, 4.0, -4.8, 3.6)
            anim.play(sp.id, "Roar", 0.1, false, true); at("d4-rev", -6.5, 3.2, -7.5, 2.4, 0.8)
            anim.play(sp.id, "Flap", 0.1, true, true); at("d5-kridla", -6.5, 3.2, -7.5, 2.4, 0.45)
            anim.play(sp.id, "Attack", 0.05, false, true); at("d6-utok", -6.5, 3.2, -7.5, 2.2, 0.62)
            anim.play(sp.id, "Idle", 0.1, true, true)
            _G.world.weather({ snow = 0.8, wind = 0.5, instant = true })
            at("d7-snezeni", -6.5, 3.2, -7.5, 2.2, 2)
            _G.world.weather({ snow = 0, wind = 0.25, instant = true })
            _G.world.environment({ time_of_day = 22.5 })
            at("d8-drak-noc", -6.5, 3.2, -7.5, 2.2, 3)
            game.log("SELFTEST hotovo")
            game.quit()
            return
        end
        local x, z = sp.x, sp.z
        entity.set_rotation(sp.id, 0, 215, 0)
        local function at(name, dx, dy, dz, wait) lookFrom(x + dx, G(x, z) + dy, z + dz, x, G(x, z) + 0.7, z); timer.sleep(wait or 1.5); shot(name) end
        at("s1-pavouk", -3.6, 1.8, -3.4, 3)
        at("s2-pavouk-bok", -4.4, 1.4, 0.6)
        at("s3-pavouk-oci", -1.4, 1.0, -2.0)
        anim.play(sp.id, "Walk", 0.1, true, true); at("s4-chuze", -3.6, 1.8, -3.4, 0.5)
        anim.play(sp.id, "Attack", 0.05, false, true); at("s5-utok", -3.6, 1.8, -3.4, 0.42)
        anim.play(sp.id, "Death", 0.1, false, true); at("s6-smrt", -3.6, 1.8, -3.4, 1.6)
        anim.play(sp.id, "Idle", 0.1, true, true)
        _G.world.environment({ time_of_day = 22.5 })
        at("s7-pavouk-noc", -3.6, 1.8, -3.4, 3)
        at("s8-hnizdo-noc", -14, 6, -14, 1.5)
        game.log("SELFTEST hotovo")
        game.quit()
        return
    end
    if only == "humans" then
        -- realistické postavy (MakeHuman CC0) v animacích přenesených z KayKitu
        _G.world.environment({ time_of_day = 15.5 })
        local list = game.env("VOXARIO_HUMANS") or "test_male"
        local ids = {}
        local bx, bz = 8, -82
        local n = 0
        for name in list:gmatch("[^,]+") do n = n + 1 end
        local i = 0
        local looks = { syl_knight_m = { right = "sword", left = "shield" }, syl_mage_f = { right = "staff" },
                        aeth_heavy_m = { right = "sword2", helm = true }, aeth_engineer_f = { right = "crossbow", left = "dagger" },
                        cultist_m = { right = "dagger", left = "dagger" }, crusher = { right = "axe2" }, lyrise = { left = "book" } }
        for name in list:gmatch("[^,]+") do
            i = i + 1
            local x = bx + (i - (n + 1) / 2) * 1.4
            ids[#ids + 1] = require("eryndor.humans").Spawn(name, x, G(x, bz), bz, looks[name] or {})
        end
        lookFrom(bx + 0.6, G(bx, bz) + 1.45, bz + 2.2 + n * 0.9, bx, G(bx, bz) + 1.0, bz)
        timer.sleep(3)
        local function all(clip, t, name)
            for _, id in ipairs(ids) do anim.play(id, clip, 0, not clip:find("Death")) end
            timer.sleep(t); shot(name)
        end
        all("Idle", 1.0, "h1-klid")
        all("Walking_A", 0.3, "h2-chuze")
        all("1H_Melee_Attack_Chop", 0.45, "h3-sek")
        all("2H_Melee_Attack_Spin", 0.5, "h4-rotace")
        all("Spellcasting", 0.5, "h5-kouzlo")
        all("Block", 0.4, "h6-blok")
        lookFrom(bx + 3.2, G(bx, bz) + 1.3, bz + 0.4, bx, G(bx, bz) + 1.0, bz)
        all("Running_A", 0.25, "h7-beh-bok")
        lookFrom(bx + 0.25, G(bx, bz) + 1.72, bz + 0.85, bx, G(bx, bz) + 1.62, bz)
        all("Idle", 0.5, "h8-oblicej")
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
    sel.preview = require("eryndor.humans").Spawn(c.model, x, G(x, z), z, { yaw = 200, name = c.name, right = c.look.right,
        left = c.look.left, helm = c.look.helm })
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
    for _, m in ipairs(combat.mobs) do entity.destroy(m.id); if m.light then entity.destroy(m.light) end end
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
                           contrast = 1.1, saturation = 1.22, clouds = 0.45, bloom = 0.12,
                           style = "realistic" })   -- realistické vykreslování enginu (fyzikální PBR + SSAO)
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

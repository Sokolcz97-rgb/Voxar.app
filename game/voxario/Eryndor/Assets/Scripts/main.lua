-- Eryndor – testovací fantasy kanál (Voxario Studio Engine).
-- Svět Aethelgard (8 x 8 km) podle „Herní dokumentace: Svět Aethelgard“: Verdant Canopy, Frostfang Peaks,
-- Ignis Scar, Crystalarium, Serpentine River a Azure Ocean. Klávesa M = mapa světa.
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

-- první spawn daného druhu nepřítele (samotest)
local function spawnOf(kind)
    for _, s in ipairs(map.Data.Spawns) do if s[1] == kind then return s[2], s[3] end end
    return map.Start.x, map.Start.z
end

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
        local wx, wz = spawnOf("wolf")
        player.Teleport(wx - 7, wz - 7)
        player.cam.yaw = 45
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
        local cx, cz = spawnOf("cultist")
        player.Teleport(cx - 10, cz - 6); player.cam.yaw = 60
        timer.sleep(2)
        combat.TabTarget(); combat.UseSkill(1)
        timer.sleep(0.8); shot("g7-mag-sesilani")
        timer.sleep(2.5); shot("g8-mag-boj")
        -- rytíř proti lávovému pavoukovi (Creature Forge) na popelavém návrší
        game_.Reset()
        game_.EnterWorld(1)
        local sx, sz = spawnOf("spider")
        player.Teleport(sx - 8, sz - 8); player.cam.yaw = 45
        timer.sleep(2.5); shot("g9-lavovy-pavouk")
        combat.TabTarget(); combat.StartAttack()
        timer.sleep(3.0); shot("g10-boj-s-pavoukem")
        combat.UseSkill(1); timer.sleep(0.5); shot("g11-uder-zridla-pavouk")
        timer.sleep(3.5); shot("g12-pavouk-utoci")
        -- ledový drak (elitní, Creature Forge): řev při zahlédnutí, boj
        game_.Reset()
        game_.EnterWorld(3)
        local dx, dz = spawnOf("dragon")
        player.Teleport(dx - 12, dz + 10); player.cam.yaw = -50
        timer.sleep(2.5); shot("g13-ledovy-drak")
        combat.TabTarget(); combat.StartAttack()
        timer.sleep(1.2); shot("g14-drak-rve")
        timer.sleep(3.0); shot("g15-boj-s-drakem")
        combat.UseSkill(1); timer.sleep(0.5); shot("g16-drak-utok")
        game.log("SELFTEST hotovo")
        game.quit()
        return
    end
    if only == "creator" then
        -- tvorba postavy: všechny rasy, tvar těla, nádech a záře, animace
        local races = require("eryndor.races")
        local cr = game_.Creator
        _G.world.environment({ time_of_day = 16 })
        game_.SetMode("select"); cr.Show()
        local n = 0
        local function set(r, tab, fn)
            cr.a = races.Default(r); cr.a.name = "Tester"; cr.rebuild = true
            if fn then fn(cr.a) end
            cr.forceTab, cr.tab = tab, tab
            timer.sleep(2.5)
        end
        local function snap(name) n = n + 1; shot(string.format("c%02d-%s", n, name)) end
        for _, r in ipairs(races.Order) do
            set(r, "race"); snap(r)
            cr.rot = 150; timer.sleep(0.8); snap(r .. "-zezadu"); cr.rot = 0
        end
        set("clovek", "body", function(a) a.height, a.shoulders, a.muscle, a.limbs = 1.15, 1.25, 1.28, 1.1 end); snap("telo-mohutne")
        set("clovek", "body", function(a) a.height, a.shoulders, a.muscle, a.limbs = 0.85, 0.85, 0.82, 0.9 end); snap("telo-stihle")
        set("vila", "look", function(a) a.glow, a.glowColor = 0.8, races.Hex("#b06cff") end); snap("vzhled-zare")
        set("obr", "look", function(a) a.tint, a.tintAmount = races.Hex("#d8e8ff"), 0.7 end); snap("vzhled-nadech")
        set("elf", "race"); cr.Pose("Spellcast_Shoot"); timer.sleep(0.6); snap("animace-kouzlo")
        set("trpaslik", "race"); cr.Pose(combat.Classes[1].skills[1].anim); timer.sleep(0.5); snap("animace-utok")
        set("kocka", "race"); cr.Pose("Running_A"); timer.sleep(0.5); snap("animace-beh")
        game.log("SELFTEST hotovo")
        game.quit()
        return
    end
    if only == "mp" then
        -- dva testeři naráz (dvě instance hry): VOXARIO_MP_ROLE = a | b
        local races = require("eryndor.races")
        local presence = require("eryndor.presence")
        local role = game.env("VOXARIO_MP_ROLE") or "a"
        _G.world.environment({ time_of_day = 15.5 })
        game_.SetMode("select")
        local cr = game_.Creator
        cr.Load()
        cr.a = races.Default(role == "a" and "obr" or "vila")
        cr.a.name = role == "a" and "Tester Obr" or "Testerka Víla"
        cr.a.cls = role == "a" and 1 or 2
        game_.EnterWorld()
        local S = map.Start
        if role == "a" then
            player.Teleport(S.x + 4, S.z - 6)
            for i = 1, 60 do   -- chodí sem a tam a útočí
                timer.sleep(0.5)
                player.Teleport(S.x + 4 + math.sin(i * 0.3) * 2, S.z - 6)
                if i % 8 == 0 then player.Action("1H_Melee_Attack_Chop", 0.9) end
            end
        else
            player.Teleport(S.x + 1, S.z - 1)
            player.cam.yaw = 160
            local t = 0
            while presence.count == 0 and t < 40 do timer.sleep(0.5); t = t + 0.5 end
            game.log("MP: ostatních hráčů = " .. presence.count)
            timer.sleep(3); shot("m1-dalsi-tester")
            local o
            for _, v in pairs(presence.others) do o = v end
            if o then
                lookFrom(o.pos[1] - 3, G(o.pos[1], o.pos[2]) + 1.8, o.pos[2] + 3.5, o.pos[1], G(o.pos[1], o.pos[2]) + 1.1, o.pos[2])
                player.inputEnabled = false
                game_.freeCam = true
                timer.sleep(1.5); shot("m2-tester-zblizka")
                timer.sleep(2.5); shot("m3-tester-utok")
            end
        end
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
        local bx, bz = map.Start.x + 6, map.Start.z - 8
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
        local S, Gi, Sh, R, L = map.Start, map.Giant, map.Shrine, map.Rift, map.DragonLair
        local V1 = map.Data.Volcanoes[1]
        local riv = map.Data.River[math.floor(#map.Data.River * 0.45)]
        local br = map.Data.Bridges[2]
        view("01-zakladna", S.x - 34, 12, S.z + 30, map.Tower.x, 6, map.Tower.z, 5)
        view("02-verdant-canopy", Gi.x + 150, 40, Gi.z + 120, Gi.x, 20, Gi.z, 4)
        view("03-tisicilety-strom", Gi.x + 34, 5, Gi.z + 26, Gi.x, 16, Gi.z, 3)
        view("04-elfi-svatyne", Sh.x + 26, 6, Sh.z + 22, Sh.x, 3, Sh.z, 3)
        view("05-serpentine-most", br.x + 90, 22, br.z + 70, br.x, 2, br.z, 4)
        view("06-serpentine-reka", riv[1] + 160, 45, riv[2] - 120, riv[1], 0, riv[2], 3)
        view("07-frostfang-peaks", L.x + 30, 30, L.z + 220, L.x, 120, L.z - 400, 4)
        view("08-zamrzle-jezero", L.x + 40, 12, L.z + 40, map.FrozenLake.x, 0, map.FrozenLake.z, 3)
        view("09-ignis-sopka", V1.x + 520, 40, V1.z - 520, V1.x, 140, V1.z, 4)
        view("10-lavove-reky", V1.x + 60, 70, V1.z + 200, V1.x, 20, V1.z + 500, 3)
        view("11-crystalarium", R.x - 110, 30, R.z + 90, R.x, 8, R.z, 4)
        view("12-stinova-trhlina", R.x - 22, 6, R.z + 16, R.x, 3, R.z, 3)
        view("13-pobrezi-ocean", -3000, 30, 1200, -3600, 0, 900, 3)
        view("14-vyhled-kontinent", S.x + 400, 900, S.z + 1900, S.x, 0, S.z - 600, 5)
        _G.world.environment({ time_of_day = 22.5 })
        view("15-noc-crystalarium", R.x - 110, 30, R.z + 90, R.x, 8, R.z, 3)
        view("16-noc-ignis", V1.x + 520, 40, V1.z - 520, V1.x, 140, V1.z, 3)
        view("17-noc-zakladna", S.x - 34, 12, S.z + 30, map.Tower.x, 6, map.Tower.z, 3)
        -- Azure Ocean a mořská monstra (kreslený styl)
        local function firstMob(kind)
            for _, sp in ipairs(map.Data.Spawns) do if sp[1] == kind then return sp[2], sp[3] end end
        end
        local lev = world.Leviathans[1]
        _G.world.environment({ time_of_day = 14 })
        timer.sleep(1)
        -- pobřeží u první sirény: kamera nad mělčinou, pohled dál na moře (od středu kontinentu ven)
        local ox, oz = firstMob("siren")
        local dl = math.sqrt(ox * ox + oz * oz)
        local ux, uz = ox / dl, oz / dl
        local cx, cz = ox - ux * 60, oz - uz * 60
        lookFrom(cx, math.max(G(cx, cz), 0) + 14, cz, ox + ux * 400, 0, oz + uz * 400); timer.sleep(3); shot("23-azure-ocean")
        if lev then
            local lx, lz = lev.x, lev.z
            lookFrom(lx + 70, 26, lz + 60, lx, 0, lz); timer.sleep(2); shot("24-abyssal-leviathan")
        end
        combat.SpawnAll()
        local sx, sz = firstMob("siren")
        if sx then lookFrom(sx + 7, 2.6, sz + 6, sx, 1.4, sz); timer.sleep(2.5); shot("25-coral-siren") end
        local ex, ez = firstMob("eel")
        if ex then lookFrom(ex + 8, 4.5, ez + 7, ex, 0.2, ez); timer.sleep(2.5); shot("26-razorfin-eel") end
        _G.world.environment({ time_of_day = 22.5 })
        lookFrom(cx, math.max(G(cx, cz), 0) + 14, cz, ox + ux * 400, 0, oz + uz * 400); timer.sleep(3); shot("27-noc-zarici-koraly")
        if lev then lookFrom(lev.x + 70, 26, lev.z + 60, lev.x, 0, lev.z); timer.sleep(2); shot("28-noc-leviathan") end
        game_.Reset()
        -- mapa světa (M) a minimapa ve hře
        _G.world.environment({ time_of_day = 15 })
        game_.SetMode("select"); game_.EnterWorld(1)
        player.cam.yaw = 200
        timer.sleep(2.5); shot("18-hra-minimapa")
        game_.mapOpen = true
        timer.sleep(0.6); shot("19-mapa-sveta-M")
        game_.mapOpen = false
        game_.Reset()
        game_.SetMode("test")
    end
    -- počasí
    local S, L = map.Start, map.DragonLair
    _G.world.environment({ time_of_day = 14 })
    _G.world.weather({ rain = 0.9, wind = 0.6, instant = true })
    view("20-dest", S.x - 34, 12, S.z + 30, map.Tower.x, 6, map.Tower.z, 3)
    _G.world.weather({ rain = 1, storm = 1, wind = 1, instant = true })
    _G.world.environment({ time_of_day = 19.5 })
    for i = 1, 40 do   -- počkat na blesk
        timer.sleep(0.25)
        if _G.world.weather().flash > 0.4 then break end
    end
    view("21-bourka-blesk", S.x - 60, 25, S.z + 60, S.x, 3, S.z, 0.05)
    _G.world.weather({ rain = 0, storm = 0, snow = 1, wind = 0.4, instant = true })
    _G.world.environment({ time_of_day = 11 })
    view("22-snih-frostfang", L.x + 40, 12, L.z + 40, map.FrozenLake.x, 0, map.FrozenLake.z, 3)
    _G.world.weather({ snow = 0, wind = 0.25, instant = true })
    game.log("SELFTEST hotovo")
    game.quit()
end

-- ------------------------------------------------------------------ tvorba postavy a vstup do hry
local creator = require("eryndor.creator")
local presence = require("eryndor.presence")
local mode = "select"
game_.Creator = creator

local function showPreview() creator.Show() end

local function enterWorld()
    if not creator.a then creator.Load() end
    creator.Hide()
    local a = creator.a
    if a.name == "" then a.name = require("eryndor.races").Defs[a.race].name:match("^(%S+)") .. " Ozvěna" end
    local c = combat.Classes[a.cls] or combat.Classes[1]
    player.Create(c, map.Start, a)
    combat.SetupPlayer(c)
    combat.SpawnAll()
    quest.Spawn()
    local rname = require("eryndor.races").Defs[a.race].name
    combat.Log("Vítej v Aethelgardu, " .. a.name .. " (" .. rname .. ", " .. c.name .. ").", { 0.8, 0.9, 1.0 })
    combat.Log("Tab cíl · R útok · 1–5 dovednosti · F mluvit · M mapa · pravé tlačítko kamera", { 0.7, 0.7, 0.7 })
    mode = "play"
    game_.mode = mode
    presence.Start(a)
end
game_.EnterWorld = function(i)
    if not creator.a then creator.Load() end
    if i then creator.a.cls = i end
    enterWorld()
end
game_.SetMode = function(m) mode = m; game_.mode = m end
game_.Preview = function(i)
    creator.Show()
    if i then creator.a.cls = i; creator.rebuild = true end
end
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
local lastRegion
local function weatherCycle()
    -- ve Frostfang Peaks sněží, v Ignis Scar je sucho (popel), jinde se počasí střídá
    local px, _, pz = player.Pos()
    local region = map.Region(px, pz)
    if region ~= lastRegion then
        if region == "f" or region == "k" then _G.world.weather({ rain = 0, storm = 0, snow = 0.7, wind = 0.6 })
        elseif lastRegion == "f" or lastRegion == "k" then _G.world.weather({ snow = 0, wind = 0.3 }) end
        if region == "i" or region == "l" then _G.world.weather({ rain = 0, storm = 0, snow = 0 }) end
        lastRegion = region
        combat.Log("Vstupuješ: " .. map.RegionName(px, pz), { 1.0, 0.85, 0.45 })
    end
    if region == "f" or region == "k" or region == "i" or region == "l" then return end
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
    _G.world.environment({ day_night = true, real_time = false, time_of_day = 15, day_length = 60, fog = 0.0006,
                           shadow_distance = 260, haze = 0.45, exposure = 0.85, night_exposure = 1.6,
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
    if game_.built then world.Update(dt) end   -- leviatani na moři (i v samotestu)
    if mode ~= "play" and mode ~= "select" then return end
    if mode == "select" then creator.Update(dt); return end
    presence.Update(dt)
    if not ui.wants_keyboard() and not quest.dialog then
        if input.pressed("Tab") then combat.TabTarget() end
        if input.pressed("R") then combat.StartAttack() end
        if input.pressed("Escape") then combat.target, combat.auto = nil, false end
        for i = 1, 6 do if input.pressed(tostring(i)) then combat.UseSkill(i) end end
        if input.pressed("F") then quest.Talk() end
        if input.pressed("M") then game_.mapOpen = not game_.mapOpen end
    end
    combat.Update(dt)
    player.Update(dt, combat.inCombat, combat.moveTo, combat.me and combat.me.casting ~= nil)
    if not game_.freeCam then player.UpdateCamera(dt) end
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
        creator.Draw()
        if creator.enter then creator.enter = false; enterWorld() end
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
    presence.DrawLabels()
    hud.DrawGame()
    hud.DrawQuest(quest.Tracker())
    hud.DrawDialog(quest.dialog)
    if game_.mapOpen then hud.DrawWorldMap() else hud.DrawMinimap() end
end

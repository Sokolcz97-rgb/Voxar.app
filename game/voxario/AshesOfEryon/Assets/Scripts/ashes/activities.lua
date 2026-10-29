-- Činnosti ve světě: světový boss Thalassos (WorldBoss.cs), aréna (Arena.cs) a běh kolem mét
-- na stadionu (Race.cs). Výsledky, čest i časy počítá server; boj přehrává ashes.combat.
local map = require("ashes.worldmap")
local api = require("ashes.api")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")
local pose = require("ashes.pose")

local M = {}
local boot, player, hud, combat
local note, noteUntil, noteColor = nil, 0, nil

local function Note(s, color) note, noteUntil, noteColor = s, game.time() + 5, color end
local function dist(ax, az, bx, bz) return math.sqrt((ax - bx) ^ 2 + (az - bz) ^ 2) end
local function sec(ms) return (string.format("%.1f s", (ms or 0) / 1000):gsub("%.", ",")) end

-- ------------------------------------------------------------------ světový boss
local Boss = { state = nil, pollAt = 0, polling = false, crew = {} }
M.Boss = Boss

local function buildBoss()
    local sx, sz = 20, 50
    if map.HeightAt(sx, sz) < 0.6 then
        for i = 1, 39 do
            if map.HeightAt(sx, sz) >= 0.6 then break end
            sx, sz = 20 + math.cos(i) * i * 0.8, 50 - math.sin(i) * i * 0.8 - i * 0.3
        end
    end
    Boss.x, Boss.z, Boss.yaw, Boss.scale = sx, sz, 200, 1.9 / 1.62
    Boss.pose = pose.New()
    Boss.id = world.spawn("Models/heroes/hoplit_m.glb", sx, map.Ground(sx, sz), sz,
        { fit = 1.9, yaw = 200, name = "Thalassos", tag = "enemy" })
    Boss.crew = {}
    for i = 0, 3 do
        local a = i * math.pi / 2 + 0.6
        local x, z = sx + math.cos(a) * 3.2, sz + math.sin(a) * 3.2
        local id = world.spawn("Models/heroes/" .. (i % 2 == 0 and "lucistnik" or "hoplit") .. "_m.glb", x, map.Ground(x, z), z,
            { fit = 1.62, yaw = 200 + i * 25, lod = "auto", lod_distance = 20, name = "Pirát", tag = "enemy" })
        Boss.crew[#Boss.crew + 1] = { id = id, x = x, z = z, title = i % 2 == 0 and "Pirátský lukostřelec" or "Pirátský kopiník" }
    end
    local fx, fz = sx + 3.5, sz - 2
    world.spawn("cylinder", fx, map.Ground(fx, fz) + 0.08, fz, { size = { 0.5, 0.15, 0.5 }, color = { 0.15, 0.08, 0.04 } })
    world.spawn("light", fx, map.Ground(fx, fz), fz, { light = { color = { 1, 0.5, 0.18 }, intensity = 14, range = 7, flicker = true, y = 0.6 } })
    Boss.pollAt, Boss.visible = 0, true
end

local function bossDist()
    if not Boss.id then return 999 end
    local px, _, pz = player.Position()
    return dist(px, pz, Boss.x, Boss.z)
end

local function bossAlive() return Boss.state == nil or Boss.state.alive end

local function updateBoss(dt)
    if not Boss.id then return end
    local now = game.time()
    if not Boss.polling and now > Boss.pollAt and api.SignedIn() and not boot.selftest then
        Boss.polling = true
        api.Rpc("ashes_boss_state", {}, function(st, err)
            Boss.polling = false
            Boss.pollAt = game.time() + (bossDist() < 60 and 6 or 25)
            if not err and type(st) == "table" then Boss.state = st end
        end)
    end
    local alive = bossAlive()
    if Boss.visible ~= alive then
        Boss.visible = alive
        entity.set_visible(Boss.id, alive)
        for _, c in ipairs(Boss.crew) do entity.set_visible(c.id, alive) end
        if alive then pose.Stand(Boss.pose) end
    end
    local fwd, dy, pitch, fall = pose.Step(Boss.pose, dt)
    local yr = math.rad(Boss.yaw)
    entity.set_position(Boss.id, Boss.x + math.sin(yr) * fwd, map.Ground(Boss.x, Boss.z) + dy, Boss.z + math.cos(yr) * fwd)
    entity.set_rotation(Boss.id, fall or pitch, Boss.yaw, 0)
    if alive and not combat.Busy() and not boot.typing and not hud.IsOpen() and bossDist() < 7 and keys.Down("interact") then
        combat.ServerFight("ashes_boss_attack", {}, { cls = "hoplit", label = "Thalassos, vůdce pirátů", boss = Boss,
            onError = function(e) Note(e, skin.Ember) end,
            onDone = function() Boss.pollAt = 0 end })
    end
end

local isoToEpoch = require("ashes.util").IsoToEpoch

local function drawBoss(W, H)
    if not Boss.id then return end
    local st = Boss.state
    local alive = bossAlive()
    if alive then
        local gy = map.Ground(Boss.x, Boss.z)
        ui.world_label(Boss.x, gy + 2.7, Boss.z, "Thalassos, vůdce pirátů", { size = 21, color = "#f27361", font = "bold", max_distance = 45 })
        ui.world_label(Boss.x, gy + 2.43, Boss.z, st and string.format("světový boss · %d / %d životů", st.hp or 0, st.hp_max or 0) or "světový boss",
            { size = 15, color = { 1, 0.45, 0.3 }, font = "body", max_distance = 30 })
        for _, c in ipairs(Boss.crew) do
            local cy = map.Ground(c.x, c.z) + 2.2
            ui.world_label(c.x, cy, c.z, c.title, { size = 17, color = "#f27361", font = "bold", max_distance = 25 })
            ui.world_label(c.x, cy - 0.25, c.z, "družina Thalassose", { size = 14, color = skin.Muted, font = "body", max_distance = 18 })
        end
    end
    local d = bossDist()
    if d > 45 or not st or combat.Busy() then return end
    local x, y, w = W / 2 - 300, 176, 600
    if st.alive then
        ui.text(W / 2, y - 28, "THALASSOS, VŮDCE PIRÁTŮ  ·  SVĚTOVÝ BOSS", { size = 16, font = "caps", color = { 1, 0.55, 0.4 }, align = "center" })
        ui.bar(x, y, w, 30, (st.hp or 0) / math.max(1, st.hp_max or 1), { 0.94, 0.27, 0.18 }, string.format("%d / %d", st.hp or 0, st.hp_max or 0))
        local top = ""
        for i, t in ipairs(st.top or {}) do
            if i > 3 then break end
            top = top .. string.format("%d. %s (%d)   ", i, t.name or "", t.damage or 0)
        end
        ui.text(W / 2, y + 36, string.format("Tvé poškození: %d    %s", st.my_damage or 0, top), { size = 16, font = "body", color = skin.Muted, align = "center" })
        if d < 7 and not hud.near then hud.Prompt(W, H, keys.Label("interact"), "Zaútočit na Thalassose") end
    else
        local when = ""
        local t = isoToEpoch(st.respawn_at)
        if t then
            local left = t - os.time()
            when = left > 0 and string.format(" Vrátí se asi za %d min.", math.ceil(left / 60)) or " Brzy se vrátí."
        end
        local killer = (st.killer and st.killer ~= "") and (" – poslední ránu zasadil " .. st.killer) or ""
        ui.text(W / 2, y, "Thalassos padl" .. killer .. "." .. when, { size = 22, font = "bold", color = skin.GoldBright, align = "center" })
    end
end

-- ------------------------------------------------------------------ aréna
local Arena = { open = false, loaded = false, busy = false, list = {}, fame = nil, fameTab = false, error = nil, page = 0 }
M.Arena = Arena

function M.OpenArena()
    Arena.open, Arena.loaded, Arena.error, Arena.page = true, false, nil, 0
end

local function arenaLoad()
    Arena.busy = true
    api.Rpc("ashes_arena_opponents", {}, function(list, err)
        Arena.busy, Arena.loaded = false, true
        if err then Arena.error, Arena.list = err, {} else Arena.list = type(list) == "table" and list or {} end
    end)
end

local function fameLoad()
    Arena.busy = true
    api.Rpc("ashes_hall_of_fame", {}, function(list, err)
        Arena.busy = false
        if err then Arena.error, Arena.fame = err, {} else Arena.fame = type(list) == "table" and list or {} end
    end)
end

local function reopen(err) Arena.error, Arena.open, Arena.loaded = err, true, true end

local function drawArena(W, H)
    if not Arena.open then return end
    if not Arena.loaded and not Arena.busy and not boot.selftest then arenaLoad() end
    if Arena.fameTab and not Arena.fame and not Arena.busy and not boot.selftest then fameLoad() end
    local me = (boot.state and boot.state.character) or {}
    ui.fade(0.45)
    local x, y, w, h = W / 2 - 520, H / 2 - 370, 1040, 720
    local ix, iy, iw, ih = skin.Panel(x, y, w, h, "Aréna")
    ui.text(ix, iy, "Zápas proti uložené postavě jiného hrdiny. Vítězství přináší čest a zlato, porážka trochu cti vezme. " ..
        "Soupeř z druhé strany války dává 1,5× více cti a posune hradbu. Mezi zápasy si musíš chvíli odpočinout.",
        { size = 17, font = "body", color = skin.Muted, wrap = iw })
    ui.text(ix, iy + 52, string.format("Tvá čest: %d   ·   vítězství %d / porážky %d", me.honor or 0, me.wins or 0, me.losses or 0),
        { size = 20, font = "bold", color = skin.Text })
    local ty = iy + 86
    if skin.Chip(ix, ty, 200, 36, not Arena.fameTab) then Arena.fameTab = false end
    ui.text(ix + 100, ty + 8, "Soupeři", { size = 17, font = "h2", color = skin.Text, align = "center" })
    if skin.Chip(ix + 210, ty, 200, 36, Arena.fameTab) then Arena.fameTab, Arena.fame = true, nil end
    ui.text(ix + 310, ty + 8, "Síň slávy", { size = 17, font = "h2", color = skin.Text, align = "center" })
    local ly = ty + 52
    local free = not Arena.busy and not combat.Busy()
    if Arena.fameTab then
        ui.text(ix, ly, "Nejslavnější hrdinové podle cti.", { size = 17, font = "body", color = skin.Muted })
        ly = ly + 30
        if not Arena.fame then ui.text(ix, ly, "Kronikář listuje svitky…", { size = 20, font = "body", color = skin.Text })
        else
            local myName = (me.display_name and me.display_name ~= "") and me.display_name or me.name
            for i, f in ipairs(Arena.fame) do
                if i > 10 then break end
                local mine = f.name == myName
                local legend = f.eryon and " – legenda Eryon" or (f.azkar and " – legenda Azkar" or "")
                ui.text(ix, ly, i .. ".", { size = 20, font = "h2", color = i <= 3 and skin.GoldBright or skin.Text })
                ui.text(ix + 56, ly, (f.name or "") .. legend .. (mine and "  (ty)" or ""), { size = 20, font = "bold", color = mine and skin.Sky or skin.Text })
                ui.text(ix + 440, ly + 2, string.format("%s · úr. %d · kap. %d", skin.ClassName(f.class), f.level or 1, f.chapter or 1), { size = 17, font = "body", color = skin.Muted })
                ui.text(ix + 720, ly + 2, f.faction == "legie" and "Legie" or "Kalidra", { size = 17, font = "body", color = f.faction == "legie" and skin.Ember or skin.Sky })
                ui.text(ix + iw, ly, tostring(f.honor or 0) .. " cti", { size = 20, font = "h2", color = skin.Sky, align = "right" })
                ly = ly + 42
            end
        end
    else
        ui.text(ix, ly + 4, "Cvičný zápas s gladiátorem na tvé úrovni – trochu zkušeností, zlata a 1 čest za výhru, bez rizika.",
            { size = 17, font = "body", color = skin.Muted, wrap = iw - 250 })
        if skin.Button(ix + iw - 220, ly, 220, 46, "CVIČNÝ ZÁPAS", false, free) then
            Arena.open = false
            combat.ServerFight("ashes_arena_spar", {}, { arena = true, gender = "m", label = "Gladiátor", onError = reopen })
        end
        ly = ly + 58
        ui.line(ix, ly, ix + iw, ly, "#c9a45c59", 1)
        ly = ly + 10
        if not Arena.loaded then ui.text(ix, ly, "Mistr arény vybírá soupeře…", { size = 20, font = "body", color = skin.Text })
        elseif #Arena.list == 0 then ui.text(ix, ly, "Zatím tu není žádný jiný hrdina – zkus cvičný zápas a přiveď přátele!", { size = 20, font = "body", color = skin.Text }) end
        local per = 4
        local pages = math.max(1, math.ceil(#Arena.list / per))
        Arena.page = math.min(Arena.page, pages - 1)
        for i = Arena.page * per + 1, math.min(#Arena.list, Arena.page * per + per) do
            local o = Arena.list[i]
            local rival = o.faction ~= me.faction
            local g = (type(o.appearance) == "table" and o.appearance.gender == "f") and "f" or "m"
            ui.draw_image(skin.Portrait(o.class, g), ix, ly + 6, 72, 72)
            local legend = o.eryon and "  · legenda Eryon" or (o.azkar and "  · legenda Azkar" or "")
            ui.text(ix + 86, ly + 10, (o.name or "") .. legend, { size = 23, font = "bold", color = skin.Text })
            ui.text(ix + 86, ly + 44, string.format("%s · úroveň %d · %s", skin.ClassName(o.class), o.level or 1, skin.FactionName(o.faction)) ..
                (rival and "  ·  nepřítel (1,5× čest)" or ""), { size = 17, font = "body", color = rival and skin.Ember or skin.Muted })
            ui.text(ix + iw - 200, ly + 26, tostring(o.honor or 0) .. " cti", { size = 21, font = "h2", color = skin.Sky, align = "right" })
            if skin.Button(ix + iw - 170, ly + 16, 170, 52, "VYZVAT", true, free) then
                Arena.open = false
                combat.ServerFight("ashes_arena_fight", { p_target = o.id }, { arena = true, cls = o.class, gender = g,
                    label = string.format("%s · úroveň %d", o.name or "", o.level or 1), onError = reopen })
            end
            ly = ly + 90
            ui.line(ix, ly - 4, ix + iw, ly - 4, "#c9a45c33", 1)
        end
        if pages > 1 then
            if skin.Button(ix, iy + ih - 110, 60, 40, "‹", false, Arena.page > 0) then Arena.page = Arena.page - 1 end
            ui.text(ix + 100, iy + ih - 100, string.format("%d / %d", Arena.page + 1, pages), { size = 18, font = "body", color = skin.Muted, align = "center" })
            if skin.Button(ix + 140, iy + ih - 110, 60, 40, "›", false, Arena.page < pages - 1) then Arena.page = Arena.page + 1 end
        end
    end
    if Arena.error then ui.text(ix, iy + ih - 100, Arena.error, { size = 19, font = "bold", color = skin.Ember }) end
    if not Arena.fameTab and skin.Button(ix, iy + ih - 50, 240, 44, "Obnovit soupeře", false, free) then Arena.loaded, Arena.error = false, nil end
    if skin.Button(ix + iw - 240, iy + ih - 50, 240, 46, "ZAVŘÍT (Esc)", true) then Arena.open = false end
end

-- ------------------------------------------------------------------ běh kolem mét (stadion)
local Race = { pts = {}, fires = {}, running = false, busy = false, nextIdx = 2, startedAt = 0, bestMs = 0, runsLeft = 3, top = {} }
M.Race = Race
local COURSE = { { 0, 15 }, { 30, -15 }, { 45, 25 }, { -5, 40 } }

local function setLit(idx)
    for i, f in ipairs(Race.fires) do
        local lit = i == idx
        if lit and not f.light then
            f.light = world.spawn("light", f.x, f.y, f.z, { light = { color = { 1, 0.5, 0.18 }, intensity = 20, range = 10, flicker = true } })
            f.flame = world.spawn("cylinder", f.x, f.y + 0.2, f.z, { size = { 0.6, 0.4, 0.6 }, color = { 1, 0.55, 0.15 } })
        elseif not lit and f.light then
            entity.destroy(f.light); entity.destroy(f.flame)
            f.light, f.flame = nil, nil
        end
    end
end

local function buildRace()
    Race.pts, Race.fires, Race.running = {}, {}, false
    for _, c in ipairs(COURSE) do
        local x, z = c[1], c[2]
        -- kdyby bod vyšel do vody, posune se k pevnině uprostřed pláně
        for _ = 1, 30 do
            if map.HeightAt(x, z) >= 0.6 then break end
            local dx, dz = 20 - x, 10 - z
            local l = math.sqrt(dx * dx + dz * dz)
            if l < 2 then x, z = 20, 10 else x, z = x + dx / l * 2, z + dz / l * 2 end
        end
        Race.pts[#Race.pts + 1] = { x = x, z = z }
    end
    for i, p in ipairs(Race.pts) do
        local y = map.Ground(p.x, p.z)
        world.spawn("cylinder", p.x, y + 1.6, p.z, { size = { 0.7, 3.2, 0.7 }, color = { 0.86, 0.83, 0.76 }, collider = "capsule",
            name = i == 1 and "Stadion start" or ("Méta " .. (i - 1)) })
        world.spawn("cylinder", p.x, y + 3.3, p.z, { size = { 1.1, 0.15, 1.1 }, color = { 0.55, 0.38, 0.2 } })
        Race.fires[i] = { x = p.x, y = y + 3.45, z = p.z }
    end
    setLit(1)
end

local function raceDistTo(p)
    local px, _, pz = player.Position()
    return dist(px, pz, p.x, p.z)
end

local function raceCur() return Race.pts[Race.nextIdx] or Race.pts[1] end

local function raceAbort(why) Race.running = false; setLit(1); Note(why) end

local function raceBegin()
    Race.busy = true
    api.Rpc("ashes_race_start", {}, function(r, err)
        Race.busy = false
        if err then return Note(err, skin.Ember) end
        r = type(r) == "table" and r or {}
        Race.bestMs, Race.runsLeft, Race.top = r.best_ms or 0, r.runs_left or 0, r.top or {}
        Race.running, Race.nextIdx, Race.startedAt = true, 2, game.time()
        setLit(2)
        boot.sound.Play("quest")
        Note(Race.runsLeft > 0 and "Běž! Oběhni méty v pořadí a vrať se ke startu." or "Běž! (Odměny na dnešek už máš – běží se o rekord.)")
    end)
end

local function raceFinish()
    Race.busy, Race.running = true, false
    setLit(1)
    api.Rpc("ashes_race_finish", {}, function(r, err)
        Race.busy = false
        if err then return Note(err, skin.Ember) end
        if type(r) ~= "table" then return end
        if type(r.state) == "table" and r.state.character then boot.state = r.state end
        Race.bestMs, Race.runsLeft, Race.top = r.best_ms or 0, r.runs_left or 0, r.top or {}
        local reward = (r.gold or 0) > 0 and string.format("  +%d zlata, +%d zkušeností", r.gold, r.xp or 0) or ""
        Note((r.record and ("NOVÝ REKORD! " .. sec(r.ms)) or string.format("Doběhl jsi za %s (rekord %s).", sec(r.ms), sec(r.best_ms))) .. reward)
        boot.sound.Play((r.levels or 0) > 0 and "level" or (r.record and "quest" or "coin"))
    end)
end

local function updateRace()
    if #Race.pts == 0 then return end
    local fight = combat.Busy()
    if Race.running then
        if fight or game.time() - Race.startedAt > 290 then return raceAbort("Závod přerušen.") end
        if raceDistTo(raceCur()) < 3.2 then
            if Race.nextIdx <= #Race.pts then
                Race.nextIdx = Race.nextIdx + 1
                boot.sound.Play("click", 2)
                setLit(Race.nextIdx <= #Race.pts and Race.nextIdx or 1)
            elseif not Race.busy then raceFinish() end
        end
        return
    end
    if not Race.busy and not fight and not boot.typing and not hud.IsOpen() and raceDistTo(Race.pts[1]) < 4 and keys.Down("interact") then
        raceBegin()
    end
end

-- Další cíl závodu (pro minimapu): {x, z, title} nebo nil
function M.RaceTarget()
    if not Race.running then return nil end
    local c = raceCur()
    return { x = c.x, z = c.z, title = Race.nextIdx <= #Race.pts and string.format("méta %d/%d", Race.nextIdx - 1, #Race.pts - 1) or "cíl – startovní sloup" }
end

local function drawRace(W, H)
    if #Race.pts == 0 then return end
    for i, p in ipairs(Race.pts) do
        local y = map.Ground(p.x, p.z) + 4.2
        ui.world_label(p.x, y, p.z, i == 1 and "Stadion – startovní sloup" or ("Méta " .. (i - 1)), { size = 18, color = skin.GoldBright, font = "bold", max_distance = 40 })
        if i == 1 then ui.world_label(p.x, y - 0.27, p.z, "běh kolem mét · " .. keys.Label("interact"), { size = 15, color = skin.Muted, font = "body", max_distance = 25 }) end
    end
    if Race.running then
        local x, y = W / 2 - 200, 176
        ui.rect(x, y, 400, 74, { 0.04, 0.03, 0.025, 0.8 })
        ui.rect(x, y, 400, 3, skin.Gold)
        ui.text(W / 2, y + 6, sec(math.floor((game.time() - Race.startedAt) * 1000 + 0.5)), { size = 32, font = "bold", color = skin.GoldBright, align = "center" })
        local label = Race.nextIdx <= #Race.pts and string.format("Méta %d z %d", Race.nextIdx - 1, #Race.pts - 1) or "Zpět ke startu!"
        ui.text(W / 2, y + 46, label .. (Race.bestMs > 0 and ("   ·   rekord " .. sec(Race.bestMs)) or ""), { size = 16, font = "body", color = skin.Muted, align = "center" })
    elseif raceDistTo(Race.pts[1]) < 4 and not combat.Busy() and not hud.near then
        hud.Prompt(W, H, keys.Label("interact"), "Běh kolem mét (stadion)")
        if #Race.top > 0 then
            local s = "NEJRYCHLEJŠÍ:  "
            for i, t in ipairs(Race.top) do
                if i > 3 then break end
                s = s .. string.format("%d. %s %s    ", i, t.name or "", sec(t.best_ms))
            end
            ui.text(W / 2, H - 230, s, { size = 16, font = "body", color = skin.Muted, align = "center" })
        end
    end
end

-- ------------------------------------------------------------------ společné
function M.Build(b, p, h, c)
    boot, player, hud, combat = b, p, h, c
    buildBoss()
    buildRace()
    b.openArena = M.OpenArena
end

function M.IsOpen() return Arena.open end
function M.Close() Arena.open = false end

function M.Update(dt)
    if not boot or not player.body then return end
    updateBoss(dt)
    updateRace()
end

function M.Draw(W, H)
    if not boot then return end
    drawBoss(W, H)
    drawRace(W, H)
    if note and game.time() < noteUntil then
        ui.text(W / 2, H - 236, note, { size = 22, font = "bold", color = noteColor or skin.GoldBright, align = "center" })
    end
    drawArena(W, H)
end

-- Samotest: okno arény s ukázkovými soupeři
function M.TestArena()
    Arena.open, Arena.loaded, Arena.fameTab = true, true, false
    Arena.list = {
        { id = "1", name = "Eryon", class = "hoplit", faction = "kalidra", level = 12, honor = 640, eryon = true, appearance = { gender = "m" } },
        { id = "2", name = "Kassandra", class = "vestec", faction = "legie", level = 4, honor = 85, appearance = { gender = "f" } },
        { id = "3", name = "Leonidas", class = "lucistnik", faction = "kalidra", level = 3, honor = 40, appearance = { gender = "m" } },
    }
end

return M

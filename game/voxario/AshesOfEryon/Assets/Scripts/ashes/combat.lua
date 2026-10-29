-- Boj (Encounters.cs + EncountersLive.cs): nepřátelé v oblastech, strážní vatry a památník.
-- Nepřítel, který hráče zahlédne, se k němu rozběhne; dotyk spustí aktivní boj: útok (levé tlačítko),
-- dovednost (1), úhyb (Q), blok (držet F). Rytmus úderů, poškození i odměny drží server (ashes_live_*).
-- Souboje vyhodnocené serverem celé najednou (aréna, boss, příběh) se přehrají kolo po kole.
local map = require("ashes.worldmap")
local api = require("ashes.api")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")
local pose = require("ashes.pose")

local M = { enemies = {}, beacons = {}, live = nil, fighting = false, result = nil }

local sqrt, floor, min, max, exp = math.sqrt, math.floor, math.min, math.max, math.exp

-- ------------------------------------------------------------------ data (map.ts)
local function E(id, name, cls, l0, l1) return { id = id, name = name, cls = cls, l0 = l0, l1 = l1 } end
local RegionEnemies = {
    kalidra = {
        shore = { E("vrakar", "Vrakař", "lucistnik", 1, 2), E("pasarak", "Pašerák z útesů", "lucistnik", 1, 2) },
        aqueduct = { E("lapka", "Lapka od akvaduktu", "hoplit", 2, 3), E("kultista", "Kultista popela", "vestec", 2, 3) },
        hills = { E("zved-legie", "Zvěd Rudého slunce", "lucistnik", 3, 5), E("predvoj", "Předvoj legie", "hoplit", 3, 5) },
        plain = { E("kopinik", "Kopiník Rudého slunce", "hoplit", 4, 6), E("knez-slunce", "Kněz Rudého slunce", "vestec", 4, 6) },
        cove = { E("strazce-lodi", "Strážce černých lodí", "hoplit", 5, 7) },
        camp = { E("garda", "Azkarova garda", "hoplit", 6, 8) },
        pass = { E("lapka-prusmyku", "Lapka ze Solného průsmyku", "lucistnik", 3, 5), E("hlidka-slunce", "Hlídka Rudého slunce", "hoplit", 3, 5) },
        sands = { E("nomad", "Nomád rudých písků", "hoplit", 5, 7), E("vestec-slunce", "Věštec Rudého slunce", "vestec", 5, 7), E("lucistnik-dun", "Lučištník z dun", "lucistnik", 5, 7) },
    },
    legie = {
        cove = { E("strazny-utesy", "Strážný z útesů", "lucistnik", 1, 2), E("vrakar", "Vrakař", "lucistnik", 1, 2) },
        shore = { E("vrakar", "Vrakař", "lucistnik", 2, 3), E("rybar", "Rybář s harpunou", "hoplit", 2, 3) },
        aqueduct = { E("strazce-akvaduktu", "Strážce akvaduktu", "hoplit", 2, 3), E("knezka", "Kněžka přílivu", "vestec", 2, 3) },
        hills = { E("zved-kalidra", "Kalidrský zvěd", "lucistnik", 3, 5), E("strazce-ohne", "Strážce ohně", "hoplit", 3, 5) },
        plain = { E("obrance", "Obránce Kalidry", "hoplit", 4, 6), E("knez-kalidry", "Kněz Kalidry", "vestec", 4, 6) },
        kalidra = { E("straz-kalidry", "Stráž Kalidry", "hoplit", 6, 8) },
        pass = { E("lapka-prusmyku", "Lapka ze Solného průsmyku", "lucistnik", 3, 5), E("pruzkumnik-kalidry", "Kalidrský průzkumník", "lucistnik", 3, 5) },
        sands = { E("nomad", "Nomád rudých písků", "hoplit", 5, 7), E("strazce-ruin", "Strážce Starého slunce", "vestec", 5, 7), E("lucistnik-dun", "Lučištník z dun", "lucistnik", 5, 7) },
    },
}
local Camps = {
    { "shore", -64, 80 }, { "shore", -46, 82 }, { "shore", -72, 32 }, { "shore", -32, 72 },
    { "aqueduct", -46, 18 }, { "aqueduct", -28, 2 }, { "aqueduct", -56, -4 }, { "aqueduct", -20, -18 },
    { "hills", -24, -40 }, { "hills", -8, -64 }, { "hills", 16, -68 }, { "hills", 36, -46 }, { "hills", -2, -42 },
    { "plain", 12, 26 }, { "plain", 34, 0 }, { "plain", 34, 36 }, { "plain", 8, -6 },
    { "cove", -64, -44 }, { "cove", -30, -74 },
    { "camp", 44, -76 }, { "camp", 72, -56 },
    { "kalidra", 86, 2 }, { "kalidra", 86, 36 },
    { "pass", -20, 146 }, { "pass", -12, 172 }, { "pass", 8, 200 },
    { "sands", -60, 196 }, { "sands", 22, 240 }, { "sands", -36, 250 }, { "sands", 48, 300 }, { "sands", 20, 288 }, { "sands", -50, 300 }, { "sands", 72, 268 },
}
-- oblasti bez nepřátel (vlastní město / tábor)
local Safe = { kalidra = { kalidra = true }, legie = { camp = true } }
local SafeZones = { { -52, 50, 20 }, { -44, -50, 18 }, { 62, 15, 14 }, { 56, -60, 14 } }
M.RespawnKalidra, M.RespawnLegie = { x = 62, z = 15 }, { x = 56, z = -60 }
local Beacons = { { "b1", -22, -58 }, { "b2", 2, -72 }, { "b3", 28, -60 } }
local Memorial = { x = 28, z = 30 }

local function dist(ax, az, bx, bz) return sqrt((ax - bx) ^ 2 + (az - bz) ^ 2) end
local function inSafe(x, z, margin)
    for _, s in ipairs(SafeZones) do if dist(x, z, s[1], s[2]) < s[3] + (margin or 0) then return true end end
    return false
end

local faction, boot, player, hud = "kalidra", nil, nil, nil
local note, noteUntil = nil, 0
local floats = {}
local tagLevel = -1
local memorialPos

local function Note(s) note, noteUntil = s, game.time() + 5 end
M.Note = Note

local function float(x, y, z, text, color) floats[#floats + 1] = { x, y, z, text, color, game.time() } end

local function quest(id)
    for _, q in ipairs((boot.state and boot.state.wquests) or {}) do if q.quest_id == id then return q end end
end
local function hasTarget(wq, id)
    for _, t in ipairs((wq and wq.targets) or {}) do if t == id then return true end end
    return false
end

-- ------------------------------------------------------------------ stavba
local function setFire(b, lit)
    if b.lit == lit then return end
    b.lit = lit
    if lit then
        b.light = world.spawn("light", b.x, b.y + 1.1, b.z, { light = { color = { 1, 0.5, 0.18 }, intensity = 40, range = 18, flicker = true, y = 0.4 } })
        b.flame = world.spawn("cylinder", b.x, b.y + 1.45, b.z, { size = { 0.9, 0.7, 0.9 }, color = { 1, 0.55, 0.15 } })
    else
        if b.light then entity.destroy(b.light) end
        if b.flame then entity.destroy(b.flame) end
        b.light, b.flame = nil, nil
    end
end

-- Zapálené vatry podle úkolu „Strážní ohně“ (k4) / „Zhasnout ohně“ (l4)
function M.RefreshBeacons()
    local legie = faction == "legie"
    local wq = quest(legie and "l4" or "k4")
    for _, b in ipairs(M.beacons) do
        local touched = wq ~= nil and (wq.state ~= "active" or hasTarget(wq, b.id))
        setFire(b, legie and not touched or (not legie and touched))
    end
end

function M.Build(b, p, h, fac)
    boot, player, hud, faction = b, p, h, fac or "kalidra"
    M.enemies, M.beacons, tagLevel = {}, {}, -1
    local R = map.Rng(99)
    for _, camp in ipairs(Camps) do
        local region = camp[1]
        local defs = RegionEnemies[faction][region]
        if not Safe[faction][region] and defs then
            local count = (region == "kalidra" or region == "camp") and 1 or 2
            for _ = 1, count do
                local def = defs[floor(R() * #defs) + 1]
                local hx, hz = camp[2] + (R() - 0.5) * 6, camp[3] + (R() - 0.5) * 6
                local id = world.spawn("Models/heroes/" .. def.cls .. "_m.glb", hx, map.Ground(hx, hz), hz,
                    { fit = 1.62, lod = "auto", lod_distance = 20, name = def.name, tag = "enemy" })
                M.enemies[#M.enemies + 1] = { def = def, region = region, id = id, hx = hx, hz = hz, x = hx, z = hz,
                    tx = hx, tz = hz, wait = R() * 3, calmUntil = 0, respawnAt = 0, alive = true, yaw = R() * 360,
                    speed = 0, phase = 0, pose = pose.New(), sub = "", subColor = skin.Text, gait = pose.GaitOptions(def.cls .. "_m") }
            end
        end
    end
    -- strážní vatry a památník padlých
    for _, bc in ipairs(Beacons) do
        local x, z = bc[2], bc[3]
        local y = map.Ground(x, z)
        world.spawn("cylinder", x, y + 0.5, z, { size = { 2.8, 1.2, 2.8 }, color = { 0.7, 0.67, 0.6 }, collider = "box", name = "Strážní vatra" })
        M.beacons[#M.beacons + 1] = { id = bc[1], x = x, y = y, z = z, lit = nil }
    end
    local mx, mz = Memorial.x, Memorial.z
    local my = map.Ground(mx, mz)
    world.spawn("cube", mx, my + 1.1, mz, { size = { 1.2, 2.4, 0.5 }, color = { 0.62, 0.6, 0.56 }, collider = "box", name = "Památník padlých" })
    for i = 0, 7 do
        local a = i / 8 * math.pi * 2
        local x, z = mx + math.cos(a) * 2.2, mz + math.sin(a) * 2.2
        world.spawn("sphere", x, map.Ground(x, z) + 0.1, z, { size = { 0.55, 0.55, 0.55 }, color = { 0.62, 0.6, 0.56 } })
    end
    world.spawn("light", mx + 0.9, my + 0.1, mz + 0.8, { light = { color = { 1, 0.55, 0.2 }, intensity = 6, range = 5, flicker = true, y = 0.3 } })
    memorialPos = { x = mx, y = my, z = mz }
    M.RefreshBeacons()
end

-- Cíle aktivních úkolů (minimapa): {x, z, title}
function M.QuestTargets()
    local list = {}
    for _, wq in ipairs((boot and boot.state and boot.state.wquests) or {}) do
        local def = wq.state == "active" and hud.QuestDef(wq.quest_id)
        if def then
            if def.type == "kill" then
                for _, e in ipairs(M.enemies) do if e.alive and e.def.id == def.target then list[#list + 1] = { x = e.x, z = e.z, title = def.title } end end
            elseif def.type == "beacon" then
                for _, b in ipairs(Beacons) do if not hasTarget(wq, b[1]) then list[#list + 1] = { x = b[2], z = b[3], title = def.title } end end
            elseif def.type == "visit" then list[#list + 1] = { x = Memorial.x, z = Memorial.z, title = def.title } end
        end
    end
    return list
end

function M.Busy() return M.fighting or M.result ~= nil end
function M.InLive() return M.live ~= nil end
-- Hráč se nehýbe při přehrávání souboje a nad výsledkem (v aktivním boji ano)
function M.LocksInput() return (M.fighting and not M.live) or M.result ~= nil end

local function setState(st)
    if type(st) == "table" and st.character then boot.state = st end
end

local function resultSound()
    local r = M.result
    if not r then return end
    if (r.levels or 0) > 0 then boot.sound.Play("level")
    elseif r.won then boot.sound.Play("coin")
    else boot.sound.Play("fall", 0.8) end
end

-- ------------------------------------------------------------------ nepřátelé
local function enemyLevelTags()
    local my = (boot.state and boot.state.character and boot.state.character.level) or 1
    if my == tagLevel then return end
    tagLevel = my
    for _, e in ipairs(M.enemies) do
        -- nepřátelé se přizpůsobují úrovni hráče (±1), v těžších oblastech mají aspoň minimum oblasti
        local lv = max(my, e.def.l0)
        local diff, c
        if lv <= my then diff, c = "vyrovnaný", { 0.95, 0.85, 0.55 }
        elseif lv <= my + 2 then diff, c = "silný", { 1, 0.6, 0.35 }
        else diff, c = "nebezpečný", { 1, 0.35, 0.3 } end
        e.sub, e.subColor = string.format("úroveň %d–%d · %s", max(1, lv - 1), lv + 1, diff), c
    end
end

local function turnTo(e, dx, dz, k)
    if dx * dx + dz * dz < 0.0001 then return end
    local want = math.deg(math.atan(dx, dz))
    e.yaw = e.yaw + ((want - e.yaw + 540) % 360 - 180) * k
end

local function placeEnemy(e, dt)
    e.phase = e.phase + dt * e.speed * 1.9
    pose.Gait(e.id, e.phase, e.pose.fallen and 0 or e.speed, e.gait)
    local bob = math.abs(math.sin(e.phase)) * min(e.speed, 7) * 0.012
    local fwd, dy, pitch, fall = pose.Step(e.pose, dt)
    local yr = math.rad(e.yaw)
    entity.set_position(e.id, e.x + math.sin(yr) * fwd, map.Ground(e.x, e.z) + bob + dy, e.z + math.cos(yr) * fwd)
    entity.set_rotation(e.id, fall or (min(e.speed, 7) * 1.1 + pitch), e.yaw, 0)
end

local liveBegin

local function updateEnemies(dt, px, pz)
    local now = game.time()
    local calm = M.Busy() or inSafe(px, pz) or hud.IsOpen() or boot.selftest
    for _, e in ipairs(M.enemies) do
        if not e.alive then
            if now > e.respawnAt then
                e.alive, e.x, e.z, e.calmUntil = true, e.hx, e.hz, now + 2
                pose.Stand(e.pose)
                entity.set_visible(e.id, true)
                placeEnemy(e, 0)
            end
        elseif M.live and M.live.e == e then
            -- řídí aktivní boj
        elseif M.fighting then
            e.speed = 0
            placeEnemy(e, dt)
        else
            local toPlayer = dist(px, pz, e.x, e.z)
            local homeDist = dist(e.x, e.z, e.hx, e.hz)
            local speed = 0
            if inSafe(e.x, e.z, 1) then e.tx, e.tz, speed = e.hx, e.hz, 2.6
            elseif not calm and now > e.calmUntil and toPlayer < 7 and homeDist < 18 then
                e.tx, e.tz, speed = px, pz, 3.4
                if toPlayer < 1.5 then
                    e.calmUntil = now + 4
                    liveBegin(e)
                end
            else
                e.wait = e.wait - dt
                if e.wait <= 0 and dist(e.x, e.z, e.tx, e.tz) < 0.5 then
                    e.tx, e.tz = e.hx + (math.random() * 14 - 7), e.hz + (math.random() * 14 - 7)
                    if inSafe(e.tx, e.tz, 2) or map.HeightAt(e.tx, e.tz) < 0.5 then e.tx, e.tz = e.hx, e.hz end
                    e.wait = 2 + math.random() * 4
                end
                if homeDist > 18 then e.tx, e.tz = e.hx, e.hz end
                if dist(e.x, e.z, e.tx, e.tz) > 0.5 and e.wait <= 0 then speed = 1.5 end
            end
            if speed > 0 then
                local dx, dz = e.tx - e.x, e.tz - e.z
                local l = sqrt(dx * dx + dz * dz)
                if l > 0.1 then
                    dx, dz = dx / l, dz / l
                    local nx, nz = e.x + dx * speed * dt, e.z + dz * speed * dt
                    if map.HeightAt(nx, nz) > 0.3 then e.x, e.z = nx, nz else e.tx, e.tz = e.x, e.z end
                    turnTo(e, dx, dz, 1 - exp(-8 * dt))
                end
            end
            e.speed = speed
            placeEnemy(e, dt)
        end
    end
end

-- ------------------------------------------------------------------ vatry a památník (E)
local function nearPrompt(px, py, pz)
    for _, b in ipairs(M.beacons) do
        if dist(px, pz, b.x, b.z) < 4 then return "beacon", b.id, faction == "legie" and "Uhasit kalidrskou vatru" or "Zapálit strážní vatru" end
    end
    if memorialPos and dist(px, pz, memorialPos.x, memorialPos.z) < 4 then return "visit", "memorial", "Položit květ k památníku" end
end

local function interact(kind, target)
    local legie = faction == "legie"
    local wq = quest(kind == "beacon" and (legie and "l4" or "k4") or "k7")
    if not wq or wq.state ~= "active" then
        return Note(kind == "beacon"
            and (legie and "Kalidrská vatra. (Úkol „Zhasnout ohně“ dává kněz Oren.)" or "Vatra čeká na rozkaz. (Úkol „Strážní ohně“ dává Damon.)")
            or "Památník padlých. Kámen si pamatuje jejich jména.")
    end
    if kind == "beacon" and hasTarget(wq, target) then return Note(legie and "Tahle vatra už je uhašená." or "Tahle vatra už hoří.") end
    api.Rpc("ashes_wq_event", { p_kind = kind, p_target = target }, function(st, err)
        if err then return Note(err) end
        setState(st)
        M.RefreshBeacons()
        Note(kind == "beacon" and (legie and "Vatra zasyčela a zhasla. Kalidra o jedno oko méně." or "Vatra vzplála – vidí ji celé pobřeží.")
            or "Položil jsi květ k památníku padlých.")
    end)
end

-- ------------------------------------------------------------------ aktivní boj
local liveHelpShown = false

local function endLive()
    M.live, M.fighting = nil, false
    player.speedMul = 1
end

local function playLiveEvent(L, ev)
    local e = L.e
    local px, py, pz = player.Position()
    local ey = map.Ground(e.x, e.z)
    if ev.who == "e" then
        pose.Lunge(e.pose)
        if ev.e then float(px, py + 2, pz, ev.active and "ÚHYB!" or "úhyb", { 0.7, 0.85, 1 }); boot.sound.Play("dodge")
        elseif (ev.d or 0) <= 0 and ev.b then float(px, py + 2, pz, "blok", { 0.8, 0.8, 0.8 }); boot.sound.Play("block")
        else
            if ev.b then float(px, py + 2.4, pz, "BLOK", { 0.8, 0.85, 0.9 }); boot.sound.Play("block")
            else boot.sound.Play(ev.c and "crit" or "hit") end
            float(px, py + 2, pz, (ev.c and "KRITICKÝ  " or "") .. "-" .. tostring(ev.d), { 1, 0.35, 0.3 })
            pose.Flinch(player.pose)
        end
    elseif ev.who == "p" then
        if ev.e then float(e.x, ey + 2, e.z, "minul", { 0.75, 0.75, 0.75 })
        elseif (ev.d or 0) <= 0 and ev.b then float(e.x, ey + 2, e.z, "vykryto", { 0.8, 0.8, 0.8 }); boot.sound.Play("block")
        else
            boot.sound.Play((ev.c or ev.skill) and "crit" or "hit")
            float(e.x, ey + 2, e.z, (ev.skill and (string.upper(L.skillName) .. "  ") or (ev.c and "KRITICKÝ  " or "")) .. "-" .. tostring(ev.d),
                ev.skill and { 1, 0.6, 0.2 } or (ev.c and { 1, 0.45, 0.2 } or { 1, 0.9, 0.5 }))
            pose.Flinch(e.pose)
        end
    elseif ev.who == "stun" then
        L.stunnedUntil = game.time() + (ev.ms or 0) / 1000
        float(e.x, ey + 2.5, e.z, "OMRÁČEN", { 1, 0.85, 0.4 })
    end
end

-- Jedna akce na serveru; odpověď přehraje události (zásahy, úhyby, bloky)
local function liveAct(L, action, index)
    if L.ended or not L.id then return end
    L.inflight = L.inflight + 1
    local args = { p_id = L.id, p_action = action }
    if index then args.p_index = index end
    local t0 = game.time()
    api.Rpc("ashes_live_act", args, function(st, err)
        L.inflight = L.inflight - 1
        if L.ended or M.live ~= L then return end
        if err then return Note(err) end
        if type(st) ~= "table" then return end
        local now = game.time()
        local half = (now - t0) / 2
        for _, ev in ipairs(st.events or {}) do playLiveEvent(L, ev) end
        L.hp1, L.hp2 = st.hp_p or L.hp1, st.hp_e or L.hp2
        L.swingIndex = st.swing_index or L.swingIndex
        L.swingLandAt = now + (st.next_swing_in or 0) / 1000 - half
        -- srovnat odpočty se serverem (jen když server hlásí delší čekání)
        L.attackReadyAt = max(L.attackReadyAt, now + (st.attack_ready_in or 0) / 1000 - half)
        L.skillReadyAt = max(L.skillReadyAt, now + (st.skill_ready_in or 0) / 1000 - half)
        if st.status ~= "active" then L.final, L.ended = st, true end
    end)
end

liveBegin = function(e)
    M.fighting = true
    local L = { e = e, inflight = 0, ended = false, starting = true, stunnedUntil = 0, warned = -1, defended = -1, ticked = -1,
                attackReadyAt = 0, skillReadyAt = 0, dodgeReadyAt = 0, swingIndex = 0, swingLandAt = game.time() + 99,
                skillName = "Dovednost", name1 = (boot.state and boot.state.character and boot.state.character.name) or "Ty",
                name2 = e.def.name, hp1 = 1, hp2 = 1, max1 = 1, max2 = 1, blocking = false }
    M.live = L
    player.speedMul = 1
    local t0 = game.time()
    api.Rpc("ashes_live_begin", { p_region = e.region, p_enemy = e.def.id }, function(st, err)
        if M.live ~= L then return end
        if err or type(st) ~= "table" then
            Note(err or "Souboj se nepodařilo začít.")
            e.calmUntil = game.time() + 6
            return endLive()
        end
        local now = game.time()
        local half = (now - t0) / 2
        L.id = st.id
        L.rules = st.rules or { attack_ms = 900, skill_ms = 7000, dodge_ms = 1100, range = 3.2 }
        L.skillName = (L.rules.skill and L.rules.skill ~= "") and L.rules.skill or "Dovednost"
        L.name2 = string.format("%s · úroveň %s", (st.enemy and st.enemy.name) or e.def.name, tostring(st.enemy and st.enemy.level or ""))
        L.max1, L.max2, L.hp1, L.hp2 = st.max_p or 1, st.max_e or 1, st.hp_p or 1, st.hp_e or 1
        L.swingIndex = st.swing_index or 0
        L.swingLandAt = now + (st.next_swing_in or 0) / 1000 - half
        L.attackReadyAt, L.skillReadyAt, L.dodgeReadyAt = now, now, now
        L.starting = false
        if boot.mods then boot.mods.fire("fight_start", e.def.id, e.def.name) end
        if not liveHelpShown then
            liveHelpShown = true
            Note(string.format("%s = útok · %s = dovednost · %s = úhyb · %s (držet) = blok. Uhni, když se nepřítel napřáhne!",
                keys.Label("attack"), keys.Label("skill"), keys.Label("dodge"), keys.Label("block")))
        end
    end)
end

local function finishLive(L)
    local fin, e = L.final, L.e
    player.speedMul = 1
    M.live = nil
    if not fin then return endLive() end
    if fin.status == "won" then
        pose.Fall(e.pose)
        timer.after(0.9, function() e.alive = false; e.respawnAt = game.time() + 35; entity.set_visible(e.id, false) end)
    elseif fin.status == "lost" then
        pose.Fall(player.pose)
        e.calmUntil = game.time() + 6
    else
        e.calmUntil = game.time() + 8
        Note("Utekl jsi ze souboje.")
        return endLive()
    end
    timer.after(0.9, function()
        setState(fin.state)
        M.RefreshBeacons()
        M.result = { won = fin.won, xp = fin.xp or 0, gold = fin.gold or 0, levels = fin.levels or 0, quests = fin.quests, item = fin.item }
        resultSound()
        if boot.mods then boot.mods.fire("fight_end", fin.won and "won" or "lost", e.def.name) end
        M.fighting = false
    end)
end

local function updateLive(dt)
    local L = M.live
    if not L then return end
    if L.ended then return finishLive(L) end
    local e = L.e
    local now = game.time()
    local px, _, pz = player.Position()
    local d = dist(px, pz, e.x, e.z)
    -- nepřítel: střelci drží odstup, ostatní jdou k hráči
    local ranged = e.def.cls == "lucistnik" or e.def.cls == "vestec"
    local want = ranged and 7 or 1.6
    local spd = 0
    if not L.starting and now > L.stunnedUntil and d > want + 0.3 and now < L.swingLandAt - 0.55 then
        local dx, dz = (px - e.x) / d, (pz - e.z) / d
        local nx, nz = e.x + dx * 3.6 * dt, e.z + dz * 3.6 * dt
        if map.HeightAt(nx, nz) > 0.3 then e.x, e.z, spd = nx, nz, 3.6 end
    end
    turnTo(e, px - e.x, pz - e.z, 1 - exp(-10 * dt))
    e.speed = spd
    placeEnemy(e, dt)
    if L.starting then return end
    -- napřažení nepřítele (signál k úhybu / bloku)
    if now >= L.swingLandAt - 0.65 and L.warned < L.swingIndex and now > L.stunnedUntil then
        L.warned = L.swingIndex
        float(e.x, map.Ground(e.x, e.z) + 2.6, e.z, "!", { 1, 0.25, 0.2 })
        boot.sound.Play("warn")
    end
    local inputOk = not boot.typing and not hud.IsOpen() and not boot.optionsOpen
    local range = (L.rules.range or 0) > 0 and L.rules.range or 3.2
    -- blok (držet): pomalejší pohyb, ohlásí se na nejbližší úder
    L.blocking = inputOk and keys.Held("block")
    player.speedMul = L.blocking and 0.4 or 1
    local inWindow = now >= L.swingLandAt - 0.85 and now <= L.swingLandAt + 0.2
    if L.blocking and inWindow and L.defended < L.swingIndex then
        L.defended = L.swingIndex
        liveAct(L, "block", L.swingIndex)
    end
    -- úhyb: odskok bokem; když přijde včas, rána mine
    if inputOk and keys.Down("dodge") and now >= L.dodgeReadyAt then
        L.dodgeReadyAt = now + max(0.9, (L.rules.dodge_ms or 1100) / 1000 + 0.05)
        local tx, tz = (e.x - px) / max(d, 0.01), (e.z - pz) / max(d, 0.01)
        local sx, sz = tz, -tx
        if math.random() < 0.5 then sx, sz = -sx, -sz end
        player.Dash(sx * 0.8 - tx * 0.4, sz * 0.8 - tz * 0.4)
        boot.sound.Play("dodge")
        if inWindow and L.defended < L.swingIndex then
            L.defended = L.swingIndex
            liveAct(L, "dodge", L.swingIndex)
        end
    end
    -- útok a dovednost
    local wantAttack = inputOk and not L.blocking and keys.Down("attack") and not ui.wants_mouse()
    local wantSkill = inputOk and not L.blocking and keys.Down("skill")
    if (wantAttack and now >= L.attackReadyAt) or (wantSkill and now >= L.skillReadyAt) then
        if d > range then Note(range > 5 and "Nepřítel je příliš daleko." or "Přibliž se k nepříteli.")
        else
            local skill = wantSkill and now >= L.skillReadyAt
            L.attackReadyAt = now + (L.rules.attack_ms or 900) / 1000
            if skill then L.skillReadyAt = now + (L.rules.skill_ms or 7000) / 1000 end
            player.FaceTo(e.x, e.z)
            pose.Lunge(player.pose)
            boot.sound.Play("swing")
            liveAct(L, skill and "skill" or "attack")
        end
    end
    -- vyhodnocení úderu nepřítele (server) chvíli po jeho dopadu
    if now >= L.swingLandAt + 0.38 and L.ticked < L.swingIndex and L.inflight == 0 then
        L.ticked = L.swingIndex
        liveAct(L, "tick")
    end
    -- útěk: příliš daleko od nepřítele
    if d > 26 and L.inflight == 0 and not L.fleeing then
        L.fleeing = true
        liveAct(L, "flee")
    end
end

-- ------------------------------------------------------------------ souboj vyhodnocený serverem (aréna, boss, příběh)
M.arenaFoe = nil
local replay = nil   -- { name1, name2, hp1, hp2, max1, max2 }

-- Přehraje souboj kolo po kole (hráč = f1); foe = { id, pose, x, z } nebo nil. Volat z korutiny.
local function replayFight(f, foe, label)
    local r0 = f.rounds and f.rounds[1]
    local max1 = r0 and max((r0.h1 or 0) + ((r0.a == 2 and not r0.e) and (r0.d or 0) or 0), 1) or (f.hp1 or 1)
    local max2 = r0 and max((r0.h2 or 0) + ((r0.a == 1 and not r0.e) and (r0.d or 0) or 0), 1) or (f.hp2 or 1)
    replay = { name1 = (f.f1 and f.f1.name) or "Ty", name2 = label, hp1 = max1, hp2 = max2, max1 = max1, max2 = max2 }
    timer.sleep(0.4)
    for _, r in ipairs(f.rounds or {}) do
        local px, py, pz = player.Position()
        local fx, fz = foe and foe.x or px, foe and foe.z or pz
        local fy = map.Ground(fx, fz)
        if r.a == 1 then pose.Lunge(player.pose) elseif foe then pose.Lunge(foe.pose) end
        timer.sleep(0.18)
        local tx, ty, tz = px, py + 2, pz
        if r.a == 1 then tx, ty, tz = fx, fy + 2 * (foe and foe.scale or 1), fz end
        if r.e then float(tx, ty, tz, "úhyb", { 0.7, 0.85, 1 }); boot.sound.Play("dodge")
        else
            boot.sound.Play(r.b and "block" or (r.c and "crit" or "hit"))
            if r.b then float(tx, ty + 0.4, tz, "blok", { 0.8, 0.8, 0.8 }) end
            float(tx, ty, tz, (r.c and "KRITICKÝ  " or "") .. "-" .. tostring(r.d),
                r.c and { 1, 0.45, 0.2 } or (r.a == 1 and { 1, 0.9, 0.5 } or { 1, 0.35, 0.3 }))
            if r.a == 1 then if foe then pose.Flinch(foe.pose) end else pose.Flinch(player.pose) end
        end
        replay.hp1, replay.hp2 = r.h1 or replay.hp1, r.h2 or replay.hp2
        timer.sleep(0.42)
    end
end

-- Souboj na serveru: fn, args, opts = { arena, cls, gender, label, boss = {id,pose,x,z,scale}, onError, onDone }
function M.ServerFight(fn, args, opts)
    if M.Busy() or not player.body then return end
    opts = opts or {}
    M.fighting = true
    api.Rpc(fn, args or {}, function(res, err)
        if err or type(res) ~= "table" then
            M.fighting = false
            if opts.onError then opts.onError(err or "Server odmítl souboj.") else Note(err or "Server odmítl souboj.") end
            return
        end
        timer.start(function()
            local f = res.fight or {}
            local label, cls, gender = opts.label or "Soupeř", opts.cls, opts.gender or "m"
            if (not opts.arena or not cls) and f.f2 and f.f2.name and f.f2.name ~= "" then
                label = string.format("%s · úroveň %s", f.f2.name, tostring(f.f2.level or ""))
                if f.f2.class and f.f2.class ~= "" then cls = f.f2.class end
                if f.f2.name:sub(1, #"Gladiátorka") == "Gladiátorka" then gender = "f" end
            end
            local foe = opts.boss
            if foe then
                player.FaceTo(foe.x, foe.z)
                label = opts.label or label
            else
                -- soupeř se objeví naproti hráči
                local px, _, pz = player.Position()
                local fr = math.rad(player.facing or 0)
                local x, z = px + math.sin(fr) * 2.4, pz + math.cos(fr) * 2.4
                local scale = fn == "ashes_fight_boss" and 1.3 or 1
                local h = (gender == "f" and 1.55 or 1.62) * scale
                local id = world.spawn("Models/heroes/" .. (cls or "hoplit") .. "_" .. gender .. ".glb", x, map.Ground(x, z), z,
                    { fit = h, yaw = (player.facing or 0) + 180, name = label, tag = "enemy" })
                foe = { id = id, pose = pose.New(), x = x, z = z, yaw = (player.facing or 0) + 180, scale = scale, label = label,
                        sub = fn == "ashes_fight_boss" and "strážce kapitoly" or nil }
                M.arenaFoe = foe
            end
            if boot.mods then boot.mods.fire("fight_start", "arena", label) end
            timer.sleep(0.5)
            replayFight(f, foe, label)
            local header, storyNote
            if opts.boss then
                if res.killed then pose.Fall(foe.pose); header = "THALASSOS PADL!"
                else
                    if f.winner == 2 then pose.Fall(player.pose) end
                    header = "ZÁSAH"
                end
                storyNote = res.killed
                    and string.format("Zasadil jsi poslední ránu (%d poškození)! Odměnu dostanou všichni, kdo bojovali.", res.damage or 0)
                    or string.format("Zasadil jsi obrovi %d poškození. Zbývá mu %d / %d životů.", res.damage or 0, res.boss_hp or 0, res.boss_hp_max or 0)
            elseif res.won then pose.Fall(foe.pose)
            else pose.Fall(player.pose) end
            timer.sleep(0.9)
            setState(res.state)
            M.result = { won = res.won, xp = res.xp or 0, gold = res.gold or 0, levels = res.levels or 0, item = res.item,
                         quests = res.quests, arena = true, honor = opts.arena and (res.honor or 0) or nil,
                         header = header, note = storyNote or opts.storyNote, noteAlways = opts.boss ~= nil }
            resultSound()
            if boot.mods then boot.mods.fire("fight_end", res.won and "won" or "lost", label) end
            M.fighting = false
            replay = nil
            if opts.onDone then opts.onDone(res) end
        end)
    end)
end

local function closeResult()
    local r = M.result
    local lost = r and not r.won and not r.arena
    M.result = nil
    pose.Stand(player.pose)
    if M.arenaFoe then entity.destroy(M.arenaFoe.id); M.arenaFoe = nil end
    if lost then player.Respawn(faction == "legie" and M.RespawnLegie or M.RespawnKalidra) end
end
M.CloseResult = closeResult

-- ------------------------------------------------------------------ snímek
function M.Update(dt)
    if not boot or not player.body then return end
    local px, py, pz = player.Position()
    enemyLevelTags()
    updateEnemies(dt, px, pz)
    updateLive(dt)
    if M.arenaFoe then
        local f = M.arenaFoe
        local fwd, dy, pitch, fall = pose.Step(f.pose, dt)
        local yr = math.rad(f.yaw)
        entity.set_position(f.id, f.x + math.sin(yr) * fwd, map.Ground(f.x, f.z) + dy, f.z + math.cos(yr) * fwd)
        entity.set_rotation(f.id, fall or pitch, f.yaw, 0)
    end
    if not M.Busy() and not boot.typing and not hud.IsOpen() and not hud.near and keys.Down("interact") then
        local kind, target = nearPrompt(px, py, pz)
        if kind then interact(kind, target) end
    end
end

-- ------------------------------------------------------------------ kreslení
local function rewardLine(cx, y, parts, gold)
    local text = table.concat(parts, "      ")
    local w = ui.text_size(text, { size = 26, font = "bold" }) or 0
    local gw = gold > 0 and ((ui.text_size("+" .. gold .. " zlata", { size = 26, font = "bold" }) or 0) + 30) or 0
    local x = cx - (w + gw) / 2
    if text ~= "" then ui.text(x, y, text, { size = 26, font = "bold", color = { 0.78, 0.66, 1 } }) end
    if gold > 0 then ui.text(x + w + 30, y, "+" .. gold .. " zlata", { size = 26, font = "bold", color = { 0.94, 0.82, 0.54 } }) end
end

local function bars(W, b)
    local bw = 420
    local lx, rx, y = W / 2 - bw - 50, W / 2 + 50, 40
    ui.text(lx, y - 30, b.name1, { size = 20, font = "h2", color = skin.Sky })
    ui.text(rx + bw, y - 30, b.name2, { size = 20, font = "h2", color = { 1, 0.5, 0.4 }, align = "right" })
    ui.bar(lx, y, bw, 30, b.hp1 / max(1, b.max1), skin.Good, string.format("%d / %d", b.hp1, b.max1))
    ui.bar(rx, y, bw, 30, b.hp2 / max(1, b.max2), { 0.94, 0.27, 0.18 }, string.format("%d / %d", b.hp2, b.max2))
    ui.rect(W / 2 - 22, 33, 44, 44, skin.Gold, 6)
    ui.text(W / 2, 43, "VS", { size = 17, font = "h2", color = skin.Bg, align = "center", shadow = false })
end

local function liveHud(W, H, L)
    if not L.rules then return end
    local now = game.time()
    local labels = { keys.Label("attack"), keys.Label("skill"), keys.Label("dodge"), keys.Label("block") }
    local names = { "Útok", L.skillName, "Úhyb", "Blok" }
    local left = {
        max(0, L.attackReadyAt - now) / max(0.1, (L.rules.attack_ms or 900) / 1000),
        max(0, L.skillReadyAt - now) / max(0.1, (L.rules.skill_ms or 7000) / 1000),
        max(0, L.dodgeReadyAt - now) / max(0.1, (L.rules.dodge_ms or 1100) / 1000 + 0.05),
        0 }
    local bw, gap = 150, 14
    local x0, y = W / 2 - (bw * 4 + gap * 3) / 2, H - 210
    for i = 1, 4 do
        local x = x0 + (i - 1) * (bw + gap)
        local active = (i == 4) and L.blocking or left[i] <= 0
        ui.rect(x, y, bw, 74, { 0.05, 0.04, 0.03, 0.78 })
        if left[i] > 0 then ui.rect(x, y, bw * min(1, left[i]), 74, { 0, 0, 0, 0.55 }) end
        if active then ui.rect(x, y + 70, bw, 4, i == 4 and skin.Sky or skin.GoldBright) end
        local kw = 14 + #labels[i] * 10
        ui.rect(x + 8, y + 8, kw, 24, skin.Gold, 3)
        ui.text(x + 8 + kw / 2, y + 11, labels[i], { size = 14, font = "h2", color = skin.Bg, align = "center", shadow = false })
        ui.text(x + 8, y + 42, names[i], { size = 17, font = "body", color = active and skin.GoldBright or { 0.7, 0.65, 0.58 } })
    end
    -- napřažení: blikající varování
    local toSwing = L.swingLandAt - now
    if toSwing <= 0.65 and toSwing > -0.15 and now > L.stunnedUntil then
        local a = 0.55 + 0.45 * math.sin(now * 30)
        ui.text(W / 2, y - 46, string.format("Nepřítel se napřahuje – %s úhyb / %s blok", keys.Label("dodge"), keys.Label("block")),
            { size = 22, font = "h2", color = { 1, 0.35, 0.28, a }, align = "center" })
    end
end

local function resultWindow(W, H)
    local r = M.result
    ui.rect(0, 0, W, H, { 0, 0, 0, 0.45 })
    local x, y, w, h = W / 2 - 330, H / 2 - 190, 660, 380
    ui.panel("Textures/ui/panel.png", x, y, w, h, 16, 16)
    local header = r.header or (r.won and "VÍTĚZSTVÍ" or "PORÁŽKA")
    ui.text(W / 2, y + 30, header, { size = 54, font = "title", color = (r.won or r.header) and skin.GoldBright or skin.Ember, align = "center" })
    skin.Ornament(x + 60, y + 110, w - 120)
    local cy = y + 136
    local function line(text, opts)
        opts = opts or {}
        ui.text(W / 2, cy, text, { size = opts.size or 22, font = opts.font or "body", color = opts.color or skin.Text, align = "center", wrap = w - 80 })
        cy = cy + (opts.size or 22) + 12
    end
    if r.arena and r.honor == nil then
        if r.won or r.noteAlways then rewardLine(W / 2, cy, { "+" .. r.xp .. " zkušeností" }, r.gold); cy = cy + 40
        else line("+" .. r.xp .. " zkušeností  ·  Ustoupil jsi, ale přežil.", { size = 24 }) end
        if r.levels > 0 then line("NOVÁ ÚROVEŇ!", { size = 28, font = "title", color = skin.GoldBright }) end
        if (r.won or r.noteAlways) and r.note and r.note ~= "" then line(r.note, { size = 20 }) end
    elseif r.arena then
        local hon = r.honor >= 0 and ("+" .. r.honor .. " cti") or (r.honor .. " cti")
        local parts = { hon }
        if r.xp > 0 then parts[2] = "+" .. r.xp .. " zk." end
        rewardLine(W / 2, cy, parts, r.gold); cy = cy + 40
        line(r.won and "Dav v aréně skanduje tvé jméno." or "Tentokrát byl soupeř silnější. Trénuj a vrať se.")
    elseif r.won then
        rewardLine(W / 2, cy, { "+" .. r.xp .. " zkušeností" }, r.gold); cy = cy + 40
        if type(r.item) == "table" and r.item.id then
            line("Kořist: " .. tostring(r.item.name) .. "  (v batohu – klávesa " .. keys.Label("bag") .. ")", { size = 22, font = "bold", color = skin.RarityColor(r.item.rarity) })
        end
        if r.levels > 0 then line("NOVÁ ÚROVEŇ!", { size = 28, font = "title", color = skin.GoldBright }) end
        for _, q in ipairs(r.quests or {}) do
            local def, wq = hud.QuestDef(q), quest(q)
            if def then line(string.format("%s: %d/%d", def.title, wq and wq.progress or 0, def.count or 1) .. ((wq and wq.state == "ready") and "  –  hotovo!" or "")) end
        end
    else
        line(faction == "legie" and "Padl jsi. Probudíš se v bezpečí tábora Legie." or "Padl jsi. Probudíš se v bezpečí u hradeb Kalidry.", { size = 24 })
    end
    if skin.Button(W / 2 - 150, y + h - 80, 300, 54, "POKRAČOVAT", true) or input.pressed("Enter") then closeResult() end
end

function M.Draw(W, H)
    if not boot then return end
    local now = game.time()
    -- jmenovky nepřátel
    for _, e in ipairs(M.enemies) do
        if e.alive then
            local y = map.Ground(e.x, e.z) + 1.97
            ui.world_label(e.x, y, e.z, e.def.name, { size = 19, color = "#f27361", font = "bold", max_distance = 30 })
            ui.world_label(e.x, y - 0.27, e.z, e.sub, { size = 15, color = e.subColor, font = "body", max_distance = 22 })
        end
    end
    for _, b in ipairs(M.beacons) do ui.world_label(b.x, b.y + 2.6, b.z, "Strážní vatra", { size = 18, color = skin.GoldBright, font = "bold", max_distance = 30 }) end
    if memorialPos then ui.world_label(memorialPos.x, memorialPos.y + 3, memorialPos.z, "Památník padlých", { size = 18, color = skin.GoldBright, font = "bold", max_distance = 30 }) end
    if M.arenaFoe then
        local f = M.arenaFoe
        local y = map.Ground(f.x, f.z) + 1.97 * f.scale
        ui.world_label(f.x, y, f.z, f.label, { size = 19, color = "#f27361", font = "bold", max_distance = 30 })
        if f.sub then ui.world_label(f.x, y - 0.27, f.z, f.sub, { size = 15, color = { 1, 0.45, 0.3 }, font = "body", max_distance = 22 }) end
    end
    -- létající čísla
    for i = #floats, 1, -1 do
        local f = floats[i]
        local age = now - f[6]
        if age > 1.3 then table.remove(floats, i)
        else
            local c = f[5]
            ui.world_label(f[1], f[2] + age * 0.9, f[3], f[4], { size = f[4]:sub(1, 4) == "KRIT" and 34 or 28, font = "h2",
                color = { c[1], c[2], c[3], 1 - age / 1.3 }, max_distance = 60 })
        end
    end
    if note and now < noteUntil then
        ui.panel("Textures/ui/panel.png", W / 2 - 330, 170, 660, 50, 12, 16)
        ui.text(W / 2, 182, note, { size = 20, font = "bold", color = skin.GoldBright, align = "center", wrap = 640 })
    end
    local L = M.live
    if L and not L.starting then bars(W, L) elseif replay then bars(W, replay) end
    if L then liveHud(W, H, L) end
    if M.result then return resultWindow(W, H) end
    if not M.fighting and not hud.near and not hud.IsOpen() then
        local px, py, pz = player.Position()
        local kind, _, text = nearPrompt(px, py, pz)
        if kind then hud.Prompt(W, H, keys.Label("interact"), text) end
    end
end

-- ------------------------------------------------------------------ samotest
-- Ukázka aktivního boje bez serveru: nepřítel naproti hráči, lišta akcí, čísla
function M.TestFight()
    local e = M.enemies[1]
    if not e then return end
    local px, py, pz = player.Position()
    local fr = math.rad(player.facing or 0)
    e.x, e.z, e.yaw = px + math.sin(fr) * 2.2, pz + math.cos(fr) * 2.2, (player.facing or 0) + 180
    local now = game.time()
    M.fighting = true
    M.live = { e = e, inflight = 1, ended = false, starting = false, stunnedUntil = 0, warned = 99, defended = 99, ticked = 99,
               attackReadyAt = now + 0.5, skillReadyAt = now + 4, dodgeReadyAt = now, swingIndex = 1, swingLandAt = now + 0.4,
               skillName = "Štítový úder", name1 = "Tester", name2 = e.def.name .. " · úroveň 3",
               hp1 = 120, max1 = 165, hp2 = 38, max2 = 90, rules = { attack_ms = 900, skill_ms = 7000, dodge_ms = 1100, range = 3.2 } }
    float(e.x, map.Ground(e.x, e.z) + 2, e.z, "KRITICKÝ  -24", { 1, 0.45, 0.2 })
    float(px, py + 2, pz, "-9", { 1, 0.35, 0.3 })
end

function M.TestResult()
    M.live, M.fighting = nil, false
    M.result = { won = true, xp = 45, gold = 12, levels = 1, item = { id = "x", name = "Bronzový štít", rarity = 2 }, quests = { "k2" } }
end

return M

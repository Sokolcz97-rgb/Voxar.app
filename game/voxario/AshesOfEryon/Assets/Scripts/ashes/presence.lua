-- Ostatní hráči ve světě (WorldPresence.cs) přes Supabase Realtime – společný soukromý kanál
-- ashes:world:all (vidí se hráči obou frakcí). Presence nese jméno, povolání a vzhled,
-- broadcast „pos“ polohu a rychlost. Formát je stejný jako u Unity a webové verze.
local map = require("ashes.worldmap")
local api = require("ashes.api")
local pose = require("ashes.pose")

local M = { others = {}, joined = false, count = 0 }

local channel, uid, myFaction
local lastSent, lastVel, lastSendTime, sendAt = { 0, 0 }, { 0, 0 }, 0, 0

local function r2(v) return math.floor(v * 100 + 0.5) / 100 end

local function track(boot, player)
    local ch = boot.state.character
    local x, _, z = player.Position()
    channel:track({
        name = (ch.display_name and ch.display_name ~= "") and ch.display_name or ch.name,
        cls = ch.class, level = ch.level, appearance = { gender = (ch.appearance and ch.appearance.gender) or "m" },
        eryon = ch.is_eryon or false, azkar = ch.is_azkar or false, faction = ch.faction, uid = uid,
        tag = boot.oddilTag or "", x = x, z = z, ry = math.rad(player.facing or 0),
    })
end

local function leave(key)
    local o = M.others[key]
    if not o then return end
    if o.id then entity.destroy(o.id) end
    M.others[key] = nil
    M.count = M.count - 1
end

local function join(key, metas)
    if key == uid then return end
    local meta = metas and metas[1]
    if type(meta) ~= "table" or not meta.name or meta.name == "" then return end
    local name = tostring(meta.name):sub(1, 24)
    local cls = meta.cls
    if cls ~= "hoplit" and cls ~= "lucistnik" and cls ~= "vestec" then cls = "hoplit" end
    local gender = (type(meta.appearance) == "table" and meta.appearance.gender == "f") and "f" or "m"
    local fac = meta.faction == "legie" and "legie" or "kalidra"
    local o = M.others[key]
    if o then
        o.level, o.name, o.faction, o.tag = meta.level or 1, name, fac, tostring(meta.tag or ""):sub(1, 5)
        return
    end
    local x, z = tonumber(meta.x) or 0, tonumber(meta.z) or 0
    o = { name = name, cls = cls, gender = gender, level = meta.level or 1, faction = fac, tag = tostring(meta.tag or ""):sub(1, 5),
          pos = { x, z }, target = { x, z }, vel = { 0, 0 }, stamp = game.time(), ry = tonumber(meta.ry) or 0, yaw = 0,
          phase = 0, gait = pose.GaitOptions(cls .. "_" .. gender) }
    o.id = world.spawn("Models/heroes/" .. cls .. "_" .. gender .. ".glb", x, map.Ground(x, z), z,
        { fit = gender == "f" and 1.55 or 1.62, lod = "auto", lod_distance = 20, name = name, tag = "other_player" })
    M.others[key] = o
    M.count = M.count + 1
end

function M.Connect(boot, player)
    M.Disconnect()
    uid = api.UserId()
    if not uid or not boot.state or not boot.state.character then return end
    myFaction = boot.state.character.faction or "kalidra"
    channel = realtime.channel("ashes:world:all", { private = true, presence_key = uid })
    channel:on("presence", function(kind, data)
        if kind == "sync" then
            for key, metas in pairs(data) do join(key, metas) end
            for key in pairs(M.others) do if not data[key] then leave(key) end end
        elseif kind == "join" then join(data.key, data.metas)
        elseif kind == "leave" then leave(data.key) end
    end)
    channel:on("broadcast", "pos", function(p)
        local id = p.uid
        local o = id and id ~= uid and M.others[id]
        if not o then return end
        local x, z = tonumber(p.x), tonumber(p.z)
        if not x or not z or math.abs(x) > 200 or math.abs(z) > 400 then return end
        o.target = { x, z }
        o.vel = { tonumber(p.vx) or 0, tonumber(p.vz) or 0 }
        if o.vel[1] ^ 2 + o.vel[2] ^ 2 > 200 then o.vel = { 0, 0 } end
        o.stamp = game.time()
        o.ry = tonumber(p.ry) or 0
    end)
    channel:on("broadcast", "chat", function() if boot.chat then boot.chat.PollNow() end end)
    channel:subscribe(function(status)
        M.joined = status == "subscribed"
        if M.joined then track(boot, player) end
    end)
end

function M.Disconnect()
    if channel then channel:leave() end
    channel = nil
    M.joined = false
    for key in pairs(M.others) do leave(key) end
end

function M.Signal(ev)
    if M.joined then channel:send(ev, { uid = uid }) end
end

function M.Retrack(boot, player) if M.joined then track(boot, player) end end

function M.Update(dt, player)
    if not channel then return end
    local now = game.time()
    -- poloha + rychlost; ostatní si pohyb mezi zprávami dopočítají
    if M.joined and now > sendAt then
        sendAt = now + 0.16
        local x, _, z = player.Position()
        local since = now - lastSendTime
        local vx, vz = 0, 0
        if since > 0.01 then
            local s = math.max(since, 0.16)
            vx, vz = (x - lastSent[1]) / s, (z - lastSent[2]) / s
        end
        local moved = (x - lastSent[1]) ^ 2 + (z - lastSent[2]) ^ 2 > 0.0025
        local turned = (vx - lastVel[1]) ^ 2 + (vz - lastVel[2]) ^ 2 > 0.8
        local stopped = not moved and (lastVel[1] ^ 2 + lastVel[2] ^ 2) > 0.01
        if (moved and (turned or since > 0.33)) or stopped then
            if stopped then vx, vz = 0, 0 end
            lastSent, lastVel, lastSendTime = { x, z }, { vx, vz }, now
            channel:send("pos", { x = r2(x), z = r2(z), vx = r2(vx), vz = r2(vz), ry = r2(math.rad(player.facing or 0)), uid = uid })
        end
    end
    -- plynulý pohyb ostatních (dopočet max 0,6 s)
    for _, o in pairs(M.others) do
        local age = math.min(now - o.stamp, 0.6)
        local px, pz = o.target[1] + o.vel[1] * age, o.target[2] + o.vel[2] * age
        local k = 1 - math.exp(-10 * dt)
        local ox, oz = o.pos[1], o.pos[2]
        o.pos[1], o.pos[2] = o.pos[1] + (px - o.pos[1]) * k, o.pos[2] + (pz - o.pos[2]) * k
        local spd = dt > 0 and math.sqrt((o.pos[1] - ox) ^ 2 + (o.pos[2] - oz) ^ 2) / dt or 0
        o.phase = o.phase + dt * spd * 1.9
        pose.Gait(o.id, o.phase, spd, o.gait)
        local want = math.deg(o.ry)
        o.yaw = o.yaw + ((want - o.yaw + 540) % 360 - 180) * k
        entity.set_position(o.id, o.pos[1], map.Ground(o.pos[1], o.pos[2]), o.pos[2])
        entity.set_rotation(o.id, 0, o.yaw, 0)
    end
end

-- Jmenovky ostatních hráčů (vlastní frakce zlatavě, druhá načervenale)
function M.Draw()
    for _, o in pairs(M.others) do
        local y = map.Ground(o.pos[1], o.pos[2]) + 1.95
        local title = o.tag ~= "" and ("[" .. o.tag .. "] " .. o.name) or o.name
        ui.world_label(o.pos[1], y, o.pos[2], title, { size = 19, color = "#ece2d0", font = "bold", max_distance = 40 })
        ui.world_label(o.pos[1], y - 0.27, o.pos[2], "úroveň " .. tostring(o.level) .. " · " .. (o.faction == "legie" and "Legie" or "Kalidra"),
            { size = 15, color = o.faction == myFaction and "#ebcc85" or "#f27361", font = "body", max_distance = 25 })
    end
end

return M

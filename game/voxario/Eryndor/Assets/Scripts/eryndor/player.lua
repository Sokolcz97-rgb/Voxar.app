-- Ozvěna (hráč): kapsle pro pohyb po terénu, model KayKit s výbavou, kamera za zády (MMO).
--   WASD / šipky pohyb, Shift chůze, Space skok, pravé tlačítko myši otáčí kamerou, kolečko zoom.
local map = require("eryndor.map")
local humans = require("eryndor.humans")
local M = { cam = { yaw = 180, pitch = 18, distance = 7.5 }, facing = 180, speed = 0, moving = false,
            inputEnabled = true, runSpeed = 6.2, walkSpeed = 2.4 }

local sin, cos, rad, deg, sqrt, exp, max, min, atan = math.sin, math.cos, math.rad, math.deg, math.sqrt, math.exp, math.max, math.min, math.atan

function M.Pos(id)
    local p = entity.get_position(id or M.body)
    if not p then return 0, 0, 0 end
    return p.x or p[1], p.y or p[2], p.z or p[3]
end

function M.Create(class, spawn)
    M.class = class
    local x, z = spawn.x, spawn.z
    local y = map.HeightAt(x, z)
    M.body = _G.world.spawn("cylinder", x, y + 1.0, z, { visible = false, name = "Player", tag = "player",
        character = { radius = 0.35, height = 1.7, step = 0.45, slope = 50 } })
    M.view = humans.Spawn(class.model, x, y, z, { name = class.name, right = class.look.right, left = class.look.left,
        helm = class.look.helm })
    M.camera = entity.find("Camera")
    M.lamp = _G.world.spawn("light", x, y + 2.5, z, { light = { color = { 1.0, 0.8, 0.6 }, intensity = 8, range = 10, night_only = true } })
    M.anim = nil
    M.Play("Idle")
end

function M.Teleport(x, z)
    local y = map.HeightAt(x, z)
    entity.set_position(M.body, x, y + 1.0, z)
    entity.set_velocity(M.body, 0, 0, 0)
end

-- animace pohybu (útoky a kouzla hrají jako jednorázové přes M.Action)
function M.Play(clip, fade, loop)
    if M.anim == clip then return end
    M.anim = clip
    anim.play(M.view, clip, fade or 0.15, loop ~= false)
end

-- jednorázová akce (útok, kouzlo, zásah): po dohrání se vrátí k pohybu
function M.Action(clip, dur, speed)
    M.actionT = game.time() + (dur or 0.8)
    M.anim = clip
    anim.play(M.view, clip, 0.08, false, true)
    anim.speed(M.view, speed or 1)
end

local function angleLerp(a, b, t)
    local d = (b - a + 540) % 360 - 180
    return a + d * t
end

-- moveTo = {x, z} – automatický přesun k cíli (útok na vzdálený cíl, jako v 4Story)
function M.Update(dt, combatPose, moveTo, rooted)
    if not M.body then return end
    local c = M.cam
    local fx, fz = sin(rad(c.yaw)), cos(rad(c.yaw))
    local rx, rz = -fz, fx
    local ix, iz = 0, 0
    if M.inputEnabled and not M.dead then
        if input.key("W") or input.key("Up") then iz = iz + 1 end
        if input.key("S") or input.key("Down") then iz = iz - 1 end
        if input.key("D") or input.key("Right") then ix = ix + 1 end
        if input.key("A") or input.key("Left") then ix = ix - 1 end
    end
    local mx, mz = fx * iz + rx * ix, fz * iz + rz * ix
    M.manual = (ix ~= 0 or iz ~= 0)
    local px, py, pz = M.Pos()
    if not M.manual and moveTo then
        local dx, dz = moveTo[1] - px, moveTo[2] - pz
        local d = sqrt(dx * dx + dz * dz)
        if d > 0.2 then mx, mz = dx / d, dz / d end
    end
    if rooted or M.dead then mx, mz = 0, 0 end
    local ml = sqrt(mx * mx + mz * mz)
    if ml > 1 then mx, mz, ml = mx / ml, mz / ml, 1 end
    local spd = input.key("Shift") and M.walkSpeed or M.runSpeed
    local k = 1 - exp(-14 * dt)
    M.vx = (M.vx or 0) + (mx * spd - (M.vx or 0)) * k
    M.vz = (M.vz or 0) + (mz * spd - (M.vz or 0)) * k
    local jump = (M.inputEnabled and not M.dead and input.pressed("Space")) and 6.0 or 0
    local grounded = physics.move_character(M.body, M.vx, M.vz, jump)
    if jump > 0 then M.Action("Jump_Full_Short", 0.9) end
    if ml > 0.05 then M.facing = angleLerp(M.facing, deg(atan(mx, mz)), 1 - exp(-12 * dt)) end
    if M.faceTarget and ml < 0.05 then M.facing = angleLerp(M.facing, M.faceTarget, 1 - exp(-10 * dt)) end
    M.speed = sqrt(M.vx * M.vx + M.vz * M.vz)
    M.moving = M.speed > 0.4

    -- model na zemi pod kapslí
    px, py, pz = M.Pos()
    -- chodidla: odsazení kapsle od země se změří, když stojí na zemi (jinak by postava zapadla / visela)
    local th = map.HeightAt(px, pz)
    if grounded and (not M.footOffset or math.abs(py - th - M.footOffset) < 0.5) then M.footOffset = py - th end
    local gy = py - (M.footOffset or 0)
    if grounded and math.abs(gy - th) < 0.35 then gy = th end
    entity.set_position(M.view, px, gy, pz)
    entity.set_rotation(M.view, 0, M.facing, 0)
    entity.set_position(M.lamp, px, gy + 2.6, pz)

    if M.dead then
        -- leží (animace smrti hraje z combat)
    elseif M.actionT and game.time() < M.actionT then
        -- probíhá akce
    else
        M.actionT = nil
        if M.speed > 3.5 then M.Play("Running_A")
        elseif M.speed > 0.4 then M.Play("Walking_A")
        elseif combatPose then M.Play(M.class.combatIdle or "2H_Melee_Idle")
        else M.Play("Idle") end
        anim.speed(M.view, M.speed > 0.4 and math.max(0.7, math.min(1.4, M.speed / (M.speed > 3.5 and M.runSpeed or M.walkSpeed))) or 1)
    end
end

function M.UpdateCamera(dt)
    if not M.camera or not M.body then return end
    local c = M.cam
    if M.inputEnabled and not ui.wants_mouse() then
        if input.key("Mouse2") then
            local dx, dy = input.mouse_delta()
            c.yaw = c.yaw - dx * 0.25
            c.pitch = max(-5, min(70, c.pitch + dy * 0.2))
        end
        c.distance = max(2.5, min(20, c.distance - input.wheel() * 0.9))
    end
    local px, py, pz = M.Pos()
    local tx, ty, tz = px, py + 0.9, pz
    local cp, sp = cos(rad(c.pitch)), sin(rad(c.pitch))
    local fx, fy, fz = sin(rad(c.yaw)) * cp, -sp, cos(rad(c.yaw)) * cp
    local wx, wy, wz = tx - fx * c.distance, ty - fy * c.distance, tz - fz * c.distance
    local ground = map.HeightAt(wx, wz) + 0.5
    if wy < ground then wy = ground end
    c.x = c.x and c.x + (wx - c.x) * (1 - exp(-16 * dt)) or wx
    c.y = c.y and c.y + (wy - c.y) * (1 - exp(-16 * dt)) or wy
    c.z = c.z and c.z + (wz - c.z) * (1 - exp(-16 * dt)) or wz
    local dx, dy, dz = tx - c.x, ty - c.y, tz - c.z
    entity.set_position(M.camera, c.x, c.y, c.z)
    entity.set_rotation(M.camera, deg(atan(dy, sqrt(dx * dx + dz * dz))), deg(atan(-dx, -dz)), 0)
end

return M

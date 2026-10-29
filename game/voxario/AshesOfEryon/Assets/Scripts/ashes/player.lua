-- Hráč (PlayerController.cs) a kamera ve třetí osobě (CameraRig.cs)
local map = require("ashes.worldmap")
local keys = require("ashes.keybinds")

local M = {
    walkSpeed = 4.2, runSpeed = 7,
    inputEnabled = true, cameraInput = true,
    speedMul = 1,
    yaw = 0, facing = 0,
    cam = { distance = 7, yaw = 0, pitch = 22, x = 0, y = 0, z = 0 },
}

local sqrt, sin, cos, exp, rad, deg, min, max = math.sqrt, math.sin, math.cos, math.exp, math.rad, math.deg, math.min, math.max
local autoRun = false
local dashT, dashX, dashZ = 0, 0, 0
local hvx, hvz = 0, 0

-- Vytvoří hráče: model hrdiny (bez kostry – chůze procedurálně) + kapsle pro pohyb po terénu
function M.Create(cls, gender, name, spawn)
    local h = gender == "f" and 1.55 or 1.62
    local model = "Models/heroes/" .. cls .. "_" .. gender .. ".glb"
    -- kapsle (neviditelná) nese polohu, model ji následuje
    M.body = world.spawn("cylinder", spawn.x, map.Ground(spawn.x, spawn.z) + 0.2, spawn.z,
        { visible = false, name = "Player", tag = "player",
          character = { radius = 0.35, height = 1.6, step = 0.45, slope = 55 } })
    M.view = world.spawn(model, spawn.x, map.Ground(spawn.x, spawn.z), spawn.z, { fit = h, name = name, lod = "auto", lod_distance = 25 })
    M.height = h
    M.name = name
    M.camera = entity.find("Camera")
    M.Respawn(spawn)
end

function M.Respawn(p)
    local y = map.Ground(p.x, p.z)
    local hit = physics.raycast(p.x, y + 50, p.z, 0, -1, 0, 100, M.body)
    if hit then y = hit.point.y end
    entity.set_position(M.body, p.x, y + 0.15, p.z)
    entity.set_velocity(M.body, 0, 0, 0)
    M.cam.x, M.cam.y, M.cam.z = p.x, y + 4, p.z + 7
end

function M.Position()
    local p = entity.get_position(M.body)
    return p.x, p.y, p.z
end

-- Úskok (v boji): krátký rychlý pohyb
function M.Dash(dx, dz)
    local l = sqrt(dx * dx + dz * dz)
    if l < 0.1 then return end
    dashX, dashZ, dashT = dx / l * 13, dz / l * 13, 0.2
end

local function angleLerp(a, b, t)
    local d = (b - a + 540) % 360 - 180
    return a + d * t
end

function M.Update(dt, respawnPoint)
    if not M.body then return end
    local c = M.cam
    -- směr podle kamery (yaw: 0 = kamera se dívá na +Z)
    local fx, fz = sin(rad(c.yaw)), cos(rad(c.yaw))
    local rx, rz = -fz, fx   -- vpravo = dopředu × nahoru
    local ix, iz = 0, 0
    if M.inputEnabled then
        if input.key("W") or input.key("Up") then iz = iz + 1 end
        if input.key("S") or input.key("Down") then iz = iz - 1 end
        if input.key("D") or input.key("Right") then ix = ix + 1 end
        if input.key("A") or input.key("Left") then ix = ix - 1 end
        if keys.Down("autorun") then autoRun = not autoRun end
    end
    if not M.inputEnabled or input.key("S") or input.pressed("W") then autoRun = false end
    if autoRun and iz == 0 then iz = 1 end
    local mx, mz = fx * iz + rx * ix, fz * iz + rz * ix
    local ml = sqrt(mx * mx + mz * mz)
    if ml > 1 then mx, mz, ml = mx / ml, mz / ml, 1 end
    local spd = (keys.Held("run") or autoRun) and M.runSpeed or M.walkSpeed
    -- plynulý rozjezd a zastavení
    local tx, tz = mx * spd * M.speedMul, mz * spd * M.speedMul
    local k = 1 - exp(-14 * dt)
    hvx, hvz = hvx + (tx - hvx) * k, hvz + (tz - hvz) * k
    local vx, vz = hvx, hvz
    if dashT > 0 then vx, vz, dashT = vx + dashX, vz + dashZ, dashT - dt end
    local jump = (M.inputEnabled and keys.Down("jump")) and 6.5 or 0
    local grounded = physics.move_character(M.body, vx, vz, jump)
    if ml > 0.01 then
        M.facing = angleLerp(M.facing, deg(math.atan(mx, mz)), 1 - exp(-12 * dt))
    end
    M.speed = sqrt(hvx * hvx + hvz * hvz)

    -- model následuje kapsli + procedurální chůze (pohupování a náklon; Gait.cs zjednodušeně)
    local px, py, pz = M.Position()
    M.walkPhase = (M.walkPhase or 0) + dt * M.speed * 1.9
    local bob = math.abs(sin(M.walkPhase)) * min(M.speed, 7) * 0.012
    local lean = min(M.speed, 7) * 1.1
    entity.set_position(M.view, px, py + bob, pz)
    entity.set_rotation(M.view, lean, M.facing, sin(M.walkPhase) * min(M.speed, 7) * 0.35)

    -- pád do moře: zpět na břeh
    if py < -3 then M.Respawn(respawnPoint or map.SpawnKalidra) end
end

-- Kamera: pravé tlačítko = otáčení, kolečko = vzdálenost, Q/E = otáčení klávesami
function M.UpdateCamera(dt, liveCombat)
    if not M.camera or not M.body then return end
    local c = M.cam
    if M.cameraInput then
        if input.key("Mouse2") then
            local dx, dy = input.mouse_delta()
            c.yaw = c.yaw - dx * 0.25
            c.pitch = max(5, min(70, c.pitch + dy * 0.2))
        end
        if not liveCombat and keys.Held("cam_left") then c.yaw = c.yaw + 90 * dt end
        if not liveCombat and keys.Held("cam_right") then c.yaw = c.yaw - 90 * dt end
        c.distance = max(2.5, min(22, c.distance - input.wheel() * 0.8))
    end
    local px, py, pz = M.Position()
    local tx, ty, tz = px, py + 1.3, pz
    -- kamera za hráčem: směr pohledu (sin yaw, cos yaw), náklon dolů pitch
    local cp, sp = cos(rad(c.pitch)), sin(rad(c.pitch))
    local fx, fy, fz = sin(rad(c.yaw)) * cp, -sp, cos(rad(c.yaw)) * cp
    local wx, wy, wz = tx - fx * c.distance, ty - fy * c.distance, tz - fz * c.distance
    -- nesmí pod terén
    local ground = map.HeightAt(wx, wz) + 0.6
    if wy < ground then wy = ground end
    local k = 1 - exp(-14 * dt)
    c.x, c.y, c.z = c.x + (wx - c.x) * k, c.y + (wy - c.y) * k, c.z + (wz - c.z) * k
    -- natočení kamery na hráče (kamera v enginu hledí po -Z)
    local dx, dy, dz = tx - c.x, ty - c.y, tz - c.z
    local yaw = deg(math.atan(-dx, -dz))
    local pitch = deg(math.atan(dy, sqrt(dx * dx + dz * dz)))
    entity.set_position(M.camera, c.x, c.y, c.z)
    entity.set_rotation(M.camera, pitch, yaw, 0)
end

return M

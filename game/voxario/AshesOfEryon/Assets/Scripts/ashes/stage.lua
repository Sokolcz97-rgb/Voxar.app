-- Scéna tvorby postavy (jako výběr postavy v MMO): hrdina na mramorovém podstavci uprostřed
-- řeckého chrámu, dva ohně v bronzových pánvích, zlatavé světlo podvečera. Postava se pomalu
-- otáčí a jde natáčet tažením myši. Staví se mimo svět (svět se zatím nenačetl).
local M = {}

local X, Y, Z = 0, 0, 0          -- střed podstavce
local parts, hero, heroKey = nil, nil, nil
local yaw, spin, dragX = 20, 0, nil
local pose = require("ashes.pose")
local showT, showAct = nil, nil   -- předvedení útoku / kouzla po změně povolání   -- 20° = tváří ke kameře, lehce z boku

local MARBLE = { 0.8, 0.74, 0.64 }
local MARBLE_DARK = { 0.55, 0.49, 0.42 }
local BRONZE = { 0.55, 0.36, 0.16 }

local function add(id) parts[#parts + 1] = id; return id end

local function build()
    parts = {}
    -- podlaha chrámu a třístupňový podstavec
    add(world.spawn("cube", X, Y - 0.25, Z - 2, { size = { 16, 0.5, 14 }, color = MARBLE_DARK }))
    for i, r in ipairs({ 2.6, 2.1, 1.6 }) do
        add(world.spawn("cylinder", X, Y + (i - 1) * 0.18 + 0.09, Z, { size = { r * 2, 0.18, r * 2 }, color = i == 3 and MARBLE or MARBLE_DARK }))
    end
    -- sloupy v půlkruhu za hrdinou (dórské: dřík, hlavice, patka)
    for k = 0, 6 do
        local a = math.rad(200 + k * 23.3)
        local cx, cz = X + math.sin(a) * 6.2, Z + math.cos(a) * 6.2 - 1
        add(world.spawn("cylinder", cx, Y + 0.15, cz, { size = { 1.25, 0.3, 1.25 }, color = MARBLE_DARK }))
        add(world.spawn("cylinder", cx, Y + 3.0, cz, { size = { 0.85, 5.4, 0.85 }, color = MARBLE }))
        add(world.spawn("cube", cx, Y + 5.85, cz, { size = { 1.3, 0.3, 1.3 }, color = MARBLE }))
    end
    -- architráv nad sloupy
    add(world.spawn("cube", X, Y + 6.25, Z - 6.6, { size = { 12.5, 0.5, 1.3 }, color = MARBLE }))
    add(world.spawn("cube", X - 5.6, Y + 6.25, Z - 3.6, { size = { 1.3, 0.5, 6.4 }, yaw = -22, color = MARBLE }))
    add(world.spawn("cube", X + 5.6, Y + 6.25, Z - 3.6, { size = { 1.3, 0.5, 6.4 }, yaw = 22, color = MARBLE }))
    -- rudý závěs a štít za hrdinou (řecký motiv bez fantasy)
    add(world.spawn("cube", X, Y + 3.4, Z - 6.9, { size = { 4.6, 5.2, 0.08 }, color = { 0.45, 0.07, 0.05 } }))
    add(world.spawn("cylinder", X, Y + 3.9, Z - 6.82, { size = { 1.7, 0.1, 1.7 }, rotation = { 90, 0, 0 }, color = BRONZE }))
    -- dvě bronzové ohňové pánve s plameny a světlem
    for _, sx in ipairs({ -2.2, 2.2 }) do
        add(world.spawn("cylinder", X + sx, Y + 0.55, Z + 0.9, { size = { 0.22, 1.1, 0.22 }, color = BRONZE }))
        add(world.spawn("cylinder", X + sx, Y + 1.15, Z + 0.9, { size = { 0.8, 0.22, 0.8 }, color = BRONZE }))
        add(world.spawn("sphere", X + sx, Y + 1.35, Z + 0.9, { size = { 0.3, 0.38, 0.3 }, color = { 1, 0.55, 0.15 }, emissive = { 3, 1.2, 0.25 } }))
        add(world.spawn("light", X + sx, Y + 1.8, Z + 0.9, { light = { color = { 1, 0.58, 0.25 }, intensity = 30, range = 9, flicker = true } }))
    end
    -- měkké přední světlo na postavu (jako ve výběru postavy MMO)
    add(world.spawn("light", X + 1.2, Y + 2.6, Z + 3.2, { light = { color = { 1, 0.86, 0.7 }, intensity = 6, range = 8 } }))
end

local function modelPath(cls, gender)
    cls = (cls == "lucistnik" or cls == "vestec") and cls or "hoplit"
    return "Models/heroes/" .. cls .. "_" .. (gender == "f" and "f" or "m") .. ".glb"
end

function M.Active() return parts ~= nil end

-- Zobrazí (nebo aktualizuje) scénu s postavou zvoleného povolání a pohlaví
function M.Show(cls, gender)
    if not parts then
        build()
        _G.world.environment({ real_time = false, time_of_day = 18.4 })   -- zlatavý podvečer
    end
    local key = modelPath(cls, gender)
    if key ~= heroKey then
        if hero then entity.destroy(hero) end
        hero = world.spawn(key, X, Y + 0.54, Z, { fit = (gender == "f") and 1.62 or 1.72, yaw = yaw, name = "Hrdina" })
        heroKey = key
        spin = 1.0   -- krátká otočka při změně
        if entity.set_gait then entity.set_gait(hero, 0, 0, pose.GaitOptions(key)) end   -- dýchání, rozhlížení
        showT, showAct = game.time() + 0.7, (cls == "vestec") and "cast" or "attack"
    end
end

-- Každý snímek: kamera na postavu, otáčení (myší nebo pomalu samo)
function M.Update(dt, mouseX, mouseDown, overUi)
    if not parts then return end
    if mouseDown and not overUi then
        if dragX then yaw = yaw - (mouseX - dragX) * 0.4 end
        dragX = mouseX
    else
        dragX = nil
        yaw = yaw + dt * (6 + 220 * spin)
    end
    spin = math.max(0, spin - dt * 1.6)
    if hero then
        entity.set_rotation(hero, 0, yaw, 0)
        if showT and entity.set_action then
            local t = (game.time() - showT) / 0.9
            if t >= 1 then entity.set_action(hero, nil, 0); showT = nil
            elseif t >= 0 then entity.set_action(hero, showAct, t) end
        end
    end
    local cam = entity.find("Camera")
    if cam then
        entity.set_position(cam, X, Y + 1.75, Z + 5.8)
        entity.set_rotation(cam, -6, 0, 0)
    end
end

function M.Hide()
    if not parts then return end
    for _, id in ipairs(parts) do entity.destroy(id) end
    if hero then entity.destroy(hero) end
    parts, hero, heroKey = nil, nil, nil
    _G.world.environment({ real_time = true })
end

return M

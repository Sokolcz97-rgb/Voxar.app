-- Bojové pózy postav (CharacterView.cs): výpad, zásah, pád a vstávání.
-- Hrdinové z Models/heroes_rig mají kostru (tools/rig_heroes.py) – chůze, běh, útok, blok, kouzlo,
-- zásah, radost a pád jsou kosterní animace enginu (anim.*); modely bez kostry (zvířata) se
-- hýbou procedurálně (entity.set_gait / set_action) a celé tělo se posune a nakloní.
local M = {}

-- má entita kosterní animace? (model se načítá asynchronně – dokud není, platí procedurální pohyb)
local animated = {}
function M.Animated(id)
    if not id or not anim then return false end
    local a = animated[id]
    if a ~= nil then return a end
    local list = anim.list(id)
    if type(list) == "table" and #list > 0 then
        local ok = false
        for _, n in ipairs(list) do if tostring(n):lower():find("idle") then ok = true end end
        animated[id] = ok
        return ok
    end
    return false
end

function M.New() return { lunge = -1, flinch = -1, fallT = -1, fallen = false } end
function M.Lunge(p) p.lunge = 0 end
function M.Flinch(p) p.flinch = 0 end
function M.Fall(p) p.fallT, p.fallen = 0, true end
function M.Stand(p) p.fallT, p.fallen = -1, false end

-- Procedurální akce rukou a trupu v enginu (entity.set_action): útok/kouzlo při výpadu, zásah při
-- ucuknutí, blok při držení štítu. Starší engine set_action nemá – pak se jen posouvá celé tělo.
local locomotion = {}   -- přehrávaný klip pohybu (Idle / Walk / Run / Death) podle entity
function M.Forget(id) animated[id], locomotion[id] = nil, nil end   -- entita zanikla (id se může znovu použít)
local function applyAnimated(p, id)
    -- akce jako vrstva přes horní polovinu těla (nohy dál jdou / stojí), radost a pád přes celé tělo
    local act
    if p.lunge >= 0 then act = p.cast and "Cast" or "Attack"
    elseif p.flinch >= 0 then act = "Hit"
    elseif p.block then act = "Block"
    elseif p.cheerT and game.time() - p.cheerT < 1.4 then act = "Cheer" end
    if p.cheerT and game.time() - p.cheerT >= 1.4 then p.cheerT = nil end
    if act ~= p.animAct then
        if act == "Block" then anim.layer(id, "Block", "Spine", 0.12, true)
        elseif act == "Cheer" then anim.layer(id, "Cheer", "Hips", 0.1, false)
        elseif act then anim.layer(id, act, "Spine", 0.08, false)
        elseif p.animAct == "Block" then anim.stop_layer(id, 0.15) end
        p.animAct = act
    end
    if p.fallen ~= p.animFallen then
        if p.fallen then anim.play(id, "Death", 0.15, false, true); locomotion[id] = "Death"
        else anim.play(id, "Idle", 0.3); locomotion[id] = "Idle" end
        p.animFallen = p.fallen
    end
end

local function applyAction(p, id)
    if id and M.Animated(id) then return applyAnimated(p, id) end
    if not id or not entity.set_action then return end
    if p.lunge >= 0 then entity.set_action(id, p.cast and "cast" or "attack", math.min(0.999, p.lunge / 0.5))
    elseif p.flinch >= 0 then entity.set_action(id, "hit", math.min(0.999, p.flinch / 0.32))
    elseif p.block then entity.set_action(id, "block", 0.5)
    elseif p.cheerT then
        local t = (game.time() - p.cheerT) / 1.6
        if t < 1 then entity.set_action(id, "cheer", t) else p.cheerT = nil; entity.set_action(id, nil, 0) end
    elseif p.acting then entity.set_action(id, nil, 0) end
    p.acting = p.lunge >= 0 or p.flinch >= 0 or p.block or p.cheerT ~= nil
end
function M.Cheer(p) p.cheerT = game.time() end

-- Posune pózu o dt; vrací posun dopředu (m), výšku, přidaný náklon (°) a náklon pádu (nebo nil).
-- id = entita modelu (pro animace rukou a trupu)
function M.Step(p, dt, id)
    local fwd, dy, pitch, fall = 0, 0, 0, nil
    if p.lunge >= 0 then
        p.lunge = p.lunge + dt
        local l = math.sin(math.min(1, p.lunge / 0.42) * math.pi)
        fwd, pitch = fwd + l * 0.55, pitch + l * 9   -- trup se do úderu natáčí v enginu, celé tělo méně
        if p.lunge > 0.5 then p.lunge = -1 end
    end
    if p.flinch >= 0 then
        p.flinch = p.flinch + dt
        local l = math.sin(math.min(1, p.flinch / 0.32) * math.pi)
        fwd, pitch = fwd - l * 0.12, pitch - l * 10
        if p.flinch > 0.32 then p.flinch = -1 end
    end
    applyAction(p, id)
    if p.fallen then
        p.fallT = math.min(1, p.fallT + dt / 0.8)
        local e = 1 - (1 - p.fallT) ^ 3
        fall, dy = -83 * e, 0.05 * e
    end
    -- s kostrou se ohýbá trup a padá klip Death – celé tělo se jen lehce posune
    if id and M.Animated(id) then return fwd * 0.6, 0, pitch * 0.25, nil end
    return fwd, dy, pitch, fall
end

-- Procedurální chůze (LegRig.cs) – kroky počítá vertex shader enginu (entity.set_gait).
-- Ruka s předmětem (štít, luk, hůl) se nekývá: model je z jednoho kusu a předmět by se zkroutil.
function M.GaitOptions(model)
    local key = tostring(model or ""):match("([^/]+)$") or ""
    local arms = "both"
    local weapon = "right"
    if key:find("^hoplit_m") then arms = "none"        -- štít + kopí
    elseif key:find("^lucistnik") then arms, weapon = "right", "left"  -- luk v levé
    elseif key:find("^vestec") then arms = "left" end  -- hůl v pravé
    return { legs = 0.3, arms = arms, weapon = weapon }
end
M.QuadOptions = { legs = 0.45, quad = true, arms = "none" }

-- phase = fáze kroku (rad), speed = rychlost (m/s); walk = rychlost chůze modelu (plný krok)
-- Model s kostrou: klip Idle / Walk / Run podle rychlosti (rychlost přehrávání podle kroku).
function M.Gait(id, phase, speed, opts, walk)
    speed = speed or 0
    if M.Animated(id) then
        if locomotion[id] == "Death" then return end   -- leží, dokud nevstane
        local clip, rate = "Idle", 1
        if speed > 4.6 then clip, rate = "Run", math.min(1.6, speed / 7.0)
        elseif speed > 0.35 then clip, rate = "Walk", math.max(0.5, math.min(1.5, speed / (walk or 4.2) * 1.6)) end
        if locomotion[id] ~= clip then anim.play(id, clip, 0.2); locomotion[id] = clip end
        anim.speed(id, rate)
        return
    end
    entity.set_gait(id, phase, math.min(1.2, speed / (walk or 4.2)), opts)
end

-- stojící postava (NPC, boss, hrdina při tvorbě): kosterní Idle, jinak procedurální dýchání
function M.Idle(id, model)
    if anim then anim.play(id, "Idle", 0.2) end
    if entity.set_gait then entity.set_gait(id, 0, 0, M.GaitOptions(model)) end
end

return M

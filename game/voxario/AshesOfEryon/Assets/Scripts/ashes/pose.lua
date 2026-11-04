-- Bojové pózy postav (CharacterView.cs): výpad, zásah, pád a vstávání. Modely nemají kostru,
-- takže se celé tělo posune a nakloní.
local M = {}

function M.New() return { lunge = -1, flinch = -1, fallT = -1, fallen = false } end
function M.Lunge(p) p.lunge = 0 end
function M.Flinch(p) p.flinch = 0 end
function M.Fall(p) p.fallT, p.fallen = 0, true end
function M.Stand(p) p.fallT, p.fallen = -1, false end

-- Procedurální akce rukou a trupu v enginu (entity.set_action): útok/kouzlo při výpadu, zásah při
-- ucuknutí, blok při držení štítu. Starší engine set_action nemá – pak se jen posouvá celé tělo.
local function applyAction(p, id)
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
function M.Gait(id, phase, speed, opts, walk)
    entity.set_gait(id, phase, math.min(1.2, (speed or 0) / (walk or 4.2)), opts)
end

return M

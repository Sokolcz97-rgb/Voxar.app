-- Bojové pózy postav (CharacterView.cs): výpad, zásah, pád a vstávání. Modely nemají kostru,
-- takže se celé tělo posune a nakloní.
local M = {}

function M.New() return { lunge = -1, flinch = -1, fallT = -1, fallen = false } end
function M.Lunge(p) p.lunge = 0 end
function M.Flinch(p) p.flinch = 0 end
function M.Fall(p) p.fallT, p.fallen = 0, true end
function M.Stand(p) p.fallT, p.fallen = -1, false end

-- Posune pózu o dt; vrací posun dopředu (m), výšku, přidaný náklon (°) a náklon pádu (nebo nil)
function M.Step(p, dt)
    local fwd, dy, pitch, fall = 0, 0, 0, nil
    if p.lunge >= 0 then
        p.lunge = p.lunge + dt
        local l = math.sin(math.min(1, p.lunge / 0.42) * math.pi)
        fwd, pitch = fwd + l * 0.55, pitch + l * 14
        if p.lunge > 0.42 then p.lunge = -1 end
    end
    if p.flinch >= 0 then
        p.flinch = p.flinch + dt
        local l = math.sin(math.min(1, p.flinch / 0.32) * math.pi)
        fwd, pitch = fwd - l * 0.12, pitch - l * 10
        if p.flinch > 0.32 then p.flinch = -1 end
    end
    if p.fallen then
        p.fallT = math.min(1, p.fallT + dt / 0.8)
        local e = 1 - (1 - p.fallT) ^ 3
        fall, dy = -83 * e, 0.05 * e
    end
    return fwd, dy, pitch, fall
end

return M

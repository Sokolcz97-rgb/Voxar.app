-- Úvodní výprava „Ozvěna“ (lore: Archivářka Lyrise, Zkažení, Kultisté Prázdnoty, Drtič popela, Stínová trhlina)
local map = require("eryndor.map")
local player = require("eryndor.player")
local combat = require("eryndor.combat")
local humans = require("eryndor.humans")
local M = { step = 0, dialog = nil }

local STEPS = {
    { title = "Ozvěna", goal = "Promluv s Archivářkou Lyrise (F)" },
    { title = "Zkažená fauna", goal = "Zab Zkažené vlky", kind = "wolf", need = 4 },
    { title = "Kultisté Prázdnoty", goal = "Zab Kultisty u Stínové trhliny", kind = "cultist", need = 3 },
    { title = "Drtič popela", goal = "Poraz Drtiče popela u trhliny", kind = "crusher", need = 1 },
    { title = "Ozvěna", goal = "Vrať se k Lyrise (F)" },
}

function M.Spawn()
    local l = map.Lyrise
    M.npc = humans.Spawn("lyrise", l.x, map.HeightAt(l.x, l.z) + 0.25, l.z, { yaw = 160, name = "Archivářka Lyrise", left = "book" })
    anim.play(M.npc, "Spellcasting", 0.2, true)
    anim.speed(M.npc, 0.45)
    M.light = _G.world.spawn("light", l.x, map.HeightAt(l.x, l.z) + 2.4, l.z, { light = { color = { 0.4, 0.55, 1.0 }, intensity = 25, range = 10 } })
    M.step, M.count = 1, 0
    combat.onKill = function(m)
        local st = STEPS[M.step]
        if st and st.kind == m.kind then
            M.count = M.count + 1
            if M.count >= st.need then M.Advance() end
        end
    end
end

function M.Advance()
    M.step, M.count = M.step + 1, 0
    local st = STEPS[M.step]
    if st then combat.Log("Nový úkol: " .. st.goal, { 1.0, 0.85, 0.4 }) end
end

function M.Tracker()
    local st = STEPS[M.step]
    if not st then return { title = "Ozvěna", lines = { { text = "Hraniční údolí je zatím v bezpečí.", done = true } } } end
    local text = st.goal
    if st.need then text = string.format("%s: %d / %d", st.goal, M.count, st.need) end
    return { title = st.title, lines = { { text = text } } }
end

function M.NearNpc()
    local px, _, pz = player.Pos()
    local l = map.Lyrise
    return (px - l.x) ^ 2 + (pz - l.z) ^ 2 < 4.5 * 4.5
end

function M.Talk()
    if not M.NearNpc() then return end
    local close = function() M.dialog = nil end
    if M.step == 1 then
        M.dialog = { who = "Archivářka Lyrise", text =
            "Probudil ses, Ozvěno. Před pěti sty lety se Zřídlo roztrhlo ve Velkém Rozkolu a jeho střepy – Aetherium – leží " ..
            "rozeseté po celém Eryndoru. Ty jediný je dokážeš vstřebat, aniž bys zešílel. Sylvaria i Aethelgard tě budou chtít " ..
            "jako zbraň… ale z trhliny na severu už prosakuje Umbra. Zvířata v údolí se mění. Zastav je.",
            options = { { label = "Přijímám", fn = function() M.Advance(); close() end }, { label = "Později", fn = close } } }
    elseif M.step == #STEPS then
        M.dialog = { who = "Archivářka Lyrise", text =
            "Drtič popela padl a trhlina na chvíli utichla. Ale Vakarion, Pán Rozkolu, se probouzí – cítím, jak se čas láme. " ..
            "Až budeš připraven, pošlu tě do Časového zlomu. Tam uvidíš, co se doopravdy stalo před pěti sty lety.",
            options = { { label = "Rozumím", fn = function() M.Advance(); close() end } } }
    else
        local st = STEPS[M.step]
        M.dialog = { who = "Archivářka Lyrise", text = "Hvězdy šeptají: " .. (st and st.goal or "") .. ". Vrať se, až bude hotovo.",
            options = { { label = "Jdu na to", fn = close } } }
    end
end

return M

-- HUD Eryndoru: rámeček hráče a cíle, lišta dovedností s cooldowny, ukazatel sesílání, čísla
-- poškození, záznam boje, sledování výpravy, výběr povolání a rozhovor s Lyrise.
local combat = require("eryndor.combat")
local player = require("eryndor.player")
local map = require("eryndor.map")
local M = {}

local floor, max, min = math.floor, math.max, math.min
local GOLD, DARK, TEXT, DIM = "#d8b25a", "#0d0f16e0", "#efe6d2", "#a8a090"

function M.Init()
    ui.load_font("title", "UI/Cinzel-SemiBold.ttf", 46, 56)
    ui.load_font("h1", "UI/Cinzel-SemiBold.ttf", 26, 32)
    ui.load_font("h2", "UI/Cinzel-SemiBold.ttf", 19, 24)
    ui.load_font("body", "UI/Cormorant-SemiBold.ttf", 21, 26)
    ui.load_font("small", "UI/Cormorant-Medium.ttf", 17, 20)
    ui.style({ window_bg = "#0d0f16e8", text = TEXT, button = "#2a2418", button_hover = "#4a3c22", button_active = "#6a5428",
               border = "#d8b25a80", rounding = 4, border_size = 1, padding = 10, font_size = 20 })
end

local function frame(x, y, w, h)
    ui.rect(x, y, w, h, DARK, 6)
    ui.rect(x, y, w, 2, GOLD, 0)
    ui.rect(x, y + h - 2, w, 2, "#d8b25a60", 0)
end

local function unitFrame(x, y, name, level, hp, maxhp, mp, maxmp, hostile, elite)
    frame(x, y, 330, mp and 92 or 74)
    -- kolečko úrovně
    ui.rect(x + 10, y + 12, 50, 50, hostile and "#5a1a1a" or "#1a3a4a", 25)
    ui.font("h2")
    ui.text(x + 35, y + 22, tostring(level), { align = "center", color = elite and "#ffd060" or TEXT })
    ui.pop_font()
    ui.font("body")
    ui.text(x + 72, y + 8, name .. (elite and "  · Elita" or ""), { color = hostile and "#ff9a80" or "#d8f0ff", shadow = true })
    ui.pop_font()
    ui.bar(x + 72, y + 36, 246, 18, min(1, hp / max(1, maxhp)), hostile and "#a02a1c" or "#3a9a3a",
        string.format("%d / %d", floor(hp), maxhp))
    if mp then ui.bar(x + 72, y + 58, 246, 14, min(1, mp / max(1, maxmp)), "#2a5ab8", string.format("%d / %d", floor(mp), maxmp)) end
end

-- ------------------------------------------------------------------ boj
function M.DrawGame()
    local s = combat.me
    if not s then return end
    local sw, sh = ui.screen()
    unitFrame(20, 20, s.class.name, s.level, s.hp, s.maxhp, s.mp, s.maxmp, false)
    -- zkušenosti pod rámečkem
    ui.bar(20, 116, 330, 8, s.xp / combat.XpNeed(s.level), "#8a5ad8")
    -- buffy
    local bx = 20
    for _, b in pairs(s.buffs) do
        local left = b.until_t - game.time()
        ui.rect(bx, 130, 34, 34, "#0d0f16d0", 4)
        ui.rect(bx + 3, 133, 28, 28, b.color or "#888", 3)
        ui.font("small"); ui.text(bx + 17, 166, tostring(floor(left)), { align = "center", color = TEXT }); ui.pop_font()
        bx = bx + 40
    end
    -- cíl
    local t = combat.target
    if t and t.state ~= "dead" then
        unitFrame(370, 20, t.t.name, t.level, t.hp, t.maxhp, nil, nil, true, t.t.elite)
        if t.stunT and game.time() < t.stunT then
            ui.font("small"); ui.text(450, 98, "Omráčen", { color = "#ffe080" }); ui.pop_font()
        end
        -- značka nad cílem
        local p = entity.get_position(t.id)
        local x, y, vis = ui.world_to_screen(t.x, map.HeightAt(t.x, t.z) + (t.t.labelY and t.t.labelY + 0.4 or (t.t.elite and 3.4 or 2.4)), t.z)
        if vis then
            ui.rect(x - 7, y - 7, 14, 14, combat.auto and "#ff5030" or "#ffd060", 7)
        end
    end
    -- jmenovky a životy nepřátel poblíž
    local px, _, pz = player.Pos()
    for _, m in ipairs(combat.mobs) do
        if m.state ~= "dead" and (m.x - px) ^ 2 + (m.z - pz) ^ 2 < 30 * 30 then
            local x, y, vis = ui.world_to_screen(m.x, map.HeightAt(m.x, m.z) + (m.t.labelY or (m.t.elite and 3.0 or 2.0)), m.z)
            if vis then
                ui.font("small")
                ui.text(x, y - 26, m.t.name .. "  " .. m.level, { align = "center", color = m == t and "#ffe0a0" or "#ff9a80", shadow = true })
                ui.pop_font()
                ui.bar(x - 40, y - 6, 80, 6, m.hp / m.maxhp, "#c03020")
            end
        end
    end
    -- čísla poškození (stoupají a mizí)
    local now = game.time()
    for _, f in ipairs(combat.floats) do
        local age = now - f.t
        local x, y, vis = ui.world_to_screen(f.x + f.dx * age, f.y + age * 1.1, f.z)
        if vis then
            local a = max(0, 1 - age / 1.3)
            local c = f.color
            ui.font("h1", f.size)
            ui.text(x, y, f.text, { align = "center", color = { c[1], c[2], c[3], a }, shadow = true })
            ui.pop_font()
        end
    end
    -- lišta dovedností
    local n = #s.class.skills
    local size, gap = 64, 8
    local w = n * size + (n - 1) * gap + 2 * size + gap * 2
    local x0, y0 = sw / 2 - w / 2, sh - 104
    frame(x0 - 12, y0 - 12, w + 24, size + 24)
    -- automatický útok (R) a Tab
    local slots = { { key = "R", name = "Útok", color = { 0.9, 0.3, 0.2 }, active = combat.auto } }
    for i, sk in ipairs(s.class.skills) do slots[#slots + 1] = { key = sk.key, name = sk.name, color = sk.color, skill = sk, i = i } end
    slots[#slots + 1] = { key = "Tab", name = "Cíl", color = { 0.8, 0.75, 0.5 } }
    for k, sl in ipairs(slots) do
        local x = x0 + (k - 1) * (size + gap)
        local c = sl.color
        ui.rect(x, y0, size, size, "#1a1812", 6)
        ui.rect(x + 3, y0 + 3, size - 6, size - 6, { c[1] * 0.55, c[2] * 0.55, c[3] * 0.55, 1 }, 5)
        ui.rect(x + 8, y0 + 8, size - 16, size - 16, { c[1], c[2], c[3], 0.85 }, 12)
        if sl.active then ui.rect(x, y0, size, 3, "#ff6040", 0) end
        if sl.skill then
            local sk = sl.skill
            local left = (s.cd[sl.i] or 0) - now
            local g = s.gcd - now
            local frac = 0
            if left > 0 and sk.cd > 0 then frac = left / sk.cd end
            if g > 0 then frac = max(frac, g / 1.0) end
            if frac > 0 then ui.rect(x, y0 + size * (1 - frac), size, size * frac, "#000000b0", 0) end
            if s.mp < sk.mp then ui.rect(x, y0, size, size, "#1830a070", 6) end
            if left > 0.05 then
                ui.font("h2"); ui.text(x + size / 2, y0 + 20, (left > 9.5 and tostring(floor(left)) or string.format("%.1f", left)), { align = "center", color = "#ffffff", shadow = true }); ui.pop_font()
            end
        end
        ui.font("small")
        ui.text(x + 6, y0 + 2, sl.key, { color = "#ffe8b0", shadow = true })
        ui.text(x + size / 2, y0 + size + 2, sl.name, { align = "center", color = DIM, size = 14 })
        ui.pop_font()
    end
    -- ukazatel sesílání
    if s.casting then
        local c = s.casting
        local f = min(1, (now - c.start) / (c.dur + (c.pushback or 0)))
        local sk = s.class.skills[c.i]
        ui.bar(sw / 2 - 160, y0 - 54, 320, 20, f, "#d8b25a", sk.name)
    end
    -- záznam boje
    frame(20, sh - 230, 420, 190)
    ui.font("small")
    for i, l in ipairs(combat.log) do
        local a = max(0.35, 1 - (now - l.t) / 25)
        ui.text(32, sh - 222 + (i - 1) * 22, l.text, { color = { l.color[1], l.color[2], l.color[3], a } })
    end
    ui.pop_font()
    -- smrt
    if player.dead then
        ui.fade(0.45, "#000000")
        ui.font("title"); ui.text(sw / 2, sh / 2 - 60, "Padl jsi", { align = "center", color = "#e05040", shadow = true }); ui.pop_font()
        ui.font("body"); ui.text(sw / 2, sh / 2, "Ozvěna se za chvíli vrátí ke Zřídlu…", { align = "center", color = TEXT }); ui.pop_font()
    end
end

-- ------------------------------------------------------------------ výprava (sledování vpravo)
function M.DrawQuest(q)
    if not q then return end
    local sw = ui.screen()
    frame(sw - 400, 200, 380, 40 + #q.lines * 26)
    ui.font("h2"); ui.text(sw - 386, 208, q.title, { color = GOLD }); ui.pop_font()
    ui.font("small")
    for i, l in ipairs(q.lines) do ui.text(sw - 386, 236 + (i - 1) * 26, l.text, { color = l.done and "#80d080" or TEXT }) end
    ui.pop_font()
end

-- ------------------------------------------------------------------ výběr povolání
function M.DrawSelect(state)
    local sw, sh = ui.screen()
    ui.vignette(0.6)
    ui.font("title"); ui.text(sw / 2, 46, "ERYNDOR", { align = "center", color = GOLD, shadow = true }); ui.pop_font()
    ui.font("body"); ui.text(sw / 2, 108, "Velký Rozkol – testovací kanál", { align = "center", color = DIM }); ui.pop_font()
    local classes = combat.Classes
    local x = sw / 2 - (#classes * 300 + (#classes - 1) * 20) / 2
    for i, c in ipairs(classes) do
        local cx = x + (i - 1) * 320
        local sel = state.index == i
        ui.rect(cx, sh - 330, 300, 230, sel and "#2a2418f0" or "#0d0f16e0", 6)
        ui.rect(cx, sh - 330, 300, 3, c.faction == "Sylvaria" and "#3fc8c0" or "#c04030", 0)
        ui.font("small"); ui.text(cx + 150, sh - 318, c.faction == "Sylvaria" and "SYLVARIA · Společenství Půlměsíce" or "AETHELGARD · Řád Ocelového slunce",
            { align = "center", color = c.faction == "Sylvaria" and "#7fe0d8" or "#ff9a80" }); ui.pop_font()
        ui.font("h1"); ui.text(cx + 150, sh - 292, c.name, { align = "center", color = sel and GOLD or TEXT }); ui.pop_font()
        ui.font("small"); ui.text(cx + 16, sh - 250, c.desc, { wrap = 268, color = DIM }); ui.pop_font()
        if ui.button_at(cx + 60, sh - 150, 180, 38, sel and "Vybráno" or "Vybrat") then state.index = i; state.changed = true end
    end
    if ui.button_at(sw / 2 - 130, sh - 84, 260, 50, "Vstoupit do Eryndoru") then state.enter = true end
end

-- ------------------------------------------------------------------ rozhovor
function M.DrawDialog(d)
    if not d then return end
    local sw, sh = ui.screen()
    frame(sw / 2 - 380, sh - 420, 760, 250)
    ui.font("h1"); ui.text(sw / 2 - 360, sh - 408, d.who, { color = "#9fc8ff" }); ui.pop_font()
    ui.font("body"); ui.text(sw / 2 - 360, sh - 368, d.text, { wrap = 720, color = TEXT }); ui.pop_font()
    for i, o in ipairs(d.options) do
        if ui.button_at(sw / 2 - 360 + (i - 1) * 250, sh - 222, 240, 40, o.label) then o.fn() end
    end
end

return M

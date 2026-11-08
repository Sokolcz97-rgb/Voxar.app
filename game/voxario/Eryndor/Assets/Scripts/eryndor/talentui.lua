-- Okno stromu talentů (klávesa N): tři větve povolání, pasivní talenty = čtverce, aktivní kouzla = kruhy,
-- spojnice se po investování bodů rozsvítí; levé tlačítko = přidat bod, pravé = odebrat. Uzly vyšších úrovní
-- jsou zamčené, dokud ve větvi nejsou body (úroveň - 1) * 3 a předchozí talent.
local combat = require("eryndor.combat")
local talents = require("eryndor.talents")
local M = { open = false }

local GOLD, TEXT, DIM = "#d8b25a", "#efe6d2", "#a8a090"

local function layout(sw, sh)
    local w, h = 1040, 660
    local x, y = sw / 2 - w / 2, sh / 2 - h / 2 - 20
    return x, y, w, h
end

local function nodePos(x, y, w, node)
    local colW = (w - 80) / 3
    local cx = x + 40 + colW * (node.branch - 0.5)
    local cy = y + 150 + (node.tier - 1) * 118
    return cx, cy
end

function M.Toggle() M.open = not M.open end

function M.Draw()
    if not M.open then return end
    local s = combat.me
    if not s then return end
    local tree = talents.Tree(s.class.id)
    if not tree then return end
    local sw, sh = ui.screen()
    local x, y, w, h = layout(sw, sh)
    ui.fade(0.35, "#000000")
    ui.panel("UI/hud/frame.png", x, y, w, h, 18, 22)
    ui.font("h1"); ui.text(x + w / 2, y + 22, "Talenty – " .. s.class.name, { align = "center", color = GOLD, shadow = true }); ui.pop_font()
    local free = talents.Points(s) - talents.Spent(s)
    ui.font("body")
    ui.text(x + w / 2, y + 62, string.format("Volné body: %d   ·   utraceno %d / %d", free, talents.Spent(s), talents.Points(s)),
        { align = "center", color = free > 0 and "#9fe0a0" or DIM })
    ui.pop_font()
    local colW = (w - 80) / 3
    for b, bname in ipairs(tree.branches) do
        local cx = x + 40 + colW * (b - 0.5)
        ui.rect(cx - colW / 2 + 10, y + 96, colW - 20, h - 150, "#00000040", 8)
        ui.font("h2")
        ui.text(cx, y + 102, bname .. "  (" .. talents.SpentIn(s, tree, b) .. ")", { align = "center", color = TEXT })
        ui.pop_font()
    end
    -- spojnice (předpoklady): rozsvícená, když je předpoklad i uzel aktivní
    for _, node in ipairs(tree.nodes) do
        local nx, ny = nodePos(x, y, w, node)
        for _, rid in ipairs(node.requires) do
            local r = talents.Find(tree, rid)
            if r then
                local rx, ry = nodePos(x, y, w, r)
                local lit = (s.talents[rid] or 0) > 0
                local full = lit and (s.talents[node.id] or 0) > 0
                ui.line(rx, ry + 30, nx, ny - 30, full and "#ffd060" or (lit and "#b08a40" or "#3a3630"), full and 5 or 3)
            end
        end
    end
    local mx, my = ui.mouse()
    local hover
    for _, node in ipairs(tree.nodes) do
        local nx, ny = nodePos(x, y, w, node)
        local rank = s.talents[node.id] or 0
        local can = talents.CanLearn(s, node)
        local active = node.kind == "active"
        local r = 30
        local border = rank > 0 and "#ffd060" or (can and "#b0a070" or "#4a4640")
        if active then
            ui.circle(nx, ny, r + 4, "#0a0806", true)
            ui.draw_image("UI/icons/" .. node.icon .. ".png", nx - r + 4, ny - r + 4, 2 * r - 8, 2 * r - 8,
                rank > 0 and { 1, 1, 1, 1 } or (can and { 0.75, 0.75, 0.75, 1 } or { 0.3, 0.3, 0.3, 1 }))
            ui.circle(nx, ny, r + 2, border, false, rank > 0 and 4 or 2.5)
        else
            ui.rect(nx - r - 3, ny - r - 3, 2 * r + 6, 2 * r + 6, "#0a0806", 4)
            ui.draw_image("UI/icons/" .. node.icon .. ".png", nx - r, ny - r, 2 * r, 2 * r,
                rank > 0 and { 1, 1, 1, 1 } or (can and { 0.75, 0.75, 0.75, 1 } or { 0.3, 0.3, 0.3, 1 }))
            ui.rect(nx - r - 3, ny - r - 3, 2 * r + 6, 2 * r + 6, border, 4, false, rank > 0 and 3.5 or 2)
        end
        ui.rect(nx + r - 14, ny + r - 8, 34, 20, "#0a0806e0", 4)
        ui.font("small")
        ui.text(nx + r + 3, ny + r - 9, rank .. "/" .. node.max, { align = "center", color = rank >= node.max and GOLD or TEXT })
        ui.text(nx, ny + r + 12, node.name, { align = "center", color = rank > 0 and "#ffe8b0" or DIM, shadow = true })
        ui.pop_font()
        if (mx - nx) ^ 2 + (my - ny) ^ 2 < (r + 6) ^ 2 then
            hover = { node = node, x = nx, y = ny }
            if input.pressed("Mouse1") then talents.Learn(s, node) end
            if input.pressed("Mouse2") then talents.Unlearn(s, node) end
        end
    end
    if hover then
        local node = hover.node
        local ok, why = talents.CanLearn(s, node)
        local lines = { { node.name, GOLD }, { node.kind == "active" and "Aktivní kouzlo (akční lišta 6–8)" or "Pasivní talent", DIM },
                        { node.desc, TEXT } }
        if not ok and why and (s.talents[node.id] or 0) < node.max then lines[#lines + 1] = { why, "#ff9a80" } end
        lines[#lines + 1] = { "Levé tlačítko: přidat bod · pravé: odebrat", DIM }
        local tw, th = 330, 20 + #lines * 24
        local tx = math.min(hover.x + 44, x + w - tw - 10)
        ui.panel("UI/hud/frame_thin.png", tx, hover.y - th / 2, tw, th, 10, 14)
        ui.font("small")
        for i, l in ipairs(lines) do ui.text(tx + 14, hover.y - th / 2 + 10 + (i - 1) * 24, l[1], { color = l[2], wrap = tw - 28 }) end
        ui.pop_font()
    end
    if ui.button_at(x + w - 200, y + h - 52, 170, 36, "Obnovit body") then talents.Reset(s) end
    if ui.button_at(x + 30, y + h - 52, 140, 36, "Zavřít (N)") then M.open = false end
end

return M

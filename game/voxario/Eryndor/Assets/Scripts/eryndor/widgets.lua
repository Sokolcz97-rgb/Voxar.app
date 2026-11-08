-- Klikatelné prvky HUD Eryndoru (kované tlačítko s ikonou, nápověda). M.hot = myš je nad prvkem UI v tomto
-- snímku – hra pak kliknutí nepoužije pro výběr cíle ve světě. M.BeginFrame() volá on_gui na začátku.
local M = { hot = false, hotPrev = false }

local GOLD, TEXT, DIM = "#d8b25a", "#efe6d2", "#a8a090"
M.GOLD, M.TEXT, M.DIM = GOLD, TEXT, DIM

function M.BeginFrame()
    M.hotPrev = M.hot
    M.hot = false
end

-- myš nad UI (tento nebo minulý snímek – kliknutí se zpracuje dřív, než se prvek vykreslí)
function M.MouseOverUI() return M.hot or M.hotPrev end

function M.Inside(x, y, w, h)
    local mx, my = ui.mouse()
    return mx >= x and mx < x + w and my >= y and my < y + h
end

-- oblast, nad kterou myš nepatří světu (okna, panely)
function M.Block(x, y, w, h)
    if M.Inside(x, y, w, h) then M.hot = true end
end

-- velké tlačítko menu: rám, ikona vlevo, text; → kliknuto
function M.Button(x, y, w, h, label, icon, opts)
    opts = opts or {}
    local over = M.Inside(x, y, w, h)
    if over then M.hot = true end
    local down = over and input.key("Mouse1")
    ui.panel("UI/hud/frame_thin.png", x, y, w, h, 10, 14, over and { 1.25, 1.15, 0.95, 1 } or nil)
    ui.rect(x + 6, y + 6, w - 12, h - 12, down and "#00000080" or (over and "#3a2a1240" or "#00000030"), 4)
    local tx = x + 18
    if icon then
        local s = h - 18
        ui.draw_image("UI/icons/" .. icon .. ".png", x + 10, y + 9 + (down and 1 or 0), s, s)
        tx = x + 20 + s
    end
    ui.font(opts.font or "body")
    ui.text(opts.center and (x + w / 2) or tx, y + h / 2 - 13 + (down and 1 or 0), label,
        { color = opts.color or (over and "#fff2c8" or TEXT), shadow = true, align = opts.center and "center" or nil })
    ui.pop_font()
    if over and opts.key then
        ui.font("small")
        ui.text(x + w - 14, y + h / 2 - 10, opts.key, { color = DIM, align = "right" })
        ui.pop_font()
    end
    return over and input.pressed("Mouse1")
end

-- čtvercové tlačítko s ikonou (mikro menu); nápověda nad ním
function M.IconButton(x, y, s, icon, tip, key, active)
    local over = M.Inside(x, y, s, s)
    if over then M.hot = true end
    ui.draw_image("UI/hud/slot.png", x - 3, y - 3, s + 6, s + 6)
    ui.draw_image("UI/icons/" .. icon .. ".png", x, y, s, s, over and { 1.15, 1.15, 1.15, 1 } or { 0.9, 0.9, 0.9, 1 })
    if active then ui.rect(x - 2, y - 2, s + 4, s + 4, GOLD, 4, false, 2.5) end
    if over then
        ui.rect(x, y, s, s, "#ffffff22", 4)
        local label = tip .. (key and ("  (" .. key .. ")") or "")
        ui.font("small")
        local tw = ui.text_size(label) + 28
        local tx = math.min(x + s / 2 - tw / 2, ({ ui.screen() })[1] - tw - 8)
        ui.panel("UI/hud/frame_thin.png", tx, y - 46, tw, 38, 10, 14)
        ui.text(tx + 14, y - 38, label, { color = TEXT })
        ui.pop_font()
    end
    return over and input.pressed("Mouse1")
end

-- okno s kovaným rámem a nadpisem; vrací vnitřní obdélník
function M.Window(x, y, w, h, title, closeable)
    M.Block(x, y, w, h)
    ui.panel("UI/hud/frame.png", x, y, w, h, 18, 22)
    ui.rect(x + 14, y + 14, w - 28, h - 28, "#0b0907d8", 6)
    ui.font("h2")
    ui.text(x + w / 2, y + 24, title, { align = "center", color = GOLD, shadow = true })
    ui.pop_font()
    ui.line(x + 40, y + 66, x + w - 40, y + 66, "#6a5430", 2)
    local closed = false
    if closeable then
        local cx, cy = x + w - 52, y + 20
        local over = M.Inside(cx, cy, 32, 32)
        ui.rect(cx, cy, 32, 32, over and "#8a3020" or "#3a2418", 4)
        ui.font("body"); ui.text(cx + 16, cy + 2, "×", { align = "center", color = "#ffe8d0" }); ui.pop_font()
        if over then M.hot = true end
        closed = over and input.pressed("Mouse1")
    end
    return x + 30, y + 80, w - 60, h - 110, closed
end

return M

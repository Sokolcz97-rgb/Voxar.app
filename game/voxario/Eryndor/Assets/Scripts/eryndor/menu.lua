-- ESC menu Eryndoru: pokračovat, nastavení, doplňky, strom talentů, mapa, změna postavy, ukončit hru
-- (s potvrzením). Kreslí se kovaným rámem, tlačítka s ikonami, klikatelná myší; Esc menu zavře.
local W = require("eryndor.widgets")
local M = { open = false, confirm = nil }

function M.Toggle()
    M.open = not M.open
    M.confirm = nil
end

-- akce: tabulka funkcí z main.lua (options, addons, talents, map, logout, quit)
function M.Draw(act)
    if not M.open then return end
    local sw, sh = ui.screen()
    ui.fade(0.5, "#000000")
    ui.vignette(0.6)
    local w, h = 460, M.confirm and 300 or 640
    local x, y = sw / 2 - w / 2, sh / 2 - h / 2
    if M.confirm then
        local ix, iy, iw = W.Window(x, y, w, h, M.confirm.title, false)
        ui.font("body")
        ui.text(x + w / 2, iy + 10, M.confirm.text, { align = "center", color = W.TEXT, wrap = iw })
        ui.pop_font()
        if W.Button(ix, y + h - 104, iw / 2 - 8, 56, "Ano", M.confirm.icon, { center = true, color = "#ffb0a0" }) then
            local fn = M.confirm.fn
            M.confirm, M.open = nil, false
            fn()
        end
        if W.Button(ix + iw / 2 + 8, y + h - 104, iw / 2 - 8, 56, "Zpět", nil, { center = true }) then M.confirm = nil end
        return
    end
    local ix, iy, iw = W.Window(x, y, w, h, "Eryndor", false)
    local items = {
        { "Pokračovat", "m_resume", "Esc", function() M.open = false end },
        { "Nastavení", "m_settings", "O", function() M.open = false; act.options() end },
        { "Doplňky", "m_addons", nil, function() M.open = false; act.addons() end },
        { "Strom talentů", "m_talents", "N", function() M.open = false; act.talents() end },
        { "Mapa světa", "m_map", "M", function() M.open = false; act.map() end },
        { "Změnit postavu", "m_menu", nil, function()
            M.confirm = { title = "Změnit postavu", text = "Vrátit se do tvorby postavy? Postup ve světě zůstane uložený.", icon = "m_menu", fn = act.logout }
        end },
        { "Ukončit hru", "m_quit", nil, function()
            M.confirm = { title = "Ukončit hru", text = "Opravdu chceš ukončit Eryndor?", icon = "m_quit", fn = act.quit }
        end },
    }
    for i, it in ipairs(items) do
        if W.Button(ix, iy + 6 + (i - 1) * 72, iw, 62, it[1], it[2], { key = it[3], color = it[2] == "m_quit" and "#ffb0a0" or nil }) then
            it[4]()
            return
        end
    end
    ui.font("small")
    ui.text(x + w / 2, y + h - 40, "Voxario Studio Engine  ·  " .. (game.version and game.version() or ""), { align = "center", color = W.DIM })
    ui.pop_font()
end

return M

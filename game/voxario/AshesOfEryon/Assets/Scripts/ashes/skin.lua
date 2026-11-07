-- Vzhled rozhraní „Eryon“ (EryonSkin.cs): tmavé panely se zlatým rámem, Cinzel na nadpisy,
-- Cormorant Garamond na text, zlatá tlačítka. Kreslí se ve virtuálním rozlišení 1920 × 1080.
local M = {}

M.Bg = "#0d0b0a"
M.Gold = "#d2ae68"
M.GoldBright = "#f0d08a"
M.Text = "#ece2d0"
M.Muted = "#a8998a"
M.Ember = "#e0672a"
M.Blood = "#9c2a1c"
M.Good = "#8cc06b"
M.Sky = "#9fd4f0"

function M.Init()
    -- 4. číslo = největší velikost, ve které se písmo kreslí (menu, Rádce, boj) – atlas se připraví
    -- v ní, takže větší nadpisy a texty nejsou roztažené a rozmazané
    ui.load_font("title", "UI/Cinzel-SemiBold.ttf", 54, 64)
    ui.load_font("h1", "UI/Cinzel-SemiBold.ttf", 30, 36)
    ui.load_font("h2", "UI/Cinzel-SemiBold.ttf", 21, 28)
    ui.load_font("caps", "UI/Cinzel-Regular.ttf", 15, 24)
    ui.load_font("body", "UI/Cormorant-Medium.ttf", 22, 28)
    ui.load_font("bold", "UI/Cormorant-SemiBold.ttf", 22, 32)
    ui.style({
        window_bg = "#110e0ce6", text = M.Text, text_disabled = M.Muted,
        button = "#2a1f17f2", button_hover = "#40301ff7", button_active = "#140f0cf7",
        frame_bg = "#080605f2", frame_hover = "#16110df2", border = "#d6b26899",
        title_bg = "#0d0a08", header = "#5c4524", tab = "#1c1610", tab_active = "#5c4524",
        slider = M.Gold, check = M.GoldBright, progress = "#a87a3a",
        rounding = 2, border_size = 1, padding = 14, font_size = 22,
    })
end

-- Panel s rámem a nadpisem; vrací vnitřní obdélník (x, y, w, h)
function M.Panel(x, y, w, h, title)
    ui.panel("Textures/ui/panel.png", x, y, w, h, 16, 16)
    if title then
        ui.text(x + w / 2, y + 20, string.upper(title), { size = 21, color = M.Gold, font = "h2", align = "center" })
        M.Ornament(x + w / 2 - 70, y + 52, 140)
        return x + 28, y + 70, w - 56, h - 90
    end
    return x + 24, y + 24, w - 48, h - 48
end

-- Ozdoba: linka s kosočtvercem uprostřed
function M.Ornament(x, y, w)
    ui.line(x, y, x + w / 2 - 9, y, "#d2ae6888", 1)
    ui.line(x + w / 2 + 9, y, x + w, y, "#d2ae6888", 1)
    local cx = x + w / 2
    ui.line(cx - 6, y, cx, y - 6, M.Gold, 1.5)
    ui.line(cx, y - 6, cx + 6, y, M.Gold, 1.5)
    ui.line(cx + 6, y, cx, y + 6, M.Gold, 1.5)
    ui.line(cx, y + 6, cx - 6, y, M.Gold, 1.5)
end

-- Tlačítko (zlaté = primární); vrací kliknuto
function M.Button(x, y, w, h, text, primary, enabled)
    if enabled == false then
        ui.panel("Textures/ui/button.png", x, y, w, h, 10, 10, { 1, 1, 1, 0.45 })
        ui.text(x + w / 2, y + h / 2 - 11, text, { size = primary and 19 or 16, color = "#a8998a88", font = "h2", align = "center", shadow = false })
        return false
    end
    ui.panel(primary and "Textures/ui/primary.png" or "Textures/ui/button.png", x, y, w, h, 10, 10)
    return ui.button_at(x, y, w, h, text, { color = { 0, 0, 0, 0 }, hover = { 1, 0.95, 0.8, 0.10 }, font = "h2",
        size = primary and 19 or 16, text_color = primary and "#1a1209" or M.Text })
end

-- Volba (chip): vrací kliknuto
function M.Chip(x, y, w, h, on)
    ui.panel(on and "Textures/ui/chip_on.png" or "Textures/ui/chip.png", x, y, w, h, 8, 8)
    return ui.button_at(x, y, w, h, "", { color = { 0, 0, 0, 0 }, hover = { 1, 0.95, 0.8, 0.06 } })
end

-- Obrázek přes celou plochu (zachová poměr stran, ořízne přesah)
function M.Cover(path, w, h, iw, ih)
    local s = math.max(w / iw, h / ih)
    local dw, dh = iw * s, ih * s
    ui.draw_image(path, (w - dw) / 2, (h - dh) / 2, dw, dh)
end

function M.Spinner(cx, cy)
    local t = game.time() * 2.2
    for i = 0, 7 do
        local a = t + i / 8 * math.pi * 2
        local alpha = (i + 1) / 8
        ui.rect(cx + math.cos(a) * 22 - 4, cy + math.sin(a) * 22 - 4, 8, 8, { 0.82, 0.68, 0.4, alpha }, 4)
    end
end

-- Barva vzácnosti předmětu (CharacterWindow.RarityColor)
function M.RarityColor(r)
    if r == 1 then return { 0.55, 0.85, 0.45 } elseif r == 2 then return { 0.45, 0.7, 1 }
    elseif r == 3 then return { 0.78, 0.55, 1 } elseif r == 4 then return { 1, 0.6, 0.2 } end
    return M.Text
end

M.ClassNames = { hoplit = "Hoplít", lucistnik = "Lučištník", vestec = "Věštec" }
M.FactionNames = { kalidra = "Obránci Kalidry", legie = "Legie Rudého slunce" }
function M.ClassName(c) return M.ClassNames[c] or c or "" end
function M.FactionName(f) return M.FactionNames[f] or f or "" end
function M.Portrait(cls, gender) return "UI/portrait_" .. (cls or "hoplit") .. "_" .. (gender == "f" and "f" or "m") .. ".png" end

return M

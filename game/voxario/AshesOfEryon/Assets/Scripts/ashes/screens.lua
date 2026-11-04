-- Přihlášení a tvorba postavy (GameUI.cs: LoginScreen, CreatorScreen)
local skin = require("ashes.skin")
local api = require("ashes.api")

local M = {}

local form = { email = settings.get("login.email", ""), password = "", remember = settings.get("login.remember", true), show = false }
local news, serverState, newsLoading = nil, 0, false

local function loadNews()
    newsLoading = true
    api.News(function(items, ok)
        serverState = ok and 1 or -1
        news = items
    end)
end

local function background(W, H)
    skin.Cover("UI/background.jpg", W, H, 1918, 1080)
    ui.draw_image("Textures/ui/vignette.png", 0, 0, W, H)
end

-- boot: tabulka stavu ze main.lua (busy, status, signIn, ...)
function M.Login(boot)
    if not newsLoading then loadNews() end
    local W, H = ui.screen()
    background(W, H)
    -- plynulý přechod zleva
    for i = 0, 15 do
        local a = i < 9 and 0.86 or 0.86 * (1 - (i - 8) / 7)
        ui.rect(i * W * 0.62 / 16, 0, W * 0.62 / 16 + 1, H, { 0.025, 0.018, 0.012, a })
    end
    local colW, x = 520, math.max(60, W * 0.08)
    local top = math.max(20, H * 0.05)
    ui.draw_image("UI/logo.png", x + colW / 2 - 140, top, 280, 280)
    ui.text(x + colW / 2, top + 284, "KAPITOLA I  ·  POSLEDNÍ ŠTÍT", { size = 16, color = skin.Gold, font = "caps", align = "center" })
    skin.Ornament(x + colW / 2 - 90, top + 318, 180)

    local signed = api.SignedIn()
    local showForm = not (boot.busy or signed)
    local px, py, pw, ph = x, top + 334, colW, showForm and 470 or 300
    local ix, iy, iw, ih = skin.Panel(px, py, pw, ph, "Vstup do Kalidry")
    if boot.busy or (signed and not boot.state and (boot.status or "") == "") then
        skin.Spinner(ix + iw / 2, iy + 60)
        ui.text(ix + iw / 2, iy + 120, (boot.status ~= "" and boot.status) or "Načítám…", { size = 22, font = "body", align = "center", color = skin.Text })
    elseif signed and not boot.state then
        ui.text(ix, iy + 10, boot.status or "", { size = 22, font = "body", color = skin.Text, wrap = iw })
        if skin.Button(ix, iy + ih - 50, 220, 44, "Odhlásit se") then boot.SignOut() end
    else
        local enter = false
        ui.window("##login", ix - 14, iy - 10, iw + 28, 250, { title = false, background = false, scroll = false, font = "body", font_size = 22 }, function()
            ui.font("caps", 14)
            ui.label("E-MAIL ÚČTU STUDIOVOXARIO", skin.Muted)
            ui.pop_font()
            local e1, e2, _
            form.email, _, e1 = ui.input("##email", form.email, { width = iw, max = 120, hint = "jmeno@example.com" })
            ui.spacing(6)
            ui.font("caps", 14)
            ui.label("HESLO", skin.Muted)
            ui.pop_font()
            form.password, _, e2 = ui.input("##password", form.password, { width = iw, max = 128, password = not form.show })
            form.show = ui.checkbox("Zobrazit heslo", form.show)
            ui.same_line(220)
            form.remember = ui.checkbox("Zapamatovat e-mail", form.remember)
            enter = e1 or e2
        end)
        local can = #form.email > 3 and form.email:find("@") and #form.password > 0 and not boot.busy
        if skin.Button(ix, iy + 250, iw, 56, "VSTOUPIT DO SVĚTA", true, can) or (enter and can) then
            settings.set("login.remember", form.remember)
            settings.set("login.email", form.remember and form.email or "")
            boot.SignIn((form.email:gsub("^%s+", ""):gsub("%s+$", "")), form.password)
        end
        if (boot.status or "") ~= "" then
            ui.text(ix, iy + 318, boot.status, { size = 18, font = "body", color = skin.Ember, wrap = iw })
        end
        ui.line(ix, iy + ih - 58, ix + iw, iy + ih - 58, "#c9a45c59", 1)
        ui.text(ix, iy + ih - 48, "Nemáš účet? Vytvoř si ho zdarma na studiovoxario.com", { size = 16, font = "body", color = skin.Muted })
        ui.text(ix, iy + ih - 26, "Přihlašuješ se přes Google nebo Discord? Nastav si heslo v účtu na webu.", { size = 15, font = "body", color = skin.Muted, wrap = iw })
    end

    -- pravý sloupec: stav serveru a novinky
    local nw = 470
    local nx, ny = W - nw - math.max(40, W * 0.04), top + 10
    ui.rect(nx, ny, nw, 40, { 0.03, 0.02, 0.015, 0.7 })
    local dot = serverState == 1 and { 0.35, 0.85, 0.45 } or (serverState == -1 and { 0.9, 0.35, 0.25 } or { 0.9, 0.75, 0.3 })
    ui.rect(nx + 16, ny + 15, 10, 10, dot, 5)
    ui.text(nx + 36, ny + 10, serverState == 1 and "SERVERY ONLINE" or (serverState == -1 and "SERVERY NEDOSTUPNÉ" or "OVĚŘUJI SERVERY…"),
        { size = 15, font = "caps", color = skin.Muted })
    ui.text(nx + nw - 16, ny + 11, "Uzavřený test", { size = 14, font = "body", color = skin.Muted, align = "right" })
    if news and #news > 0 then
        local y = ny + 54
        ui.text(nx, y, "NOVINKY", { size = 16, font = "caps", color = skin.Gold })
        y = y + 32
        for _, n in ipairs(news) do
            if y > H - 220 then break end
            local body = n.text_cs or ""
            if #body > 170 then body = body:sub(1, 167) .. "…" end
            local title = (n.title_cs or ""):gsub("Unity verze", "Verze")
            ui.rect(nx, y, nw, 118, { 0.03, 0.02, 0.015, 0.72 })
            ui.rect(nx, y, 3, 118, skin.Gold)
            ui.text(nx + 16, y + 10, (n.published_at or ""):sub(1, 10), { size = 13, font = "body", color = skin.Muted })
            ui.text(nx + 16, y + 28, title, { size = 19, font = "bold", color = skin.Text, wrap = nw - 32 })
            ui.text(nx + 16, y + 56, body, { size = 15, font = "body", color = skin.Muted, wrap = nw - 32 })
            y = y + 128
        end
    end
    ui.text(x, H - 40, "© 2026 StudioVoxario   ·   Podmínky použití   ·   Ochrana soukromí   ·   Podpora", { size = 14, font = "body", color = "#d9ccb8bf" })
    local info = graphics.info()
    ui.text(W - 30, H - 44, "Voxario Studio Engine · Vulkan · " .. (info.upscaler == "DLSS" and "NVIDIA DLSS" or "nativní") .. "   ·   verze " .. boot.version,
        { size = 14, font = "caps", color = skin.Muted, align = "right" })
    ui.text(W - 30, H - 82, "Každá volba zanechá jizvu.", { size = 26, font = "body", color = "#ede3d1cc", align = "right" })
end

-- ------------------------------------------------------------------ tvorba postavy
local c = { name = "", class = "hoplit", gender = "m", faction = "kalidra", error = nil }

local CLASSES = {
    { "hoplit", "Štít a kopí. Nejvíc životů a blok štítem. Hlavní vlastnost: síla." },
    { "lucistnik", "Luk a dýka. Rychlé zásahy a úhyby. Hlavní vlastnost: obratnost." },
    { "vestec", "Oheň a proroctví. Silná kouzla, méně životů. Hlavní vlastnost: intelekt." },
}
local FACTIONS = {
    { "kalidra", "Obránci Kalidry", "Poslední svobodné město na pobřeží. Probudíš se na Bezejmenném břehu a pomůžeš Eryonovi udržet hradby." },
    { "legie", "Legie Rudého slunce", "Vojsko Azkara, Syna Rudého slunce. Vystoupíš z černých lodí v zátoce a povedeš útok na Kalidru." },
}

-- vlastnosti povolání pro přehled (relativně 0..1: síla, obratnost, intelekt, výdrž)
local CLASS_STATS = {
    hoplit = { 0.9, 0.45, 0.3, 0.9 },
    lucistnik = { 0.5, 0.95, 0.45, 0.6 },
    vestec = { 0.3, 0.5, 0.95, 0.45 },
}
local stage = require("ashes.stage")
local lastT

-- Tvorba postavy jako v MMO: hrdina ve 3D uprostřed chrámu, volby v panelech vlevo a vpravo
function M.Creator(boot)
    local W, H = ui.screen()
    local now = game.time()
    local dt = lastT and math.min(0.1, now - lastT) or 0
    lastT = now
    stage.Show(c.class, c.gender)
    -- jemné ztmavení okrajů, střed s hrdinou zůstává čistý
    ui.draw_image("Textures/ui/vignette.png", 0, 0, W, H)

    local pw, ph = 470, math.min(H - 150, 880)
    local lx, rx, py = 36, W - 36 - pw, 40
    local mx, my = ui.mouse()
    local overUi = (mx < lx + pw) or (mx > rx) or (my > H - 130)
    stage.Update(dt, mx, input.key("Mouse1"), overUi)

    -- levý panel: strana, povolání, pohlaví
    local ix, iy, iw, ih = skin.Panel(lx, py, pw, ph, "Zrození hrdiny")
    local y = iy
    ui.text(ix, y, "STRANA VÁLKY", { size = 15, font = "caps", color = skin.Muted }); y = y + 24
    for _, f in ipairs(FACTIONS) do
        local on = c.faction == f[1]
        if skin.Chip(ix, y, iw, 86, on) then c.faction = f[1] end
        ui.text(ix + 14, y + 10, f[2], { size = 20, font = "h2", color = on and skin.GoldBright or skin.Text })
        ui.text(ix + 14, y + 38, f[3], { size = 15, font = "body", color = skin.Muted, wrap = iw - 28 })
        y = y + 94
    end
    y = y + 8
    ui.text(ix, y, "POVOLÁNÍ", { size = 15, font = "caps", color = skin.Muted }); y = y + 24
    for _, cl in ipairs(CLASSES) do
        local on = c.class == cl[1]
        if skin.Chip(ix, y, iw, 92, on) then c.class = cl[1] end
        ui.draw_image(skin.Portrait(cl[1], c.gender), ix + 8, y + 6, 80, 80)
        ui.text(ix + 100, y + 10, skin.ClassName(cl[1]), { size = 20, font = "h2", color = on and skin.GoldBright or skin.Text })
        ui.text(ix + 100, y + 38, cl[2], { size = 15, font = "body", color = skin.Muted, wrap = iw - 112 })
        y = y + 100
    end
    y = y + 8
    ui.text(ix, y, "POSTAVA", { size = 15, font = "caps", color = skin.Muted }); y = y + 24
    local gw = (iw - 10) / 2
    for i, g in ipairs({ { "m", "Muž" }, { "f", "Žena" } }) do
        local gx = ix + (i - 1) * (gw + 10)
        if skin.Chip(gx, y, gw, 46, c.gender == g[1]) then c.gender = g[1] end
        ui.text(gx + gw / 2, y + 12, g[2], { size = 18, font = "h2", align = "center", color = c.gender == g[1] and skin.GoldBright or skin.Text })
    end

    -- pravý panel: jméno, vlastnosti, uložené postavy
    ix, iy, iw, ih = skin.Panel(rx, py, pw, ph, "Tvůj hrdina")
    y = iy
    ui.text(ix, y, "JMÉNO HRDINY (3–20 znaků)", { size = 15, font = "caps", color = skin.Muted })
    ui.window("##creator_name", ix - 14, y + 14, iw + 28, 70, { title = false, background = false, scroll = false, font = "body", font_size = 22 }, function()
        c.name = ui.input("##heroname", c.name, { width = iw, max = 20, hint = "Jméno" })
    end)
    y = y + 84
    ui.text(ix, y, "VLASTNOSTI POVOLÁNÍ", { size = 15, font = "caps", color = skin.Muted }); y = y + 26
    local st = CLASS_STATS[c.class] or CLASS_STATS.hoplit
    for i, nm in ipairs({ "Síla", "Obratnost", "Intelekt", "Výdrž" }) do
        ui.text(ix, y, nm, { size = 17, font = "body", color = skin.Text })
        ui.bar(ix + 130, y + 4, iw - 130, 14, st[i], "#a87a3a")
        y = y + 30
    end
    y = y + 10
    ui.text(ix, y, c.faction == "legie" and "Začneš na černých lodích v Zátoce černých plachet." or "Probudíš se na Bezejmenném břehu nedaleko Kalidry.",
        { size = 16, font = "body", color = skin.Muted, wrap = iw })
    y = y + 56
    if boot.slots and boot.slots.others and #boot.slots.others > 0 then
        ui.text(ix, y, "NEBO POKRAČUJ S EXISTUJÍCÍ POSTAVOU", { size = 15, font = "caps", color = skin.Muted }); y = y + 24
        for _, s in ipairs(boot.slots.others) do
            if y > iy + ih - 120 then break end
            if skin.Chip(ix, y, iw - 110, 64, false) then boot.SwitchCharacter(s) end
            ui.draw_image(skin.Portrait(s.class, s.appearance and s.appearance.gender), ix + 6, y + 6, 52, 52)
            ui.text(ix + 66, y + 8, s.name or "", { size = 19, font = "bold", color = skin.Text })
            ui.text(ix + 66, y + 34, skin.ClassName(s.class) .. " · úroveň " .. tostring(s.level or 1), { size = 15, font = "body", color = skin.Muted })
            -- smazat (druhé kliknutí do 4 s potvrdí – nevratné)
            local confirm = c.confirmDelete == s.id and game.time() - (c.confirmAt or 0) < 4
            if skin.Button(ix + iw - 100, y + 12, 100, 40, confirm and "Opravdu?" or "Smazat", false, not boot.busy) then
                if confirm then c.confirmDelete = nil; boot.DeleteCharacter(s, function(err) c.error = err end)
                else c.confirmDelete, c.confirmAt = s.id, game.time() end
            end
            y = y + 72
        end
    end
    if c.error then ui.text(ix, iy + ih - 100, c.error, { size = 18, font = "bold", color = skin.Ember, wrap = iw }) end
    if skin.Button(ix, iy + ih - 50, 200, 50, "Odhlásit se") then stage.Hide(); boot.SignOut() end

    -- dole uprostřed: vstup do světa
    local nm = c.name:gsub("^%s+", ""):gsub("%s+$", "")
    ui.text(W / 2, H - 132, "Táhni myší pro otočení postavy", { size = 15, font = "body", color = "#ede3d1aa", align = "center" })
    if skin.Button(W / 2 - 200, H - 100, 400, 64, "VSTOUPIT DO SVĚTA", true, utf8.len(nm) and utf8.len(nm) >= 3 and not boot.busy) then
        c.error = nil
        boot.CreateCharacter(nm, c.class, c.gender, c.faction, function(err) c.error = err end)
    end
end

-- volá se při vstupu do světa / odhlášení: zbourat scénu tvorby postavy
function M.HideStage() stage.Hide() end

-- Načítání (stavba světa)
function M.Loading(boot)
    local W, H = ui.screen()
    background(W, H)
    ui.rect(0, 0, W, H, { 0, 0, 0, 0.45 })
    skin.Spinner(W / 2, H / 2 - 20)
    ui.text(W / 2, H / 2 + 30, boot.status ~= "" and boot.status or "Stavím svět Kalidry…", { size = 26, font = "body", align = "center", color = skin.Text })
end

return M

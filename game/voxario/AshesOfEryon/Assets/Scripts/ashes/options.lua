-- Nastavení hry jako v Unity verzi (GameUI.cs): karty Grafika, Zobrazení, Zvuk, Ovládání, Módy, Postavy.
-- Otevírá Esc. Hodnoty se ukládají do settings (gfx.*, audio.*) a M.Apply() je při startu použije.
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")
local sound = require("ashes.sound")
local api = require("ashes.api")

local M = { open = false, rebinding = nil, tab = 1 }
local TABS = { "Grafika", "Zobrazení", "Zvuk", "Ovládání", "Módy", "Postavy" }

-- Předvolby kvality (Atmosphere.ApplyQuality): stíny, dohled, tráva, mraky, voda, hustota krajiny
local PRESETS = {
    { name = "Nízká",   shadows = "low",    view = 0.7, grass = 0.35, clouds = 1, water = 0, scenery = 0 },
    { name = "Střední", shadows = "medium", view = 0.9, grass = 0.6,  clouds = 2, water = 1, scenery = 1 },
    { name = "Vysoká",  shadows = "high",   view = 1.0, grass = 0.85, clouds = 2, water = 2, scenery = 2 },
    { name = "Ultra",   shadows = "ultra",  view = 1.4, grass = 1.0,  clouds = 3, water = 3, scenery = 3 },
}
local SHADOWS = { { "off", "Vypnuté" }, { "low", "Nízké" }, { "medium", "Střední" }, { "high", "Vysoké" }, { "ultra", "Ultra" } }
local UPSCALE_QUALITY = { { 0.77, "Kvalita" }, { 0.67, "Vyvážené" }, { 0.59, "Výkon" }, { 0.5, "Ultra výkon" } }
local DLSS_QUALITY = { { "quality", "Kvalita" }, { "balanced", "Vyvážené" }, { "performance", "Výkon" },
                       { "ultra_performance", "Ultra výkon" }, { "dlaa", "DLAA" } }
local FPS_CAPS = { 30, 60, 120, 144, 0 }

local function get(k, d) local v = settings.get(k, d); if v == nil then return d end return v end

-- Uložené nastavení -> engine (při startu a po každé změně)
function M.Apply()
    graphics.vsync(get("gfx.vsync", true))
    graphics.fps_limit(get("gfx.fps", 0))
    graphics.shadows(get("gfx.shadows", "high"))
    graphics.view_distance(get("gfx.view", 1.0))
    graphics.detail_density(get("gfx.grass", 0.85))
    graphics.clouds(get("gfx.clouds", 2))
    graphics.water_quality(get("gfx.water", 2))
    graphics.render_scale(get("gfx.scale", 1.0))
    local up = get("gfx.upscaler", "dlss")
    local _, dlssOk = graphics.dlss()
    if up == "dlss" and not dlssOk then up = get("gfx.scale", 1.0) < 0.99 and "fsr" or "off" end
    graphics.upscaler(up)
    if up == "fsr" or up == "scale" then graphics.render_scale(get("gfx.scale", 0.67)) end
    graphics.dlss_quality(get("gfx.dlss_quality", "balanced"))
    local _, rtOk = graphics.ray_tracing()
    local rt = settings.get("gfx.rt", nil)
    if rt ~= nil then graphics.ray_tracing(rtOk and rt) end
    local mode = get("gfx.window", "windowed")
    if mode ~= "windowed" then graphics.window_mode(mode) end
end

function M.Toggle()
    M.open = not M.open
    M.rebinding = nil
    keys.Capturing = false
end

local function set(k, v) settings.set(k, v); M.Apply() end

-- ------------------------------------------------------------------ prvky
local cx, cy, cw   -- kurzor uvnitř karty
local viewTop, viewBottom = 0, 1080   -- viditelná část posuvné oblasti (ImGui prvky mimo ni se nekreslí)
local scroll = {}                      -- posun obsahu každé karty
local function section(title, hint)
    cy = cy + 8
    ui.text(cx, cy, string.upper(title), { size = 19, font = "h2", color = skin.Gold })
    cy = cy + 28
    if hint then
        local _, h = ui.text(cx, cy, hint, { size = 16, font = "body", color = skin.Muted, wrap = cw })
        cy = cy + (h or 20) + 6
    end
end
-- řada voleb (chipů); vrací index zvolené nebo nil
local function choices(items, current, width, enabled)
    local x = cx
    local picked
    local w = width or math.min(200, (cw - (#items - 1) * 8) / #items)
    for i, it in ipairs(items) do
        local on = current == i
        if enabled == false then
            ui.panel("Textures/ui/chip.png", x, cy, w, 40, 8, 8, { 1, 1, 1, 0.4 })
        elseif skin.Chip(x, cy, w, 40, on) then picked = i end
        ui.text(x + w / 2, cy + 10, it, { size = 17, font = "h2", color = (enabled == false) and skin.Muted or (on and skin.GoldBright or skin.Text), align = "center" })
        x = x + w + 8
    end
    cy = cy + 52
    return picked
end
local function slider(label, value, minV, maxV, fmt)
    ui.text(cx, cy + 4, label, { size = 18, font = "body", color = skin.Text })
    local out = value
    -- posuvník je samostatné okno ImGui – ořez oblasti na něj nepůsobí, takže jen když je celý vidět
    if cy - 6 < viewTop or cy + 38 > viewBottom then
        ui.bar(cx + 248, cy + 8, cw - 300, 14, (value - minV) / math.max(1e-6, maxV - minV), "#8a6a34")
        cy = cy + 44
        return nil
    end
    ui.window("##sl_" .. label, cx + 240, cy - 6, cw - 240, 44, { title = false, background = false, scroll = false, move = false, resize = false, font = "body", font_size = 20 }, function()
        ui.item_width(cw - 300)
        local v, changed = ui.slider("##" .. label, value, minV, maxV, fmt)
        if changed then out = v end
    end)
    cy = cy + 44
    return out ~= value and out or nil
end
local function indexOf(list, fn) for i, v in ipairs(list) do if fn(v) then return i end end return nil end

-- ------------------------------------------------------------------ karty
local function graphicsTab()
    local _, dlssOk = graphics.dlss()
    section("Předvolba kvality", "Stíny, dohled, hustota trávy, mraky, voda a hustota stromů (stromy se změní po příštím vstupu do světa).")
    local preset = get("gfx.preset", 3)
    local names = {}
    for i, p in ipairs(PRESETS) do names[i] = p.name end
    local pick = choices(names, preset)
    if pick then
        local p = PRESETS[pick]
        settings.set("gfx.preset", pick)
        settings.set("gfx.shadows", p.shadows); settings.set("gfx.view", p.view); settings.set("gfx.grass", p.grass)
        settings.set("gfx.clouds", p.clouds); settings.set("gfx.water", p.water); settings.set("gfx.quality", p.scenery)
        M.Apply()
    end

    section("Zvětšování obrazu", dlssOk and "Tvoje karta podporuje NVIDIA DLSS." or
        "DLSS vyžaduje kartu NVIDIA RTX – použij AMD FSR 1 nebo vlastní měřítko (fungují na každé kartě).")
    local modes = { { "off", "Vypnuto" }, { "dlss", "NVIDIA DLSS" }, { "fsr", "AMD FSR 1" }, { "scale", "Vlastní měřítko" } }
    local up = graphics.upscaler()
    local labels = {}
    for i, m in ipairs(modes) do labels[i] = m[2] end
    local mi = choices(labels, indexOf(modes, function(m) return m[1] == up end), nil, true)
    if mi and not (modes[mi][1] == "dlss" and not dlssOk) then
        settings.set("gfx.upscaler", modes[mi][1])
        if modes[mi][1] == "off" then settings.set("gfx.scale", 1.0)
        elseif modes[mi][1] ~= "dlss" and get("gfx.scale", 1.0) > 0.99 then settings.set("gfx.scale", 0.67) end
        M.Apply()
    end
    up = graphics.upscaler()
    if up == "dlss" then
        local qn = {}
        for i, q in ipairs(DLSS_QUALITY) do qn[i] = q[2] end
        local cur = graphics.dlss_quality()
        local qi = choices(qn, indexOf(DLSS_QUALITY, function(q) return q[1] == cur end))
        if qi then set("gfx.dlss_quality", DLSS_QUALITY[qi][1]) end
    elseif up == "fsr" then
        local qn = {}
        for i, q in ipairs(UPSCALE_QUALITY) do qn[i] = q[2] end
        local s = graphics.render_scale()
        local qi = choices(qn, indexOf(UPSCALE_QUALITY, function(q) return math.abs(q[1] - s) < 0.02 end))
        if qi then set("gfx.scale", UPSCALE_QUALITY[qi][1]) end
    elseif up == "scale" then
        local v = slider("Rozlišení vykreslování", graphics.render_scale(), 0.5, 1.0, "%.2f×")
        if v then set("gfx.scale", v) end
    end
    local info = graphics.info()
    ui.text(cx, cy, string.format("Vykresluje se %d × %d → okno %d × %d", info.render_width or 0, info.render_height or 0,
        info.output_width or 0, info.output_height or 0), { size = 16, font = "body", color = skin.Muted })
    cy = cy + 26

    section("Stíny")
    local sn = {}
    for i, s in ipairs(SHADOWS) do sn[i] = s[2] end
    local si = choices(sn, indexOf(SHADOWS, function(s) return s[1] == graphics.shadows() end))
    if si then set("gfx.shadows", SHADOWS[si][1]) end
    local v = slider("Dohled", graphics.view_distance(), 0.5, 2.0, "%.1f×")
    if v then set("gfx.view", v) end
    v = slider("Hustota trávy a keřů", graphics.detail_density(), 0.0, 1.0, "%.2f")
    if v then set("gfx.grass", v) end

    section("Mraky a voda")
    local ci = choices({ "Bez mraků", "Jedna vrstva", "Dvě vrstvy", "Detailní" }, graphics.clouds() + 1)
    if ci then set("gfx.clouds", ci - 1) end
    local wi = choices({ "Voda: nízká", "Střední", "Vysoká", "Ultra (teselace)" }, graphics.water_quality() + 1)
    if wi then set("gfx.water", wi - 1) end

    local rtOn, rtOk = graphics.ray_tracing()
    if rtOk then   -- bez podpory se volba nezobrazí
        section("Ray tracing", "Stíny slunce a odrazy na vodě sledované paprskem (Vulkan ray query). Hezčí, ale náročnější – doporučeno s DLSS nebo FSR.")
        local ri = choices({ "Vypnuto", "Zapnuto" }, rtOn and 2 or 1, 200)
        if ri then set("gfx.rt", ri == 2) end
    end
end

local function displayTab()
    section("Režim okna", "„Okno přes celou obrazovku“ nepřeskakuje mezi monitory při Alt+Tab.")
    local modes = { { "windowed", "Okno" }, { "borderless", "Okno přes celou obrazovku" }, { "fullscreen", "Celá obrazovka" } }
    local labels = {}
    for i, m in ipairs(modes) do labels[i] = m[2] end
    local cur = graphics.window_mode()
    local mi = choices(labels, indexOf(modes, function(m) return m[1] == cur end), 300)
    if mi then settings.set("gfx.window", modes[mi][1]); graphics.window_mode(modes[mi][1]) end
    if graphics.window_mode() == "windowed" then
        section("Velikost okna")
        local list = { { 1280, 720 }, { 1600, 900 }, { 1920, 1080 }, { 2560, 1440 } }
        local w, h = graphics.resolution()
        local names = {}
        for i, r in ipairs(list) do names[i] = r[2] .. "p" end
        local ri = choices(names, indexOf(list, function(r) return r[1] == w and r[2] == h end), 160)
        if ri then graphics.resolution(list[ri][1], list[ri][2]) end
    end
    section("Synchronizace a snímky", "V-Sync bez trhání obrazu (trojité bufferování). Omezení FPS šetří grafickou kartu a baterii.")
    local vi = choices({ "V-Sync", "Bez V-Sync" }, graphics.vsync() and 1 or 2, 200)
    if vi then set("gfx.vsync", vi == 1) end
    local names = {}
    for i, f in ipairs(FPS_CAPS) do names[i] = f == 0 and "Bez limitu" or tostring(f) end
    local cap = graphics.fps_limit()
    local fi = choices(names, indexOf(FPS_CAPS, function(f) return f == math.floor(cap + 0.5) end), 140)
    if fi then set("gfx.fps", FPS_CAPS[fi]) end
    local show = get("ui.fps", false)
    local si = choices({ "Zobrazit FPS", "Skrýt FPS" }, show and 1 or 2, 200)
    if si then settings.set("ui.fps", si == 1) end
    local info = graphics.info()
    ui.text(cx, cy, string.format("%s  ·  %.0f FPS  ·  %s", info.gpu or "", info.fps or 0, info.present_mode or ""), { size = 16, font = "body", color = skin.Muted })
    cy = cy + 26
end

local function soundTab()
    section("Hudba", sound.nowPlaying and ("Hraje: " .. sound.nowPlaying) or "Album Eryon z úložiště hry.")
    local v = slider("Hudba", sound.MusicVolume(), 0, 1, "%.2f")
    if v then sound.MusicVolume(v); sound.ApplyVolumes() end
    section("Zvukové efekty", "Zásahy, bloky, mince, nová úroveň.")
    v = slider("Efekty", sound.SfxVolume(), 0, 1, "%.2f")
    if v then sound.SfxVolume(v); sound.ApplyVolumes(); sound.Play("click") end
    section("Celkem")
    v = slider("Celková hlasitost", get("audio.master", 1), 0, 1, "%.2f")
    if v then settings.set("audio.master", v); sound.ApplyVolumes() end
    local mi = choices({ "Zvuk zapnutý", "Ztlumit vše" }, get("audio.mute", false) and 2 or 1, 220)
    if mi then settings.set("audio.mute", mi == 2); sound.ApplyVolumes() end
end

local function controlsTab()
    section("Ovládání", "Klikni na klávesu u akce a stiskni novou klávesu nebo tlačítko myši. Esc = zrušit.")
    if M.rebinding then
        keys.Capturing = true
        local k = input.any()
        if k == "Escape" then M.rebinding = nil; keys.Capturing = false
        elseif k then keys.Set(M.rebinding, k); M.rebinding = nil; keys.Capturing = false end
    end
    local colW = (cw - 30) / 2
    local startY = cy
    for i, b in ipairs(keys.All) do
        local col = (i - 1) % 2
        local row = (i - 1) // 2
        local x, y = cx + col * (colW + 30), startY + row * 44
        ui.text(x, y + 8, b[2], { size = 17, font = "body", color = skin.Text })
        local label = M.rebinding == b[1] and "Stiskni…" or keys.Label(b[1])
        local conflict = keys.Conflict(b[1])
        if skin.Chip(x + colW - 150, y, 150, 38, M.rebinding == b[1]) then M.rebinding = b[1] end
        ui.text(x + colW - 75, y + 9, label, { size = 16, font = "h2", color = conflict and skin.Ember or skin.GoldBright, align = "center" })
    end
    cy = startY + math.ceil(#keys.All / 2) * 44 + 10
    if skin.Button(cx, cy, 260, 44, "Obnovit výchozí") then keys.ResetAll() end
    cy = cy + 56
end

local function modsTab()
    local modhost = require("ashes.modhost")
    section("Módy a doplňky", "Vlastní rozšíření v Lua (jako doplňky ve World of Warcraft). Nemění pravidla hry na serveru. Složka: " .. modhost.Folder)
    if #modhost.list == 0 then
        ui.text(cx, cy, "Žádné módy. Ukázka Deník poutníka se vytvoří při prvním spuštění.", { size = 18, font = "body", color = skin.Muted })
        cy = cy + 30
    end
    for _, m in ipairs(modhost.list) do
        local on = m.enabled
        if skin.Chip(cx, cy, 120, 38, on) then modhost.SetEnabled(m.id, not on) end
        ui.text(cx + 60, cy + 9, on and "Zapnuto" or "Vypnuto", { size = 16, font = "h2", color = on and skin.GoldBright or skin.Muted, align = "center" })
        ui.text(cx + 136, cy + 2, string.format("%s  ·  %s  ·  %s", m.name, m.version, m.author), { size = 19, font = "bold", color = skin.Text })
        local note = m.error and ("Chyba: " .. tostring(m.error):sub(1, 160)) or (m.disabled and "Vypnuto po mnoha chybách." or (m.description or ""))
        ui.text(cx + 136, cy + 26, note, { size = 15, font = "body", color = (m.error or m.disabled) and skin.Ember or skin.Muted, wrap = cw - 140 })
        cy = cy + 64
    end
    if skin.Button(cx, cy, 260, 44, "Načíst znovu (F8)") then modhost.Reload() end
    cy = cy + 56
end

-- Postavy (CharacterSlots.cs): až 4 hrdinové na účtu
local slots, slotsBusy, slotsErr, slotsAt = nil, false, nil, -100
local function loadSlots()
    slotsBusy = true
    api.Rpc("ashes_characters_list", {}, function(data, err)
        slotsBusy, slotsAt = false, game.time()
        if err then slotsErr = err else slots, slotsErr = data, nil end
    end)
end
local function act(boot, fn, args)
    slotsBusy = true
    api.Rpc(fn, args, function(_, err)
        slotsBusy = false
        if err then slotsErr = err; return end
        M.open = false
        boot.Reload()
    end)
end
local function charactersTab(boot)
    section("Tvé postavy", "Na jednom účtu můžeš mít až 4 hrdiny – třeba za každou stranu války.")
    if not slots and not slotsBusy and game.time() - slotsAt > 5 and api.SignedIn() then loadSlots() end
    if not slots then
        ui.text(cx, cy, slotsErr or "Načítám postavy…", { size = 18, font = "body", color = slotsErr and skin.Ember or skin.Text })
        cy = cy + 30
        return
    end
    local list = {}
    if slots.active and slots.active.name and slots.active.name ~= "" then list[1] = { s = slots.active, active = true } end
    for _, s in ipairs(slots.others or {}) do list[#list + 1] = { s = s } end
    for _, e in ipairs(list) do
        local s = e.s
        ui.draw_image(skin.Portrait(s.class, s.appearance and s.appearance.gender), cx, cy, 66, 66)
        ui.text(cx + 80, cy + 6, (s.name or "") .. (e.active and "  · hraješ" or ""), { size = 22, font = "bold", color = e.active and skin.Good or skin.Text })
        ui.text(cx + 80, cy + 36, string.format("%s · úroveň %d · %s", skin.ClassName(s.class), s.level or 1, skin.FactionName(s.faction)), { size = 16, font = "body", color = skin.Muted })
        if not e.active and skin.Button(cx + cw - 260, cy + 10, 260, 48, "Hrát za tuto postavu", true, not slotsBusy) then
            act(boot, "ashes_switch_character", { p_slot = s.id })
        end
        cy = cy + 78
        ui.line(cx, cy - 6, cx + cw, cy - 6, "#c9a45c33", 1)
    end
    local max = math.max(1, slots.max or 4)
    cy = cy + 6
    if skin.Button(cx, cy, 420, 46, string.format("+ Založit novou postavu  (%d/%d)", #list, max), false, not slotsBusy and #list < max) then
        act(boot, "ashes_new_character", {})
    end
    cy = cy + 54
    ui.text(cx, cy, "Současná postava se uloží a kdykoli se k ní vrátíš.", { size = 16, font = "body", color = skin.Muted })
    cy = cy + 26
    if slotsErr then ui.text(cx, cy, slotsErr, { size = 18, font = "bold", color = skin.Ember }) end
end

function M.Draw(boot)
    if not M.open then return end
    local W, H = ui.screen()
    ui.fade(0.55)
    local w, h = math.min(1040, W - 40), math.max(420, math.min(900, H - 60))
    local x, y = (W - w) / 2, (H - h) / 2
    local ix, iy, iw, ih = skin.Panel(x, y, w, h, "Nastavení")
    -- karty
    local tw = (iw - 5 * 8) / #TABS
    for i, t in ipairs(TABS) do
        local tx = ix + (i - 1) * (tw + 8)
        if skin.Chip(tx, iy - 8, tw, 40, M.tab == i) then
            M.tab, M.rebinding = i, nil
            keys.Capturing = false
            if i == 6 then slots = nil; slotsAt = -100 end
        end
        ui.text(tx + tw / 2, iy + 2, t, { size = 17, font = "h2", color = M.tab == i and skin.GoldBright or skin.Text, align = "center" })
    end
    -- obsah karty v posuvné oblasti (kolečko myši / tažení lišty), tlačítka dole pevně mimo ni
    local by = iy + ih - 50
    local top, bottom = iy + 40, by - 14
    local viewH = bottom - top
    local off = scroll[M.tab] or 0
    viewTop, viewBottom = top, bottom
    ui.clip(ix - 4, top, iw + 8, viewH)
    cx, cy, cw = ix, top + 4 - off, iw - 22
    if M.tab == 1 then graphicsTab()
    elseif M.tab == 2 then displayTab()
    elseif M.tab == 3 then soundTab()
    elseif M.tab == 4 then controlsTab()
    elseif M.tab == 5 then modsTab()
    else charactersTab(boot) end
    ui.pop_clip()
    viewTop, viewBottom = 0, H
    local contentH = cy + off - top + 8
    local maxOff = math.max(0, contentH - viewH)
    local mx, my = ui.mouse()
    if mx >= x and mx <= x + w and my >= top and my <= bottom then
        local wheel = input.wheel()
        if wheel ~= 0 then off = off - wheel * 70 end
    end
    if maxOff > 0 then
        -- lišta vpravo: táhlo odpovídá viditelné části
        local tx, tw2 = ix + iw - 10, 8
        local th = math.max(40, viewH * viewH / contentH)
        local ty = top + (viewH - th) * (off / maxOff)
        ui.rect(tx, top, tw2, viewH, "#00000055", 4)
        ui.rect(tx, ty, tw2, th, "#c9a45caa", 4)
        if input.key("Mouse1") and mx >= tx - 8 and mx <= tx + tw2 + 8 and my >= top and my <= bottom then
            off = (my - top - th / 2) / math.max(1, viewH - th) * maxOff
        end
        -- jemný přechod naznačí, že obsah pokračuje
        if off < maxOff - 1 then ui.text(ix + iw / 2, bottom - 22, "↓", { size = 20, color = skin.Muted, align = "center" }) end
    end
    scroll[M.tab] = math.max(0, math.min(maxOff, off))
    M.scrollMax = maxOff
    -- spodní lišta
    if skin.Button(ix, by, 280, 50, "ZPĚT DO HRY", true) then M.Toggle() end
    if skin.Button(ix + iw - 420, by, 200, 50, "Odhlásit se") then M.open = false; boot.SignOut(); boot.Reload() end
    if skin.Button(ix + iw - 200, by, 200, 50, "Ukončit hru") then game.quit() end
end

-- Samotest: otevřít kartu
function M.TestOpen(tab, scrollTo)
    M.open, M.tab = true, tab
    scroll[tab] = scrollTo or 0
    if tab == 6 then
        slots = { max = 4, active = { id = "a", name = "Tester", class = "hoplit", faction = "kalidra", level = 3, appearance = { gender = "m" } },
                  others = { { id = "b", name = "Kassandra", class = "vestec", faction = "legie", level = 5, appearance = { gender = "f" } } } }
    end
end

return M

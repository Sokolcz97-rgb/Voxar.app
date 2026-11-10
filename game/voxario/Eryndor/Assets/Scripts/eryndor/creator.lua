-- Tvorba postavy Eryndoru: rasa (modely z obrázků dokumentace přes Meshy), povolání, jméno,
-- tvar těla (výška, končetiny, ramena, svaly, hlava), barevný nádech a magická záře.
-- Náhled se otáčí (tažení myší / A, D), u záložky Vzhled se kamera přiblíží k obličeji.
local races = require("eryndor.races")
local combat = require("eryndor.combat")
local map = require("eryndor.map")
local M = { rot = 0, tab = "race", dirty = true, enter = false }

local GOLD, TEXT, DIM = "#d8b25a", "#efe6d2", "#a8a090"
local KEY, CHARACTERS_KEY, ACTIVE_KEY = "eryndor.character2", "eryndor.characters", "eryndor.active_character"

function M.Load()
    local saved = settings and settings.get and settings.get(CHARACTERS_KEY)
    M.characters = {}
    if type(saved) == "table" then
        for _, character in ipairs(saved) do M.characters[#M.characters + 1] = races.Sanitize(character) end
    end
    if #M.characters == 0 then
        local legacy = settings and settings.get and settings.get(KEY)
        if type(legacy) == "table" then M.characters[1] = races.Sanitize(legacy) end
    end
    local active = settings and settings.get and settings.get(ACTIVE_KEY) or 1
    M.active = math.max(1, math.min(#M.characters, math.floor(tonumber(active) or 1)))
    M.selected = M.characters[M.active] and M.active or nil
    M.a = M.selected and races.Sanitize(M.characters[M.selected]) or races.Default("clovek")
    M.screen = M.selected and "select" or "editor"
    M.page = 1
    M.dirty, M.rebuild = true, true
end

function M.Save()
    M.a = races.Sanitize(M.a)
    M.characters = M.characters or {}
    if M.selected and M.characters[M.selected] then
        M.characters[M.selected] = races.Sanitize(M.a)
    else
        M.characters[#M.characters + 1] = races.Sanitize(M.a)
        M.selected = #M.characters
    end
    M.active = M.selected
    if settings and settings.set then
        settings.set(CHARACTERS_KEY, M.characters)
        settings.set(ACTIVE_KEY, M.active)
        settings.set(KEY, M.a)
    end
end

function M.New()
    M.returnSelected = M.selected or M.active
    M.a = races.Default("clovek")
    M.selected, M.screen, M.tab = nil, "editor", "race"
    M.rebuild, M.dirty = true, true
end

function M.Select(index)
    if not M.characters[index] then return end
    M.selected, M.active = index, index
    M.a = races.Sanitize(M.characters[index])
    M.screen, M.tab = "select", "race"
    M.rebuild, M.dirty = true, true
    if settings and settings.set then settings.set(ACTIVE_KEY, index) end
end

function M.Delete(index)
    if not M.characters[index] then return end
    table.remove(M.characters, index)
    if #M.characters == 0 then
        M.selected, M.active = nil, 0
        M.New()
        if settings and settings.set then
            settings.set(CHARACTERS_KEY, {})
            settings.set(ACTIVE_KEY, nil)
            settings.set(KEY, nil)
        end
        return
    end
    if M.active > index then M.active = M.active - 1
    elseif M.active == index then M.active = math.min(index, #M.characters) end
    M.active = math.max(1, M.active or 1)
    M.Select(M.active)
    M.Save()
end

local function cls() return combat.Classes[M.a.cls] or combat.Classes[1] end

-- ------------------------------------------------------------------ náhled
local function spot()
    local x, z = map.Start.x - 24, map.Start.z - 3
    return x, map.HeightAt(x, z), z
end

function M.Respawn()
    if M.preview then entity.destroy(M.preview) end
    for _, w in ipairs(M.items or {}) do entity.destroy(w) end
    local x, y, z = spot()
    local c = cls()
    M.preview, M.items = races.Spawn(M.a, x, y, z, { yaw = 180 + M.rot, name = "Náhled", right = c.look.right, left = c.look.left })
    M.Pose(M.pose or "Idle")
    M.rebuild = false
end

function M.Pose(clip)
    M.pose = clip
    if not M.preview then return end
    local loop = clip == "Idle" or clip == "Walking_A" or clip == "Running_A" or clip == "Running_B" or clip == "Spellcasting"
    anim.play(M.preview, require("eryndor.player").Clip(clip, cls(), M.a), 0.15, loop, true)
    M.poseEnd = (not loop) and game.time() + 1.8 or nil
end

function M.Camera()
    local x, y, z = spot()
    local h = M.a.height
    if M.tab == "look" or M.tab == "face" then
        local hy = y + 1.45 * h
        eryndor.LookFrom(x + 0.6 * h, hy + 0.05, z - 1.7 * h, x + 0.36 * h, hy - 0.1, z)
    else
        local d = 2.5 + 1.0 * h
        eryndor.LookFrom(x + 0.95 * h, y + 1.15 * h, z - d, x + 0.62 * h, y + 0.92 * h, z)
    end
end

function M.Show()
    M.Load()
    M.Respawn()
    M.Camera()
    M.ApplyLight()
end

function M.Hide()
    for _, l in ipairs(M.lights or {}) do entity.destroy(l) end
    M.lights = {}
    if not game.selftest() then _G.world.environment({ day_length = 60 }) end   -- ve hře zase běží den a noc
    if M.preview then entity.destroy(M.preview); M.preview = nil end
    for _, w in ipairs(M.items or {}) do entity.destroy(w) end
    M.items = {}
end

function M.Update(dt)
    if not M.preview then return end
    if M.rebuild then M.Respawn() elseif M.dirty then races.Apply(M.preview, M.a) end
    M.dirty = false
    if M.poseEnd and game.time() > M.poseEnd then M.Pose("Idle") end
    if not ui.wants_keyboard() then
        if input.key("Left") or input.key("A") then M.rot = M.rot - 90 * dt end
        if input.key("Right") or input.key("D") then M.rot = M.rot + 90 * dt end
    end
    if M.drag and input.key("Mouse1") then
        local dx = input.mouse_delta()
        M.rot = M.rot + dx * 0.4
    else
        M.drag = false
    end
    entity.set_rotation(M.preview, 0, 180 + M.rot, 0)
    M.Camera()
end

-- ------------------------------------------------------------------ UI
local function slider(label, key, lo, hi, fmt)
    ui.label(label, DIM)
    ui.item_width(-1)
    local v, ch = ui.slider("##" .. key, M.a[key], lo, hi, fmt or "%.2f")
    if ch then M.a[key] = v; M.dirty = true end
end

local function color(label, key, presets)
    local c, ch = ui.color(label .. "##" .. key, M.a[key])
    if ch then M.a[key] = c; M.dirty = true end
    for i, h in ipairs(presets or {}) do
        ui.same_line()
        if ui.swatch("##" .. key .. i, h, 24) then M.a[key] = races.Hex(h); M.dirty = true end
    end
end

-- hex kód barvy (#rrggbb)
local function hexInput(key)
    local c = M.a[key]
    local cur = string.format("#%02x%02x%02x", math.floor(c[1] * 255 + 0.5), math.floor(c[2] * 255 + 0.5), math.floor(c[3] * 255 + 0.5))
    ui.item_width(140)
    local txt, ch = ui.input("Hex##hex" .. key, cur, { max = 7 })
    if ch and txt:match("^#%x%x%x%x%x%x$") then M.a[key] = races.Hex(txt); M.dirty = true end
end

-- osvětlení scény tvorby postavy: denní doba + studiová světla (postava ve dne i v noci)
M.light = { mode = 1, time = 16.0, studio = true }
M.LightModes = { { "Den", 13.0 }, { "Zlatá hodina", 18.2 }, { "Soumrak", 19.6 }, { "Noc", 23.0 } }
local function applyLight()
    _G.world.environment({ time_of_day = M.light.time, day_length = 0 })
    for _, l in ipairs(M.lights or {}) do entity.destroy(l) end
    M.lights = {}
    if M.light.studio and M.preview then
        local x, y, z = spot()
        local night = M.light.time > 19.2 or M.light.time < 5.5
        M.lights[#M.lights + 1] = _G.world.spawn("light", x + 1.6, y + 2.4, z - 1.8,
            { light = { color = { 1.0, 0.86, 0.7 }, intensity = night and 30 or 12, range = 7 } })     -- hlavní světlo
        M.lights[#M.lights + 1] = _G.world.spawn("light", x - 1.4, y + 2.0, z + 1.4,
            { light = { color = { 0.55, 0.7, 1.0 }, intensity = night and 22 or 9, range = 6 } })      -- kontra (obrys)
    end
end
M.ApplyLight = applyLight

local function tab(id, title, fn)
    local force = M.forceTab == id
    if force then M.forceTab = nil end
    if ui.tab(title, force) then
        M.tab = id
        fn()
        ui.end_tab()
    end
end

local function pickRace(r)
    local keep = { name = M.a.name, cls = M.a.cls }
    M.a = races.Default(r); M.a.name, M.a.cls = keep.name, keep.cls
    M.rebuild = true
end

local function randomize()
    local r = races.Order[math.random(#races.Order)]
    pickRace(r)
    local a = M.a
    a.height = a.height * (0.94 + math.random() * 0.12)
    for _, k in ipairs({ "limbs", "shoulders", "muscle", "head" }) do a[k] = a[k] + (math.random() - 0.5) * 0.16 end
    a.tint = races.Hex(races.Tints[math.random(#races.Tints)]); a.tintAmount = math.random() * 0.5
    M.a = races.Sanitize(a)
end

function M.Draw()
    if M.screen == "select" then
        local sw, sh = ui.screen()
        local count = #M.characters
        local visible = math.max(1, math.floor((sh - 250) / 96))
        local pages = math.max(1, math.ceil(count / visible))
        M.page = math.max(1, math.min(M.page or 1, pages))
        ui.vignette(0.5)
        ui.font("title"); ui.text(sw / 2, 24, "ERYNDOR", { align = "center", color = GOLD, shadow = true }); ui.pop_font()
        ui.font("body"); ui.text(sw / 2, 80, "Vyber svou Ozvěnu", { align = "center", color = DIM, shadow = true }); ui.pop_font()
        ui.window("Postavy", 24, 120, 570, sh - 144, { title = false, move = false, resize = false, font = "panel", font_size = 27 }, function()
            ui.font("h2"); ui.label("Tvé postavy", GOLD); ui.pop_font()
            for row = 1, visible do
                local index = (M.page - 1) * visible + row
                local character = M.characters[index]
                if character then
                    local race = races.Defs[character.race]
                    local y = 172 + (row - 1) * 92
                    local chosen = M.selected == index
                    ui.rect(42, y, 526, 78, chosen and "#3a2c18d8" or "#10131bd8", 5)
                    ui.rect(42, y, 4, 78, chosen and GOLD or "#59606b", 0)
                    ui.font("body")
                    ui.text(58, y + 8, character.name ~= "" and character.name or (race.name .. " Ozvěna"),
                        { color = chosen and "#ffe6a0" or TEXT, shadow = true })
                    ui.pop_font()
                    ui.font("small")
                    ui.text(58, y + 42, race.name .. "  ·  " .. combat.Classes[character.cls].name, { color = DIM })
                    ui.pop_font()
                    if ui.button_at(356, y + 20, 84, 36, chosen and "Vybráno" or "Vybrat") then M.Select(index) end
                    if ui.button_at(448, y + 20, 52, 36, "Upr.") then
                        M.Select(index); M.screen = "editor"
                    end
                    if ui.button_at(506, y + 20, 52, 36, "Smaz.") then M.deleteConfirm = index end
                end
            end
            if pages > 1 then
                if ui.button_at(42, sh - 104, 100, 34, "Předchozí") then M.page = math.max(1, M.page - 1) end
                ui.font("small"); ui.text(300, sh - 98, M.page .. " / " .. pages, { align = "center", color = DIM }); ui.pop_font()
                if ui.button_at(458, sh - 104, 100, 34, "Další") then M.page = math.min(pages, M.page + 1) end
            end
        end)
        ui.window("Dobrodruh", sw - 480, 150, 440, 290, { title = false, move = false, resize = false, font = "panel", font_size = 27 }, function()
            local race = races.Defs[M.a.race]
            ui.font("h2"); ui.label(M.a.name ~= "" and M.a.name or (race.name .. " Ozvěna"), GOLD); ui.pop_font()
            ui.font("body"); ui.text_wrapped(race.name .. "  ·  " .. combat.Classes[M.a.cls].name, TEXT); ui.pop_font()
            ui.spacing()
            ui.text_wrapped(race.desc, DIM)
        end)
        if ui.button_at(sw - 460, 466, 200, 46, "Vytvořit postavu") then M.New() end
        if ui.button_at(sw - 250, 466, 200, 46, "Vstoupit do Eryndoru") then M.Save(); M.enter = true end
        if M.deleteConfirm then
            local character = M.characters[M.deleteConfirm]
            ui.window("Smazání postavy", sw / 2 - 220, sh / 2 - 100, 440, 210, { title = false, move = false, resize = false }, function()
                ui.text_wrapped("Opravdu smazat postavu „" .. (character and character.name or "") .. "“? Tuto akci nelze vrátit.", TEXT)
                if ui.button("Smazat", 150, 40) then M.Delete(M.deleteConfirm); M.deleteConfirm = nil end
                ui.same_line()
                if ui.button("Zrušit", 150, 40) then M.deleteConfirm = nil end
            end)
        end
        return
    end
    local sw, sh = ui.screen()
    local d = races.Defs[M.a.race]
    ui.vignette(0.45)
    ui.font("title"); ui.text(sw / 2 + 210, 26, "ERYNDOR", { align = "center", color = GOLD, shadow = true }); ui.pop_font()
    ui.font("body"); ui.text(sw / 2 + 210, 86, "Tvorba postavy – Velký Rozkol", { align = "center", color = DIM, shadow = true }); ui.pop_font()

    ui.window("Tvorba postavy", 24, 24, 480, sh - 48, { title = false, move = false, resize = false, font = "panel", font_size = 27 }, function()
        ui.font("h2"); ui.label("Ozvěna – tvoje postava", GOLD); ui.pop_font()
        if ui.button("Zpět na výběr", 190, 36) then
            if M.selected then
                M.Save(); M.screen = "select"
            elseif #M.characters > 0 then
                M.Select(math.max(1, math.min(M.returnSelected or M.active or 1, #M.characters)))
            end
        end
        ui.spacing()
        ui.item_width(-1)
        local n, ch = ui.input("##name", M.a.name, { hint = "Jméno postavy", max = 24 })
        if ch then M.a.name = n end
        ui.separator()
        if ui.begin_tabs("##tabs") then
            tab("race", "Rasa", function()
                for _, r in ipairs(races.Order) do
                    if ui.selectable(races.Defs[r].name .. "  ·  " .. races.Defs[r].tag, M.a.race == r) and M.a.race ~= r then pickRace(r) end
                end
                ui.spacing()
                ui.text_wrapped(d.desc, DIM)
                if d.variants then
                    ui.label("Srst / vzhled", GOLD)
                    for i, v in ipairs(d.variants) do
                        if ui.selectable(v[2], M.a.variant == i) and M.a.variant ~= i then M.a.variant = i; M.rebuild = true end
                    end
                end
                ui.spacing()
                ui.label("Povolání (boj a dovednosti)", GOLD)
                local names = {}
                for i, c in ipairs(combat.Classes) do names[i] = c.name .. " (" .. c.faction .. ")" end
                ui.item_width(-1)
                local i, chc = ui.combo("##cls", M.a.cls, names)
                if chc then M.a.cls = i; M.rebuild = true end
                ui.text_wrapped(cls().desc, DIM)
            end)
            tab("body", "Tělo", function()
                ui.label("Morfologie těla", GOLD)
                slider("Výška", "height", 0.7, 1.4)
                slider("Délka končetin", "limbs", 0.85, 1.18)
                slider("Šířka ramen", "shoulders", 0.82, 1.28)
                slider("Svalová hmota", "muscle", 0.8, 1.3)
                slider("Velikost hlavy", "head", 0.85, 1.2)
            end)
            tab("face", "Obličej", function()
                ui.label("Obličejové rysy", GOLD)
                slider("Velikost očí", "eyes", 0.6, 1.6)
                slider("Rozestup očí", "eyeGap", -0.015, 0.015, "%.3f m")
                slider("Velikost nosu", "nose", 0.5, 1.9)
                slider("Délka nosu", "noseLen", -0.02, 0.03, "%.3f m")
                slider("Šířka čelisti", "jaw", 0.7, 1.45)
                slider("Velikost hlavy", "head", 0.85, 1.2)
            end)
            tab("look", "Vzhled", function()
                ui.label("Barevný nádech", GOLD)
                color("Barva", "tint", races.Tints)
                hexInput("tint")
                slider("Síla nádechu", "tintAmount", 0, 1)
                ui.spacing()
                ui.label("Výbava rasy", GOLD)
                local gv, gch = ui.checkbox("Zbraně a zbroj rasy##gear", M.a.gear ~= false)
                if gch then M.a.gear = gv; M.rebuild = true end
                local gd = races.Gear[M.a.race]
                if gd then ui.text_wrapped(M.a.gear ~= false and gd.label or "Zbraně podle povolání", DIM) end
                ui.spacing()
                ui.label("Magická záře (Aetherium)", GOLD)
                color("Barva záře", "glowColor", { "#7fdfff", "#b06cff", "#ff8a3a", "#7dff9a" })
                hexInput("glowColor")
                slider("Síla záře", "glow", 0, 1)
                ui.spacing()
                ui.label("Osvětlení scény", GOLD)
                for i, lm in ipairs(M.LightModes) do
                    if i > 1 then ui.same_line() end
                    if ui.selectable(lm[1] .. "##lm" .. i, M.light.mode == i, 0) then M.light.mode = i; M.light.time = lm[2]; applyLight() end
                end
                ui.item_width(-1)
                local lt, lch = ui.slider("##denni_doba", M.light.time, 0, 24, "denní doba %.1f h")
                if lch then M.light.time = lt; M.light.mode = 0; applyLight() end
                local st, sch = ui.checkbox("Studiová světla", M.light.studio)
                if sch then M.light.studio = st; applyLight() end
            end)
            ui.end_tabs()
        end
        ui.spacing(); ui.separator()
        if ui.button("Náhodně", 140, 36) then randomize() end
        ui.same_line()
        if ui.button("Výchozí", 140, 36) then pickRace(M.a.race) end
    end)

    -- animace náhledu
    local poses = { { "Klid", "Idle" }, { "Chůze", "Walking_A" }, { "Běh", "Running_A" }, { "Sprint", "Running_B" }, { "Útok", cls().skills[1].anim },
                    { "Kouzlo", "Spellcast_Shoot" }, { "Radost", "Cheer" } }
    local bx = sw / 2 + 250 - (#poses * 120) / 2
    for i, p in ipairs(poses) do
        if ui.button_at(bx + (i - 1) * 120, sh - 150, 110, 34, p[1]) then M.Pose(p[2]) end
    end
    ui.font("small"); ui.text(sw / 2 + 250, sh - 108, "Táhni myší nebo A / D = otočit postavu", { align = "center", color = DIM, shadow = true }); ui.pop_font()

    if ui.button_at(sw - 300, sh - 84, 270, 52, "Vstoupit do Eryndoru") then
        if M.a.name == "" then M.a.name = d.name:match("^(%S+)") .. " Ozvěna" end
        M.Save()
        M.enter = true
    end
    if ui.button_at(sw - 590, sh - 84, 270, 52, "Uložit postavu") then
        M.Save()
        M.screen = "select"
    end
    ui.font("h1"); ui.text(sw - 165, 30, d.name, { align = "center", color = GOLD, shadow = true }); ui.pop_font()
    ui.font("small"); ui.text(sw - 165, 66, cls().name, { align = "center", color = TEXT, shadow = true }); ui.pop_font()

    if not ui.wants_mouse() and input.pressed("Mouse1") then M.drag = true end
end

return M

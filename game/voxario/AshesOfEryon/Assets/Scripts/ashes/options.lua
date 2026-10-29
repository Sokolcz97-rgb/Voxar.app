-- Nastavení hry (GameUI.Settings): Zobrazení, Grafika, Zvuk, Ovládání, Účet. Otevírá Esc.
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")
local sound = require("ashes.sound")

local M = { open = false, rebinding = nil }

local QUALITY = { "Nízká", "Střední", "Vysoká", "Ultra" }
local SHADOWS = { "off", "low", "medium", "high", "ultra" }
local SHADOW_NAMES = { "Vypnuté", "Nízké", "Střední", "Vysoké", "Ultra" }

-- Uložené nastavení grafiky -> engine (volá se při startu)
function M.Apply()
    graphics.vsync(settings.get("gfx.vsync", true))
    graphics.render_scale(settings.get("gfx.scale", 1.0))
    graphics.shadows(settings.get("gfx.shadows", "high"))
    graphics.view_distance(settings.get("gfx.view", 1.0))
    graphics.dlss(settings.get("gfx.dlss", true))
    graphics.dlss_quality(settings.get("gfx.dlss_quality", "balanced"))
    if settings.get("gfx.fullscreen", false) then graphics.fullscreen(true) end
end

function M.Toggle()
    M.open = not M.open
    M.rebinding = nil
    keys.Capturing = false
end

local function idx(list, value)
    for i, v in ipairs(list) do if v == value then return i end end
    return 1
end

function M.Draw(boot)
    if not M.open then return end
    local W, H = ui.screen()
    ui.fade(0.55)
    -- zachytávání nové klávesy
    if M.rebinding then
        keys.Capturing = true
        local k = input.any()
        if k == "Escape" then M.rebinding = nil; keys.Capturing = false
        elseif k then keys.Set(M.rebinding, k); M.rebinding = nil; keys.Capturing = false end
    end
    local w, h = 980, 700
    ui.window("Nastavení", (W - w) / 2, (H - h) / 2, w, h, { font = "body", font_size = 22, scroll = false, image = "Textures/ui/panel.png", image_border = 16, border = 16 }, function()
        if ui.begin_tabs("settings") then
            if ui.tab("Zobrazení") then
                local full = ui.checkbox("Celá obrazovka", graphics.fullscreen())
                if full ~= graphics.fullscreen() then graphics.fullscreen(full); settings.set("gfx.fullscreen", full) end
                local vs = ui.checkbox("Svislá synchronizace (VSync)", graphics.vsync())
                if vs ~= graphics.vsync() then graphics.vsync(vs); settings.set("gfx.vsync", vs) end
                local modes = graphics.resolutions()
                if #modes > 0 and not graphics.fullscreen() then
                    local names, cur = {}, 1
                    local cw, ch = graphics.resolution()
                    for i, m in ipairs(modes) do
                        names[i] = m[1] .. " × " .. m[2]
                        if m[1] == cw and m[2] == ch then cur = i end
                    end
                    ui.item_width(320)
                    local sel, changed = ui.combo("Rozlišení okna", cur, names)
                    if changed then graphics.resolution(modes[sel][1], modes[sel][2]) end
                end
                ui.end_tab()
            end
            if ui.tab("Grafika") then
                ui.item_width(320)
                local q, qc = ui.combo("Kvalita krajiny (po restartu)", settings.get("gfx.quality", 2) + 1, QUALITY)
                if qc then settings.set("gfx.quality", q - 1) end
                ui.item_width(320)
                local s, sc = ui.combo("Stíny", idx(SHADOWS, graphics.shadows()), SHADOW_NAMES)
                if sc then graphics.shadows(SHADOWS[s]); settings.set("gfx.shadows", SHADOWS[s]) end
                ui.item_width(320)
                local v, vc = ui.slider("Dohled", graphics.view_distance(), 0.5, 2.0, "%.1f×")
                if vc then graphics.view_distance(v); settings.set("gfx.view", v) end
                local on, available = graphics.dlss()
                if available then
                    local d = ui.checkbox("NVIDIA DLSS", on)
                    if d ~= on then graphics.dlss(d); settings.set("gfx.dlss", d) end
                    local qs = { "ultra_performance", "performance", "balanced", "quality", "dlaa" }
                    local qn = { "Ultra výkon", "Výkon", "Vyvážené", "Kvalita", "DLAA" }
                    ui.item_width(320)
                    local dq, dqc = ui.combo("Kvalita DLSS", idx(qs, graphics.dlss_quality()), qn)
                    if dqc then graphics.dlss_quality(qs[dq]); settings.set("gfx.dlss_quality", qs[dq]) end
                else
                    ui.label("DLSS není na této grafické kartě k dispozici.", skin.Muted)
                    ui.item_width(320)
                    local rs, rsc = ui.slider("Měřítko vykreslování", graphics.render_scale(), 0.5, 1.0, "%.2f")
                    if rsc then graphics.render_scale(rs); settings.set("gfx.scale", rs) end
                end
                local info = graphics.info()
                ui.spacing(10)
                ui.label(string.format("%s  ·  %.0f FPS  ·  %d × %d", info.gpu or "", info.fps or 0, info.render_width or 0, info.render_height or 0), skin.Muted)
                ui.end_tab()
            end
            if ui.tab("Zvuk") then
                ui.item_width(360)
                local m, mc = ui.slider("Celková hlasitost", settings.get("audio.master", 1), 0, 1, "%.2f")
                if mc then settings.set("audio.master", m); sound.ApplyVolumes() end
                ui.item_width(360)
                local mu, muc = ui.slider("Hudba", sound.MusicVolume(), 0, 1, "%.2f")
                if muc then sound.MusicVolume(mu); sound.ApplyVolumes() end
                ui.item_width(360)
                local sf, sfc = ui.slider("Efekty", sound.SfxVolume(), 0, 1, "%.2f")
                if sfc then sound.SfxVolume(sf); sound.ApplyVolumes(); sound.Play("click") end
                local mute = ui.checkbox("Ztlumit vše", settings.get("audio.mute", false))
                if mute ~= settings.get("audio.mute", false) then settings.set("audio.mute", mute); sound.ApplyVolumes() end
                if sound.nowPlaying then ui.label("Hraje: " .. sound.nowPlaying, skin.Muted) end
                ui.end_tab()
            end
            if ui.tab("Ovládání") then
                if ui.begin_list("binds", 0, 470) then
                    local group
                    for _, b in ipairs(keys.All) do
                        if b[3] ~= group then
                            group = b[3]
                            ui.spacing(4)
                            ui.label(string.upper(group), skin.Gold)
                        end
                        ui.label(b[2])
                        ui.same_line(420)
                        local label = M.rebinding == b[1] and "Stiskni klávesu…" or keys.Label(b[1])
                        if ui.button(label .. "##" .. b[1], 200, 0) then M.rebinding = b[1] end
                        local conflict = keys.Conflict(b[1])
                        if conflict then ui.same_line(); ui.label("kolize: " .. conflict, skin.Ember) end
                    end
                    ui.end_list()
                end
                if ui.button("Obnovit výchozí", 260, 0) then keys.ResetAll() end
                ui.end_tab()
            end
            if ui.tab("Účet") then
                local api = require("ashes.api")
                ui.label("Přihlášen: " .. api.Email())
                ui.spacing(10)
                if ui.button("Odhlásit se", 260, 0) then M.open = false; boot.SignOut(); boot.Reload() end
                ui.same_line()
                if ui.button("Ukončit hru", 260, 0) then game.quit() end
                ui.end_tab()
            end
            ui.end_tabs()
        end
        ui.cursor(w / 2 - 150, h - 76)
        if ui.button("POKRAČOVAT", 300, 48) then M.Toggle() end
    end)
end

return M

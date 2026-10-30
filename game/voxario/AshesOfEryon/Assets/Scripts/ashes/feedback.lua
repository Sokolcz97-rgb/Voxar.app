-- Hlášení chyb a nápadů přímo ze hry (Feedback.cs, F1). K textu se přidá verze hry, poloha, oblast,
-- úroveň postavy a grafika, aby šla chyba snadno dohledat.
local api = require("ashes.api")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")

local M = { open = false }
local boot, player, minimap
local busy, kind, text, msg, msgOk = false, "bug", "", nil, false

M.Version = "0.11.0-beta.9"

function M.Build(b, p, mm) boot, player, minimap = b, p, mm end
function M.IsOpen() return M.open end
function M.Close() M.open = false end

function M.Update()
    if not boot or not boot.inWorld then M.open = false; return end
    if keys.Down("feedback") and (M.open or not boot.typing) then M.open, msg, M.focus = not M.open, nil, true end
end

local function context()
    local x, _, z = player.Position()
    local ch = (boot.state and boot.state.character) or {}
    local info = graphics.info()
    return {
        version = M.Version, x = math.floor(x * 10 + 0.5) / 10, z = math.floor(z * 10 + 0.5) / 10,
        region = minimap.RegionName(x, z), level = ch.level or 0, faction = ch.faction or "",
        gpu = tostring(info.gpu or "") .. " · Vulkan" .. (info.upscaler and (" · " .. tostring(info.upscaler)) or ""),
        os = game.platform and game.platform() or "", fps = math.floor((info.fps or 0) + 0.5), engine = "Voxario",
    }
end

local function send()
    busy = true
    api.Rpc("ashes_feedback_send", { p_kind = kind, p_text = text:match("^%s*(.-)%s*$"), p_context = context() }, function(_, err)
        busy = false
        if err then msg, msgOk = err, false; return end
        msg, msgOk, text = "Díky! Hlášení dorazilo vývojářům.", true, ""
        boot.sound.Play("quest", 0.5)
    end)
end

function M.Draw(W, H)
    if not M.open then return end
    ui.fade(0.45)
    local x, y, w, h = W / 2 - 400, H / 2 - 270, 800, 540
    local ix, iy, iw, ih = skin.Panel(x, y, w, h, "Hlášení pro vývojáře")
    ui.text(ix, iy, "Narazil jsi na chybu nebo máš nápad? Napiš, co se stalo. Verzi hry, polohu, oblast, úroveň a grafiku přidáme automaticky.",
        { size = 17, font = "body", color = skin.Muted, wrap = iw })
    local ty = iy + 52
    for i, k in ipairs({ { "bug", "Chyba" }, { "idea", "Nápad" }, { "other", "Jiné" } }) do
        local cx = ix + (i - 1) * 190
        if skin.Chip(cx, ty, 180, 38, kind == k[1]) then kind = k[1] end
        ui.text(cx + 90, ty + 9, k[2], { size = 17, font = "h2", color = skin.Text, align = "center" })
    end
    -- víceřádkové pole (ImGui) v průhledném okně přes panel
    ui.window("##feedback", ix, ty + 50, iw, 270, { title = false, move = false, resize = false, scroll = false, background = false, font = "body", font_size = 21 }, function()
        local t = ui.input("##text", text, { multiline = true, height = 250, width = iw - 30, max = 4000, focus = M.focus, hint = "Co se stalo…" })
        text = t or text
        M.focus = false
    end)
    if msg then ui.text(ix, iy + ih - 100, msg, { size = 19, font = "bold", color = msgOk and skin.Good or skin.Ember }) end
    if skin.Button(ix, iy + ih - 50, 200, 46, "Zavřít (Esc)") then M.open = false end
    local ok = not busy and #(text:match("^%s*(.-)%s*$")) >= 5
    if skin.Button(ix + iw - 260, iy + ih - 52, 260, 50, busy and "Odesílám…" or "ODESLAT", true, ok) then send() end
end

return M

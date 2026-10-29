-- Módy (Mods/ModManager.cs, ModApi.cs, ModSamples.cs): doplňky v Lua ve složce
-- Dokumenty/Ashes of Eryon/Mods/<mód>/ (mod.json + main.lua). Běží v sandboxu enginu (voxario.mods),
-- tabulky eryon a ui mají stejná jména a parametry jako v Unity verzi, takže staré módy fungují dál.
-- Zapnutí a vypnutí je v Nastavení → Módy, F8 je načte znovu.
local mods = require("voxario.mods")
local skin = require("ashes.skin")

local M = { list = {} }
local boot, player, minimap, hud
local toasts, console = {}, {}
M.Folder = (fs.documents() or ".") .. "/Ashes of Eryon/Mods"

local function log(info, s)
    console[#console + 1] = "[" .. tostring(info.name or info.id) .. "] " .. s
    if #console > 8 then table.remove(console, 1) end
    game.log("[Mod " .. tostring(info.id) .. "] " .. s)
end

function M.Toast(s) toasts[#toasts + 1] = { tostring(s), game.time() + 5 } end

local COLORS = { gold = skin.GoldBright, text = skin.Text, muted = skin.Muted, ember = skin.Ember, blood = skin.Blood, good = skin.Good, sky = skin.Sky }
local function color(c, def) if c == nil then return def end return COLORS[c] or c end
-- názvy kláves z Unity (KeyCode) → engine
local KEYMAP = { LeftShift = "Shift", RightShift = "Shift", LeftControl = "Ctrl", RightControl = "Ctrl", LeftAlt = "Alt", RightAlt = "Alt",
    Return = "Enter", KeypadEnter = "Enter", Mouse0 = "Mouse1", Mouse1 = "Mouse2", Mouse2 = "Mouse3", UpArrow = "Up", DownArrow = "Down",
    LeftArrow = "Left", RightArrow = "Right", BackQuote = "Grave" }
local function keyName(k)
    k = tostring(k or "")
    if #k == 1 then return k:upper() end
    if k:match("^Alpha%d$") then return k:sub(6) end
    if k:match("^Keypad%d$") then return "Num" .. k:sub(7) end
    return KEYMAP[k] or k
end

local function n(v, def) return tonumber(v) or def end

-- API pro jeden mód
local function eryonApi(info)
    return {
        print = function(...)
            local parts = {}
            for i = 1, select("#", ...) do parts[#parts + 1] = tostring(select(i, ...)) end
            log(info, table.concat(parts, " "))
        end,
        notify = function(text) M.Toast(text) end,
        on = function(event, fn)
            if type(fn) ~= "function" then error("eryon.on: očekávám funkci", 2) end
            mods.on(info, tostring(event), fn)
        end,
        time = function() return game.time() end,
        mod = function() return info.id end,
        save = function(k, v) settings.set("mod." .. info.id .. "." .. tostring(k), tostring(v)) end,
        load = function(k, def)
            local v = settings.get("mod." .. info.id .. "." .. tostring(k), nil)
            if v == nil then return def end
            return v
        end,
        key = function(name) return input.key(keyName(name)) end,
        screen = function() return ui.screen() end,
        player = function()
            local ch = boot.state and boot.state.character
            if not ch then return nil end
            local t = { name = (ch.display_name and ch.display_name ~= "") and ch.display_name or ch.name, class = ch.class,
                faction = ch.faction, level = ch.level, xp = ch.xp or 0, xp_need = ch.xp_need or 0, gold = ch.gold or 0,
                honor = ch.honor or 0, wins = ch.wins or 0, losses = ch.losses or 0, chapter = ch.chapter }
            if player.body then
                local x, _, z = player.Position()
                t.x, t.z, t.region = x, z, minimap.RegionName(x, z)
            end
            return t
        end,
        quests = function()
            local list = {}
            for _, wq in ipairs((boot.state and boot.state.wquests) or {}) do
                local def = hud.QuestDef(wq.quest_id) or {}
                list[#list + 1] = { id = wq.quest_id, state = wq.state, progress = wq.progress or 0, count = def.count or 1,
                    title = def.title or wq.quest_id, objective = def.objective or "" }
            end
            return list
        end,
        replace_player_model = function(file, height)
            local path = mods.safe_path(info, file)
            if not path or not fs.exists(path) then return log(info, "model se nenačetl: " .. tostring(file)) end
            player.ReplaceModel(path, n(height, 1.62))
        end,
        spawn_model = function(file, x, z, size, yaw)
            local path = mods.safe_path(info, file)
            if not path or not fs.exists(path) then return log(info, "model se nenačetl: " .. tostring(file)) end
            x, z = n(x, 0), n(z, 0)
            world.spawn(path, x, require("ashes.worldmap").Ground(x, z), z, { fit = n(size, 2), yaw = n(yaw, 0), name = "Mod " .. info.id })
        end,
    }
end

-- Rozhraní pro mód (jen v události „draw“), souřadnice 1920 × 1080 jako v Unity
local function uiApi(info)
    local function align(a, x, w)
        if a == "center" then return x + w / 2, "center" elseif a == "right" then return x + w, "right" end
        return x, "left"
    end
    return {
        panel = function(x, y, w, h, title) skin.Panel(n(x, 0), n(y, 0), n(w, 300), n(h, 200), title) end,
        text = function(x, y, w, h, text, size, c, a)
            local tx, al = align(a, n(x, 0), n(w, 300))
            ui.text(tx, n(y, 0), tostring(text or ""), { size = n(size, 20), font = "body", color = color(c, skin.Text), align = al, wrap = n(w, 300) })
        end,
        title = function(x, y, w, h, text, size, c)
            ui.text(n(x, 0), n(y, 0), tostring(text or ""), { size = n(size, 22), font = "h2", color = color(c, skin.Gold) })
        end,
        button = function(x, y, w, h, text, kind)
            return skin.Button(n(x, 0), n(y, 0), n(w, 160), n(h, 40), tostring(text or ""), kind == "primary") == true
        end,
        bar = function(x, y, w, h, v, c, label)
            ui.bar(n(x, 0), n(y, 0), n(w, 200), n(h, 20), math.max(0, math.min(1, n(v, 0))), color(c, skin.Good), label and tostring(label) or nil)
        end,
        image = function(x, y, w, h, file)
            local path = mods.safe_path(info, file)
            if path and fs.exists(path) then ui.draw_image(path, n(x, 0), n(y, 0), n(w, 64), n(h, 64)) end
        end,
        ornament = function(x, y, w) skin.Ornament(n(x, 0), n(y, 0) + 5, n(w, 200)) end,
        mouse = function() return ui.mouse() end,
    }
end

-- Při prvním spuštění: složka módů s návodem a ukázkovým módem
local function ensureSamples()
    fs.mkdir(M.Folder)
    local readme = fs.read("Mods/README.txt")
    if readme then fs.write(M.Folder .. "/README.txt", readme) end
    local sample = M.Folder .. "/UkazkaEryon"
    if fs.is_dir(sample) then return end
    fs.mkdir(sample)
    for _, f in ipairs({ "mod.json", "main.lua" }) do
        local text = fs.read("Mods/UkazkaEryon/" .. f)
        if text then fs.write(sample .. "/" .. f, text) end
    end
end

function M.IsEnabled(id) return settings.get("mod.on." .. id, true) ~= false end
function M.SetEnabled(id, on) settings.set("mod.on." .. id, on and true or false); M.Reload() end

function M.Reload()
    M.list = {}
    mods.clear()
    for _, name in ipairs(fs.list(M.Folder) or {}) do
        local root = M.Folder .. "/" .. name
        if fs.is_dir(root) and fs.exists(root .. "/main.lua") then
            local info
            if M.IsEnabled(name) then
                info = mods.load(root)
                info.enabled = true
                if info.error then log(info, "CHYBA: " .. tostring(info.error)) end
            else
                info = { id = name, root = root, enabled = false }
                local j = json.decode(fs.read(root .. "/mod.json") or "") or {}
                if type(j) == "table" then for k, v in pairs(j) do if k ~= "id" then info[k] = v end end end
            end
            info.name = info.name or info.id
            info.version = info.version or "1.0"
            info.author = info.author or "neznámý autor"
            M.list[#M.list + 1] = info
        end
    end
    local on = 0
    for _, m in ipairs(M.list) do if m.enabled and not m.error then on = on + 1 end end
    game.log(string.format("módy: %d (zapnuto %d)", #M.list, on))
    if boot and boot.inWorld then mods.fire("enter_world") end
end

function M.Build(b, p, mm, h)
    boot, player, minimap, hud = b, p, mm, h
    mods.expose("eryon", eryonApi)
    mods.expose("ui", uiApi)
    pcall(ensureSamples)
    M.Reload()
    b.mods = { fire = function(ev, ...) mods.fire(ev, ...) end }
end

function M.Update(dt)
    if input.pressed("F8") then M.Reload(); M.Toast("Módy znovu načteny.") end
    if #M.list == 0 then return end
    mods.fire("update", dt)
    if not boot.typing then
        local t = input.text()
        if t and t ~= "" then mods.fire("key", utf8.char(utf8.codepoint(t, 1)):lower()) end
    end
end

function M.Draw(W, H, allowDraw)
    if allowDraw and #M.list > 0 then mods.fire("draw") end
    local y = 240
    for i = #toasts, 1, -1 do if game.time() > toasts[i][2] then table.remove(toasts, i) end end
    for _, t in ipairs(toasts) do
        ui.panel("Textures/ui/panel.png", W / 2 - 300, y, 600, 46, 12, 16)
        ui.text(W / 2, y + 11, t[1], { size = 21, font = "bold", color = skin.GoldBright, align = "center" })
        y = y + 52
    end
    -- chyby módů vlevo dole (jen prvních 10 minut)
    if game.time() < 600 then
        local errs = {}
        for _, c in ipairs(console) do if c:find("CHYBA") then errs[#errs + 1] = c end end
        local cy = H - 90 - #errs * 22
        for _, c in ipairs(errs) do
            ui.text(20, cy, c, { size = 16, font = "body", color = skin.Ember })
            cy = cy + 22
        end
    end
end

return M

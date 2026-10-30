-- Přenastavitelné klávesy (KeyBinds.cs) – uložené v settings ("ashes.key.<id>")
local M = {}

M.All = {
    { "attack", "Útok", "Boj", "Mouse1" },
    { "skill", "Schopnost", "Boj", "1" },
    { "dodge", "Úskok", "Boj", "Q" },
    { "block", "Krytí (držet)", "Boj", "F" },
    { "run", "Běh (držet)", "Pohyb", "Shift" },
    { "jump", "Skok", "Pohyb", "Space" },
    { "autorun", "Automatický běh", "Pohyb", "R" },
    { "recall", "Návrat do bezpečí", "Pohyb", "T" },
    { "cam_left", "Otočit kameru vlevo", "Pohyb", "Q" },
    { "cam_right", "Otočit kameru vpravo", "Pohyb", "E" },
    { "interact", "Mluvit / použít", "Svět", "E" },
    { "character", "Postava a trénink", "Okna", "C" },
    { "bag", "Batoh a výbava", "Okna", "I" },
    { "chronicle", "Kronika", "Okna", "K" },
    { "map", "Mapa světa", "Okna", "M" },
    { "oddil", "Oddíl", "Okna", "O" },
    { "guide", "Rádce", "Okna", "H" },
    { "feedback", "Nahlásit chybu", "Okna", "F1" },
}

local cache = {}
M.Capturing = false   -- v nastavení se zachytává nová klávesa – akce ve hře se nespouštějí

function M.Get(id)
    if cache[id] then return cache[id] end
    local key
    for _, b in ipairs(M.All) do if b[1] == id then key = b[4] end end
    key = settings.get("ashes.key." .. id, key) or key
    cache[id] = key
    return key
end

function M.Set(id, key)
    cache[id] = key
    settings.set("ashes.key." .. id, key)
end

-- Klávesy z Unity verze 0.10 (launcher je při prvním spuštění předá v ASHES_IMPORT_KEYS „akce=klávesa;…“)
function M.ImportFromLauncher()
    local raw = game.env and game.env("ASHES_IMPORT_KEYS")
    if not raw or raw == "" or settings.get("ashes.keys_imported", false) then return 0 end
    local known, n = {}, 0
    for _, b in ipairs(M.All) do known[b[1]] = true end
    for id, key in raw:gmatch("([%w_]+)=([%w]+)") do
        if known[id] then M.Set(id, key); n = n + 1 end
    end
    settings.set("ashes.keys_imported", true)
    game.log(string.format("Klávesy z Unity verze převzaty (%d)", n))
    return n
end

function M.ResetAll()
    for _, b in ipairs(M.All) do settings.set("ashes.key." .. b[1], nil) end
    cache = {}
end

function M.Down(id)
    if M.Capturing then return false end
    local k = M.Get(id)
    return k ~= nil and input.pressed(k)
end

function M.Held(id)
    if M.Capturing then return false end
    local k = M.Get(id)
    return k ~= nil and input.key(k)
end

-- Jiná akce se stejnou klávesou (kamera se smí překrývat)
function M.Conflict(id)
    if id:sub(1, 3) == "cam" then return nil end
    local k = M.Get(id)
    for _, b in ipairs(M.All) do
        if b[1] ~= id and b[1]:sub(1, 3) ~= "cam" and M.Get(b[1]) == k then return b[2] end
    end
    return nil
end

local NAMES = { Mouse1 = "LMB", Mouse2 = "RMB", Mouse3 = "Kolečko", Mouse4 = "Myš 4", Mouse5 = "Myš 5",
                Space = "Mezerník", Shift = "Shift", Ctrl = "Ctrl", Alt = "Alt", Tab = "Tab", Grave = "`" }
function M.KeyName(k)
    if not k then return "—" end
    if NAMES[k] then return NAMES[k] end
    local num = k:match("^Num(%d)$")
    if num then return "Num " .. num end
    return k
end

function M.Label(id) return M.KeyName(M.Get(id)) end

return M

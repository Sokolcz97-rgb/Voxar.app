-- Chat (Social/Chat.cs): kanál frakce „Svět“ a kanál oddílu. Enter = psát, Tab = přepnout kanál,
-- /o zpráva = do oddílu, /s zpráva = do světa, Esc = zrušit. Zprávy drží server (ashes_chat_send /
-- ashes_chat_recent), který čistí text a hlídá spam; web, Unity i tato verze sdílí stejné kanály.
local api = require("ashes.api")
local skin = require("ashes.skin")

local M = { typing = false }

local messages, lastId, pollAt, lastNews = {}, 0, 0, -100
local sending, draft, oddilChannel, lastActivity = false, "", false, -100
local err, errUntil = nil, 0
local MAX_LEN = 200

local function worldChannel(boot)
    local ch = boot.state and boot.state.character
    return "world:" .. ((ch and ch.faction and ch.faction ~= "") and ch.faction or "kalidra")
end
local function oddilChannelName(boot) return boot.oddilId and ("oddil:" .. boot.oddilId) or nil end

local function add(m)
    m.t = game.time()
    messages[#messages + 1] = m
    if #messages > 80 then table.remove(messages, 1) end
    lastActivity = game.time()
end

local function setError(e) err, errUntil = e, game.time() + 4 end

-- Někdo poslal zprávu (signál přes Realtime) – načíst hned
function M.PollNow() pollAt = 0; lastNews = game.time() end

-- Systémová zpráva (jen u tebe)
function M.System(text) add({ channel = "system", name = "", text = text }) end

local function poll(boot)
    api.Rpc("ashes_chat_recent", { p_after = lastId }, function(rows)
        if type(rows) ~= "table" then return end
        for _, r in ipairs(rows) do
            local id = tonumber(r.id) or 0
            if id > lastId then
                lastId = id
                add({ channel = tostring(r.channel or ""), name = tostring(r.name or ""), tag = r.tag, text = tostring(r.text or ""), mine = r.mine == true })
                if r.mine ~= true and boot.mods then boot.mods.fire("chat", tostring(r.channel or ""):sub(1, 5) == "oddil" and "oddil" or "svet", tostring(r.name or ""), tostring(r.text or "")) end
            end
        end
    end)
end

local function send(boot, text)
    text = text:match("^%s*(.-)%s*$")
    if text == "" then return end
    local channel = (oddilChannel and oddilChannelName(boot)) or worldChannel(boot)
    local cmd, rest = text:match("^/(%a+)%s+(.+)$")
    if cmd == "o" or cmd == "oddil" then
        if not oddilChannelName(boot) then return setError("Nejsi v žádném oddílu.") end
        channel, text = oddilChannelName(boot), rest
    elseif cmd == "s" or cmd == "svet" then
        channel, text = worldChannel(boot), rest
    end
    sending = true
    api.Rpc("ashes_chat_send", { p_channel = channel, p_text = text }, function(_, e)
        sending = false
        if e then setError(e) elseif boot.presence then boot.presence.Signal("chat") end
        M.PollNow()
    end)
end

-- Smaže poslední znak (UTF-8)
local function backspace(s)
    if s == "" then return s end
    local i = #s
    while i > 1 and (s:byte(i) & 0xC0) == 0x80 do i = i - 1 end
    return s:sub(1, i - 1)
end

-- Vrací true, když chat spotřeboval Esc (nemá se otevřít nastavení)
function M.Update(boot, blocked)
    if not boot.inWorld or (not api.SignedIn() and not boot.selftest) then M.typing = false; return false end
    local now = game.time()
    if now > pollAt and not sending and not boot.selftest then
        -- nové zprávy ohlásí Realtime (PollNow), dotaz na server je jen pojistka
        local recent = now - lastNews < 30
        pollAt = now + (M.typing and 2 or recent and 4 or 8)
        poll(boot)
    end
    if not M.typing then
        if (input.pressed("Enter")) and not blocked then
            M.typing, lastActivity = true, now
        end
        return false
    end
    if input.pressed("Escape") then M.typing, draft = false, ""; return true end
    if input.pressed("Enter") then
        if not sending and draft:match("%S") then send(boot, draft) end
        M.typing, draft = false, ""
        return false
    end
    if input.pressed("Tab") then oddilChannel = not oddilChannel and oddilChannelName(boot) ~= nil end
    if input.pressed("Backspace") then draft = backspace(draft) end
    local typed = input.text()
    if typed and typed ~= "" and utf8.len(draft .. typed) and utf8.len(draft .. typed) <= MAX_LEN then draft = draft .. typed end
    lastActivity = now
    return false
end

local function prefixOf(m)
    if m.channel == "system" then return "" end
    local p = ""
    if m.channel:sub(1, 5) == "oddil" then p = "[Oddíl] " end
    if m.tag and m.tag ~= "" then p = p .. "[" .. tostring(m.tag) .. "] " end
    return p .. m.name .. ": "
end

function M.Draw(boot)
    if not boot.inWorld then return end
    local _, H = ui.screen()
    local w, h, x = 560, 260, 18
    local y = H - 64 - h - 44
    local now = game.time()
    local active = M.typing or now - lastActivity < 12
    local alpha = M.typing and 1 or math.max(0, math.min(1, 1 - (now - lastActivity - 10) / 2))
    if active then ui.rect(x, y, w, h + (M.typing and 44 or 0), { 0.03, 0.02, 0.015, 0.55 * alpha }) end
    -- zprávy odspodu
    local size, wrap = 19, w - 20
    local cy = y + h - 6
    for i = #messages, 1, -1 do
        local m = messages[i]
        local a = M.typing and 1 or math.max(0, math.min(1, 1 - (now - m.t - 14) / 3))
        if a > 0 then
            local prefix = prefixOf(m)
            local line = prefix .. m.text
            local _, lh = ui.text_size(line, { size = size, font = "body", wrap = wrap })
            cy = cy - (lh or size)
            if cy < y + 2 then break end
            if m.channel == "system" then
                ui.text(x + 10, cy, line, { size = size, font = "body", wrap = wrap, color = { 0.66, 0.6, 0.54, a } })
            else
                local oddil = m.channel:sub(1, 5) == "oddil"
                local body = oddil and { 0.79, 0.9, 0.71, a } or { 0.93, 0.89, 0.82, a }
                ui.text(x + 10, cy, line, { size = size, font = "body", wrap = wrap, color = body })
                -- jméno přes první řádek jinou barvou (stejné písmo = stejné pozice znaků)
                local nameColor = m.mine and { 0.62, 0.83, 0.94, a } or { 0.94, 0.82, 0.54, a }
                ui.text(x + 10, cy, prefix, { size = size, font = "body", color = nameColor, shadow = false })
            end
        end
    end
    if err and now < errUntil then ui.text(x + 10, y - 26, err, { size = 16, font = "body", color = skin.Ember }) end
    if not M.typing then
        if active then
            ui.text(x + 10, y + h + 4, "Enter – psát   ·   Tab – kanál   ·   /o oddíl",
                { size = 14, font = "caps", color = { 0.66, 0.6, 0.54, alpha } })
        end
        return
    end
    -- vstupní řádek s kanálem
    local onOddil = oddilChannel and oddilChannelName(boot) ~= nil
    ui.panel(onOddil and "Textures/ui/chip_on.png" or "Textures/ui/chip.png", x + 6, y + h + 6, 86, 34, 8, 8)
    ui.text(x + 49, y + h + 13, onOddil and "ODDÍL" or "SVĚT", { size = 15, font = "caps", color = skin.GoldBright, align = "center" })
    ui.rect(x + 98, y + h + 4, w - 104, 38, { 0.05, 0.04, 0.03, 0.9 }, 4)
    ui.rect(x + 98, y + h + 4, w - 104, 38, skin.Gold, 4, false, 1)
    local caret = (math.floor(now * 2) % 2 == 0) and "|" or ""
    local shown = draft
    while #shown > 0 and (ui.text_size(shown, { size = 19, font = "body" }) or 0) > w - 130 do
        shown = shown:sub(2)
        while #shown > 0 and (shown:byte(1) & 0xC0) == 0x80 do shown = shown:sub(2) end
    end
    ui.text(x + 108, y + h + 12, shown .. caret, { size = 19, font = "body", color = skin.Text })
end

-- Pro samotest: ukázkové zprávy
function M.TestFill()
    add({ channel = "world:kalidra", name = "Nikandros", tag = "ŠTÍT", text = "Kdo jde na vrakaře na břeh?" })
    add({ channel = "oddil:x", name = "Ariadna", tag = "ŠTÍT", text = "Sraz u kašny na agoře!" })
    add({ channel = "world:kalidra", name = "Tester", text = "Jdu s vámi.", mine = true })
    M.System("Vítej v Kalidře. Enter – psát, Tab – kanál.")
    M.typing = true
    draft = "Vatra na kopci už hoří"
end

function M.Close() M.typing, draft = false, "" end

return M

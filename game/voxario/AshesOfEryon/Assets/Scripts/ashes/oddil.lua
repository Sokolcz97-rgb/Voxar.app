-- Oddíl (Social/Oddil.cs, klávesa O): založení (od 2. úrovně, 50 zlata), pozvánky, členové a hodnosti
-- (velitel, setník, člen), odchod. Pravidla drží server (ashes_oddil_*). Chat a jmenovky čtou
-- boot.oddilId a boot.oddilTag.
local api = require("ashes.api")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")

local M = { open = false }
local boot, player, presence, chat
local info, invites = nil, {}
local busy, loaded, err, ok = false, false, nil, nil
local form = { name = "", tag = "", motto = "", invite = "" }
local refreshAt, test = 0, false

local ROLE = { velitel = "Velitel", setnik = "Setník", clen = "Člen" }

function M.Build(b, p, pr, c) boot, player, presence, chat = b, p, pr, c end
function M.IsOpen() return M.open end
function M.Close() M.open, test = false, false end

local function apply(r)
    local before = boot.oddilTag
    info = (type(r) == "table" and type(r.oddil) == "table" and r.oddil.id and r.oddil.id ~= "") and r.oddil or nil
    invites = (type(r) == "table" and type(r.invites) == "table") and r.invites or {}
    boot.oddilId = info and info.id or nil
    boot.oddilTag = info and info.tag or ""
    if not loaded and #invites > 0 then chat.System("Máš pozvánku do oddílu " .. tostring(invites[1].name) .. " – klávesa " .. keys.Label("oddil") .. ".") end
    loaded = true
    if before ~= boot.oddilTag then presence.Retrack(boot, player) end
end

local function call(fn, args, success, after)
    busy = true
    api.Rpc(fn, args or {}, function(r, e)
        busy = false
        if e then err, ok = e, nil; return end
        apply(r)
        if success then ok, err = success, nil end
        if after then after() end
    end)
end

function M.Update()
    if test then return end
    if not boot or not boot.inWorld or not api.SignedIn() then M.open, loaded, info = false, false, nil; return end
    if game.time() > refreshAt and not busy then
        refreshAt = game.time() + (M.open and 15 or 60)
        call("ashes_oddil_info", {})
    end
    if not boot.typing and keys.Down("oddil") then
        M.open, err, ok = not M.open, nil, nil
        if M.open then refreshAt = 0 end
    end
end

-- textové pole (ImGui) bez rámu okna
local function field(id, x, y, w, value, max, hint)
    local out = value
    ui.window("##" .. id, x - 14, y - 10, w + 28, 64, { title = false, background = false, scroll = false, move = false, resize = false, font = "body", font_size = 21 }, function()
        out = ui.input("##" .. id .. "_in", value, { width = w, max = max, hint = hint }) or value
    end)
    return out
end

local function noOddil(x, y, w)
    ui.text(x, y, "Oddíl je skupina spolubojovníků tvé frakce: společný kanál v chatu, zkratka u jména a velení (velitel, setníci, členové).",
        { size = 19, font = "body", color = skin.Text, wrap = w })
    local cy = y + 64
    if #invites > 0 then
        ui.text(x, cy, "POZVÁNKY", { size = 19, font = "h2", color = skin.Gold })
        cy = cy + 34
        for _, inv in ipairs(invites) do
            ui.text(x, cy + 8, string.format("[%s] %s", inv.tag or "", inv.name or ""), { size = 20, font = "bold", color = skin.Text })
            ui.text(x, cy + 34, string.format("%d členů · %s", inv.members or 0, inv.motto or ""), { size = 16, font = "body", color = skin.Muted })
            if skin.Button(x + w - 310, cy + 6, 150, 40, "Přijmout", true, not busy) then
                call("ashes_oddil_answer", { p_oddil = inv.id, p_accept = true }, "Vítej v oddílu " .. tostring(inv.name) .. "!")
            end
            if skin.Button(x + w - 150, cy + 6, 150, 40, "Odmítnout", false, not busy) then
                call("ashes_oddil_answer", { p_oddil = inv.id, p_accept = false }, "Pozvánka odmítnuta.")
            end
            cy = cy + 64
        end
    end
    cy = cy + 10
    ui.text(x, cy, "ZALOŽIT ODDÍL", { size = 19, font = "h2", color = skin.Gold })
    ui.text(x, cy + 30, "Od 2. úrovně, stojí 50 zlata. Zkratka 2–5 znaků se zobrazuje u jmen členů.", { size = 16, font = "body", color = skin.Muted })
    cy = cy + 62
    ui.text(x, cy, "NÁZEV", { size = 14, font = "caps", color = skin.Muted })
    form.name = field("oddil_name", x, cy + 22, w, form.name, 24, "Štít Kalidry")
    cy = cy + 80
    ui.text(x, cy, "ZKRATKA", { size = 14, font = "caps", color = skin.Muted })
    ui.text(x + 220, cy, "HESLO ODDÍLU (nepovinné)", { size = 14, font = "caps", color = skin.Muted })
    form.tag = string.upper(field("oddil_tag", x, cy + 22, 190, form.tag, 5, "ŠTÍT"))
    form.motto = field("oddil_motto", x + 220, cy + 22, w - 220, form.motto, 80, "Dokud jeden stojí…")
    cy = cy + 90
    if skin.Button(x, cy, 360, 48, "ZALOŽIT ODDÍL (50 ZLATA)", true, not busy) then
        call("ashes_oddil_create", { p_name = form.name, p_tag = form.tag, p_motto = form.motto }, "Oddíl založen!", function()
            -- odečtené zlato
            if info then api.Rpc("ashes_state", {}, function(st) if type(st) == "table" and st.character then boot.state = st end end) end
        end)
    end
end

local function members(x, y, w)
    ui.text(x, y, "[" .. tostring(info.tag or "") .. "]", { size = 22, font = "bold", color = skin.Gold })
    if info.motto and info.motto ~= "" then ui.text(x + 90, y, "„" .. info.motto .. "“", { size = 22, font = "body", color = skin.Text }) end
    ui.text(x, y + 34, string.format("Tvoje hodnost: %s   ·   %d členů   ·   kanál v chatu: Tab nebo /o", ROLE[info.role] or "Člen", #(info.members or {})),
        { size = 16, font = "body", color = skin.Muted })
    local leader, officer = info.role == "velitel", info.role == "setnik"
    local cy = y + 72
    for i, m in ipairs(info.members or {}) do
        if i > 9 then break end
        ui.rect(x + 4, cy + 14, 10, 10, m.online and skin.Good or { 0.4, 0.36, 0.32 }, 5)
        ui.text(x + 26, cy + 8, (m.name or "") .. (m.me and "  (ty)" or ""), { size = 20, font = "bold", color = m.me and skin.Sky or skin.Text })
        ui.text(x + 290, cy + 11, string.format("%s · úr. %d", skin.ClassName(m.class), m.level or 1), { size = 16, font = "body", color = skin.Muted })
        ui.text(x + 480, cy + 9, ROLE[m.role] or "Člen", { size = 19, font = "bold", color = m.role == "velitel" and skin.GoldBright or skin.Text })
        if not m.me then
            local bx = x + w - 90
            local function act(label, action, done)
                local hit = skin.Chip(bx, cy + 4, 90, 34, false)
                ui.text(bx + 45, cy + 11, label, { size = 15, font = "body", color = skin.Text, align = "center" })
                if hit and not busy then call("ashes_oddil_member", { p_user = m.user_id, p_action = action }, done) end
                bx = bx - 96
            end
            if leader or (officer and m.role == "clen") then act("Vyloučit", "kick", (m.name or "") .. " byl vyloučen.") end
            if leader and m.role == "setnik" then act("Degradovat", "demote", (m.name or "") .. " je člen.") end
            if leader and m.role == "clen" then act("Povýšit", "promote", (m.name or "") .. " je setník.") end
        end
        cy = cy + 44
    end
    if leader or officer then
        cy = math.max(cy + 10, y + 470)
        form.invite = field("oddil_invite", x, cy, 360, form.invite, 40, "Jméno postavy")
        if skin.Button(x + 380, cy - 4, 200, 42, "Pozvat hráče", false, not busy and form.invite:match("%S") ~= nil) then
            local name = form.invite:match("^%s*(.-)%s*$")
            call("ashes_oddil_invite", { p_name = name }, "Pozvánka odeslána: " .. name)
            form.invite = ""
        end
        ui.text(x, cy + 44, "Zadej jméno postavy (stejné frakce).", { size = 16, font = "body", color = skin.Muted })
    end
end

function M.Draw(W, H)
    if not M.open or not boot or not boot.inWorld then return end
    ui.fade(0.45)
    local x, y, w, h = W / 2 - 430, H / 2 - 360, 860, 720
    local ix, iy, iw, ih = skin.Panel(x, y, w, h, info and ("Oddíl " .. tostring(info.name)) or "Oddíl")
    if info then members(ix, iy, iw) else noOddil(ix, iy, iw) end
    if err then ui.text(ix, iy + ih - 92, err, { size = 18, font = "bold", color = skin.Ember }) end
    if ok then ui.text(ix, iy + ih - 92, ok, { size = 18, font = "bold", color = skin.Good }) end
    if info and skin.Button(ix, iy + ih - 48, 220, 42, "Opustit oddíl", false, not busy) then call("ashes_oddil_leave", {}, "Opustil jsi oddíl.") end
    if skin.Button(ix + iw - 220, iy + ih - 50, 220, 46, "ZAVŘÍT (" .. keys.Label("oddil") .. ")", true) then M.Close() end
end

-- Samotest: ukázkový oddíl
function M.TestOpen()
    test, M.open = true, true
    info = { id = "x", name = "Štít Kalidry", tag = "ŠTÍT", motto = "Dokud jeden stojí, Kalidra nepadne.", role = "velitel",
        members = {
            { name = "Tester", class = "hoplit", level = 3, role = "velitel", online = true, me = true },
            { name = "Ariadna", class = "vestec", level = 5, role = "setnik", online = true },
            { name = "Nikandros", class = "lucistnik", level = 2, role = "clen", online = false },
        } }
end

return M

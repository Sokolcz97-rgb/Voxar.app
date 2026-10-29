-- Kronika (Chronicle.cs, klávesa K nebo hostinský Gorgias / markytánka Sabra): příběhová kampaň
-- ze serveru – kapitola, výpravy za odvahu (časové mise), strážce kapitoly, denní dar, válka o Kalidru.
-- Výpravy a bosse vyhodnotí server (ashes_start_quest, ashes_finish_quest, ashes_fight_boss).
local api = require("ashes.api")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")
local util = require("ashes.util")

local M = { open = false }
local boot, combat
local busy, err, giftNote = false, nil, nil
local seenState, serverOffset = nil, 0
local doneNotified, expeditionSeen = false, false

local function serverNow() return os.time() + serverOffset end

local function active()
    for _, q in ipairs((boot.state and boot.state.quests) or {}) do if q.state == "active" then return q end end
end

-- Zbývající čas aktivní výpravy v sekundách (nil = žádná výprava)
function M.Remaining()
    local a = active()
    local e = a and util.IsoToEpoch(a.ends_at)
    if not e then return nil end
    return math.max(0, e - serverNow())
end

local function giftReady(st)
    local now = st.now
    return st.character and type(now) == "string" and #now >= 10 and st.character.daily_gift_day ~= now:sub(1, 10)
end

local function call(fn, args)
    busy = true
    api.Rpc(fn, args, function(st, e)
        busy = false
        if e then err = e; return end
        if type(st) == "table" and st.character then boot.state = st end
        err = nil
        if fn == "ashes_start_quest" then
            if boot.mods then boot.mods.fire("expedition", "start", (active() or {}).title or "") end
            boot.sound.Play("quest", 0.6)
        end
    end)
end

local function gift()
    busy = true
    api.Rpc("ashes_daily_gift", {}, function(g, e)
        busy = false
        if e then err = e; return end
        g = type(g) == "table" and g or {}
        if type(g.state) == "table" and g.state.character then boot.state = g.state end
        err = nil
        giftNote = string.format("Denní dar: +%d zlata, +%d zkušeností.", g.gold or 0, g.xp or 0)
        boot.sound.Play((g.levels or 0) > 0 and "level" or "coin")
    end)
end

local function fight(fn, args, cls, label, note)
    M.open = false
    if fn == "ashes_finish_quest" and boot.mods then boot.mods.fire("expedition", "end", label) end
    combat.ServerFight(fn, args, { cls = cls, label = label, storyNote = note, onError = function(e) err = e; M.open = true end })
end

function M.Open() M.open, err = true, nil end
function M.Close() M.open = false end
function M.IsOpen() return M.open end

function M.Build(b, c)
    boot, combat = b, c
    b.openChronicle = M.Open
end

function M.Update()
    if not boot or not boot.inWorld then M.open = false; return end
    if boot.state ~= seenState then
        seenState = boot.state
        local sn = boot.state and util.IsoToEpoch(boot.state.now)
        if sn then serverOffset = sn - os.time() end
    end
    -- výprava právě skončila → upozornění
    local left = M.Remaining()
    local done = left ~= nil and left <= 0
    if done and not doneNotified and expeditionSeen then
        boot.sound.Play("quest")
        if boot.mods then boot.mods.fire("expedition", "ready", (active() or {}).title or "") end
    end
    expeditionSeen, doneNotified = left ~= nil, done
    if boot.typing then return end
    if keys.Down("chronicle") then if M.open then M.open = false else M.Open() end end
end

-- HUD: odpočet výpravy nahoře uprostřed
local function badge(W)
    local left = M.Remaining()
    if not left then return end
    ui.panel("Textures/ui/panel.png", W / 2 - 200, 16, 400, 46, 12, 16)
    local text = left <= 0 and ("Výprava skončila – otevři Kroniku (" .. keys.Label("chronicle") .. ")") or ("Na výpravě · zbývá " .. util.Clock(left))
    ui.text(W / 2, 27, text, { size = 20, font = "bold", color = left <= 0 and skin.GoldBright or skin.Text, align = "center" })
end

function M.Draw(W, H)
    if not boot or not boot.state or not boot.state.character then return end
    local fighting = combat.Busy()
    if not M.open then if not fighting then badge(W) end return end
    local st, ch, chap = boot.state, boot.state.character, boot.state.chapter
    ui.fade(0.45)
    local w, h = math.min(1180, W - 60), math.min(820, H - 80)
    local x, y = (W - w) / 2, (H - h) / 2
    local title = (chap and chap.title and chap.title ~= "") and string.format("Kapitola %s · %s", tostring(chap.n or ""), chap.title) or "Kronika"
    local ix, iy, iw, ih = skin.Panel(x, y, w, h, title)
    local free = not busy and not fighting
    local cy = iy
    local function caps(t) ui.text(ix, cy, t, { size = 15, font = "caps", color = skin.Gold }); cy = cy + 26 end
    local function para(t, opts)
        opts = opts or {}
        local _, th = ui.text(ix + (opts.indent or 0), cy, t, { size = opts.size or 19, font = opts.font or "body", color = opts.color or skin.Text, wrap = opts.wrap or iw })
        cy = cy + (th or 22) + (opts.gap or 6)
    end
    -- denní dar
    if giftReady(st) then
        ui.text(ix, cy + 12, ch.faction == "legie" and "Azkar posílá svým vojákům denní žold." or "Kalidra posílá svým obráncům denní dar.",
            { size = 21, font = "bold", color = skin.GoldBright })
        if skin.Button(ix + iw - 320, cy, 320, 46, "VYZVEDNOUT DENNÍ DAR", true, free) then gift() end
        cy = cy + 58
    end
    -- válka o Kalidru
    local wd = st.world
    if type(wd) == "table" and (wd.wall_max or 0) > 0 then
        local k = math.max(0, math.min(1, (wd.wall or 0) / wd.wall_max))
        caps(string.format("VÁLKA O KALIDRU  ·  hrdinů %d (Kalidra %d · Legie %d)", wd.heroes or 0, wd.kalidra or 0, wd.legie or 0))
        ui.bar(ix, cy, iw, 22, k, { 0.45, 0.7, 0.95 }, string.format("Hradba Kalidry %d %%  –  %s", math.floor(k * 100 + 0.5),
            ch.faction == "legie" and "každé tvé vítězství ji boří" or "každé tvé vítězství ji zpevňuje"))
        cy = cy + 34
    end
    if chap and chap.intro and chap.intro ~= "" then para(chap.intro, { size = 19, color = { 0.86, 0.8, 0.7 } }) end
    -- postup kapitoly a odvaha
    local need = math.max(1, (chap and chap.need) or 1)
    local half = iw / 2 - 20
    ui.text(ix, cy, "POSTUP KAPITOLY", { size = 15, font = "caps", color = skin.Gold })
    ui.text(ix + half + 40, cy, "ODVAHA (obnoví se každé ráno)", { size = 15, font = "caps", color = skin.Gold })
    cy = cy + 26
    ui.bar(ix, cy, half, 24, math.min(1, (ch.chapter_progress or 0) / need), skin.Gold, string.format("%d / %d výprav", math.min(ch.chapter_progress or 0, need), need))
    ui.bar(ix + half + 40, cy, half, 24, math.min(1, (ch.courage or 0) / 100), skin.Ember, string.format("%d / 100", ch.courage or 0))
    cy = cy + 40
    local act = active()
    if act then
        caps("PROBÍHAJÍCÍ VÝPRAVA")
        para(act.title or "", { size = 22, font = "h2", color = skin.GoldBright })
        if act.story and act.story ~= "" then para(act.story) end
        local left = M.Remaining() or 0
        if left > 0 then
            para("Vrátíš se za " .. util.Clock(left) .. ". Mezitím můžeš volně hrát – výprava běží i po zavření hry.")
        else
            local foe = (act.enemy and act.enemy.name and act.enemy.name ~= "") and act.enemy.name or "nepřítel"
            para("Na konci cesty tě čeká " .. foe .. ".")
            if skin.Button(ix, cy, 420, 54, "DOKONČIT VÝPRAVU – SOUBOJ", true, free) then
                fight("ashes_finish_quest", { p_skip = false }, (act.enemy and act.enemy.class) or "hoplit", foe, "Výprava „" .. (act.title or "") .. "“ je u konce.")
            end
            cy = cy + 64
        end
    elseif st.quests and #st.quests > 0 then
        caps("NABÍDNUTÉ VÝPRAVY  (vyber jednu – ostatní propadnou)")
        local shown = 0
        for _, q in ipairs(st.quests) do
            if q.state == "offered" and shown < 3 then
                shown = shown + 1
                local top = cy
                ui.text(ix, cy, q.title or "", { size = 21, font = "h2", color = skin.GoldBright })
                cy = cy + 30
                if q.story and q.story ~= "" then para(q.story, { size = 16, color = skin.Muted, wrap = iw - 330, gap = 2 }) end
                local info = string.format("%d min   ·   +%d zk.   ·   %d zlata   ·   kořist %d %%", q.minutes or 0, q.xp or 0, q.gold or 0, q.item_chance or 0)
                if q.enemy and q.enemy.name and q.enemy.name ~= "" then info = info .. "   ·   nepřítel: " .. q.enemy.name end
                para(info, { size = 16, color = skin.Text, gap = 8 })
                local cost = 8 + (q.minutes or 0) * 2
                local can = (ch.courage or 0) >= cost
                if skin.Button(ix + iw - 300, top + 10, 300, 52, can and ("Vydat se  ·  odvaha " .. cost) or ("Málo odvahy (" .. cost .. ")"), true, free and can) then
                    call("ashes_start_quest", { p_quest = q.id })
                end
                cy = math.max(cy, top + 72)
                ui.line(ix, cy, ix + iw, cy, "#c9a45c33", 1)
                cy = cy + 8
            end
        end
    else
        para("Žádné výpravy nejsou k dispozici. Zkus to znovu za chvíli.")
    end
    -- strážce kapitoly
    local boss = chap and chap.boss
    if type(boss) == "table" and boss.e and boss.e ~= "" then
        cy = cy + 6
        caps("STRÁŽCE KAPITOLY")
        para(boss.e .. "  ·  " .. (boss.t or ""), { size = 21, font = "h2", color = { 1, 0.55, 0.4 } })
        if boss.s and boss.s ~= "" then para(boss.s, { size = 17, color = { 0.86, 0.8, 0.7 }, wrap = iw - 480 }) end
        local ready = (ch.chapter_progress or 0) >= need
        local br = util.IsoToEpoch(ch.boss_ready_at)
        local cd = br and math.max(0, br - serverNow()) or 0
        local label = not ready and string.format("Nejdřív splň výpravy (%d/%d)", ch.chapter_progress or 0, need)
            or (cd > 0 and ("Odpočíváš ještě " .. util.Clock(cd)) or ("VYZVAT: " .. string.upper(boss.e)))
        if skin.Button(ix + iw - 460, cy - 50, 460, 54, label, true, free and ready and cd <= 0) then
            fight("ashes_fight_boss", {}, (boss.c and boss.c ~= "") and boss.c or "hoplit", boss.e, boss.win)
        end
        cy = cy + 10
    end
    -- zprávy ze světa (co se vejde)
    if st.chronicle and #st.chronicle > 0 and cy < iy + ih - 120 then
        caps("ZPRÁVY ZE SVĚTA")
        local shown = 0
        for _, c in ipairs(st.chronicle) do
            if c.text and c.text ~= "" and shown < 6 and cy < iy + ih - 90 then
                shown = shown + 1
                local t = util.IsoToEpoch(c.created_at)
                local when = t and os.date("%d. %m. %H:%M", t) or ""
                ui.text(ix, cy, when, { size = 16, font = "body", color = skin.Muted })
                local _, th = ui.text(ix + 130, cy, c.text, { size = 16, font = "body", color = skin.Text, wrap = iw - 130 })
                cy = cy + (th or 20) + 4
            end
        end
    end
    local fy = iy + ih - 48
    if err then ui.text(ix, fy + 12, err, { size = 19, font = "bold", color = skin.Ember, wrap = iw - 280 })
    elseif giftNote then ui.text(ix, fy + 12, giftNote, { size = 19, font = "bold", color = skin.Good }) end
    if skin.Button(ix + iw - 240, fy, 240, 46, "ZAVŘÍT (Esc)", true) then M.open = false end
end

return M

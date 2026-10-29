-- Okno postavy (CharacterWindow.cs, klávesy C a I): vlastnosti a trénink, výbava a batoh, kovář.
-- Pravidla (ceny, úrovně, plný batoh) drží server – okno jen volá ashes_train / ashes_equip /
-- ashes_sell / ashes_shop / ashes_buy a ukáže nový stav.
local api = require("ashes.api")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")

local M = { open = false, tab = 1 }
local boot
local busy, msg, msgErr, msgUntil = false, nil, false, 0
local shop, shopLoaded, restockAt = nil, false, nil
local smithName = "Kovář"
local bagPage, shopPage = 0, 0

local TABS = { "Postava", "Výbava a batoh", "Kovář" }
local SLOTS = { "zbran", "stit", "helma", "zbroj", "rukavice", "boty", "amulet" }
local STATS = { "sila", "obratnost", "intelekt", "vydrz", "stesti" }
local SLOT_NAMES = { zbran = "Zbraň", stit = "Štít", helma = "Helma", zbroj = "Zbroj", rukavice = "Rukavice", boty = "Boty", amulet = "Amulet" }
local STAT_NAMES = { sila = "Síla", obratnost = "Obratnost", intelekt = "Intelekt", vydrz = "Výdrž", stesti = "Štěstí" }
local RARITY_NAMES = { [0] = "běžný", "neobvyklý", "vzácný", "epický", "legendární" }

function M.SlotName(s) return SLOT_NAMES[s] or s end
function M.StatName(s) return STAT_NAMES[s] or s end
local function mainStat(cls) return cls == "lucistnik" and "obratnost" or (cls == "vestec" and "intelekt" or "sila") end
local function statHint(s, cls)
    if s == "sila" then return cls == "hoplit" and "Hlavní vlastnost štítonoše – zvyšuje poškození." or "Mírně snižuje poškození od protivníků." end
    if s == "obratnost" then return cls == "lucistnik" and "Hlavní vlastnost lučištníka – zvyšuje poškození." or "Šance uhnout ranám." end
    if s == "intelekt" then return cls == "vestec" and "Hlavní vlastnost věštce ohně – zvyšuje poškození." or "Odolnost proti kouzlům věštců." end
    if s == "vydrz" then return "Více životů v boji." end
    return "Šance na kritický zásah."
end

function M.ItemLine(it)
    local parts = {}
    if it.slot == "zbran" then parts[#parts + 1] = string.format("poškození %d–%d", it.wmin or 0, it.wmax or 0) end
    if (it.armor or 0) > 0 then parts[#parts + 1] = "zbroj " .. it.armor end
    for _, s in ipairs(STATS) do
        local v = it[s] or 0
        if v ~= 0 then parts[#parts + 1] = STAT_NAMES[s] .. " " .. (v > 0 and "+" or "") .. v end
    end
    return table.concat(parts, "  ·  ")
end

-- Hrubé srovnání s nasazeným předmětem stejného slotu: text, barva
local function compare(it)
    local st = boot.state
    local cur
    for _, x in ipairs(st.items or {}) do if x.equipped and x.slot == it.slot and x.id ~= it.id then cur = x end end
    if not cur then if it.equipped then return "", nil end return "nový slot", skin.Good end
    local main = mainStat(st.character.class)
    local function score(i)
        return ((i.wmin or 0) + (i.wmax or 0)) * 1.5 + (i.armor or 0) + (i[main] or 0) * 2 + (i.vydrz or 0) * 1.5
            + ((i.sila or 0) + (i.obratnost or 0) + (i.intelekt or 0) + (i.stesti or 0)) * 0.5
    end
    local d = score(it) - score(cur)
    if math.abs(d) < 0.5 then return "podobné", skin.Muted end
    return d > 0 and "lepší než nasazené" or "horší než nasazené", d > 0 and skin.Good or skin.Ember
end

local function bagCount()
    local n = 0
    for _, it in ipairs(boot.state.items or {}) do if not it.equipped then n = n + 1 end end
    return n
end

local function setMsg(s, isErr) msg, msgErr, msgUntil = s, isErr, game.time() + 5 end

local function loadShop()
    busy = true
    api.Rpc("ashes_shop", {}, function(list, err)
        busy, shopLoaded = false, true
        if err then setMsg(err, true); shop = {}; return end
        shop = type(list) == "table" and list or {}
        api.Rpc("ashes_shop_next", {}, function(secs) if tonumber(secs) then restockAt = game.time() + tonumber(secs) end end)
    end)
end

local function restockText()
    if not restockAt then return "" end
    local s = math.max(0, math.floor(restockAt - game.time()))
    if s <= 0 then return "nové zboží je připravené – otevři kováře znovu" end
    local h, m = s // 3600, s % 3600 // 60
    return "nové zboží za " .. (h > 0 and string.format("%d h %d min", h, m) or (m > 0 and (m .. " min") or "chvilku"))
end

local function call(fn, args, success, reloadShop)
    local ev = fn == "ashes_equip" and "equip" or (fn == "ashes_sell" and "sell" or (fn == "ashes_buy" and "buy" or nil))
    busy = true
    api.Rpc(fn, args, function(st, err)
        busy = false
        if err then return setMsg(err, true) end
        if type(st) == "table" and st.character then
            local before = (boot.state.character and boot.state.character.level) or 0
            boot.state = st
            if st.character.level > before and before > 0 then success = success .. "  ·  NOVÁ ÚROVEŇ!" end
        end
        setMsg(success, false)
        if ev and boot.mods then boot.mods.fire("item", ev, success) end
        boot.sound.Play(success:find("NOVÁ ÚROVEŇ") and "level" or "coin", 0.8)
        if reloadShop then loadShop() end
    end)
end

function M.Open(t)
    M.open, M.tab, msg = true, t, nil
    if t == 3 then shopLoaded = false end
end
function M.OpenSmith(name) smithName = name; M.Open(3) end
function M.Close() M.open = false end
function M.IsOpen() return M.open end

function M.Build(b)
    boot = b
    b.openSmith = M.OpenSmith
end

function M.Update()
    if not boot or not boot.inWorld or boot.typing then return end
    if keys.Down("character") then if M.open and M.tab == 1 then M.open = false else M.Open(1) end end
    if keys.Down("bag") then if M.open and M.tab == 2 then M.open = false else M.Open(2) end end
    if M.open and M.tab == 3 and not shopLoaded and not busy and not boot.selftest then loadShop() end
end

-- ------------------------------------------------------------------ záložky
local function statsTab(x, y, w, h)
    local st = boot.state
    local ch, f = st.character, st.fighter or {}
    -- vlevo: portrét a souhrn
    ui.draw_image(skin.Portrait(ch.class, ch.appearance and ch.appearance.gender), x + 70, y, 220, 220)
    ui.text(x + 180, y + 234, skin.ClassName(ch.class) .. "  ·  úroveň " .. tostring(ch.level or 1), { size = 22, font = "h2", color = skin.GoldBright, align = "center" })
    ui.text(x + 180, y + 266, skin.FactionName(ch.faction), { size = 17, font = "body", color = skin.Muted, align = "center" })
    ui.bar(x, y + 300, 360, 22, (ch.xp or 0) / math.max(1, ch.xp_need or 1), { 0.62, 0.48, 0.9 }, string.format("%d / %d zkušeností", ch.xp or 0, ch.xp_need or 0))
    local ly = y + 340
    local function line(label, value)
        ui.text(x, ly, label, { size = 21, font = "body", color = skin.Muted })
        ui.text(x + 360, ly, value, { size = 21, font = "bold", color = skin.Text, align = "right" })
        ly = ly + 32
    end
    line("Životy v boji", tostring(math.floor((st.hp or 0) + 0.5)))
    if st.fighter then
        line("Poškození zbraně", string.format("%d–%d", f.wmin or 0, f.wmax or 0))
        line("Zbroj", tostring(f.armor or 0) .. (f.shield and "  ·  štít (blok)" or ""))
    end
    line("Čest", tostring(ch.honor or 0))
    ui.text(x, ly + 4, string.format("Vítězství %d  ·  porážky %d", ch.wins or 0, ch.losses or 0), { size = 17, font = "body", color = skin.Muted })
    -- vpravo: vlastnosti a trénink
    local rx, rw = x + 400, w - 400
    ui.text(rx, y, "VLASTNOSTI A TRÉNINK", { size = 16, font = "caps", color = skin.Gold })
    ui.text(rx, y + 26, "Trénink stojí zlato a trvale zvýší vlastnost o 1. Čím vyšší hodnota, tím dražší další bod.", { size = 17, font = "body", color = skin.Muted, wrap = rw })
    local main = mainStat(ch.class)
    local sy = y + 64
    for _, s in ipairs(STATS) do
        local baseV, total = ch[s] or 0, f[s] or ch[s] or 0
        local cost = (st.train_cost and st.train_cost[s]) or 0
        ui.text(rx, sy + 6, STAT_NAMES[s] .. (s == main and "   · hlavní" or ""), { size = 23, font = "bold", color = s == main and skin.GoldBright or skin.Text })
        ui.text(rx, sy + 38, statHint(s, ch.class), { size = 16, font = "body", color = skin.Muted })
        local bonus = total - baseV
        ui.text(rx + rw - 240, sy + 14, tostring(baseV) .. (bonus > 0 and (" +" .. bonus) or ""), { size = 26, font = "h2", color = bonus > 0 and skin.Good or skin.Text, align = "right" })
        if skin.Button(rx + rw - 210, sy + 12, 210, 52, "Trénovat  " .. cost, false, not busy and cost > 0 and (ch.gold or 0) >= cost) then
            call("ashes_train", { p_stat = s }, STAT_NAMES[s] .. " +1")
        end
        sy = sy + 80
        ui.line(rx, sy - 2, rx + rw, sy - 2, "#c9a45c33", 1)
    end
end

local function itemTitle(it, x, y, extra)
    ui.text(x, y, it.name or "", { size = 20, font = "bold", color = skin.RarityColor(it.rarity) })
    local tw = ui.text_size(it.name or "", { size = 20, font = "bold" }) or 0
    ui.text(x + tw + 12, y + 3, extra, { size = 15, font = "body", color = skin.Muted })
end

local function pager(x, y, page, pages, set)
    if pages <= 1 then return end
    if skin.Button(x, y, 50, 36, "‹", false, page > 0) then set(page - 1) end
    ui.text(x + 90, y + 8, string.format("%d / %d", page + 1, pages), { size = 17, font = "body", color = skin.Muted, align = "center" })
    if skin.Button(x + 130, y, 50, 36, "›", false, page < pages - 1) then set(page + 1) end
end

local function gearTab(x, y, w, h)
    local st = boot.state
    local items = st.items or {}
    ui.text(x, y, "NASAZENÁ VÝBAVA", { size = 16, font = "caps", color = skin.Gold })
    local sy = y + 28
    for _, slot in ipairs(SLOTS) do
        local eq
        for _, it in ipairs(items) do if it.equipped and it.slot == slot then eq = it end end
        ui.rect(x, sy, 470, 70, { 0.08, 0.06, 0.05, 0.7 })
        ui.text(x + 12, sy + 6, string.upper(SLOT_NAMES[slot]), { size = 14, font = "caps", color = skin.Muted })
        if eq then
            itemTitle(eq, x + 12, sy + 24, "úr. " .. tostring(eq.level or 1))
            ui.text(x + 12, sy + 48, M.ItemLine(eq), { size = 15, font = "body", color = skin.Muted })
            if skin.Button(x + 470 - 116, sy + 17, 104, 36, "Sundat", false, not busy) then
                call("ashes_equip", { p_item = eq.id, p_on = false }, eq.name .. " je v batohu.")
            end
        else
            ui.text(x + 12, sy + 30, "— prázdné —", { size = 19, font = "body", color = { 0.44, 0.39, 0.35 } })
        end
        sy = sy + 74
    end
    -- batoh
    local rx, rw = x + 500, w - 500
    ui.text(rx, y, string.format("BATOH  %d / %d", bagCount(), (st.bag_max or 0) > 0 and st.bag_max or 12), { size = 16, font = "caps", color = skin.Gold })
    ui.text(rx, y + 26, "Kořist padá z nepřátel ve světě. Lepší výbavu koupíš u kováře v Kalidře (Tharos) nebo v táboře Legie (Rukmar).",
        { size = 16, font = "body", color = skin.Muted, wrap = rw })
    local bag = {}
    for _, it in ipairs(items) do if not it.equipped then bag[#bag + 1] = it end end
    if #bag == 0 then ui.text(rx, y + 84, "Batoh je prázdný.", { size = 20, font = "body", color = skin.Text }) end
    local per = 5
    local pages = math.max(1, math.ceil(#bag / per))
    bagPage = math.min(bagPage, pages - 1)
    local by = y + 76
    for i = bagPage * per + 1, math.min(#bag, bagPage * per + per) do
        local it = bag[i]
        itemTitle(it, rx, by + 6, string.format("%s · úr. %d · %s", SLOT_NAMES[it.slot] or it.slot, it.level or 1, RARITY_NAMES[it.rarity or 0] or ""))
        local line = M.ItemLine(it)
        ui.text(rx, by + 34, line, { size = 15, font = "body", color = skin.Muted })
        local ctext, ccolor = compare(it)
        if ctext ~= "" then ui.text(rx + (ui.text_size(line, { size = 15, font = "body" }) or 0) + 14, by + 34, ctext, { size = 15, font = "body", color = ccolor }) end
        local tooHigh = (it.level or 1) > (st.character.level or 1) + 2
        if skin.Button(rx + rw - 310, by + 12, 150, 46, tooHigh and ("od úr. " .. ((it.level or 1) - 2)) or "Nasadit", false, not busy and not tooHigh) then
            call("ashes_equip", { p_item = it.id, p_on = true }, "Nasazeno: " .. it.name)
        end
        if skin.Button(rx + rw - 150, by + 12, 150, 46, "Prodat  " .. math.max(1, (it.price or 0) // 4), false, not busy) then
            call("ashes_sell", { p_item = it.id }, "Prodáno: " .. it.name)
        end
        by = by + 80
        ui.line(rx, by - 4, rx + rw, by - 4, "#c9a45c33", 1)
    end
    pager(rx, y + h - 40, bagPage, pages, function(p) bagPage = p end)
end

local function shopTab(x, y, w, h)
    local st = boot.state
    local rs = restockText()
    ui.text(x, y, string.upper(smithName) .. "  ·  ZBOŽÍ" .. (rs ~= "" and ("  ·  " .. string.upper(rs)) or ""), { size = 16, font = "caps", color = skin.Gold })
    ui.text(x, y + 26, "Kovář každé 3 hodiny – a hned po tvé nové úrovni – ukove nové zboží pro tvé povolání a úroveň. Nákup jde rovnou do batohu.",
        { size = 16, font = "body", color = skin.Muted, wrap = w })
    if not shopLoaded then return ui.text(x, y + 70, "Načítám zboží…", { size = 20, font = "body", color = skin.Text }) end
    if not shop or #shop == 0 then return ui.text(x, y + 70, "Kovář právě kuje nové zboží – otevři ho znovu.", { size = 20, font = "body", color = skin.Text }) end
    local full = bagCount() >= ((st.bag_max or 0) > 0 and st.bag_max or 12)
    local sy = y + 64
    if full then ui.text(x, sy, "Batoh je plný – nejdřív něco prodej.", { size = 19, font = "bold", color = skin.Ember }); sy = sy + 30 end
    local per = 5
    local pages = math.max(1, math.ceil(#shop / per))
    shopPage = math.min(shopPage, pages - 1)
    for i = shopPage * per + 1, math.min(#shop, shopPage * per + per) do
        local it = shop[i]
        itemTitle(it, x, sy + 6, string.format("%s · úr. %d · %s", SLOT_NAMES[it.slot] or it.slot, it.level or 1, RARITY_NAMES[it.rarity or 0] or ""))
        local line = M.ItemLine(it)
        ui.text(x, sy + 36, line, { size = 15, font = "body", color = skin.Muted })
        local ctext, ccolor = compare(it)
        if ctext ~= "" then ui.text(x + (ui.text_size(line, { size = 15, font = "body" }) or 0) + 14, sy + 36, ctext, { size = 15, font = "body", color = ccolor }) end
        if skin.Button(x + w - 220, sy + 14, 220, 50, "Koupit  " .. tostring(it.price or 0), true, not busy and not full and (st.character.gold or 0) >= (it.price or 0)) then
            call("ashes_buy", { p_item = it.id }, "Koupeno: " .. it.name .. " (v batohu)", true)
        end
        sy = sy + 84
        ui.line(x, sy - 4, x + w, sy - 4, "#c9a45c33", 1)
    end
    pager(x, y + h - 40, shopPage, pages, function(p) shopPage = p end)
end

function M.Draw(W, H)
    if not M.open or not boot or not boot.state or not boot.state.character then return end
    local ch = boot.state.character
    ui.fade(0.45)
    local w, h = math.min(1180, W - 60), math.min(760, H - 120)
    local x, y = (W - w) / 2, (H - h) / 2 - 10
    local ix, iy, iw, ih = skin.Panel(x, y, w, h, (ch.display_name and ch.display_name ~= "") and ch.display_name or ch.name)
    for i, t in ipairs(TABS) do
        local tx = ix + (i - 1) * 230
        if skin.Chip(tx, iy, 220, 38, M.tab == i) then M.Open(i) end
        ui.text(tx + 110, iy + 9, t, { size = 17, font = "h2", color = skin.Text, align = "center" })
    end
    ui.text(ix + iw, iy + 6, tostring(ch.gold or 0) .. " zlata", { size = 22, font = "bold", color = { 0.94, 0.82, 0.54 }, align = "right" })
    local by, bh = iy + 54, ih - 54 - 56
    if M.tab == 1 then statsTab(ix, by, iw, bh)
    elseif M.tab == 2 then gearTab(ix, by, iw, bh)
    else shopTab(ix, by, iw, bh) end
    local fy = iy + ih - 48
    if msg and game.time() < msgUntil then
        ui.text(ix, fy + 12, msg, { size = 20, font = "bold", color = msgErr and skin.Ember or skin.Good })
    elseif busy then ui.text(ix, fy + 14, "Kovář počítá…", { size = 17, font = "body", color = skin.Muted }) end
    if skin.Button(ix + iw - 240, fy + 2, 240, 44, "ZAVŘÍT (Esc)", true) then M.open = false end
end

-- Samotest: ukázkové zboží kováře
function M.TestOpen(t)
    M.open, M.tab = true, t
    if t == 3 then
        shopLoaded = true
        shop = {
            { id = "a", slot = "zbran", name = "Bronzový meč", rarity = 1, level = 3, wmin = 6, wmax = 11, sila = 2, price = 140 },
            { id = "b", slot = "helma", name = "Helma s hřebenem z Kalidry", rarity = 3, level = 4, armor = 9, vydrz = 3, price = 520 },
            { id = "c", slot = "boty", name = "Měděné sandály", rarity = 0, level = 3, armor = 3, price = 60 },
        }
    end
end

return M

-- Rádce „Co dál“ (Guide.cs), ukazatel cíle (Waypoint.cs) a velké příběhové karty (StoryCards.cs):
-- úvod kapitoly a oslava nové úrovně. Klávesa H skryje rádce i ukazatel.
local map = require("ashes.worldmap")
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")

local M = {}
local boot, player, hud, world, combat, activities, chronicle, windows
local hidden = false

local function quest(st, id)
    for _, q in ipairs((st and st.wquests) or {}) do if q.quest_id == id then return q end end
end
local function npcName(id)
    for _, n in ipairs(map.Npcs) do if n.id == id then return n.name .. " (" .. n.role .. ")" end end
    return id
end
local function unlocked(q, st)
    for _, r in ipairs(q.req or {}) do
        local w = quest(st, r)
        if not w or w.state ~= "done" then return false end
    end
    return true
end
local function giftReady(st)
    return st.character and type(st.now) == "string" and #st.now >= 10 and st.character.daily_gift_day ~= st.now:sub(1, 10)
end

-- Jedna věta s dalším krokem
function M.NextStep()
    local st = boot.state
    if not st or not st.character then return nil end
    local ch = st.character
    local fac = (ch.faction and ch.faction ~= "") and ch.faction or "kalidra"
    local quests = hud.Quests()
    for _, q in ipairs(quests) do
        local w = quest(st, q.id)
        if w and w.state == "ready" then return "Odevzdej úkol „" .. q.title .. "“ – vrať se za: " .. npcName(q.giver) .. "." end
    end
    for _, q in ipairs(quests) do
        local w = quest(st, q.id)
        if w and w.state == "active" then
            if not q.objective or q.objective == "" then return "Pokračuj v úkolu „" .. q.title .. "“." end
            return q.title .. ": " .. q.objective .. (((q.count or 1) > 1) and string.format(" (%d/%d)", w.progress or 0, q.count) or "")
        end
    end
    for _, q in ipairs(quests) do
        if q.faction == fac and not quest(st, q.id) and unlocked(q, st) then
            return "Nový úkol čeká u: " .. npcName(q.giver) .. " – nad hlavou má zlatý vykřičník. Přijdi k němu a stiskni " .. keys.Label("interact") .. "."
        end
    end
    local K = keys.Label("chronicle")
    if giftReady(st) then return "Čeká na tebe denní dar – otevři Kroniku (" .. K .. ") a vyzvedni si zlato a zkušenosti." end
    local rem = chronicle.Remaining()
    if rem and rem <= 0 then return "Výprava skončila – otevři Kroniku (" .. K .. ") a dokonči ji soubojem." end
    if not rem and st.quests and #st.quests > 0 and (ch.courage or 0) >= 10 then
        return "Otevři Kroniku (" .. K .. ") a vydej se na výpravu – posuneš příběh kapitoly."
    end
    local chap = st.chapter
    if chap and (chap.need or 0) > 0 and (ch.chapter_progress or 0) >= chap.need then
        return "Kapitola je připravená: v Kronice (" .. K .. ") vyzvi strážce – " .. tostring(chap.boss and chap.boss.e or "") .. "."
    end
    for _, it in ipairs(st.items or {}) do
        if not it.equipped and (it.level or 1) <= (ch.level or 1) + 2 then
            local empty = true
            for _, e in ipairs(st.items) do if e.equipped and e.slot == it.slot then empty = false end end
            if empty then return "V batohu máš " .. it.name .. " na volný slot – nasaď ho v okně Batoh (" .. keys.Label("bag") .. ")." end
        end
    end
    local tc = st.train_cost
    if type(tc) == "table" then
        local cheapest = math.min(tc.sila or 0, tc.obratnost or 0, tc.intelekt or 0, tc.vydrz or 0, tc.stesti or 0)
        if cheapest > 0 and (ch.gold or 0) >= cheapest * 2 then return "Máš dost zlata – natrénuj vlastnosti v okně Postava (" .. keys.Label("character") .. ")." end
    end
    local bs = activities.Boss.state
    if bs and bs.alive and (ch.level or 1) >= 2 then
        return "Na pláni u Památníku padlých táboří pirátský vůdce Thalassos se svou družinou. Spoj síly s ostatními – přijdi k němu a stiskni " .. keys.Label("interact") .. "."
    end
    return fac == "legie"
        and "Bojuj s obránci Kalidry v kraji, zkus arénu u Mistra zápasů, navštiv kováře Rukmara nebo si zaběhni kolo kolem mét na stadionu (bílý sloup na pláni)."
        or "Bojuj s Legií v kraji, zkus arénu u Mistra arény, navštiv kováře Tharose nebo si zaběhni kolo kolem mét na stadionu (bílý sloup na pláni)."
end

-- ------------------------------------------------------------------ ukazatel cíle
local target, label, scanAt = nil, nil, 0

local function scan()
    target = nil
    local px, _, pz = player.Position()
    local rt = activities.RaceTarget()
    if rt then target, label = rt, rt.title; return end
    local best = math.huge
    local function consider(x, z, text, bias)
        local d = math.sqrt((px - x) ^ 2 + (pz - z) ^ 2)
        if d > 4 and d * bias < best then best, target, label = d * bias, { x = x, z = z }, text end
    end
    for _, n in ipairs(world.npcs) do
        local mark = hud.Marker(boot.state, n.def.id)
        if mark == "?" then consider(n.x, n.z, n.def.name .. " – odevzdat úkol", 0.5)
        elseif mark == "!" then consider(n.x, n.z, n.def.name .. " – nový úkol", 1.6) end
    end
    for _, t in ipairs(combat.QuestTargets()) do consider(t.x, t.z, (t.title and t.title ~= "") and t.title or "cíl úkolu", 1) end
    for _, wq in ipairs((boot.state and boot.state.wquests) or {}) do
        local def = wq.state == "active" and hud.QuestDef(wq.quest_id)
        if def and def.type == "talk" then
            for _, n in ipairs(world.npcs) do
                if n.def.id == def.target then consider(n.x, n.z, n.def.name .. " – " .. def.title, 0.8) end
            end
        end
    end
    local bs = activities.Boss.state
    if not target and bs and bs.alive and boot.state.character and (boot.state.character.level or 1) >= 2 then
        consider(activities.Boss.x, activities.Boss.z, "Thalassos – světový boss", 1)
    end
end

-- Kosočtverec (čtyři čáry s výplní z obdélníků)
local function diamond(cx, cy, s, color)
    local h = s / 2
    for i = 0, h, 1.5 do
        local w = (h - i)
        ui.line(cx - w, cy - i, cx + w, cy - i, color, 1.8)
        ui.line(cx - w, cy + i, cx + w, cy + i, color, 1.8)
    end
end

local function drawWaypoint(W, H)
    if not target or combat.Busy() then return end
    local px, _, pz = player.Position()
    local d = math.sqrt((px - target.x) ^ 2 + (pz - target.z) ^ 2)
    local sx, sy, visible = ui.world_to_screen(target.x, map.Ground(target.x, target.z) + 2.6, target.z)
    local m = 70
    local off = not visible or sx < m or sx > W - m or sy < m + 150 or sy > H - m - 60
    -- blízký cíl na obrazovce má vlastní značku (vykřičník / jmenovka) – nepřekrývat
    if not off and d < 12 then return end
    if off then
        -- směr k cíli v pohledu kamery: dopředu = nahoru na obrazovce
        local c = player.cam
        local fx, fz = math.sin(math.rad(c.yaw)), math.cos(math.rad(c.yaw))
        local rx, rz = -fz, fx
        local dx, dz = target.x - px, target.z - pz
        local vx, vy = dx * rx + dz * rz, -(dx * fx + dz * fz)
        local l = math.sqrt(vx * vx + vy * vy)
        if l < 0.001 then vx, vy, l = 0, -1, 1 end
        vx, vy = vx / l, vy / l
        local kx = (W / 2 - m) / math.max(0.001, math.abs(vx))
        local ky = (H / 2 - m - 80) / math.max(0.001, math.abs(vy))
        local k = math.min(kx, ky)
        sx, sy = W / 2 + vx * k, H / 2 + vy * k
    end
    local pulse = 1 + math.sin(game.time() * 4) * 0.08
    diamond(sx, sy, 30 * pulse, { 1, 0.82, 0.4, 0.95 })
    ui.text(sx, sy + 18, string.format("%s · %d m", label or "", math.floor(d + 0.5)), { size = 18, font = "bold", color = skin.GoldBright, align = "center" })
end

-- ------------------------------------------------------------------ příběhové karty
local card, cardUntil = nil, 0
local lastLevel, lastName, levelUntil, levelShown = -1, nil, 0, 0
local ROMAN = { "I", "II", "III", "IV", "V", "VI", "VII", "VIII" }

local function updateCards()
    local st = boot.state
    if not st or not st.character or not st.character.name or st.character.name == "" then lastLevel = -1; return end
    local ch = st.character
    if lastName ~= ch.name then lastName, lastLevel = ch.name, ch.level end
    if (ch.level or 0) > lastLevel and lastLevel > 0 then
        levelShown, levelUntil = ch.level, game.time() + 4
        boot.sound.Play("level")
        if boot.mods then boot.mods.fire("level_up", ch.level) end
    end
    lastLevel = ch.level or 0
    local chap = st.chapter
    if not boot.selftest and chap and (chap.n or 0) > 0 and chap.title and chap.title ~= "" and not combat.Busy() then
        local key = "ashes.chapterSeen." .. ch.name .. "." .. tostring(ch.faction)
        if (settings.get(key, 0) or 0) < chap.n then
            settings.set(key, chap.n)
            card = { title = "Kapitola " .. (ROMAN[chap.n] or tostring(chap.n)), sub = chap.title, text = chap.intro }
            cardUntil = game.time() + 12
        end
    end
    if M.CardOpen() and (input.pressed("Space") or input.pressed("Escape") or input.pressed("Mouse1")) then cardUntil = 0; return true end
end

function M.CardOpen() return card ~= nil and game.time() < cardUntil end

local function drawCards(W, H)
    local now = game.time()
    if M.CardOpen() then
        local fade = math.min(1, (cardUntil - now) / 1.2)
        ui.rect(0, 0, W, H, { 0, 0, 0, 0.55 * fade })
        local y = H * 0.3
        ui.text(W / 2, y, string.upper(card.title), { size = 24, font = "caps", color = { 0.82, 0.68, 0.41, fade }, align = "center" })
        ui.text(W / 2, y + 40, card.sub, { size = 62, font = "title", color = { 0.94, 0.82, 0.54, fade }, align = "center" })
        skin.Ornament(W / 2 - 260, y + 144, 520)
        if card.text and card.text ~= "" then
            ui.text(W / 2, y + 166, card.text, { size = 25, font = "body", color = { 0.93, 0.89, 0.82, fade }, align = "center", wrap = 1040 })
        end
        ui.text(W / 2, y + 330, "Mezerník nebo kliknutí – pokračovat", { size = 17, font = "body", color = { 0.66, 0.6, 0.54, fade }, align = "center" })
    elseif now < levelUntil then
        local t = 4 - (levelUntil - now)
        local a = math.min(1, t * 3) * math.min(1, (levelUntil - now) / 0.8)
        ui.text(W / 2, H * 0.22, "NOVÁ ÚROVEŇ", { size = 58, font = "title", color = { 0.94, 0.82, 0.54, a }, align = "center" })
        ui.text(W / 2, H * 0.22 + 80, string.format("Dosáhl jsi %d. úrovně – víc životů a lepší kořist. Trénuj vlastnosti (%s).", levelShown, keys.Label("character")),
            { size = 24, font = "body", color = { 0.93, 0.89, 0.82, a }, align = "center" })
    end
end

-- ------------------------------------------------------------------ společné
function M.Build(b, deps)
    boot, player, hud, world, combat, activities, chronicle, windows =
        b, deps.player, deps.hud, deps.world, deps.combat, deps.activities, deps.chronicle, deps.windows
    hidden = settings.get("ui.guide.hidden", false) == true
end

-- Vrací true, když karta spotřebovala Esc
function M.Update()
    if not boot or not boot.inWorld then return false end
    if not boot.typing and keys.Down("guide") then
        hidden = not hidden
        settings.set("ui.guide.hidden", hidden)
    end
    if game.time() > scanAt then scanAt = game.time() + 0.5; scan() end
    return updateCards() == true
end

function M.Draw(W, H)
    if not boot or not boot.inWorld then return end
    if not hidden and not combat.Busy() and not windows() then
        drawWaypoint(W, H)
        local step = M.NextStep()
        if step then
            local x, y, w, h = W / 2 - 280, 70, 560, 96
            ui.rect(x, y, w, h, { 0.04, 0.03, 0.025, 0.78 })
            ui.rect(x, y, 3, h, skin.Gold)
            ui.text(x + 14, y + 8, "CO DÁL", { size = 15, font = "caps", color = skin.Gold })
            ui.text(x + w - 14, y + 9, keys.Label("guide") .. " – skrýt rádce", { size = 13, font = "body", color = skin.Muted, align = "right" })
            ui.text(x + 14, y + 32, step, { size = 18, font = "body", color = skin.Text, wrap = w - 28 })
        end
    end
    drawCards(W, H)
end

return M

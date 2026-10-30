-- Herní rozhraní ve světě: HUD (GameUI.Hud), jmenovky (NameTag.cs), rozhovory a úkoly od NPC (NpcDialog.cs)
local skin = require("ashes.skin")
local keys = require("ashes.keybinds")
local map = require("ashes.worldmap")
local api = require("ashes.api")
local util = require("ashes.util")

local M = { open = nil, near = nil, notice = nil, noticeUntil = 0, busy = false }

local content
local function Content()
    if not content then
        content = json.decode(fs.read("Data/content.json") or "{}") or {}
        content.quests = content.quests or {}
        content.npcs = content.npcs or {}
    end
    return content
end
function M.Quests() return Content().quests end
function M.QuestDef(id)
    for _, q in ipairs(Content().quests) do if q.id == id then return q end end
end
function M.Talk(id)
    for _, n in ipairs(Content().npcs) do if n.id == id then return n end end
end

local function Quest(state, id)
    if not state or not state.wquests then return nil end
    for _, q in ipairs(state.wquests) do if q.quest_id == id then return q end end
end

local function Faction(state)
    local f = state and state.character and state.character.faction
    return (f and f ~= "") and f or "kalidra"
end

local function Available(state, q)
    if not state or q.faction ~= Faction(state) then return false end
    if Quest(state, q.id) then return false end
    for _, r in ipairs(q.req or {}) do
        local w = Quest(state, r)
        if not w or w.state ~= "done" then return false end
    end
    return true
end

-- Značka nad NPC: "!" = nový úkol, "?" = k odevzdání
function M.Marker(state, npc)
    for _, q in ipairs(Content().quests) do
        if q.giver == npc then
            local wq = Quest(state, q.id)
            if wq and wq.state == "ready" then return "?" end
        end
    end
    for _, q in ipairs(Content().quests) do
        if q.giver == npc and Available(state, q) then return "!" end
    end
end

function M.Notice(text)
    M.notice, M.noticeUntil = text, game.time() + 6
end

local function call(boot, fn, args, onOk)
    M.busy = true
    api.Rpc(fn, args, function(data, err)
        M.busy = false
        if err then return M.Notice(err) end
        if onOk then onOk(data)
        elseif data and data.character then boot.state = data end
    end)
end

function M.Open(boot, n)
    M.open = { npc = n, title = n.def.name .. " · " .. n.def.role, text = (M.Talk(n.def.id) or {}).greet or "…" }
    if boot.mods then boot.mods.fire("npc_talk", n.def.id, n.def.name) end
    -- úkoly typu „promluv si s …“
    for _, q in ipairs(Content().quests) do
        local wq = Quest(boot.state, q.id)
        if wq and wq.state == "active" and q.type == "talk" then
            local target = (q.goalNpc and q.goalNpc ~= "") and q.goalNpc or q.target
            if target == n.def.id then call(boot, "ashes_wq_event", { p_kind = "talk", p_target = n.def.id }) end
        end
    end
end

function M.Close() M.open = nil end
function M.IsOpen() return M.open ~= nil end

-- Každý snímek: nejbližší NPC a klávesa E
function M.Update(boot, world, px, pz)
    M.near = nil
    local best = 3.6
    for _, n in ipairs(world.npcs) do
        local d = math.sqrt((px - n.x) ^ 2 + (pz - n.z) ^ 2)
        if d < best then best, M.near = d, n end
    end
    if M.open and (not M.near or M.near.def.id ~= M.open.npc.def.id) and not boot.selftest then M.Close() end
    if not boot.typing and keys.Down("interact") and M.near and not M.open then M.Open(boot, M.near) end
    if M.open then   -- NPC se otočí k hráči
        local n = M.open.npc
        local want = math.deg(math.atan(px - n.x, pz - n.z))
        n.yaw = n.yaw or math.deg(n.def.face)
        local d = (want - n.yaw + 540) % 360 - 180
        n.yaw = n.yaw + d * (1 - math.exp(-6 * time.delta()))
        entity.set_rotation(n.id, 0, n.yaw, 0)
    end
end

local function prompt(W, H, key, text)
    local x, y = W / 2 - 220, H - 170
    ui.panel("Textures/ui/panel.png", x, y, 440, 50, 12, 16)
    local kw = math.max(34, (ui.text_size(key, { size = 15, font = "h2" }) or 0) + 16)
    ui.rect(x + 16, y + 11, kw, 28, skin.Gold, 3)
    ui.text(x + 16 + kw / 2, y + 15, key, { size = 15, font = "h2", color = skin.Bg, align = "center", shadow = false })
    ui.text(x + 28 + kw, y + 12, text, { size = 22, font = "bold", color = skin.GoldBright })
end

M.Prompt = prompt

local function dialogWindow(boot, W, H)
    local o = M.open
    local n = o.npc
    local w, h = math.min(1180, W - 80), 380
    local x, y = (W - w) / 2, H - h - 70
    ui.panel("Textures/ui/panel.png", x, y, w, h, 16, 16)
    ui.draw_image(skin.Portrait(n.def.cls, (n.def.id == "thalia" or n.def.id == "sabra") and "f" or "m"), x + 26, y + 26, 150, 150)
    ui.text(x + 101, y + 186, string.upper(n.def.name), { size = 18, font = "h2", color = skin.GoldBright, align = "center" })
    ui.text(x + 101, y + 212, n.def.role, { size = 17, font = "body", color = skin.Muted, align = "center" })
    local tx, tw = x + 210, w * 0.5
    ui.text(tx, y + 24, o.title, { size = 24, font = "h1", color = skin.Gold })
    skin.Ornament(tx, y + 68, tw)
    ui.text(tx, y + 84, o.text, { size = 24, font = "body", color = skin.Text, wrap = tw })
    -- volby vpravo
    local ox, ow = tx + tw + 30, x + w - (tx + tw + 30) - 26
    ui.line(ox - 16, y + 26, ox - 16, y + h - 26, "#c9a45c59", 1)
    local oy = y + 26
    local function option(label, mark)
        local hit = ui.button_at(ox, oy, ow, 40, "", { color = { 0, 0, 0, 0 }, hover = { 0.82, 0.68, 0.4, 0.1 } })
        ui.rect(ox + 6, oy + 14, 11, 11, mark, 2)
        ui.text(ox + 28, oy + 8, label, { size = 21, font = "body", color = skin.Text })
        oy = oy + 44
        return hit and not M.busy
    end
    local st = boot.state
    if o.offer then
        ui.text(ox, oy, "ÚKOL", { size = 14, font = "caps", color = skin.Muted })
        ui.text(ox, oy + 22, o.offer.objective or "", { size = 22, font = "bold", color = skin.GoldBright, wrap = ow })
        oy = oy + 90
        if skin.Button(ox, oy, ow, 50, "PŘIJMOUT ÚKOL", true, not M.busy) then
            local q = o.offer
            call(boot, "ashes_wq_accept", { p_quest = q.id }, function(data)
                if data and data.character then boot.state = data end
                M.Notice("Nový úkol: " .. q.title)
                if boot.sound then boot.sound.Play("quest", 0.6) end
                if boot.mods then boot.mods.fire("quest_accepted", q.id, q.title) end
                if M.open then M.open.offer, M.open.text = nil, "Dobře. Vrať se, až to bude hotové." end
            end)
        end
        if skin.Button(ox, oy + 58, ow, 42, "Zatím ne") then o.offer, o.text = nil, (M.Talk(n.def.id) or {}).greet or "…" end
        return
    end
    for _, q in ipairs(Content().quests) do
        if q.giver == n.def.id then
            local wq = Quest(st, q.id)
            if wq and wq.state == "ready" and option("Odevzdat: " .. q.title, skin.Good) then
                call(boot, "ashes_wq_turnin", { p_quest = q.id }, function(res)
                    if res and res.state and res.state.character then boot.state = res.state end
                    if M.open then M.open.title, M.open.text = q.title, q.done or "" end
                    local lv = res and res.levels and res.levels > 0
                    if boot.sound then boot.sound.Play(lv and "level" or "quest") end
                    M.Notice("Úkol splněn: " .. q.title .. "   +" .. tostring(res and res.xp or 0) .. " zk.   +" ..
                        tostring(res and res.gold or 0) .. " zlata" .. (lv and "   ·   NOVÁ ÚROVEŇ!" or ""))
                    if boot.mods then boot.mods.fire("quest_done", q.id, q.title) end
                end)
            end
        end
    end
    for _, q in ipairs(Content().quests) do
        if q.giver == n.def.id and Available(st, q) and option("Úkol: " .. q.title, skin.Ember) then
            o.offer, o.title, o.text = q, q.title, q.offer or ""
        end
    end
    local id = n.def.id
    if (id == "tharos" or id == "rukmar") and boot.openSmith and option("Ukaž mi své zboží (obchod)", skin.GoldBright) then
        M.Close(); boot.openSmith(n.def.name .. " · " .. n.def.role)
    end
    if (id == "gorgias" or id == "sabra") and boot.openChronicle and option("Jaké výpravy jsou k mání? (Kronika)", skin.GoldBright) then
        M.Close(); boot.openChronicle()
    end
    if (id == "arena-k" or id == "arena-l") and boot.openArena and option("Chci zápasit v aréně", skin.Ember) then
        M.Close(); boot.openArena()
    end
    if not M.open then return end
    local talk = M.Talk(n.def.id)
    if talk and talk.lore then
        for _, l in ipairs(talk.lore) do
            if option(l.q, skin.Gold) then o.title, o.text = n.def.name .. " · " .. n.def.role, l.a end
        end
    end
    oy = math.max(oy, y + h - 70)
    if option("Rozloučit se", skin.Muted) then M.Close() end
end

local function questTracker(boot, W)
    local st = boot.state
    if not st or not st.wquests then return end
    local active = {}
    for _, q in ipairs(st.wquests) do if q.state == "active" or q.state == "ready" then active[#active + 1] = q end end
    if #active == 0 then return end
    local w, x, y = 380, W - 400, 380
    ui.text(x, y, "ÚKOLY", { size = 19, font = "h2", color = skin.Gold })
    ui.line(x, y + 30, x + w, y + 30, "#c9a45c59", 1)
    y = y + 40
    for _, wq in ipairs(active) do
        local def
        for _, q in ipairs(Content().quests) do if q.id == wq.quest_id then def = q end end
        if def then
            ui.text(x, y, def.title, { size = 20, font = "bold", color = wq.state == "ready" and skin.Good or skin.Text })
            local prog = (def.count or 1) > 1 and string.format("  (%d/%d)", wq.progress or 0, def.count) or ""
            ui.text(x, y + 24, (wq.state == "ready" and "Vrať se pro odměnu" or (def.objective or "")) .. prog,
                { size = 17, font = "body", color = skin.Muted, wrap = w })
            y = y + 58
        end
    end
end

-- Oblast podle polohy (jméno na kompasu)

function M.Draw(boot, world, player)
    local W, H = ui.screen()
    local st = boot.state
    local ch = st and st.character or {}
    -- jmenovky nad NPC (NameTag.cs)
    for _, n in ipairs(world.npcs) do
        local y = map.Ground(n.x, n.z) + n.height + 0.35
        local marker = M.Marker(st, n.def.id)
        if marker then ui.world_label(n.x, y + 0.45, n.z, marker, { size = 34, color = marker == "?" and skin.Good or skin.Ember, font = "h1", max_distance = 45 }) end
        ui.world_label(n.x, y, n.z, n.def.name, { size = 20, color = skin.GoldBright, font = "bold", max_distance = 35 })
        ui.world_label(n.x, y - 0.28, n.z, n.def.role, { size = 15, color = skin.Muted, font = "body", max_distance = 22 })
    end
    -- hráč: portrét, jméno, úroveň, životy, zkušenosti, zlato (vlevo nahoře)
    ui.panel("Textures/ui/panel.png", 20, 20, 430, 128, 16, 16)
    ui.draw_image(skin.Portrait(ch.class, ch.appearance and ch.appearance.gender), 34, 32, 104, 104)
    ui.text(152, 34, ch.display_name or ch.name or "", { size = 22, font = "h2", color = skin.GoldBright })
    ui.text(152, 62, skin.ClassName(ch.class) .. "  ·  úroveň " .. tostring(ch.level or 1), { size = 17, font = "body", color = skin.Muted })
    local hp, hpMax = util.Hp(st)
    ui.bar(152, 88, 280, 18, math.min(1, hp / math.max(hpMax, 1)), "#9c2a1c", string.format("%d / %d", math.floor(hp), hpMax))
    ui.bar(152, 112, 280, 10, math.min(1, (ch.xp or 0) / math.max(ch.xp_need or 1, 1)), "#a87a3a")
    ui.text(470, 30, string.format("%d zlata", ch.gold or 0), { size = 20, font = "bold", color = skin.GoldBright })
    questTracker(boot, W)
    -- klávesová lišta dole
    local hints = { { keys.Label("interact"), "Mluvit" }, { keys.Label("run"), "Běh" }, { keys.Label("jump"), "Skok" },
                    { keys.Label("autorun"), "Auto běh" }, { keys.Label("recall"), "Návrat" }, { "Esc", "Pauza" } }
    -- kapsa klávesy podle šířky textu („Mezerník“ je delší než „E“)
    local items, total = {}, 0
    for i, hnt in ipairs(hints) do
        local kw = math.max(40, (ui.text_size(hnt[1], { size = 14, font = "h2" }) or 0) + 18)
        local lw = ui.text_size(hnt[2], { size = 17, font = "body" }) or 60
        items[i] = { kw, lw }
        total = total + kw + 8 + lw + (i < #hints and 34 or 0)
    end
    local hx = W / 2 - total / 2
    for i, hnt in ipairs(hints) do
        local kw, lw = items[i][1], items[i][2]
        ui.rect(hx, H - 52, kw, 28, "#d2ae68e6", 3)
        ui.text(hx + kw / 2, H - 48, hnt[1], { size = 14, font = "h2", color = skin.Bg, align = "center", shadow = false })
        ui.text(hx + kw + 8, H - 50, hnt[2], { size = 17, font = "body", color = skin.Text })
        hx = hx + kw + 8 + lw + 34
    end
    if M.notice and game.time() < M.noticeUntil then
        ui.panel("Textures/ui/panel.png", W / 2 - 330, 110, 660, 54, 12, 16)
        ui.text(W / 2, 124, M.notice, { size = 22, font = "bold", color = skin.GoldBright, align = "center" })
    end
    if M.open then dialogWindow(boot, W, H)
    elseif M.near then prompt(W, H, keys.Label("interact"), "Mluvit – " .. M.near.def.name) end
end

return M

-- Ashes of Eryon – start hry (GameBootstrap.cs): přihlášení, načtení postavy ze serveru,
-- stavba světa, hráč a kamera. Skript je na objektu "Game" ve scéně Scenes/Main.vscene.
local skin = require("ashes.skin")
local api = require("ashes.api")
local map = require("ashes.worldmap")
local world = require("ashes.world")
local player = require("ashes.player")
local hud = require("ashes.hud")
local screens = require("ashes.screens")
local keys = require("ashes.keybinds")
local presence = require("ashes.presence")
local sound = require("ashes.sound")
local options = require("ashes.options")
local minimap = require("ashes.minimap")
local chat = require("ashes.chat")

local boot = {
    version = "0.8.0 (Voxario)",
    busy = false, status = "", state = nil, inWorld = false, loading = false,
    slots = nil, selftest = false, typing = false,
}
_G.ashes = boot   -- pro módy a ladění

local savePosKey, savePosAt = nil, 0
local recallT = nil

-- ------------------------------------------------------------------ server
local function NeedsCharacter()
    local st = boot.state
    return st and st.allowed and (not st.character or not st.character.name or st.character.name == "")
end

local function RefreshSlots()
    api.Rpc("ashes_characters_list", {}, function(data) if data then boot.slots = data end end)
end

local EnterWorld

local function LoadState()
    boot.busy, boot.status = true, "Načítám postavu…"
    api.Rpc("ashes_state", {}, function(data, err)
        boot.busy = false
        if err then boot.status = err; return end
        boot.state = data
        if not data or not data.allowed then
            boot.status = "Brány Kalidry jsou zatím zavřené – hrát mohou jen testeři s povolením."
            return
        end
        if NeedsCharacter() then boot.status = ""; RefreshSlots(); return end
        boot.status = "Stavím svět Kalidry…"
        boot.loading = true
        timer.after(0.1, function() EnterWorld() end)   -- nejdřív vykreslit načítací obrazovku
    end)
end

function boot.SignIn(email, password)
    boot.busy, boot.status = true, "Přihlašuji…"
    api.SignIn(email, password, function(err)
        boot.busy = false
        if err then boot.status = err; return end
        boot.status = ""
        LoadState()
    end)
end

function boot.SignOut()
    presence.Disconnect()
    api.SignOut()
    boot.state, boot.slots = nil, nil
end

function boot.CreateCharacter(name, cls, gender, faction, onError)
    boot.busy, boot.status = true, "Kovám tvůj osud…"
    api.Rpc("ashes_create_character", { p_name = name, p_class = cls, p_appearance = { gender = gender }, p_faction = faction },
        function(_, err)
            boot.busy, boot.status = false, ""
            if err then return onError(err) end
            LoadState()
        end)
end

-- Znovu od začátku (odhlášení, změna postavy): scéna se načte znovu
function boot.Reload() game.load_scene("Scenes/Main.vscene") end

function boot.SwitchCharacter(slot)
    boot.busy, boot.status = true, "Přepínám postavu…"
    api.Rpc("ashes_switch_character", { p_slot = slot.id }, function(_, err)
        boot.busy, boot.status = false, err or ""
        if not err then LoadState() end
    end)
end

-- ------------------------------------------------------------------ svět
function EnterWorld()
    local ch = boot.state.character
    local faction = (ch.faction and ch.faction ~= "") and ch.faction or "kalidra"
    local quality = settings.get("gfx.quality", 2)
    world.Build(faction, quality)
    local gender = (ch.appearance and ch.appearance.gender == "f") and "f" or "m"
    local cls = (ch.class and ch.class ~= "") and ch.class or "hoplit"
    local spawn = faction == "legie" and map.SpawnLegie or map.SpawnKalidra
    -- pokračovat tam, kde hráč skončil (uloženo v tomto počítači)
    savePosKey = "ashes.pos." .. ch.name .. "." .. faction
    local saved = settings.get(savePosKey)
    if type(saved) == "table" and saved[1] and map.InWorld(saved[1], saved[2]) and map.HeightAt(saved[1], saved[2]) > 0.4 then
        spawn = { x = saved[1], z = saved[2] }
    end
    minimap.Build()
    player.Create(cls, gender, (ch.display_name and ch.display_name ~= "") and ch.display_name or ch.name, spawn)
    boot.spawn = faction == "legie" and map.SpawnLegie or map.SpawnKalidra
    boot.inWorld, boot.loading, boot.status = true, false, ""
    if not boot.selftest then
        presence.Connect(boot, player)
        sound.StartMusic(ch.chapter)
    end
    if boot.mods then boot.mods.fire("enter_world") end
end

-- ------------------------------------------------------------------ samotest (CI): záběry jako Unity verze
local function shot(name) game.screenshot(name .. ".png"); timer.sleep(0.4) end

local function lookFrom(x, y, z, tx, ty, tz)
    player.cameraOverride = { x, y, z, tx, ty, tz }
end

local function Selftest()
    boot.selftest = true
    timer.sleep(2.0); shot("0-prihlaseni")
    boot.state = { allowed = true, character = {} }
    timer.sleep(1.5); shot("0b-tvorba-postavy")
    boot.state = {
        allowed = true, hp = 165, bag_max = 12,
        character = { name = "Tester", display_name = "Tester", class = "hoplit", faction = "kalidra", level = 3, xp = 140,
                      xp_need = 300, gold = 172, honor = 12, appearance = { gender = "m" } },
        fighter = { level = 3, sila = 15, vydrz = 13 },
        wquests = { { quest_id = "k1", state = "done" }, { quest_id = "k2", state = "active", progress = 1 }, { quest_id = "k3", state = "ready" } },
    }
    boot.loading = true
    timer.sleep(0.5)
    EnterWorld()
    timer.sleep(5); shot("1-hrac")
    local G = map.Ground
    local views = {
        { "2-mesto", 40, G(40, 15) + 18, 15, 74, G(74, 15), 15 },
        { "3-prehled", 0, 140, -60, 0, 0, 10 },
        { "4-nikias", -46, G(-46, 44) + 2.5, 44, -50, G(-50, 44) + 1, 44 },
        { "7-krajina", -40, G(-40, 30) + 9, 30, -20, G(-20, 0) + 3, 0 },
        { "8-akvadukt", -30, G(-30, 12) + 5, 12, -45, G(-45, 13) + 4, 13 },
        { "9-zatoka", -50, G(-50, -60) + 14, -60, -68, G(-68, -78), -78 },
        { "21-pobrezi", -58, G(-58, 40) + 2.5, 40, -85, G(-85, 38) + 0.3, 38 },
        { "23-breh-k-jihu", -58, G(-58, 96) + 3.5, 96, -40, G(-40, 170) + 4, 170 },
        { "24-prusmyk", -24, G(-24, 132) + 2.5, 132, -8, G(-8, 158) + 3, 158 },
        { "26-poust", 18, G(18, 228) + 9, 228, 40, G(40, 280) + 2, 280 },
        { "27-oaza", 24, G(24, 262) + 4, 262, 38, G(38, 272) + 1, 272 },
        { "28-ruiny", -8, G(-8, 258) + 4, 258, -22, G(-22, 268) + 2, 268 },
        { "29-jih-shora", 0, 120, 120, 0, 0, 240 },
    }
    for _, v in ipairs(views) do
        lookFrom(v[2], v[3], v[4], v[5], v[6], v[7])
        timer.sleep(2.0); shot(v[1])
    end
    -- noc: 23:00
    _G.world.environment({ real_time = false, time_of_day = 23 })
    lookFrom(-40, G(-40, 30) + 9, 30, -20, G(-20, 0) + 3, 0)
    timer.sleep(4); shot("22-noc")
    _G.world.environment({ real_time = true })
    -- rozhovor s Nikiasem
    player.cameraOverride = nil
    player.Respawn({ x = -50.5, z = 46.5 })
    timer.sleep(1.5)
    for _, n in ipairs(world.npcs) do if n.def.id == "nikias" then hud.Open(boot, n) end end
    timer.sleep(1.5); shot("5-rozhovor")
    hud.Close()
    minimap.big = true
    timer.sleep(0.5); shot("6-mapa")
    minimap.big = false
    chat.TestFill()
    timer.sleep(0.5); shot("6b-chat")
    chat.Close()
    game.log("SELFTEST hotovo")
    game.quit()
end

-- ------------------------------------------------------------------ životní cyklus
boot.sound = sound
boot.chat = chat
boot.presence = presence

function on_start()
    skin.Init()
    sound.ApplyVolumes()
    options.Apply()
    game.custom_pause(true)   -- Esc = nastavení hry (ne menu přehrávače)
    _G.world.environment({ day_night = true, real_time = true, fog = 0.0016, fog_height = 0, shadow_distance = 200, haze = 0.35 })
    if game.selftest() then timer.start(Selftest); return end
    boot.busy = true
    local function resume()
        boot.status = "Obnovuji přihlášení…"
        api.Resume(function(ok)
            boot.busy, boot.status = false, ""
            if ok then LoadState() end
        end)
    end
    if net.launcher_ticket() then
        -- spuštěno z launcheru s přihlášeným účtem -> bez přihlašovací obrazovky
        boot.status = "Přihlašuji účtem z launcheru…"
        api.SignInWithTicket(function(ok)
            if ok then boot.busy = false; boot.status = ""; LoadState()
            else game.log("lístek z launcheru neplatný – zkouším uložené přihlášení"); resume() end
        end)
    else
        resume()
    end
end

function on_update(dt)
    if not boot.inWorld then return end
    local chatEsc = chat.Update(boot, hud.IsOpen() or options.open)
    boot.typing = ui.wants_keyboard() or chat.typing
    if input.pressed("Escape") and not options.rebinding and not chatEsc then
        if hud.IsOpen() then hud.Close() else options.Toggle() end
    end
    player.inputEnabled = not hud.IsOpen() and not boot.typing and not options.open
    player.cameraInput = not options.open and not boot.typing
    player.Update(dt, boot.spawn)
    if player.cameraOverride then
        local o = player.cameraOverride
        local cam = entity.find("Camera")
        local dx, dy, dz = o[4] - o[1], o[5] - o[2], o[6] - o[3]
        entity.set_position(cam, o[1], o[2], o[3])
        entity.set_rotation(cam, math.deg(math.atan(dy, math.sqrt(dx * dx + dz * dz))), math.deg(math.atan(-dx, -dz)), 0)
    else
        player.UpdateCamera(dt, false)
    end
    world.Update(dt)
    presence.Update(dt, player)
    local px, _, pz = player.Position()
    hud.Update(boot, world, px, pz)
    minimap.Update(boot)
    -- návrat do bezpečí (T): 3 s soustředění, pohyb ho přeruší
    if keys.Down("recall") and not recallT then recallT = 3; hud.Notice("Návrat do bezpečí… (nehýbej se)") end
    if recallT then
        if player.speed and player.speed > 0.5 then recallT = nil; hud.Notice("Návrat přerušen")
        else
            recallT = recallT - dt
            if recallT <= 0 then recallT = nil; player.Respawn(boot.spawn) end
        end
    end
    -- poloha se ukládá každé 2 s
    if savePosKey and game.time() > savePosAt then
        savePosAt = game.time() + 2
        settings.set(savePosKey, { math.floor(px * 10) / 10, math.floor(pz * 10) / 10 })
    end
end

function on_gui()
    if not boot.inWorld then
        if boot.loading then screens.Loading(boot)
        elseif NeedsCharacter() and not boot.busy then screens.Creator(boot)
        else screens.Login(boot) end
        return
    end
    presence.Draw()
    hud.Draw(boot, world, player)
    minimap.Draw(boot, player, hud.Marker)
    chat.Draw(boot)
    options.Draw(boot)
end

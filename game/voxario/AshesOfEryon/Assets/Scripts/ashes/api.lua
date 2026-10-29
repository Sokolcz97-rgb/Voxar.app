-- Spojení se serverem hry (SupabaseClient.cs): přihlášení účtem StudioVoxario a herní RPC.
-- Server je autoritativní – stejné funkce (ashes_*) používá webová verze.
local M = {}

M.Url = "https://rioexuvgvmdwvidfakxy.supabase.co"
M.PublishableKey = "sb_publishable_s0KxdrY9Wm7_j2mtI-PnJg_eYbQln9-"

net.configure(M.Url, M.PublishableKey)

local function readError(r, fallback)
    local m = r.error
    if r.data and type(r.data) == "table" then
        m = r.data.message or r.data.error_description or r.data.msg or m
    end
    if not m or m == "" then return fallback end
    if tostring(m):find("Invalid login") then return fallback end
    return tostring(m)
end
M.ReadError = readError

local function remember()
    local s = net.session()
    if s then settings.set("ashes.refresh", s.refresh_token) end
end

function M.SignedIn() return net.session() ~= nil end
function M.Email() local s = net.session(); return s and s.email or "" end
function M.UserId() local s = net.session(); return s and s.user_id or nil end

-- done(err) – nil = přihlášeno
function M.SignIn(email, password, done)
    net.sign_in(email, password, function(r)
        if not r.ok then return done(readError(r, "Přihlášení se nepodařilo. Zkontroluj e-mail a heslo.")) end
        remember()
        done(nil)
    end)
end

-- Jednorázový lístek z launcheru (ASHES_LAUNCHER_TICKET) – hra si z něj udělá vlastní relaci
function M.SignInWithTicket(done)
    if not net.launcher_ticket() then return done(false) end
    net.sign_in_ticket(function(r)
        if r.ok then remember() end
        done(r.ok)
    end)
end

-- Uložený obnovovací token (bez hesla)
function M.Resume(done)
    local refresh = settings.get("ashes.refresh", "")
    if refresh == "" then return done(false) end
    net.set_session("", refresh, 1)
    net.refresh(function(r)
        if r.ok then remember() else settings.set("ashes.refresh", nil) end
        done(r.ok)
    end)
end

function M.SignOut()
    net.sign_out()
    settings.set("ashes.refresh", nil)
end

-- Serverová funkce: done(data, err)
function M.Rpc(fn, args, done)
    net.rpc(fn, args or {}, function(r)
        if r.ok then
            remember()   -- token se mohl obnovit
            if done then done(r.data, nil) end
        else
            if done then done(nil, readError(r, "Server odmítl požadavek.")) end
        end
    end)
end

-- Novinky na přihlašovací obrazovce (ashes_changelog)
function M.News(done)
    net.select("ashes_changelog", "select=title_cs,text_cs,published_at&kind=eq.game&order=published_at.desc&limit=3",
        function(r) done(r.ok and r.data or nil, r.ok) end)
end

return M

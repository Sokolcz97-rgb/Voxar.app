-- Hudba (Music.cs): album „Eryon“ ze soukromého úložiště ashes-music – album.json, skladba podle
-- kapitoly, podepsaný odkaz, přehrávání ve smyčce. Zvuky (Sfx.cs): generované v kódu, bez souborů.
local api = require("ashes.api")

local M = { nowPlaying = nil }

function M.MusicVolume(v)
    if v then settings.set("audio.music", math.max(0, math.min(1, v))) end
    return settings.get("audio.music", 0.45)
end
function M.SfxVolume(v)
    if v then settings.set("audio.sfx", math.max(0, math.min(1, v))) end
    return settings.get("audio.sfx", 0.7)
end
function M.ApplyVolumes()
    audio.volume("music", M.MusicVolume() * 0.6)
    audio.volume("effects", M.SfxVolume())
    audio.volume("master", settings.get("audio.master", 1))
    audio.mute(settings.get("audio.mute", false))
end

function M.StartMusic(chapter)
    local s = net.session()
    if not s then return end
    local headers = { apikey = api.PublishableKey, Authorization = "Bearer " .. s.access_token }
    net.request({ url = api.Url .. "/storage/v1/object/authenticated/ashes-music/album.json", headers = headers }, function(r)
        local album = r.ok and r.data
        if type(album) ~= "table" or type(album.tracks) ~= "table" or #album.tracks == 0 then return end
        chapter = math.max(1, math.min(6, chapter or 1))
        local track = album.tracks[1]
        for _, t in ipairs(album.tracks) do
            for _, c in ipairs(t.chapters or {}) do if c == chapter then track = t; goto found end end
        end
        ::found::
        net.storage_url("ashes-music", track.file, 21600, function(sr)
            if not sr.ok then return end
            net.download(sr.body, function(dr)
                if not dr.ok then return end
                audio.music(dr.body, true, 4.0, 1.0)
                M.nowPlaying = track.title
            end)
        end)
    end)
end

function M.StopMusic() audio.stop_music(2); M.nowPlaying = nil end

-- ------------------------------------------------------------------ zvuky
local RATE = 22050
local cache = {}
local seed = 22222
local function noise()
    seed = (seed * 1664525 + 1013904223) & 0xFFFFFFFF
    return ((seed >> 9) / 4194304) * 2 - 1
end
local function env(t, attack, decay)
    if t < attack then return t / attack end
    return math.exp(-(t - attack) / (decay * 0.3))
end
local function chord(t, notes, step)
    local v = 0
    for i, f in ipairs(notes) do
        local t0 = (i - 1) * step
        if t >= t0 then
            local tt = t - t0
            v = v + math.sin(tt * 2 * math.pi * f) * math.exp(-tt * 3) * 0.3
        end
    end
    return v
end
local sin, pi = math.sin, math.pi
local DEFS = {
    hit = { 0.22, function(t) return (noise() * 0.7 + sin(t * 2 * pi * 110) * 0.5) * env(t, 0.004, 0.18) end },
    crit = { 0.4, function(t) return (noise() * 0.6 + sin(t * 2 * pi * (180 - t * 200)) * 0.7) * env(t, 0.003, 0.35) end },
    block = { 0.3, function(t) return (sin(t * 2 * pi * 820) * 0.5 + sin(t * 2 * pi * 1230) * 0.3 + noise() * 0.2) * env(t, 0.002, 0.26) end },
    dodge = { 0.25, function(t) return noise() * 0.35 * sin(pi * t / 0.25) end },
    coin = { 0.35, function(t) return sin(t * 2 * pi * (t < 0.08 and 1320 or 1760)) * 0.45 * env(t, 0.002, 0.3) end },
    level = { 1.1, function(t) return chord(t, { 523.25, 659.25, 783.99, 1046.5 }, 0.12) * env(t, 0.01, 1.0) end },
    quest = { 0.7, function(t) return chord(t, { 587.33, 880 }, 0.15) * env(t, 0.01, 0.6) end },
    swing = { 0.2, function(t) return noise() * 0.4 * sin(pi * t / 0.2) * (1 - t * 2) end },
    warn = { 0.16, function(t) return (sin(t * 2 * pi * 660) * 0.35 + sin(t * 2 * pi * 990) * 0.2) * env(t, 0.003, 0.14) end },
    click = { 0.06, function(t) return noise() * 0.3 * env(t, 0.001, 0.05) end },
    fall = { 0.5, function(t) return (noise() * 0.5 + sin(t * 2 * pi * (90 - t * 80)) * 0.6) * env(t, 0.01, 0.45) end },
}

function M.Play(id, gain)
    if M.SfxVolume() <= 0.001 then return end
    local data = cache[id]
    if not data then
        local def = DEFS[id]
        if not def then return end
        data = {}
        local n = math.ceil(def[1] * RATE)
        for i = 0, n - 1 do
            local v = def[2](i / RATE)
            data[i + 1] = v < -1 and -1 or (v > 1 and 1 or v)
        end
        cache[id] = data
    end
    audio.samples(data, RATE, gain or 1, 1 + (math.random() - 0.5) * 0.12)
end

return M

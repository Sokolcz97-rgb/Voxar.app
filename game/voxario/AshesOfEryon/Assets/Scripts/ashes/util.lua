-- Drobnosti sdílené více moduly
local M = {}

-- Čas z ISO 8601 (UTC, jak ho vrací server) na sekundy od roku 1970; nil, když to není čas
-- Životy postavy jako na serveru (ashes_hp: výdrž s výbavou × (úroveň + 1) × třída). Server posílá
-- st.hp už spočítané z výbavy; vzorec je záloha a strop – hp nikdy nepřeleze maximum.
function M.HpMax(st)
    local f = st and st.fighter
    local calc
    if f and f.vydrz then
        local cls = (st.character and st.character.class) or f.class
        local mul = cls == "hoplit" and 5 or cls == "lucistnik" and 4.5 or 4
        calc = math.max(10, (f.vydrz or 0) * ((f.level or (st.character and st.character.level) or 1) + 1) * mul)
    end
    local max = (st and tonumber(st.hp)) or calc or 10
    return math.floor(max + 0.5)
end

function M.Hp(st)
    local max = M.HpMax(st)
    local cur = st and tonumber(st.hp_current) or max
    return math.max(0, math.min(max, math.floor(cur + 0.5))), max
end

function M.IsoToEpoch(s)
    local y, mo, d, h, mi, se = tostring(s or ""):match("(%d+)-(%d+)-(%d+)[T ](%d+):(%d+):(%d+)")
    if not y then return nil end
    y, mo, d = tonumber(y), tonumber(mo), tonumber(d)
    -- dny od 1970 („days from civil“)
    if mo <= 2 then y = y - 1 end
    local era = y // 400
    local yoe = y - era * 400
    local mp = (mo + 9) % 12
    local doy = (153 * mp + 2) // 5 + d - 1
    local doe = yoe * 365 + yoe // 4 - yoe // 100 + doy
    local t = (era * 146097 + doe - 719468) * 86400 + tonumber(h) * 3600 + tonumber(mi) * 60 + tonumber(se)
    -- posun pásma (+01:00 / -05:00); Z nebo nic = UTC
    local sign, oh, om = tostring(s):match("%d%d:%d%d:%d%d[%.%d]*([%+%-])(%d%d):?(%d%d)$")
    if sign then t = t - (sign == "+" and 1 or -1) * (tonumber(oh) * 3600 + tonumber(om) * 60) end
    return t
end

-- 1:05:09 nebo 5:09
function M.Clock(secs)
    secs = math.max(0, math.floor(secs))
    local h, m, s = secs // 3600, secs % 3600 // 60, secs % 60
    if h > 0 then return string.format("%d:%02d:%02d", h, m, s) end
    return string.format("%d:%02d", m, s)
end

return M

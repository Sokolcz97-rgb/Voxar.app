-- Stromy talentů podle povolání (Technický blueprint: UI, Voda a Optimalizace – 2B).
-- Každé povolání má 3 větve po 4 úrovních. Uzel:
--   { id, name, kind = "passive" (čtverec) | "active" (kruh), branch = 1..3, tier = 1..4, max = počet bodů,
--     requires = { id, ... } (musí mít aspoň 1 bod), icon, desc,
--     mods = { atk, def, matk, hp, mp, crit, cdr } (za každý bod; hp / mp / cdr v %),
--     skill = { … } (aktivní talent: kouzlo jako u povolání – přidá se na akční lištu) }
-- Úroveň `tier` se odemkne až po (tier - 1) * 3 bodech ve stejné větvi.
local M = {}

local function P(id, name, branch, tier, max, mods, icon, desc, requires)
    return { id = id, name = name, kind = "passive", branch = branch, tier = tier, max = max, mods = mods, icon = icon, desc = desc,
             requires = requires or {} }
end
local function A(id, name, branch, tier, skill, desc, requires)
    return { id = id, name = name, kind = "active", branch = branch, tier = tier, max = 1, skill = skill, icon = id, desc = desc,
             requires = requires or {} }
end

M.Trees = {
    knight = { branches = { "Ochrana", "Čepel", "Zřídlo" }, nodes = {
        P("k_guard", "Kalená zbroj", 1, 1, 3, { def = 3 }, "p_def", "+3 obrana za bod."),
        P("k_vigor", "Vytrvalost", 1, 2, 3, { hp = 5 }, "p_hp", "+5 % maximálních životů za bod.", { "k_guard" }),
        A("t_knight_bulwark", "Hradba", 1, 3, { name = "Hradba", mp = 20, cd = 30, buff = { def = 30, t = 8 }, self = true, anim = "Block",
            color = { 0.6, 0.85, 1.0 } }, "Aktivní: +30 obrana na 8 s.", { "k_vigor" }),
        P("k_aegis", "Aegis Půlměsíce", 1, 4, 2, { def = 5, hp = 5 }, "p_def", "+5 obrana a +5 % životů za bod.", { "t_knight_bulwark" }),
        P("k_edge", "Ostří", 2, 1, 3, { atk = 2 }, "p_atk", "+2 útok za bod."),
        P("k_precision", "Přesnost", 2, 2, 3, { crit = 3 }, "p_crit", "+3 % šance na kritický zásah za bod.", { "k_edge" }),
        A("t_knight_judg", "Rozsudek", 2, 3, { name = "Rozsudek", mp = 25, cd = 16, mult = 2.6, anim = "1H_Melee_Attack_Chop",
            color = { 1.0, 0.85, 0.35 } }, "Aktivní: mocný úder za 260 % útoku.", { "k_precision" }),
        P("k_master", "Mistr meče", 2, 4, 2, { atk = 4, crit = 2 }, "p_atk", "+4 útok a +2 % kritických za bod.", { "t_knight_judg" }),
        P("k_spring", "Pramen many", 3, 1, 3, { mp = 6 }, "p_mp", "+6 % many za bod."),
        P("k_haste", "Rytmus Zřídla", 3, 2, 3, { cdr = 4 }, "p_cdr", "-4 % doby obnovení za bod.", { "k_spring" }),
        A("t_knight_spring", "Léčivý pramen", 3, 3, { name = "Léčivý pramen", mp = 30, cd = 40, heal = 0.45, self = true, cast = 1.0,
            anim = "Spellcast_Raise", color = { 0.3, 1.0, 0.9 } }, "Aktivní: vyléčí 45 % životů.", { "k_haste" }),
        P("k_grace", "Milost", 3, 4, 2, { hp = 4, mp = 4, cdr = 3 }, "p_hp", "+4 % životů a many, -3 % obnovení.", { "t_knight_spring" }),
    } },
    mage = { branches = { "Mráz", "Aetherium", "Mysl" }, nodes = {
        P("m_chill", "Ledový dech", 1, 1, 3, { matk = 3 }, "p_matk", "+3 magický útok za bod."),
        P("m_frostbite", "Omrzliny", 1, 2, 3, { crit = 3 }, "p_crit", "+3 % kritických za bod.", { "m_chill" }),
        A("t_mage_nova", "Ledová nova", 1, 3, { name = "Ledová nova", mp = 35, cd = 18, mult = 1.8, aoe = 6, self_aoe = true, slow = 5,
            magic = true, anim = "Spellcast_Raise", color = { 0.75, 0.95, 1.0 } }, "Aktivní: mráz kolem tebe, zpomalí nepřátele.", { "m_frostbite" }),
        P("m_winter", "Věčná zima", 1, 4, 2, { matk = 5 }, "p_matk", "+5 magický útok za bod.", { "t_mage_nova" }),
        P("m_focus", "Ohnisko", 2, 1, 3, { matk = 2, crit = 1 }, "p_matk", "+2 magický útok a +1 % kritických."),
        P("m_flow", "Proud Aetheria", 2, 2, 3, { cdr = 4 }, "p_cdr", "-4 % doby obnovení za bod.", { "m_focus" }),
        A("t_mage_meteor", "Meteor", 2, 3, { name = "Meteor", mp = 55, cd = 24, cast = 2.2, mult = 3.4, aoe = 5, magic = true,
            anim = "Spellcast_Long", color = { 1.0, 0.45, 0.15 } }, "Aktivní: ohnivý meteor za 340 % magie.", { "m_flow" }),
        P("m_arch", "Arcimágyně", 2, 4, 2, { matk = 4, crit = 2 }, "p_matk", "+4 magie a +2 % kritických za bod.", { "t_mage_meteor" }),
        P("m_well", "Hluboká studna", 3, 1, 3, { mp = 8 }, "p_mp", "+8 % many za bod."),
        P("m_ward", "Ochranné runy", 3, 2, 3, { def = 3, hp = 3 }, "p_def", "+3 obrana a +3 % životů za bod.", { "m_well" }),
        A("t_mage_blink", "Záblesk", 3, 3, { name = "Záblesk", mp = 15, cd = 12, dodge = true, self = true, anim = "Dodge_Backward",
            color = { 0.7, 0.6, 1.0 } }, "Aktivní: okamžitý odskok z boje.", { "m_ward" }),
        P("m_sage", "Mudrc", 3, 4, 2, { mp = 6, cdr = 4 }, "p_mp", "+6 % many a -4 % obnovení za bod.", { "t_mage_blink" }),
    } },
    warden = { branches = { "Ocel", "Bastion", "Runy" }, nodes = {
        P("w_might", "Síla", 1, 1, 3, { atk = 3 }, "p_atk", "+3 útok za bod."),
        P("w_fury", "Zuřivost", 1, 2, 3, { crit = 3 }, "p_crit", "+3 % kritických za bod.", { "w_might" }),
        A("t_warden_cleave", "Rozpolcení", 1, 3, { name = "Rozpolcení", mp = 25, cd = 14, mult = 2.2, aoe = 3.2,
            anim = "2H_Melee_Attack_Slice", color = { 1.0, 0.35, 0.2 } }, "Aktivní: široký sek všem kolem.", { "w_fury" }),
        P("w_titan", "Titán", 1, 4, 2, { atk = 5 }, "p_atk", "+5 útok za bod.", { "t_warden_cleave" }),
        P("w_plate", "Plátová zbroj", 2, 1, 3, { def = 4 }, "p_def", "+4 obrana za bod."),
        P("w_iron", "Železné zdraví", 2, 2, 3, { hp = 6 }, "p_hp", "+6 % životů za bod.", { "w_plate" }),
        A("t_warden_wall", "Ocelová zeď", 2, 3, { name = "Ocelová zeď", mp = 20, cd = 35, buff = { def = 40, t = 6 }, self = true,
            anim = "Blocking", color = { 0.9, 0.7, 0.4 } }, "Aktivní: +40 obrana na 6 s.", { "w_iron" }),
        P("w_unbroken", "Nezlomný", 2, 4, 2, { hp = 6, def = 3 }, "p_hp", "+6 % životů a +3 obrana za bod.", { "t_warden_wall" }),
        P("w_rune", "Runové ostří", 3, 1, 3, { atk = 1, crit = 2 }, "p_crit", "+1 útok a +2 % kritických."),
        P("w_tempo", "Rytmus oceli", 3, 2, 3, { cdr = 5 }, "p_cdr", "-5 % doby obnovení za bod.", { "w_rune" }),
        A("t_warden_rune", "Runa slunce", 3, 3, { name = "Runa slunce", mp = 30, cd = 30, buff = { atk = 15, t = 10 }, self = true,
            anim = "Spellcast_Raise", color = { 1.0, 0.95, 0.5 } }, "Aktivní: +15 útok na 10 s.", { "w_tempo" }),
        P("w_sun", "Dědic slunce", 3, 4, 2, { atk = 3, cdr = 3 }, "p_atk", "+3 útok a -3 % obnovení za bod.", { "t_warden_rune" }),
    } },
    engineer = { branches = { "Střelba", "Výbušniny", "Mechanika" }, nodes = {
        P("e_aim", "Mířidla", 1, 1, 3, { atk = 2, crit = 1 }, "p_crit", "+2 útok a +1 % kritických za bod."),
        P("e_eye", "Sokolí oko", 1, 2, 3, { crit = 3 }, "p_crit", "+3 % kritických za bod.", { "e_aim" }),
        A("t_engineer_volley", "Salva", 1, 3, { name = "Salva", mp = 30, cd = 16, mult = 1.6, aoe = 4.5, anim = "1H_Ranged_Shooting",
            color = { 1.0, 0.75, 0.35 } }, "Aktivní: déšť šipek na skupinu.", { "e_eye" }),
        P("e_sniper", "Odstřelovačka", 1, 4, 2, { atk = 5 }, "p_atk", "+5 útok za bod.", { "t_engineer_volley" }),
        P("e_powder", "Černý prach", 2, 1, 3, { atk = 3 }, "p_atk", "+3 útok za bod."),
        P("e_fuse", "Krátká zápalnice", 2, 2, 3, { cdr = 4 }, "p_cdr", "-4 % doby obnovení za bod.", { "e_powder" }),
        A("t_engineer_mine", "Krystalová mina", 2, 3, { name = "Krystalová mina", mp = 35, cd = 20, mult = 2.6, aoe = 4, stun = 1.5,
            anim = "Throw", color = { 1.0, 0.3, 0.1 } }, "Aktivní: výbuch, který omráčí.", { "e_fuse" }),
        P("e_demo", "Demolice", 2, 4, 2, { atk = 3, crit = 2 }, "p_atk", "+3 útok a +2 % kritických.", { "t_engineer_mine" }),
        P("e_gear", "Ozubená zbroj", 3, 1, 3, { def = 3 }, "p_def", "+3 obrana za bod."),
        P("e_batt", "Krystalová baterie", 3, 2, 3, { mp = 7 }, "p_mp", "+7 % many za bod.", { "e_gear" }),
        A("t_engineer_turret", "Opravný mechanismus", 3, 3, { name = "Opravný mechanismus", mp = 25, cd = 40, heal = 0.4, self = true,
            anim = "Use_Item", color = { 0.75, 0.8, 0.85 } }, "Aktivní: vyléčí 40 % životů.", { "e_batt" }),
        P("e_master", "Mistr mechanik", 3, 4, 2, { hp = 5, def = 3 }, "p_hp", "+5 % životů a +3 obrana za bod.", { "t_engineer_turret" }),
    } },
}

function M.Tree(classId) return M.Trees[classId] end

local function find(tree, id)
    for _, n in ipairs(tree.nodes) do if n.id == id then return n end end
end
M.Find = find

-- body: 3 na začátek (testovací kanál) + 1 za každou úroveň
function M.Points(s) return 3 + (s.level - 1) end
function M.Spent(s)
    local n = 0
    for _, r in pairs(s.talents or {}) do n = n + r end
    return n
end
function M.SpentIn(s, tree, branch)
    local n = 0
    for _, node in ipairs(tree.nodes) do
        if node.branch == branch then n = n + ((s.talents or {})[node.id] or 0) end
    end
    return n
end

-- lze investovat bod? -> true | false, důvod
function M.CanLearn(s, node)
    local tree = M.Tree(s.class.id)
    local rank = (s.talents or {})[node.id] or 0
    if rank >= node.max then return false, "Maximum" end
    if M.Spent(s) >= M.Points(s) then return false, "Žádné volné body" end
    local need = (node.tier - 1) * 3
    if M.SpentIn(s, tree, node.branch) < need then return false, string.format("Potřebuje %d bodů ve větvi %s", need, tree.branches[node.branch]) end
    for _, r in ipairs(node.requires) do
        if ((s.talents or {})[r] or 0) < 1 then return false, "Nejdřív: " .. (find(tree, r) or { name = r }).name end
    end
    return true
end

-- lze odebrat bod? (nesmí rozbít předpoklady ani prahy větve: body v nižších úrovních >= (úroveň - 1) * 3)
function M.CanUnlearn(s, node)
    local rank = (s.talents or {})[node.id] or 0
    if rank <= 0 then return false end
    local tree = M.Tree(s.class.id)
    local function below(branch, tier)
        local n = 0
        for _, o in ipairs(tree.nodes) do
            if o.branch == branch and o.tier < tier then n = n + (s.talents[o.id] or 0) end
        end
        return n
    end
    for _, other in ipairs(tree.nodes) do
        if (s.talents[other.id] or 0) > 0 and other.id ~= node.id then
            if rank == 1 then
                for _, r in ipairs(other.requires) do if r == node.id then return false end end
            end
            if other.branch == node.branch and other.tier > node.tier and below(node.branch, other.tier) - 1 < (other.tier - 1) * 3 then
                return false
            end
        end
    end
    return true
end

function M.Learn(s, node)
    if not M.CanLearn(s, node) then return false end
    s.talents[node.id] = (s.talents[node.id] or 0) + 1
    M.Apply(s)
    M.Save(s)
    return true
end

function M.Unlearn(s, node)
    if not M.CanUnlearn(s, node) then return false end
    s.talents[node.id] = s.talents[node.id] - 1
    if s.talents[node.id] <= 0 then s.talents[node.id] = nil end
    M.Apply(s)
    M.Save(s)
    return true
end

function M.Reset(s)
    s.talents = {}
    M.Apply(s)
    M.Save(s)
end

-- přepočet: modifikátory statů, maximální životy / mana, aktivní talenty na akční lištu
function M.Apply(s)
    local tree = M.Tree(s.class.id)
    local mods = { atk = 0, def = 0, matk = 0, hp = 0, mp = 0, crit = 0, cdr = 0 }
    local actives = {}
    if tree then
        for _, node in ipairs(tree.nodes) do
            local r = (s.talents or {})[node.id] or 0
            if r > 0 then
                for k, v in pairs(node.mods or {}) do mods[k] = (mods[k] or 0) + v * r end
                if node.skill then
                    local sk = {}
                    for k, v in pairs(node.skill) do sk[k] = v end
                    sk.icon = node.icon
                    actives[#actives + 1] = sk
                end
            end
        end
    end
    s.mods = mods
    local hpFrac = s.maxhp and s.maxhp > 0 and s.hp / s.maxhp or 1
    local mpFrac = s.maxmp and s.maxmp > 0 and s.mp / s.maxmp or 1
    s.maxhp = math.floor(s.baseHp * (1 + mods.hp / 100))
    s.maxmp = math.floor(s.baseMp * (1 + mods.mp / 100))
    s.hp, s.mp = math.floor(s.maxhp * hpFrac + 0.5), math.floor(s.maxmp * mpFrac + 0.5)
    -- dovednosti: 5 povolání + aktivní talenty
    s.skills = {}
    for i, sk in ipairs(s.class.skills) do
        local c = {}
        for k, v in pairs(sk) do c[k] = v end
        c.icon = s.class.id .. "_" .. i
        s.skills[i] = c
    end
    for _, sk in ipairs(actives) do s.skills[#s.skills + 1] = sk end
end

local function key(s) return "eryndor.talents." .. s.class.id end
function M.Load(s)
    local t = settings and settings.get and settings.get(key(s))
    s.talents = type(t) == "table" and t or {}
    -- neplatné nebo nadbytečné body (jiná verze stromu, nižší úroveň) zahodit
    local tree = M.Tree(s.class.id)
    for id, r in pairs(s.talents) do
        local node = tree and find(tree, id)
        if not node or type(r) ~= "number" then s.talents[id] = nil else s.talents[id] = math.min(r, node.max) end
    end
    if M.Spent(s) > M.Points(s) then s.talents = {} end
end
function M.Save(s)
    if settings and settings.set then settings.set(key(s), s.talents) end
end

return M

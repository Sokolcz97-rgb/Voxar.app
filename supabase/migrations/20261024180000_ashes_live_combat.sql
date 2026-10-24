-- Aktivní boj (Ashes of Eryon 0.9): hráč útočí, používá dovednost, uhýbá a blokuje v reálném čase.
-- Server je autoritativní: drží životy, odpočty akcí a rozvrh úderů nepřítele (nepřítel udeří
-- v pevných časech next_swing_at; hráč se může před úderem ohlásit úhybem/blokem).
-- Úder, na který klient neodpoví, se počítá jako zásah – vypnutí klienta tedy nepomůže.

create table if not exists public.ashes_live_fights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  region text not null,
  enemy_id text not null,
  lvl int not null,
  p jsonb not null,               -- hráč (ashes_fighter)
  e jsonb not null,               -- nepřítel (ashes_enemy)
  hp_p numeric not null, max_p numeric not null,
  hp_e numeric not null, max_e numeric not null,
  started_at timestamptz not null default now(),
  swing_ms int not null,
  swing_index int not null default 0,
  next_swing_at timestamptz not null,
  defenses jsonb not null default '{}'::jsonb,   -- { "<index>": "dodge" | "block" }
  last_attack_at timestamptz,
  last_skill_at timestamptz,
  last_dodge_at timestamptz,
  calls int not null default 0,
  status text not null default 'active',          -- active | won | lost | fled
  finished_at timestamptz,
  result jsonb
);
create index if not exists ashes_live_fights_user on public.ashes_live_fights (user_id, started_at desc);
alter table public.ashes_live_fights enable row level security;
drop policy if exists ashes_live_own on public.ashes_live_fights;
create policy ashes_live_own on public.ashes_live_fights for select to authenticated using (user_id = auth.uid());

-- Odpočty (ms) podle povolání: základní útok, dovednost, úhyb
create or replace function public.ashes_live_rules(cls text)
returns jsonb language sql immutable as $$
  select jsonb_build_object(
    'attack_ms', case cls when 'hoplit' then 900 when 'lucistnik' then 750 else 1050 end,
    'skill_ms', 7000,
    'dodge_ms', 1100,
    'range', case cls when 'hoplit' then 3.2 else 14 end,
    'skill', case cls when 'hoplit' then 'Úder štítem' when 'lucistnik' then 'Přesná rána' else 'Plamen' end,
    'skill_desc', case cls when 'hoplit' then 'Silný úder, který nepřítele na chvíli omráčí.'
                           when 'lucistnik' then 'Mířený výstřel s velkým poškozením.'
                           else 'Ohnivá vlna, která prorazí jakoukoli zbroj.' end);
$$;

-- Jeden zásah útočníka do obránce (stejný základ jako ashes_simulate)
create or replace function public.ashes_live_hit(att jsonb, def jsonb, mult numeric, passive numeric)
returns jsonb language plpgsql volatile as $$
declare dmg numeric; wmin numeric; wmax numeric; red numeric; maxred numeric; critc numeric; crit boolean := false;
begin
  if def ->> 'class' = 'lucistnik' and att ->> 'class' <> 'vestec' and random() < passive then
    return jsonb_build_object('d', 0, 'e', true);
  end if;
  if def ->> 'class' = 'hoplit' and coalesce((def ->> 'shield')::boolean, false) and att ->> 'class' <> 'vestec' and random() < passive then
    return jsonb_build_object('d', 0, 'b', true);
  end if;
  wmin := greatest(1, public.ashes_n(att, 'wmin'));
  wmax := greatest(wmin, public.ashes_n(att, 'wmax'));
  dmg := (wmin + random() * (wmax - wmin)) * (1 + public.ashes_main(att) / 10);
  if att ->> 'class' <> 'vestec' then
    maxred := case def ->> 'class' when 'hoplit' then 0.5 when 'lucistnik' then 0.25 else 0.1 end;
    red := least(maxred, public.ashes_n(def, 'armor') / greatest(1, public.ashes_n(att, 'level')) / 100);
    dmg := dmg * (1 - red);
  end if;
  critc := least(0.5, public.ashes_n(att, 'stesti') * 5 / greatest(1, public.ashes_n(def, 'level') * 2) / 100);
  if random() < critc then crit := true; dmg := dmg * 2; end if;
  return jsonb_build_object('d', greatest(1, round(dmg * mult)), 'c', crit);
end $$;

-- Odměna za vítězství ve světě (stejná pravidla jako ashes_world_fight)
create or replace function public.ashes_live_reward(uid uuid, p_enemy text, lvl int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare ch public.ashes_characters; xp int; gold int; ups int; item uuid; item_row jsonb; r record; d jsonb; updated text[] := '{}';
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  xp := round(public.ashes_xp_need(ch.level) / (9 + ch.level * 0.4) * least(1.5, greatest(0.3, lvl::numeric / ch.level)));
  gold := round((4 + lvl * 3) * (0.7 + random() * 0.6));
  ups := public.ashes_grant(uid, xp, gold);
  update public.ashes_characters set wins = wins + 1 where user_id = uid;
  perform public.ashes_wall_add((case when ch.faction = 'legie' then -1 else 1 end) * (10 + lvl * 2));
  if random() < 0.08 and public.ashes_bag_count(uid) < 12 then
    item := public.ashes_make_item(uid, ch.class, lvl);
    select to_jsonb(i) into item_row from public.ashes_items i where i.id = item;
  end if;
  for r in select * from public.ashes_wquests where user_id = uid and state = 'active' for update loop
    d := public.ashes_wq_catalog() -> r.quest_id;
    if d ->> 'type' = 'kill' and d ->> 'target' = p_enemy then
      update public.ashes_wquests set progress = progress + 1,
        state = case when progress + 1 >= (d ->> 'count')::int then 'ready' else 'active' end, updated_at = now()
        where user_id = uid and quest_id = r.quest_id;
      updated := array_append(updated, r.quest_id);
    end if;
  end loop;
  return jsonb_build_object('xp', xp, 'gold', gold, 'levels', ups, 'item', item_row, 'quests', to_jsonb(updated));
end $$;
revoke all on function public.ashes_live_reward(uuid, text, int) from public, anon, authenticated;

-- Začátek souboje s nepřítelem ve světě
create or replace function public.ashes_live_begin(p_region text, p_enemy text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters; e jsonb; lvl int; lmin int; lmax int; look jsonb;
  pf jsonb; ef jsonb; sw int; f public.ashes_live_fights;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if ch.last_world_fight_at > now() - interval '3 seconds' and not public.ashes_is_admin() then raise exception 'Chvíli si oddychni.'; end if;
  select x into e from jsonb_array_elements(public.ashes_region_enemies() -> ch.faction -> p_region) x where x ->> 'id' = p_enemy limit 1;
  if e is null then raise exception 'Tady takový nepřítel není.'; end if;
  -- rozehraný souboj se ukončí jako útěk
  update public.ashes_live_fights set status = 'fled', finished_at = now() where user_id = uid and status = 'active';
  lmin := (e -> 'l' ->> 0)::int; lmax := (e -> 'l' ->> 1)::int;
  lvl := greatest(lmin, least(lmax, ch.level + (case when random() < 0.3 then 1 else 0 end) - (case when random() < 0.3 then 1 else 0 end)));
  if ch.faction = 'legie' then look := jsonb_build_object('kalidran', true, 'cloak', (array['#2c3e5a', '#7a1f16', '#3d4a2a'])[1 + floor(random() * 3)::int]);
  else look := jsonb_build_object('enemy', true, 'tint', (array['#7a1f1a', '#5b2a12', '#3a2f2a'])[1 + floor(random() * 3)::int]); end if;
  pf := public.ashes_fighter(uid);
  ef := public.ashes_enemy(e ->> 'n', e ->> 'c', lvl, (0.8 + random() * 0.2)::numeric, look);
  sw := case ef ->> 'class' when 'lucistnik' then 1650 when 'vestec' then 2150 else 1850 end;
  insert into public.ashes_live_fights (user_id, region, enemy_id, lvl, p, e, hp_p, max_p, hp_e, max_e, swing_ms, next_swing_at)
  values (uid, p_region, p_enemy, lvl, pf, ef, round(public.ashes_hp(pf)), round(public.ashes_hp(pf)), round(public.ashes_hp(ef)), round(public.ashes_hp(ef)),
          sw, now() + interval '1400 milliseconds')
  returning * into f;
  update public.ashes_characters set last_world_fight_at = now() where user_id = uid;
  return jsonb_build_object(
    'id', f.id, 'status', f.status,
    'hp_p', f.hp_p, 'max_p', f.max_p, 'hp_e', f.hp_e, 'max_e', f.max_e,
    'enemy', jsonb_build_object('name', ef ->> 'name', 'level', lvl, 'class', ef ->> 'class'),
    'cls', pf ->> 'class', 'rules', public.ashes_live_rules(pf ->> 'class'),
    'swing_ms', sw, 'swing_index', 0,
    'next_swing_in', round(extract(epoch from (f.next_swing_at - clock_timestamp())) * 1000),
    'events', '[]'::jsonb);
end $$;

-- Akce v souboji: tick | attack | skill | dodge | block | flee
create or replace function public.ashes_live_act(p_id uuid, p_action text, p_index int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); f public.ashes_live_fights; rules jsonb; ev jsonb := '[]'::jsonb; h jsonb; def text;
  nowt timestamptz := clock_timestamp(); grace interval := interval '300 milliseconds'; mult numeric; reward jsonb; res jsonb;
begin
  if uid is null or not public.ashes_can_play() then raise exception 'Ashes of Eryon se připravuje.' using errcode = '42501'; end if;
  select * into f from public.ashes_live_fights where id = p_id and user_id = uid for update;
  if not found then raise exception 'Souboj neexistuje.'; end if;
  rules := public.ashes_live_rules(f.p ->> 'class');

  if f.status = 'active' then
    -- ochrana proti zahlcení (běžná hra udělá jen pár akcí za sekundu)
    update public.ashes_live_fights set calls = calls + 1 where id = f.id;
    if f.calls > 20 * greatest(1, extract(epoch from (nowt - f.started_at))) then raise exception 'Příliš mnoho akcí.'; end if;
    -- souboj nejde nechat viset
    if nowt > f.started_at + interval '4 minutes' then f.status := 'fled'; end if;

    -- 1) přihlášení obrany na nejbližší úder (před vyhodnocením úderů)
    if f.status = 'active' and p_action in ('dodge', 'block') and p_index = f.swing_index
       and nowt >= f.next_swing_at - interval '900 milliseconds' and nowt <= f.next_swing_at + grace then
      if p_action = 'block' or f.last_dodge_at is null or nowt >= f.last_dodge_at + make_interval(secs => (rules ->> 'dodge_ms')::numeric / 1000) then
        f.defenses := f.defenses || jsonb_build_object(p_index::text, p_action);
        if p_action = 'dodge' then f.last_dodge_at := nowt; end if;
      end if;
    end if;

    -- 2) vyhodnotit údery nepřítele, jejichž čas už uplynul
    while f.status = 'active' and nowt > f.next_swing_at + grace loop
      def := f.defenses ->> f.swing_index::text;
      if def = 'dodge' then
        h := jsonb_build_object('d', 0, 'e', true, 'active', true);
      else
        h := public.ashes_live_hit(f.e, f.p, 1, 0.1);
        if def = 'block' and coalesce((h ->> 'd')::numeric, 0) > 0 then
          h := h || jsonb_build_object('d', greatest(1, round((h ->> 'd')::numeric *
                 case when coalesce((f.p ->> 'shield')::boolean, false) then 0.2 else 0.4 end)), 'b', true, 'active', true);
        end if;
      end if;
      f.hp_p := greatest(0, f.hp_p - coalesce((h ->> 'd')::numeric, 0));
      ev := ev || (h || jsonb_build_object('who', 'e', 'i', f.swing_index, 'hp_p', f.hp_p));
      f.swing_index := f.swing_index + 1;
      f.next_swing_at := f.next_swing_at + make_interval(secs => f.swing_ms / 1000.0);
      if f.hp_p <= 0 then f.status := 'lost'; end if;
    end loop;

    -- 3) útok / dovednost hráče
    if f.status = 'active' and p_action in ('attack', 'skill') then
      if p_action = 'attack' and (f.last_attack_at is null or nowt >= f.last_attack_at + make_interval(secs => (rules ->> 'attack_ms')::numeric / 1000 * 0.9)) then
        mult := 0.55; f.last_attack_at := nowt;
      elsif p_action = 'skill' and (f.last_skill_at is null or nowt >= f.last_skill_at + make_interval(secs => (rules ->> 'skill_ms')::numeric / 1000 * 0.95)) then
        mult := case f.p ->> 'class' when 'hoplit' then 1.2 when 'lucistnik' then 1.6 else 1.7 end;
        f.last_skill_at := nowt; f.last_attack_at := nowt;
        -- úder štítem: omráčení – nejbližší úder nepřítele se odsune
        if f.p ->> 'class' = 'hoplit' then
          f.next_swing_at := greatest(f.next_swing_at, nowt) + interval '1600 milliseconds';
          ev := ev || jsonb_build_object('who', 'stun', 'ms', 1600);
        end if;
      end if;
      if mult is not null then
        h := public.ashes_live_hit(f.p, f.e, mult, case when p_action = 'skill' then 0 else 0.15 end);
        f.hp_e := greatest(0, f.hp_e - coalesce((h ->> 'd')::numeric, 0));
        ev := ev || (h || jsonb_build_object('who', 'p', 'skill', p_action = 'skill', 'hp_e', f.hp_e));
        if f.hp_e <= 0 then f.status := 'won'; end if;
      end if;
    end if;

    if f.status = 'active' and p_action = 'flee' then f.status := 'fled'; end if;

    -- 4) konec souboje
    if f.status <> 'active' then
      f.finished_at := nowt;
      if f.status = 'won' then
        reward := public.ashes_live_reward(uid, f.enemy_id, f.lvl);
      elsif f.status = 'lost' then
        update public.ashes_characters set losses = losses + 1 where user_id = uid;
      end if;
      f.result := coalesce(reward, '{}'::jsonb);
    end if;

    update public.ashes_live_fights set hp_p = f.hp_p, hp_e = f.hp_e, swing_index = f.swing_index,
      next_swing_at = f.next_swing_at, defenses = f.defenses, last_attack_at = f.last_attack_at,
      last_skill_at = f.last_skill_at, last_dodge_at = f.last_dodge_at, status = f.status,
      finished_at = f.finished_at, result = f.result
    where id = f.id;
  end if;

  res := jsonb_build_object('id', f.id, 'status', f.status, 'hp_p', f.hp_p, 'max_p', f.max_p, 'hp_e', f.hp_e, 'max_e', f.max_e,
    'swing_index', f.swing_index, 'swing_ms', f.swing_ms,
    'next_swing_in', round(extract(epoch from (f.next_swing_at - clock_timestamp())) * 1000),
    'attack_ready_in', case when f.last_attack_at is null then 0 else greatest(0, round(extract(epoch from (f.last_attack_at + make_interval(secs => (rules ->> 'attack_ms')::numeric / 1000) - clock_timestamp())) * 1000)) end,
    'skill_ready_in', case when f.last_skill_at is null then 0 else greatest(0, round(extract(epoch from (f.last_skill_at + make_interval(secs => (rules ->> 'skill_ms')::numeric / 1000) - clock_timestamp())) * 1000)) end,
    'events', ev);
  if f.status <> 'active' then
    res := res || coalesce(f.result, '{}'::jsonb) || jsonb_build_object('won', f.status = 'won', 'title', f.e ->> 'name', 'state', public.ashes_state());
  end if;
  return res;
end $$;

grant execute on function public.ashes_live_begin(text, text) to authenticated;
grant execute on function public.ashes_live_act(uuid, text, int) to authenticated;
revoke all on function public.ashes_live_hit(jsonb, jsonb, numeric, numeric) from public, anon, authenticated;
grant execute on function public.ashes_live_rules(text) to authenticated;

-- úklid starých soubojů (7 dní)
do $$
begin
  perform cron.unschedule('ashes-live-fights-cleanup') where exists (select 1 from cron.job where jobname = 'ashes-live-fights-cleanup');
  perform cron.schedule('ashes-live-fights-cleanup', '17 4 * * *', $c$delete from public.ashes_live_fights where started_at < now() - interval '7 days'$c$);
end $$;

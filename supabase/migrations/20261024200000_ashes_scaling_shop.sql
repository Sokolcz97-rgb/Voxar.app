-- Ashes of Eryon: nepřátelé podle úrovně hráče + kovář s častější obnovou zboží.

-- ---------------------------------------------------------------- kovář
alter table public.ashes_characters
  add column if not exists shop_at timestamptz,
  add column if not exists shop_level int;

-- Nabídka: 8 kusů pro povolání a úroveň hráče (vždy zbraň + štít/zbroj).
-- Obnova každé 3 hodiny, po nové úrovni a když v nabídce zbudou nejvýš 2 kusy.
create or replace function public.ashes_shop()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters; left_n int; sl text;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  select count(*) into left_n from public.ashes_items where user_id = uid and in_shop;
  if ch.shop_at is null or ch.shop_at < now() - interval '3 hours' or ch.level > coalesce(ch.shop_level, 0) or left_n <= 2 then
    delete from public.ashes_items where user_id = uid and in_shop;
    perform public.ashes_make_item(uid, ch.class, ch.level + floor(random() * 2)::int, 'zbran', 0.08, true);
    perform public.ashes_make_item(uid, ch.class, ch.level + floor(random() * 2)::int, case when ch.class = 'hoplit' then 'stit' else 'zbroj' end, 0.08, true);
    -- 6 dalších kusů, každý jiný typ (náhodné pořadí)
    for sl in select s from unnest(array['helma', 'zbroj', 'rukavice', 'boty', 'amulet', 'stit', 'zbran']) s order by random() limit 6 loop
      perform public.ashes_make_item(uid, ch.class, ch.level + floor(random() * 2)::int, sl, 0.08, true);
    end loop;
    update public.ashes_characters set shop_at = now(), shop_level = ch.level, shop_day = current_date where user_id = uid;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(i) order by i.slot) from public.ashes_items i where i.user_id = uid and i.in_shop), '[]'::jsonb);
end $$;

-- Za kolik sekund kovář ukove nové zboží (pro okno kováře)
create or replace function public.ashes_shop_next()
returns int language sql stable security definer set search_path = public as $$
  select greatest(0, coalesce(extract(epoch from (c.shop_at + interval '3 hours' - now()))::int, 0))
  from public.ashes_characters c where c.user_id = auth.uid();
$$;
grant execute on function public.ashes_shop_next() to authenticated;

-- ---------------------------------------------------------------- úroveň nepřátel podle hráče
-- úroveň = úroveň hráče ±1, ale nejméně minimum oblasti (těžší oblasti zůstávají nebezpečné)
create or replace function public.ashes_scaled_enemy_level(player_level int, region_min int)
returns int language sql volatile as $$
  select greatest(1, region_min, player_level + (case when random() < 0.3 then 1 else 0 end) - (case when random() < 0.3 then 1 else 0 end));
$$;

-- ashes_world_fight (automatický souboj) i ashes_live_begin (aktivní boj) používají novou úroveň
do $$
declare fn text; src text;
begin
  foreach fn in array array['public.ashes_world_fight(text,text)', 'public.ashes_live_begin(text,text)'] loop
    select pg_get_functiondef(fn::regprocedure) into src;
    src := replace(src,
      'lvl := greatest(lmin, least(lmax, ch.level + (case when random() < 0.3 then 1 else 0 end) - (case when random() < 0.3 then 1 else 0 end)));',
      'lvl := public.ashes_scaled_enemy_level(ch.level, lmin);');
    if position('ashes_scaled_enemy_level' in src) = 0 then raise exception 'Úprava % se nepodařila', fn; end if;
    execute src;
  end loop;
end $$;

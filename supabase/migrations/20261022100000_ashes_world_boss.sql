-- Světový boss: mořský obr Thalassos se sdílenými životy pro celý server.
create table if not exists public.ashes_world_boss (
  id int primary key default 1 check (id = 1),
  name text not null default 'Thalassos, mořský obr',
  cls text not null default 'hoplit',
  generation int not null default 1,
  hp int not null default 3000,
  hp_max int not null default 3000,
  spawned_at timestamptz not null default now(),
  killed_at timestamptz,
  killer text
);
insert into public.ashes_world_boss (id) values (1) on conflict do nothing;

create table if not exists public.ashes_world_boss_hits (
  generation int not null,
  user_id uuid not null,
  name text,
  damage int not null default 0,
  hits int not null default 0,
  primary key (generation, user_id)
);
alter table public.ashes_world_boss enable row level security;
alter table public.ashes_world_boss_hits enable row level security;

-- oživení po 20 minutách; životy podle počtu aktivních hrdinů
create or replace function public.ashes_boss_respawn_if_due()
returns void language plpgsql security definer set search_path = public as $$
declare b ashes_world_boss; active int; mx int;
begin
  select * into b from ashes_world_boss where id = 1 for update;
  if b.killed_at is not null and b.killed_at < now() - interval '20 minutes' then
    select count(*) into active from ashes_characters where last_seen > now() - interval '7 days';
    mx := 1500 + greatest(1, active) * 600;
    update ashes_world_boss set generation = generation + 1, hp = mx, hp_max = mx, spawned_at = now(), killed_at = null, killer = null where id = 1;
  end if;
end $$;

create or replace function public.ashes_boss_state()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); b ashes_world_boss;
begin
  perform public.ashes_boss_respawn_if_due();
  select * into b from ashes_world_boss where id = 1;
  return jsonb_build_object(
    'name', b.name, 'cls', b.cls, 'generation', b.generation, 'hp', b.hp, 'hp_max', b.hp_max,
    'alive', b.killed_at is null,
    'respawn_at', case when b.killed_at is not null then b.killed_at + interval '20 minutes' end,
    'killer', b.killer,
    'my_damage', coalesce((select damage from ashes_world_boss_hits where generation = b.generation and user_id = uid), 0),
    'top', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'damage', damage) order by damage desc)
                     from (select name, damage from ashes_world_boss_hits where generation = b.generation order by damage desc limit 5) t), '[]'::jsonb));
end $$;

create or replace function public.ashes_boss_attack()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require(); ch ashes_characters; b ashes_world_boss; fight jsonb; lvl int;
  dmg int := 0; r jsonb; xp int; gold int; ups int := 0; killed boolean := false; nm text; c record;
  item uuid; item_row jsonb;
begin
  select * into ch from ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if ch.last_world_fight_at > now() - interval '15 seconds' and not public.ashes_is_admin() then
    raise exception 'Nabírej dech – na obra znovu za chvíli.';
  end if;
  perform public.ashes_boss_respawn_if_due();
  select * into b from ashes_world_boss where id = 1 for update;
  if b.killed_at is not null then raise exception 'Obr už leží v příboji. Vrátí se za chvíli.'; end if;
  nm := public.ashes_display_name(ch);
  lvl := greatest(ch.level + 3, 6);
  fight := public.ashes_simulate(public.ashes_fighter(uid),
    public.ashes_enemy(b.name, b.cls, lvl, 1.0, jsonb_build_object('boss', true, 'tint', '#2c4a5a')));
  for r in select * from jsonb_array_elements(fight -> 'rounds') loop
    if (r ->> 'a')::int = 1 and not coalesce((r ->> 'e')::boolean, false) then dmg := dmg + (r ->> 'd')::int; end if;
  end loop;
  dmg := least(dmg, b.hp);
  update ashes_world_boss set hp = hp - dmg where id = 1;
  insert into ashes_world_boss_hits (generation, user_id, name, damage, hits) values (b.generation, uid, nm, dmg, 1)
    on conflict (generation, user_id) do update set damage = ashes_world_boss_hits.damage + excluded.damage, hits = ashes_world_boss_hits.hits + 1, name = excluded.name;
  update ashes_characters set last_world_fight_at = now() where user_id = uid;
  xp := greatest(1, round(public.ashes_xp_need(ch.level) / 25.0));
  gold := 4 + ch.level * 2;
  if b.hp - dmg <= 0 then
    killed := true;
    update ashes_world_boss set killed_at = now(), killer = nm where id = 1;
    perform public.ashes_log('boss', format('%s zasadil poslední ránu – %s padl! Bojovalo %s hrdinů.', nm, b.name,
      (select count(*) from ashes_world_boss_hits where generation = b.generation)));
    for c in select h.user_id from ashes_world_boss_hits h where h.generation = b.generation loop
      perform public.ashes_grant(c.user_id, round(public.ashes_xp_need((select level from ashes_characters where user_id = c.user_id)) * 0.3)::int,
        60 + (select level from ashes_characters where user_id = c.user_id) * 10);
      insert into vox_notifications (user_id, type, title, body, data)
      values (c.user_id, 'ashes', 'Thalassos padl!', 'Obr padl i díky tobě. Odměna zkušeností a zlata je připsaná.', '{}'::jsonb);
    end loop;
    if public.ashes_bag_count(uid) < 12 then
      item := public.ashes_make_item(uid, ch.class, ch.level, null, 0.25);
      select to_jsonb(i) into item_row from ashes_items i where i.id = item;
    end if;
  end if;
  ups := public.ashes_grant(uid, xp, gold);
  return jsonb_build_object('fight', fight, 'won', killed, 'xp', xp, 'gold', gold, 'levels', ups, 'item', item_row,
    'damage', dmg, 'killed', killed, 'boss_hp', greatest(0, b.hp - dmg), 'boss_hp_max', b.hp_max, 'state', public.ashes_state());
end $$;

revoke all on function public.ashes_boss_state(), public.ashes_boss_attack(), public.ashes_boss_respawn_if_due() from public, anon;
grant execute on function public.ashes_boss_state(), public.ashes_boss_attack() to authenticated;

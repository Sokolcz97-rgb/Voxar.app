-- Světový boss: z mořského obra je pirátský vůdce Thalassos s družinou (řecký, ne fantasy styl).
alter table public.ashes_world_boss alter column name set default 'Thalassos, vůdce pirátů';
update public.ashes_world_boss set name = 'Thalassos, vůdce pirátů';
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
    raise exception 'Nabírej dech – na Thalassose znovu za chvíli.';
  end if;
  perform public.ashes_boss_respawn_if_due();
  select * into b from ashes_world_boss where id = 1 for update;
  if b.killed_at is not null then raise exception 'Thalassos už leží v prachu. Jeho posádka se brzy vrátí.'; end if;
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
      values (c.user_id, 'ashes', 'Thalassos padl!', 'Pirátský vůdce padl i díky tobě. Odměna zkušeností a zlata je připsaná.', '{}'::jsonb);
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

-- Aréna: cvičný zápas s gladiátorem na úrovni hráče (i když nejsou jiní hráči).
create or replace function public.ashes_arena_spar()
returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  uid uuid := public.ashes_require(); ch public.ashes_characters; fight jsonb; won boolean;
  cls text; nm text; xp int := 0; gold int := 0; ups int := 0; honor int := 0;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if ch.last_world_fight_at > now() - interval '8 seconds' and not public.ashes_is_admin() then
    raise exception 'Gladiátoři ještě čistí písek. Chvíli počkej.';
  end if;
  cls := (array['hoplit', 'lucistnik', 'vestec'])[1 + floor(random() * 3)::int];
  nm := (array['Gladiátor Kastor', 'Gladiátorka Ifis', 'Gladiátor Bryas', 'Gladiátorka Neaira', 'Gladiátor Lykos'])[1 + floor(random() * 5)::int];
  fight := public.ashes_simulate(public.ashes_fighter(uid),
    public.ashes_enemy(nm, cls, ch.level, (0.85 + random() * 0.15)::numeric, jsonb_build_object('tint', '#6b5a3a')));
  won := (fight ->> 'winner')::int = 1;
  update public.ashes_characters set last_world_fight_at = now() where user_id = uid;
  if won then
    xp := greatest(1, round(public.ashes_xp_need(ch.level) / 30.0));
    gold := 3 + ch.level * 2;
    honor := 1;
    ups := public.ashes_grant(uid, xp, gold);
    update public.ashes_characters set honor = honor + 1, wins = wins + 1 where user_id = uid;
  else
    update public.ashes_characters set losses = losses + 1 where user_id = uid;
  end if;
  return jsonb_build_object('fight', fight, 'won', won, 'honor', honor, 'gold', gold, 'xp', xp, 'levels', ups,
    'rival', false, 'state', public.ashes_state());
end;
$function$;
revoke all on function public.ashes_arena_spar() from public, anon;
grant execute on function public.ashes_arena_spar() to authenticated;

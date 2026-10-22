-- Denní dar: jednou denně zlato a zkušenosti pro postavu.
alter table public.ashes_characters add column if not exists daily_gift_day date;

create or replace function public.ashes_daily_gift()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch ashes_characters; gold int; xp int; ups int;
begin
  select * into ch from ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if ch.daily_gift_day = current_date then raise exception 'Dnešní dar už máš. Další bude zítra.'; end if;
  gold := 20 + ch.level * 10;
  xp := greatest(1, round(public.ashes_xp_need(ch.level) * 0.08));
  update ashes_characters set daily_gift_day = current_date where user_id = uid;
  ups := public.ashes_grant(uid, xp, gold);
  return jsonb_build_object('gold', gold, 'xp', xp, 'levels', ups, 'state', public.ashes_state());
end $$;
revoke all on function public.ashes_daily_gift() from public, anon;
grant execute on function public.ashes_daily_gift() to authenticated;

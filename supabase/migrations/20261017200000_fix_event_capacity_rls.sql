-- Fix: kapacita komunitních událostí se u běžných členů nevynucovala.
--
-- vox_enforce_event_capacity() běžela jako SECURITY INVOKER a zamykala řádek
-- události přes SELECT ... FOR UPDATE. S RLS se na SELECT FOR UPDATE uplatňuje
-- i UPDATE politika tabulky vox_events, kterou splňují jen owner/mod. Běžnému
-- členovi se proto řádek nevrátil, event_capacity zůstala NULL a kontrola
-- kapacity se tiše přeskočila (událost šla přeplnit).
--
-- Funkce teď běží jako vlastník tabulky (SECURITY DEFINER, RLS se neuplatní),
-- se zafixovaným search_path. Volá ji pouze trigger, ne klient.

create or replace function public.vox_enforce_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_capacity integer;
  going_count integer;
begin
  if tg_op = 'UPDATE' and old.status = 'going' then
    return new;
  end if;

  select capacity
  into event_capacity
  from public.vox_events
  where id = new.event_id
  for update;

  if event_capacity is null then
    return new;
  end if;

  select count(*)
  into going_count
  from public.vox_event_attendees
  where event_id = new.event_id
    and status = 'going';

  if going_count >= event_capacity then
    raise exception 'Událost je již naplněna.'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.vox_enforce_event_capacity() from public, anon, authenticated;

-- Stejný problém (počítání účastníků pod RLS) se týká i validace při změně
-- kapacity; správci sice účastníky vidí, ale definer verze je konzistentní.
create or replace function public.vox_validate_event_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  going_count integer;
begin
  if new.capacity is null then
    return new;
  end if;

  select count(*)
  into going_count
  from public.vox_event_attendees
  where event_id = new.id
    and status = 'going';

  if going_count > new.capacity then
    raise exception 'Kapacita nemůže být nižší než počet potvrzených účastníků (%).', going_count
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

revoke all on function public.vox_validate_event_capacity() from public, anon, authenticated;

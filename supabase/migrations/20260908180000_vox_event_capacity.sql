-- Enforce event capacity in the database, not only in the client UI.
-- Locking the event row serializes simultaneous RSVP requests so a full event
-- cannot be overbooked by two members confirming attendance at the same time.

create or replace function public.vox_enforce_event_capacity()
returns trigger
language plpgsql
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

drop trigger if exists vox_event_attendees_enforce_capacity on public.vox_event_attendees;
create trigger vox_event_attendees_enforce_capacity
before insert or update of status on public.vox_event_attendees
for each row
when (new.status = 'going')
execute function public.vox_enforce_event_capacity();

create or replace function public.vox_validate_event_capacity()
returns trigger
language plpgsql
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

drop trigger if exists vox_events_validate_capacity on public.vox_events;
create trigger vox_events_validate_capacity
before insert or update of capacity on public.vox_events
for each row
execute function public.vox_validate_event_capacity();

-- StudioVoxario / Voxar.app community events + RSVP
create table if not exists public.vox_events (
  id uuid primary key default gen_random_uuid(),
  guild_id uuid not null references public.vox_guilds(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  channel_id uuid references public.vox_channels(id) on delete set null,
  cover_url text,
  created_by uuid not null default auth.uid(),
  status text not null default 'scheduled' check (status in ('scheduled', 'cancelled')),
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vox_events_valid_time check (ends_at is null or ends_at > starts_at)
);

create table if not exists public.vox_event_attendees (
  event_id uuid not null references public.vox_events(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  status text not null default 'going' check (status in ('going', 'interested', 'declined')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists vox_events_guild_starts_idx on public.vox_events(guild_id, starts_at);
create index if not exists vox_events_channel_idx on public.vox_events(channel_id) where channel_id is not null;
create index if not exists vox_event_attendees_user_idx on public.vox_event_attendees(user_id);

create or replace function public.vox_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists vox_events_touch_updated_at on public.vox_events;
create trigger vox_events_touch_updated_at
before update on public.vox_events
for each row execute function public.vox_touch_updated_at();

drop trigger if exists vox_event_attendees_touch_updated_at on public.vox_event_attendees;
create trigger vox_event_attendees_touch_updated_at
before update on public.vox_event_attendees
for each row execute function public.vox_touch_updated_at();

create or replace function public.can_manage_vox_events(_guild uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vox_guild_members membership
    where membership.guild_id = _guild
      and membership.user_id = _user
      and membership.role::text in ('owner', 'mod')
  );
$$;

create or replace function public.is_vox_event_member(_event uuid, _user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.vox_events event_row
    join public.vox_guild_members membership
      on membership.guild_id = event_row.guild_id
    where event_row.id = _event
      and membership.user_id = _user
  );
$$;

revoke all on function public.can_manage_vox_events(uuid, uuid) from public;
revoke all on function public.is_vox_event_member(uuid, uuid) from public;
grant execute on function public.can_manage_vox_events(uuid, uuid) to authenticated;
grant execute on function public.is_vox_event_member(uuid, uuid) to authenticated;

alter table public.vox_events enable row level security;
alter table public.vox_event_attendees enable row level security;

drop policy if exists "vox events readable by guild members" on public.vox_events;
create policy "vox events readable by guild members"
on public.vox_events for select
to authenticated
using (public.is_vox_member(guild_id, auth.uid()));

drop policy if exists "vox events manageable by guild managers" on public.vox_events;
create policy "vox events manageable by guild managers"
on public.vox_events for all
to authenticated
using (public.can_manage_vox_events(guild_id, auth.uid()))
with check (
  public.can_manage_vox_events(guild_id, auth.uid())
  and created_by = auth.uid()
);

drop policy if exists "vox event attendees readable by event guild" on public.vox_event_attendees;
create policy "vox event attendees readable by event guild"
on public.vox_event_attendees for select
to authenticated
using (public.is_vox_event_member(event_id, auth.uid()));

drop policy if exists "vox event attendees insert own" on public.vox_event_attendees;
create policy "vox event attendees insert own"
on public.vox_event_attendees for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_vox_event_member(event_id, auth.uid())
);

drop policy if exists "vox event attendees update own" on public.vox_event_attendees;
create policy "vox event attendees update own"
on public.vox_event_attendees for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.is_vox_event_member(event_id, auth.uid())
);

drop policy if exists "vox event attendees delete own" on public.vox_event_attendees;
create policy "vox event attendees delete own"
on public.vox_event_attendees for delete
to authenticated
using (user_id = auth.uid());

-- Realtime is used by the Voxar event board and the compact right-side event card.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vox_events'
  ) then
    alter publication supabase_realtime add table public.vox_events;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vox_event_attendees'
  ) then
    alter publication supabase_realtime add table public.vox_event_attendees;
  end if;
end $$;

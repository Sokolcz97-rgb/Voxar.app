-- Voxar.app notification center with event-driven alerts.
create table if not exists public.vox_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  guild_id uuid references public.vox_guilds(id) on delete cascade,
  type text not null default 'system',
  title text not null check (char_length(trim(title)) between 1 and 160),
  body text,
  data jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists vox_notifications_user_created_idx
  on public.vox_notifications(user_id, created_at desc);
create index if not exists vox_notifications_unread_idx
  on public.vox_notifications(user_id, is_read, created_at desc);
create index if not exists vox_notifications_guild_idx
  on public.vox_notifications(guild_id) where guild_id is not null;

alter table public.vox_notifications enable row level security;

drop policy if exists "vox notifications read own" on public.vox_notifications;
create policy "vox notifications read own"
on public.vox_notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "vox notifications update own" on public.vox_notifications;
create policy "vox notifications update own"
on public.vox_notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "vox notifications delete own" on public.vox_notifications;
create policy "vox notifications delete own"
on public.vox_notifications for delete
to authenticated
using (user_id = auth.uid());

create or replace function public.vox_notify_event_members()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  notification_type text;
  notification_title text;
  notification_body text;
begin
  if tg_op = 'INSERT' then
    notification_type := 'event_new';
    notification_title := 'Nová komunitní událost';
    notification_body := new.title || ' · ' || to_char(new.starts_at at time zone 'Europe/Prague', 'DD.MM. HH24:MI');
  elsif tg_op = 'UPDATE' then
    if not (
      old.title is distinct from new.title
      or old.starts_at is distinct from new.starts_at
      or old.ends_at is distinct from new.ends_at
      or old.location is distinct from new.location
      or old.channel_id is distinct from new.channel_id
      or old.status is distinct from new.status
    ) then
      return new;
    end if;
    notification_type := case when new.status = 'cancelled' then 'event_cancelled' else 'event_updated' end;
    notification_title := case when new.status = 'cancelled' then 'Událost byla zrušena' else 'Událost byla upravena' end;
    notification_body := new.title || ' · ' || to_char(new.starts_at at time zone 'Europe/Prague', 'DD.MM. HH24:MI');
  else
    return new;
  end if;

  insert into public.vox_notifications (user_id, guild_id, type, title, body, data)
  select
    membership.user_id,
    new.guild_id,
    notification_type,
    notification_title,
    notification_body,
    jsonb_build_object(
      'event_id', new.id,
      'guild_id', new.guild_id,
      'channel_id', new.channel_id,
      'starts_at', new.starts_at,
      'status', new.status
    )
  from public.vox_guild_members membership
  where membership.guild_id = new.guild_id
    and membership.user_id <> auth.uid();

  return new;
end;
$$;

revoke all on function public.vox_notify_event_members() from public;

drop trigger if exists vox_events_notify_members on public.vox_events;
create trigger vox_events_notify_members
after insert or update on public.vox_events
for each row execute function public.vox_notify_event_members();

-- Add notifications to realtime only once.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vox_notifications'
  ) then
    alter publication supabase_realtime add table public.vox_notifications;
  end if;
end $$;

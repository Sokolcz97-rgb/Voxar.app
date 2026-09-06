-- Voxar V29 — functional message pins + reactions for the community reference UI.
-- Additive only: existing messages and community data are preserved.

create table if not exists public.vox_message_pins (
  message_id uuid primary key references public.vox_messages(id) on delete cascade,
  channel_id uuid not null references public.vox_channels(id) on delete cascade,
  guild_id uuid not null references public.vox_guilds(id) on delete cascade,
  pinned_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

create table if not exists public.vox_message_reactions (
  message_id uuid not null references public.vox_messages(id) on delete cascade,
  channel_id uuid not null references public.vox_channels(id) on delete cascade,
  guild_id uuid not null references public.vox_guilds(id) on delete cascade,
  user_id uuid not null default auth.uid(),
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);

create index if not exists vox_message_pins_channel_idx on public.vox_message_pins(channel_id, created_at desc);
create index if not exists vox_message_reactions_channel_idx on public.vox_message_reactions(channel_id, created_at);
create index if not exists vox_message_reactions_message_idx on public.vox_message_reactions(message_id);

create or replace function public.vox_sync_message_interaction_scope()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  resolved_channel uuid;
  resolved_guild uuid;
begin
  select m.channel_id, public.vox_channel_guild(m.channel_id)
    into resolved_channel, resolved_guild
  from public.vox_messages m
  where m.id = new.message_id;

  if resolved_channel is null or resolved_guild is null then
    raise exception 'Message does not exist or has no community scope';
  end if;

  new.channel_id := resolved_channel;
  new.guild_id := resolved_guild;
  return new;
end;
$$;

drop trigger if exists vox_message_pins_scope on public.vox_message_pins;
create trigger vox_message_pins_scope
before insert or update on public.vox_message_pins
for each row execute function public.vox_sync_message_interaction_scope();

drop trigger if exists vox_message_reactions_scope on public.vox_message_reactions;
create trigger vox_message_reactions_scope
before insert or update on public.vox_message_reactions
for each row execute function public.vox_sync_message_interaction_scope();

alter table public.vox_message_pins enable row level security;
alter table public.vox_message_reactions enable row level security;

revoke all on public.vox_message_pins from anon;
revoke all on public.vox_message_reactions from anon;
grant select, insert, delete on public.vox_message_pins to authenticated;
grant select, insert, delete on public.vox_message_reactions to authenticated;
grant all on public.vox_message_pins to service_role;
grant all on public.vox_message_reactions to service_role;

drop policy if exists "vox pins readable by guild members" on public.vox_message_pins;
create policy "vox pins readable by guild members"
on public.vox_message_pins for select to authenticated
using (public.is_vox_member(guild_id, auth.uid()));

drop policy if exists "vox pins insert author or manager" on public.vox_message_pins;
create policy "vox pins insert author or manager"
on public.vox_message_pins for insert to authenticated
with check (
  pinned_by = auth.uid()
  and public.is_vox_member(guild_id, auth.uid())
  and (
    exists (select 1 from public.vox_messages m where m.id = message_id and m.author_id = auth.uid())
    or public.vox_member_role(guild_id, auth.uid()) in ('owner'::public.vox_member_role, 'mod'::public.vox_member_role)
  )
);

drop policy if exists "vox pins delete author or manager" on public.vox_message_pins;
create policy "vox pins delete author or manager"
on public.vox_message_pins for delete to authenticated
using (
  public.is_vox_member(guild_id, auth.uid())
  and (
    pinned_by = auth.uid()
    or exists (select 1 from public.vox_messages m where m.id = message_id and m.author_id = auth.uid())
    or public.vox_member_role(guild_id, auth.uid()) in ('owner'::public.vox_member_role, 'mod'::public.vox_member_role)
  )
);

drop policy if exists "vox reactions readable by guild members" on public.vox_message_reactions;
create policy "vox reactions readable by guild members"
on public.vox_message_reactions for select to authenticated
using (public.is_vox_member(guild_id, auth.uid()));

drop policy if exists "vox reactions insert own" on public.vox_message_reactions;
create policy "vox reactions insert own"
on public.vox_message_reactions for insert to authenticated
with check (user_id = auth.uid() and public.is_vox_member(guild_id, auth.uid()));

drop policy if exists "vox reactions delete own" on public.vox_message_reactions;
create policy "vox reactions delete own"
on public.vox_message_reactions for delete to authenticated
using (user_id = auth.uid());

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vox_message_pins'
  ) then
    alter publication supabase_realtime add table public.vox_message_pins;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'vox_message_reactions'
  ) then
    alter publication supabase_realtime add table public.vox_message_reactions;
  end if;
end $$;

alter table public.vox_message_pins replica identity full;
alter table public.vox_message_reactions replica identity full;


-- 1. Status enum
do $$ begin
  create type public.bot_guild_status as enum ('pending','approved','rejected','suspended');
exception when duplicate_object then null; end $$;

-- 2. bot_guilds
create table if not exists public.bot_guilds (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique,
  name text not null,
  icon_url text,
  owner_user_id uuid,
  owner_discord_id text,
  status public.bot_guild_status not null default 'pending',
  source text not null default 'auto', -- 'auto' | 'request'
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  notes text,
  member_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.bot_guilds enable row level security;

create policy "Bot guilds view"
  on public.bot_guilds for select
  using (
    can('bot','manage')
    or owner_user_id = auth.uid()
  );

create policy "Bot guilds insert"
  on public.bot_guilds for insert
  with check (
    can('bot','manage')
    or owner_user_id = auth.uid()
  );

create policy "Bot guilds update"
  on public.bot_guilds for update
  using (
    can('bot','manage')
    or (owner_user_id = auth.uid() and status <> 'approved')
  );

create policy "Bot guilds delete"
  on public.bot_guilds for delete
  using (can('bot','manage'));

create trigger bot_guilds_set_updated_at
  before update on public.bot_guilds
  for each row execute function public.update_updated_at_column();

-- 3. Helper: může uživatel spravovat daný guild?
create or replace function public.is_guild_manager(_user_id uuid, _guild_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.has_role(_user_id, 'admin'::app_role)
    or exists (
      select 1 from public.bot_guilds g
      where g.guild_id = _guild_id
        and g.owner_user_id = _user_id
        and g.status = 'approved'
    );
$$;

-- 4. Per-guild config (overrides global bot_config)
create table if not exists public.bot_guild_config (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique references public.bot_guilds(guild_id) on delete cascade,
  prefix text,
  default_welcome_channel text,
  default_log_channel text,
  default_alerts_channel text,
  maintenance_channel text,
  bot_maintenance boolean not null default false,
  automod_enabled boolean not null default false,
  automod_action text not null default 'warn',
  automod_blocked_words text[] not null default '{}',
  automod_max_mentions integer not null default 5,
  automod_max_emojis integer not null default 10,
  automod_spam_threshold integer not null default 5,
  nsfw_protection boolean not null default false,
  nsfw_allowed_channels text[] not null default '{}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);

alter table public.bot_guild_config enable row level security;

create policy "Guild config view"
  on public.bot_guild_config for select
  using (public.is_guild_manager(auth.uid(), guild_id));

create policy "Guild config insert"
  on public.bot_guild_config for insert
  with check (public.is_guild_manager(auth.uid(), guild_id));

create policy "Guild config update"
  on public.bot_guild_config for update
  using (public.is_guild_manager(auth.uid(), guild_id));

create policy "Guild config delete"
  on public.bot_guild_config for delete
  using (can('bot','manage'));

create trigger bot_guild_config_set_updated_at
  before update on public.bot_guild_config
  for each row execute function public.update_updated_at_column();

-- 5. Auto-create config po schválení guildu
create or replace function public.ensure_guild_config()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if NEW.status = 'approved' and (OLD.status is distinct from NEW.status) then
    insert into public.bot_guild_config (guild_id)
    values (NEW.guild_id)
    on conflict (guild_id) do nothing;
  end if;
  return NEW;
end;
$$;

create trigger bot_guilds_ensure_config
  after update on public.bot_guilds
  for each row execute function public.ensure_guild_config();

-- 6. guild_id na všechny per-feature tabulky (nullable = globální/legacy)
alter table public.bot_commands add column if not exists guild_id text;
alter table public.bot_welcome add column if not exists guild_id text;
alter table public.bot_stream_notifications add column if not exists guild_id text;
alter table public.bot_status_checks add column if not exists guild_id text;
alter table public.bot_tickets_config add column if not exists guild_id text;

create index if not exists idx_bot_commands_guild on public.bot_commands(guild_id);
create index if not exists idx_bot_welcome_guild on public.bot_welcome(guild_id);
create index if not exists idx_bot_streams_guild on public.bot_stream_notifications(guild_id);
create index if not exists idx_bot_status_checks_guild on public.bot_status_checks(guild_id);
create index if not exists idx_bot_tickets_config_guild on public.bot_tickets_config(guild_id);

-- bot_tickets_config už není singleton po guildech
alter table public.bot_tickets_config drop column if exists is_singleton;

-- 7. Rozšířené RLS — vlastníci guildů mohou spravovat svá data
-- bot_commands
drop policy if exists "Bot commands manage insert" on public.bot_commands;
drop policy if exists "Bot commands manage update" on public.bot_commands;
drop policy if exists "Bot commands manage delete" on public.bot_commands;
drop policy if exists "Bot commands view" on public.bot_commands;

create policy "Bot commands view"
  on public.bot_commands for select to authenticated
  using (
    can('bot','manage')
    or can('bot','view')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot commands insert"
  on public.bot_commands for insert to authenticated
  with check (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot commands update"
  on public.bot_commands for update to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot commands delete"
  on public.bot_commands for delete to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );

-- bot_welcome
drop policy if exists "Bot welcome manage insert" on public.bot_welcome;
drop policy if exists "Bot welcome manage update" on public.bot_welcome;
drop policy if exists "Bot welcome manage delete" on public.bot_welcome;
drop policy if exists "Bot welcome view" on public.bot_welcome;

create policy "Bot welcome view"
  on public.bot_welcome for select to authenticated
  using (
    can('bot','manage') or can('bot','view')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot welcome insert"
  on public.bot_welcome for insert to authenticated
  with check (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot welcome update"
  on public.bot_welcome for update to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot welcome delete"
  on public.bot_welcome for delete to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );

-- bot_stream_notifications
drop policy if exists "Bot streams manage insert" on public.bot_stream_notifications;
drop policy if exists "Bot streams manage update" on public.bot_stream_notifications;
drop policy if exists "Bot streams manage delete" on public.bot_stream_notifications;
drop policy if exists "Bot streams view" on public.bot_stream_notifications;

create policy "Bot streams view"
  on public.bot_stream_notifications for select to authenticated
  using (
    can('bot','manage') or can('bot','view')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot streams insert"
  on public.bot_stream_notifications for insert to authenticated
  with check (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot streams update"
  on public.bot_stream_notifications for update to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot streams delete"
  on public.bot_stream_notifications for delete to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );

-- bot_status_checks
drop policy if exists "Bot status checks manage insert" on public.bot_status_checks;
drop policy if exists "Bot status checks manage update" on public.bot_status_checks;
drop policy if exists "Bot status checks manage delete" on public.bot_status_checks;
drop policy if exists "Bot status checks view" on public.bot_status_checks;

create policy "Bot status checks view"
  on public.bot_status_checks for select to authenticated
  using (
    can('bot','manage') or can('bot','view')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot status checks insert"
  on public.bot_status_checks for insert to authenticated
  with check (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot status checks update"
  on public.bot_status_checks for update to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot status checks delete"
  on public.bot_status_checks for delete to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );

-- bot_tickets_config
drop policy if exists "Bot tickets manage insert" on public.bot_tickets_config;
drop policy if exists "Bot tickets manage update" on public.bot_tickets_config;
drop policy if exists "Bot tickets manage delete" on public.bot_tickets_config;
drop policy if exists "Bot tickets view" on public.bot_tickets_config;

create policy "Bot tickets view"
  on public.bot_tickets_config for select to authenticated
  using (
    can('bot','manage') or can('bot','view')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot tickets insert"
  on public.bot_tickets_config for insert to authenticated
  with check (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot tickets update"
  on public.bot_tickets_config for update to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );
create policy "Bot tickets delete"
  on public.bot_tickets_config for delete to authenticated
  using (
    can('bot','manage')
    or (guild_id is not null and public.is_guild_manager(auth.uid(), guild_id))
  );

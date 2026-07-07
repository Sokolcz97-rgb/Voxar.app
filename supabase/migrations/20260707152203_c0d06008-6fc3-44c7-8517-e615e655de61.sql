
create table if not exists public.bot_minecraft_config (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null unique references public.bot_guilds(guild_id) on delete cascade,
  enabled boolean not null default false,
  server_address text,
  server_type text not null default 'discordsrv',
  plugin_token text not null default replace(gen_random_uuid()::text, '-', ''),
  chat_channel text,
  console_channel text,
  join_leave_channel text,
  death_channel text,
  achievement_channel text,
  server_status_channel text,
  link_role_id text,
  allow_chat_relay boolean not null default true,
  allow_discord_to_mc boolean not null default true,
  allow_commands boolean not null default false,
  chat_format text not null default '**{name}**: {message}',
  join_format text not null default '🟢 **{name}** se připojil na server',
  leave_format text not null default '🔴 **{name}** opustil server',
  death_format text not null default '💀 {message}',
  achievement_format text not null default '🏆 **{name}** získal: {achievement}',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
grant select, insert, update, delete on public.bot_minecraft_config to authenticated;
grant all on public.bot_minecraft_config to service_role;
alter table public.bot_minecraft_config enable row level security;
create policy "MC config view"  on public.bot_minecraft_config for select using (public.is_guild_manager(auth.uid(), guild_id));
create policy "MC config insert" on public.bot_minecraft_config for insert with check (public.is_guild_manager(auth.uid(), guild_id));
create policy "MC config update" on public.bot_minecraft_config for update using (public.is_guild_manager(auth.uid(), guild_id));
create policy "MC config delete" on public.bot_minecraft_config for delete using (public.can('bot','manage'));
create trigger bot_minecraft_config_set_updated_at before update on public.bot_minecraft_config for each row execute function public.update_updated_at_column();

create table if not exists public.bot_minecraft_links (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  discord_user_id text,
  minecraft_uuid text not null,
  minecraft_name text not null,
  verified_at timestamptz not null default now(),
  unique (guild_id, minecraft_uuid)
);
grant select, insert, update, delete on public.bot_minecraft_links to authenticated;
grant all on public.bot_minecraft_links to service_role;
alter table public.bot_minecraft_links enable row level security;
create policy "MC links view" on public.bot_minecraft_links for select using (user_id = auth.uid() or public.is_guild_manager(auth.uid(), guild_id));
create policy "MC links insert" on public.bot_minecraft_links for insert with check (public.is_guild_manager(auth.uid(), guild_id));
create policy "MC links delete" on public.bot_minecraft_links for delete using (user_id = auth.uid() or public.is_guild_manager(auth.uid(), guild_id));

create table if not exists public.bot_minecraft_pending_links (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null references public.bot_guilds(guild_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  discord_user_id text,
  code text not null unique,
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.bot_minecraft_pending_links to authenticated;
grant all on public.bot_minecraft_pending_links to service_role;
alter table public.bot_minecraft_pending_links enable row level security;
create policy "MC pending own view" on public.bot_minecraft_pending_links for select using (user_id = auth.uid());
create policy "MC pending own insert" on public.bot_minecraft_pending_links for insert with check (user_id = auth.uid());
create policy "MC pending own delete" on public.bot_minecraft_pending_links for delete using (user_id = auth.uid());

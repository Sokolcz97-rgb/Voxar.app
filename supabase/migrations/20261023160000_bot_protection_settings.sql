-- Discord bot: nastavení ochrany (anti-scam / anti-bot) a záznam zásahů pro dashboard.

-- Nastavení ochrany – globální šablona i jednotlivé servery
alter table public.bot_config
  add column if not exists antiscam_enabled boolean not null default true,
  add column if not exists antiscam_sensitivity text not null default 'normal',
  add column if not exists antiscam_allowed_domains text[] not null default '{}',
  add column if not exists antiscam_blocked_domains text[] not null default '{}',
  add column if not exists antiscam_allow_invites boolean not null default false;

alter table public.bot_guild_config
  add column if not exists antiscam_enabled boolean not null default true,
  add column if not exists antiscam_sensitivity text not null default 'normal',
  add column if not exists antiscam_allowed_domains text[] not null default '{}',
  add column if not exists antiscam_blocked_domains text[] not null default '{}',
  add column if not exists antiscam_allow_invites boolean not null default false;

do $$ begin
  alter table public.bot_config add constraint bot_config_antiscam_sensitivity_chk check (antiscam_sensitivity in ('low', 'normal', 'high'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.bot_guild_config add constraint bot_guild_config_antiscam_sensitivity_chk check (antiscam_sensitivity in ('low', 'normal', 'high'));
exception when duplicate_object then null; end $$;

-- Zásahy bota (ochrana i ruční moderace) – zapisuje bot service-role klíčem, čtou správci serveru
create table if not exists public.bot_moderation_events (
  id bigint generated always as identity primary key,
  guild_id text not null,
  user_id text not null,
  user_tag text,
  source text not null default 'antiscam',      -- antiscam | antibot | manual | scan
  level text not null,                          -- warn | timeout | ban | kick | info | ok
  score integer,
  reasons text[] not null default '{}',
  channel_id text,
  content text,
  moderator text,                               -- kdo zasáhl ručně / vyřešil hlášení
  resolution text,                              -- unban | untimeout | ban | ok
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists bot_moderation_events_guild_time on public.bot_moderation_events (guild_id, created_at desc);

alter table public.bot_moderation_events enable row level security;
drop policy if exists "Guild managers view moderation events" on public.bot_moderation_events;
create policy "Guild managers view moderation events" on public.bot_moderation_events
  for select using (public.is_guild_manager(auth.uid(), guild_id) or public.can('bot', 'manage'));

-- obsah zpráv a důvody se drží 90 dní (zásady ochrany osobních údajů)
create or replace function public.bot_moderation_events_cleanup()
returns void language sql security definer set search_path = public as $$
  delete from public.bot_moderation_events where created_at < now() - interval '90 days';
$$;
revoke all on function public.bot_moderation_events_cleanup() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('bot-moderation-cleanup') where exists (select 1 from cron.job where jobname = 'bot-moderation-cleanup');
  perform cron.schedule('bot-moderation-cleanup', '51 3 * * *', 'select public.bot_moderation_events_cleanup()');
end $$;

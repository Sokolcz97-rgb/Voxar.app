-- Přihlášení launcheru Ashes of Eryon účtem StudioVoxario (prohlížeč → launcher, PKCE).
-- Jednorázové kódy platí 2 minuty, ukládá se jen jejich SHA-256 otisk. Přístup jen service role (edge funkce launcher-auth).
create table if not exists public.launcher_auth_codes (
  code_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  challenge text not null,
  device text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '2 minutes',
  used_at timestamptz
);
alter table public.launcher_auth_codes enable row level security;
revoke all on public.launcher_auth_codes from anon, authenticated;

-- Přehled přihlášených launcherů (pro účet uživatele a odhlášení na dálku)
create table if not exists public.launcher_sessions_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event text not null,              -- login | game
  device text,
  created_at timestamptz not null default now()
);
alter table public.launcher_sessions_log enable row level security;
drop policy if exists "Users view own launcher log" on public.launcher_sessions_log;
create policy "Users view own launcher log" on public.launcher_sessions_log for select using (auth.uid() = user_id);
create index if not exists launcher_sessions_log_user on public.launcher_sessions_log (user_id, created_at desc);

create or replace function public.launcher_auth_cleanup()
returns void language sql security definer set search_path = public as $$
  delete from public.launcher_auth_codes where created_at < now() - interval '1 day';
  delete from public.launcher_sessions_log where created_at < now() - interval '90 days';
$$;
revoke all on function public.launcher_auth_cleanup() from public, anon, authenticated;

do $$
begin
  perform cron.unschedule('launcher-auth-cleanup') where exists (select 1 from cron.job where jobname = 'launcher-auth-cleanup');
  perform cron.schedule('launcher-auth-cleanup', '57 3 * * *', 'select public.launcher_auth_cleanup()');
end $$;

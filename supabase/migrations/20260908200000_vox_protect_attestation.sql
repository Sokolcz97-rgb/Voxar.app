-- VoxarioProtect serverless integrity handshake.
-- The desktop application sends only a short build fingerprint and selected
-- security flags. No file, Defender event text, process list or IP address is
-- stored by this schema.

create table if not exists public.vox_protect_challenges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nonce_hash text not null check (char_length(nonce_hash) = 64),
  scope text not null default 'account' check (scope in ('account', 'game')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  decision text check (decision in ('allow', 'warn', 'block'))
);

create index if not exists vox_protect_challenges_user_created_idx
  on public.vox_protect_challenges (user_id, created_at desc);

create table if not exists public.vox_protect_build_policies (
  id uuid primary key default gen_random_uuid(),
  platform text not null check (platform in ('win32', 'darwin', 'linux')),
  app_version text not null check (char_length(app_version) between 1 and 80),
  integrity_hash text not null check (char_length(integrity_hash) = 64),
  enforcement text not null default 'observe' check (enforcement in ('observe', 'warn', 'block')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (platform, app_version, integrity_hash)
);

create index if not exists vox_protect_build_policies_lookup_idx
  on public.vox_protect_build_policies (platform, app_version, integrity_hash)
  where active = true;

create table if not exists public.vox_protect_incidents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('blocked_build', 'security_flag')),
  scope text not null check (scope in ('account', 'game')),
  app_version text not null,
  integrity_hash text not null check (char_length(integrity_hash) = 64),
  flags text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists vox_protect_incidents_user_created_idx
  on public.vox_protect_incidents (user_id, created_at desc);

alter table public.vox_protect_challenges enable row level security;
alter table public.vox_protect_build_policies enable row level security;
alter table public.vox_protect_incidents enable row level security;

-- These tables are an Edge Function authority. Browser clients have no direct
-- access; the service role is used only inside the protected function runtime.
revoke all on table public.vox_protect_challenges from anon, authenticated;
revoke all on table public.vox_protect_build_policies from anon, authenticated;
revoke all on table public.vox_protect_incidents from anon, authenticated;

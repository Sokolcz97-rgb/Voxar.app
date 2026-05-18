
create table if not exists public.discord_oauth_sessions (
  state text primary key,
  user_id uuid,
  guilds jsonb not null default '[]'::jsonb,
  discord_user_id text,
  discord_username text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '10 minutes')
);

alter table public.discord_oauth_sessions enable row level security;

-- No public policies: edge functions use service role.
create index if not exists idx_discord_oauth_sessions_expires on public.discord_oauth_sessions(expires_at);

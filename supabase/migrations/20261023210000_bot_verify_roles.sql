-- Ověření členů při vstupu na server (role Ověřen / Neověřen) – viz discord-bot/src/verify.js
alter table public.bot_guild_config
  add column if not exists verified_role_id text,
  add column if not exists unverified_role_id text,
  add column if not exists auto_verify boolean not null default false;

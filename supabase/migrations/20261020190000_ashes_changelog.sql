-- Novinky a změny hry pro launcher (a web). Čtení veřejné, zápis jen admin.
create table if not exists public.ashes_changelog (
  id uuid primary key default gen_random_uuid(),
  published_at timestamptz not null default now(),
  kind text not null default 'game' check (kind in ('game', 'launcher', 'news', 'event')),
  title_cs text not null,
  title_en text,
  text_cs text not null default '',
  text_en text,
  image text,
  created_at timestamptz not null default now()
);
alter table public.ashes_changelog enable row level security;
drop policy if exists ashes_changelog_read on public.ashes_changelog;
create policy ashes_changelog_read on public.ashes_changelog for select using (true);
drop policy if exists ashes_changelog_admin on public.ashes_changelog;
create policy ashes_changelog_admin on public.ashes_changelog for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
grant select on public.ashes_changelog to anon, authenticated;

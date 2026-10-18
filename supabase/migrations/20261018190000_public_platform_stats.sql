-- Transparentní čísla platformy a veřejný tým pro úvodní stránku.
-- Vrací jen souhrnné počty (žádná osobní data) a u týmu jen veřejné
-- profilové údaje lidí s rolí admin/editor, kteří platformu spravují.

create or replace function public.get_platform_stats()
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'members', (select count(*) from public.profiles),
    'active_7d', (select count(*) from public.profiles where last_seen_at > now() - interval '7 days'),
    'forum_threads', (select count(*) from public.forum_threads),
    'forum_posts', (select count(*) from public.forum_posts),
    'servers', (select count(*) from public.servers where is_approved),
    'servers_online', (select count(*) from public.servers where is_approved and is_online),
    'bot_servers', (select count(*) from public.bot_guilds where status = 'approved'),
    'communities', (select count(*) from public.vox_guilds),
    'live_streams', (select count(*) from public.live_streams_cache where is_live),
    'generated_at', now()
  );
$$;

drop function if exists public.get_public_team();
create function public.get_public_team()
returns table (display_name text, avatar_url text, role text)
language sql
stable
security definer
set search_path = public
as $$
  -- Jen přezdívka a avatar; uživatelské jméno může obsahovat skutečné jméno.
  select p.display_name, p.avatar_url, r.role::text
  from public.user_roles r
  join public.profiles p on p.user_id = r.user_id
  where r.role in ('admin', 'editor') and coalesce(p.display_name, '') <> ''
  order by case r.role when 'admin' then 0 else 1 end, p.display_name;
$$;

revoke all on function public.get_platform_stats() from public;
revoke all on function public.get_public_team() from public;
grant execute on function public.get_platform_stats() to anon, authenticated;
grant execute on function public.get_public_team() to anon, authenticated;

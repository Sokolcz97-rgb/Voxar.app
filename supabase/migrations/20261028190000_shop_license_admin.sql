-- Správa licencí: správce může licenci přidělit (dárek, tester, sám sobě), prodloužit aktualizace nebo odebrat.

alter table public.shop_licenses
  add column if not exists granted_by uuid,
  add column if not exists note text;

-- Najde uživatele podle e-mailu, uživatelského jména, zobrazovaného jména nebo ID.
create or replace function public.shop_admin_find_user(p_query text)
returns table (user_id uuid, email text, name text)
language sql stable security definer set search_path = public as $$
  select u.id, u.email::text, coalesce(nullif(p.display_name, ''), nullif(p.username, ''), u.email)::text
  from auth.users u left join profiles p on p.user_id = u.id
  where public.has_role(auth.uid(), 'admin'::app_role)
    and length(trim(coalesce(p_query, ''))) >= 2
    and (u.email ilike '%' || trim(p_query) || '%'
         or p.username ilike '%' || trim(p_query) || '%'
         or p.display_name ilike '%' || trim(p_query) || '%'
         or u.id::text = trim(p_query))
  order by u.email
  limit 10
$$;
revoke all on function public.shop_admin_find_user(text) from public, anon;
grant execute on function public.shop_admin_find_user(text) to authenticated;

-- Držitelé licencí položky
create or replace function public.shop_admin_licenses(p_item uuid)
returns table (user_id uuid, email text, name text, purchased_at timestamptz, updates_until timestamptz,
               revoked_at timestamptz, granted boolean, note text)
language sql stable security definer set search_path = public as $$
  select l.user_id, u.email::text, coalesce(nullif(p.display_name, ''), nullif(p.username, ''), u.email)::text,
         l.purchased_at, l.updates_until, l.revoked_at, l.granted_by is not null and l.purchase_id is null, l.note
  from shop_licenses l
  left join auth.users u on u.id = l.user_id
  left join profiles p on p.user_id = l.user_id
  where l.item_id = p_item and public.has_role(auth.uid(), 'admin'::app_role)
  order by l.revoked_at nulls first, l.purchased_at desc
$$;
revoke all on function public.shop_admin_licenses(uuid) from public, anon;
grant execute on function public.shop_admin_licenses(uuid) to authenticated;

-- Přidělit licenci / prodloužit aktualizace o p_days dní (od dnes, nebo od konce, pokud ještě běží)
create or replace function public.shop_admin_grant_license(p_user uuid, p_item uuid, p_days integer, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare it shop_items%rowtype; until timestamptz; d integer := greatest(0, coalesce(p_days, 365));
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Licence může přidělovat jen správce.'; end if;
  select * into it from shop_items where id = p_item;
  if it.id is null or it.kind <> 'software' then raise exception 'Položka nenalezena.'; end if;
  if not exists (select 1 from auth.users where id = p_user) then raise exception 'Uživatel nenalezen.'; end if;
  insert into shop_licenses (user_id, item_id, purchased_at, updates_until, granted_by, note)
  values (p_user, p_item, now(), now() + make_interval(days => d), auth.uid(), nullif(trim(coalesce(p_note, '')), ''))
  on conflict (user_id, item_id) do update
    set updates_until = case when shop_licenses.revoked_at is null
                             then greatest(shop_licenses.updates_until, now()) + make_interval(days => d)
                             else now() + make_interval(days => d) end,
        purchased_at = case when shop_licenses.revoked_at is null then shop_licenses.purchased_at else now() end,
        revoked_at = null,
        granted_by = coalesce(shop_licenses.granted_by, auth.uid()),
        note = coalesce(nullif(trim(coalesce(p_note, '')), ''), shop_licenses.note),
        updated_at = now()
  returning updates_until into until;
  insert into vox_notifications (user_id, type, title, body, data)
  values (p_user, 'shop', 'Licence přidělena',
          'Získal(a) jsi licenci „' || it.title || '“. Aktualizace máš do ' ||
          to_char(until at time zone 'Europe/Prague', 'DD.MM.YYYY') || '. Soubor najdeš v Obchodě → Software.',
          jsonb_build_object('item_id', p_item, 'url', '/obchod?tab=software'));
  return until;
end $$;
revoke all on function public.shop_admin_grant_license(uuid, uuid, integer, text) from public, anon;
grant execute on function public.shop_admin_grant_license(uuid, uuid, integer, text) to authenticated;

-- Odebrat licenci
create or replace function public.shop_admin_revoke_license(p_user uuid, p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then raise exception 'Licence může odebírat jen správce.'; end if;
  update shop_licenses set revoked_at = now(), updated_at = now()
   where user_id = p_user and item_id = p_item and revoked_at is null;
  if not found then raise exception 'Uživatel tuto licenci nemá.'; end if;
end $$;
revoke all on function public.shop_admin_revoke_license(uuid, uuid) from public, anon;
grant execute on function public.shop_admin_revoke_license(uuid, uuid) to authenticated;

-- Správa nákupů: ruční zamítnutí a smazání transakce (např. zkušební platby).
-- Zamítnutí ponechá záznam se stavem "rejected" (nepočítá se do tržeb), smazání ho odstraní úplně.
-- Obojí odebere přístup, který transakce dala (předplatné, rámeček).

create or replace function public.shop_revoke_purchase_content(p public.shop_purchases)
returns void language plpgsql security definer set search_path = public as $$
begin
  update shop_entitlements set expires_at = least(expires_at, now()), revoked_at = coalesce(revoked_at, now())
   where purchase_id = p.id;
  -- rámeček jen pokud ho uživatel nemá zaplacený jiným nákupem
  if p.kind = 'frame' and p.cosmetic_id is not null and p.user_id is not null
     and not exists (select 1 from shop_purchases o where o.user_id = p.user_id and o.cosmetic_id = p.cosmetic_id
                     and o.id <> p.id and o.status = 'paid') then
    delete from user_cosmetics where user_id = p.user_id and cosmetic_id = p.cosmetic_id;
  end if;
end $$;
revoke all on function public.shop_revoke_purchase_content(public.shop_purchases) from public, anon, authenticated;

create or replace function public.shop_admin_reject(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p shop_purchases%rowtype;
begin
  if not (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)) then
    raise exception 'Not authorized';
  end if;
  select * into p from shop_purchases where id = _id for update;
  if p.id is null then raise exception 'Nákup nenalezen.'; end if;
  perform public.shop_revoke_purchase_content(p);
  update shop_purchases set status = 'rejected', fulfilled = false, updated_at = now() where id = _id;
end $$;
grant execute on function public.shop_admin_reject(uuid) to authenticated;

create or replace function public.shop_admin_delete(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p shop_purchases%rowtype;
begin
  if not public.has_role(auth.uid(), 'admin'::app_role) then
    raise exception 'Mazat nákupy může jen správce.';
  end if;
  select * into p from shop_purchases where id = _id for update;
  if p.id is null then raise exception 'Nákup nenalezen.'; end if;
  perform public.shop_revoke_purchase_content(p);
  delete from shop_entitlements where purchase_id = _id;
  delete from shop_purchases where id = _id;
end $$;
grant execute on function public.shop_admin_delete(uuid) to authenticated;

-- Obchod: jednorázová licence + Upgrade pass (např. Voxario Studio Engine).
--
-- Položka "software" má režim prodeje (sale_mode):
--   subscription – měsíční / roční předplatné (jako dosud, shop_entitlements)
--   license      – jednorázová trvalá licence (cena price_czk) s aktualizacemi na license_updates_days dní;
--                  potom si zákazník dokupuje Upgrade pass (pass_month_czk / pass_year_czk).
-- Licence je trvalá: po konci aktualizací program funguje dál, jen nedostává nové verze.
-- Upgrade pass navazuje na konec aktualizací (kdo je má vypršelé, platí ode dne zaplacení).
--
-- Nákup = shop_purchases (kind 'software') s period:
--   'license'    – koupě licence
--   'pass_month' – Upgrade pass na 30 dní
--   'pass_year'  – Upgrade pass na 365 dní

alter table public.shop_items
  add column if not exists sale_mode text not null default 'subscription',
  add column if not exists license_updates_days integer not null default 365,
  add column if not exists pass_month_czk integer,
  add column if not exists pass_year_czk integer,
  add column if not exists product_key text;
alter table public.shop_items drop constraint if exists shop_items_sale_mode_check;
alter table public.shop_items add constraint shop_items_sale_mode_check check (sale_mode in ('subscription', 'license'));
create unique index if not exists shop_items_product_key_idx on public.shop_items (product_key) where product_key is not null;

create table if not exists public.shop_licenses (
  user_id uuid not null,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  purchase_id uuid references public.shop_purchases(id) on delete set null,
  purchased_at timestamptz not null default now(),
  updates_until timestamptz not null,
  revoked_at timestamptz,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.shop_licenses enable row level security;
drop policy if exists shop_licenses_select on public.shop_licenses;
create policy shop_licenses_select on public.shop_licenses for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role));
drop policy if exists shop_licenses_staff on public.shop_licenses;
create policy shop_licenses_staff on public.shop_licenses for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create or replace function public.shop_pass_interval(p_period text)
returns interval language sql immutable as $$
  select case p_period when 'pass_year' then interval '365 days' when 'pass_month' then interval '30 days' else interval '0' end
$$;

-- Stažení: předplatné (jako dosud) NEBO licence, pokud nejnovější soubor vyšel v době platných aktualizací.
create or replace function public.shop_can_download(p_item uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shop_entitlements e
    where e.user_id = auth.uid() and e.item_id = p_item and e.expires_at > now()
  ) or exists (
    select 1 from shop_licenses l join shop_items i on i.id = l.item_id
    where l.user_id = auth.uid() and l.item_id = p_item and l.revoked_at is null
      and (l.updates_until > now() or coalesce(i.file_uploaded_at, '-infinity') <= l.updates_until)
  ) or public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)
$$;

-- Moje licence (pro Obchod → software)
create or replace function public.shop_my_licenses()
returns table (item_id uuid, purchased_at timestamptz, updates_until timestamptz, updates_active boolean, can_download boolean)
language sql stable security definer set search_path = public as $$
  select l.item_id, l.purchased_at, l.updates_until, l.updates_until > now(),
         l.updates_until > now() or coalesce(i.file_uploaded_at, '-infinity') <= l.updates_until
  from shop_licenses l join shop_items i on i.id = l.item_id
  where l.user_id = auth.uid() and l.revoked_at is null
$$;
revoke all on function public.shop_my_licenses() from public, anon;
grant execute on function public.shop_my_licenses() to authenticated;

-- Stav licence pro aplikaci (engine). p_product = product_key položky nebo její ID.
create or replace function public.shop_license_status(p_product text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare it shop_items%rowtype; l shop_licenses%rowtype;
begin
  select * into it from shop_items
   where product_key = p_product or (p_product ~* '^[0-9a-f-]{36}$' and id = p_product::uuid) limit 1;
  if it.id is null then return jsonb_build_object('ok', false, 'error', 'unknown_product'); end if;
  if auth.uid() is null then return jsonb_build_object('ok', false, 'error', 'not_signed_in'); end if;
  select * into l from shop_licenses where user_id = auth.uid() and item_id = it.id and revoked_at is null;
  return jsonb_build_object(
    'ok', true,
    'product', coalesce(it.product_key, it.id::text),
    'title', it.title,
    'owned', l.user_id is not null,
    'purchased_at', l.purchased_at,
    'updates_until', l.updates_until,
    'updates_active', coalesce(l.updates_until > now(), false),
    'latest_version', it.file_version,
    'latest_released_at', it.file_uploaded_at,
    'latest_allowed', l.user_id is not null and (l.updates_until > now() or coalesce(it.file_uploaded_at, '-infinity') <= l.updates_until),
    'pass_month_czk', it.pass_month_czk,
    'pass_year_czk', it.pass_year_czk,
    'buy_url', 'https://studiovoxario.com/obchod?tab=software&licence=' || coalesce(it.product_key, it.id::text),
    'pass_url', 'https://studiovoxario.com/obchod?tab=software&pass=' || coalesce(it.product_key, it.id::text)
  );
end $$;
revoke all on function public.shop_license_status(text) from public, anon;
grant execute on function public.shop_license_status(text) to authenticated;

-- Vyřízení zaplacené licence / passu (volá shop_fulfill_purchase)
create or replace function public.shop_fulfill_license(p public.shop_purchases, it public.shop_items)
returns void language plpgsql security definer set search_path = public as $$
declare l shop_licenses%rowtype; new_until timestamptz;
begin
  if p.period = 'license' then
    new_until := now() + make_interval(days => greatest(0, coalesce(it.license_updates_days, 365)));
    insert into shop_licenses (user_id, item_id, purchase_id, purchased_at, updates_until)
    values (p.user_id, p.item_id, p.id, now(), new_until)
    on conflict (user_id, item_id) do update
      set purchase_id = excluded.purchase_id,
          purchased_at = case when shop_licenses.revoked_at is null then shop_licenses.purchased_at else now() end,
          updates_until = greatest(case when shop_licenses.revoked_at is null then shop_licenses.updates_until else now() end, excluded.updates_until),
          revoked_at = null, updated_at = now()
    returning * into l;
    insert into vox_notifications (user_id, type, title, body, data)
    values (p.user_id, 'shop', 'Licence aktivní',
            'Licence „' || it.title || '“ je zaplacená a trvalá. Aktualizace máš do ' ||
            to_char(l.updates_until at time zone 'Europe/Prague', 'DD.MM.YYYY') ||
            ', potom si je můžeš prodloužit Upgrade passem. Soubor najdeš v Obchodě → Software.',
            jsonb_build_object('item_id', p.item_id, 'url', '/obchod?tab=software'));
  else
    select * into l from shop_licenses where user_id = p.user_id and item_id = p.item_id and revoked_at is null for update;
    if l.user_id is null then raise exception 'Upgrade pass vyžaduje zakoupenou licenci.'; end if;
    update shop_licenses
       set updates_until = greatest(updates_until, now()) + public.shop_pass_interval(p.period), updated_at = now()
     where user_id = p.user_id and item_id = p.item_id
    returning * into l;
    insert into vox_notifications (user_id, type, title, body, data)
    values (p.user_id, 'shop', 'Upgrade pass aktivní',
            'Aktualizace „' || it.title || '“ máš nově do ' ||
            to_char(l.updates_until at time zone 'Europe/Prague', 'DD.MM.YYYY') || '.',
            jsonb_build_object('item_id', p.item_id, 'url', '/obchod?tab=software'));
  end if;
  update shop_purchases set status = 'paid', fulfilled = true, paid_at = coalesce(paid_at, now()) where id = p.id;
end $$;
revoke all on function public.shop_fulfill_license(public.shop_purchases, public.shop_items) from public, anon, authenticated;

-- Vrácení / zamítnutí / smazání licence nebo passu
create or replace function public.shop_revoke_license_part(p public.shop_purchases)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p.kind <> 'software' or p.status not in ('paid', 'refund_requested') then return; end if;
  if p.period = 'license' then
    update shop_licenses set revoked_at = now(), updated_at = now()
     where user_id = p.user_id and item_id = p.item_id and purchase_id = p.id;
  elsif p.period in ('pass_month', 'pass_year') then
    update shop_licenses set updates_until = updates_until - public.shop_pass_interval(p.period), updated_at = now()
     where user_id = p.user_id and item_id = p.item_id;
  end if;
end $$;
revoke all on function public.shop_revoke_license_part(public.shop_purchases) from public, anon, authenticated;

create or replace function public.shop_revoke_purchase_content(p public.shop_purchases)
returns void language plpgsql security definer set search_path = public as $$
begin
  update shop_entitlements set expires_at = least(expires_at, now()), revoked_at = coalesce(revoked_at, now())
   where purchase_id = p.id;
  perform public.shop_revoke_license_part(p);
  if p.kind = 'frame' and p.cosmetic_id is not null and p.user_id is not null
     and not exists (select 1 from shop_purchases o where o.user_id = p.user_id and o.cosmetic_id = p.cosmetic_id
                     and o.id <> p.id and o.status = 'paid') then
    delete from user_cosmetics where user_id = p.user_id and cosmetic_id = p.cosmetic_id;
  end if;
end $$;
revoke all on function public.shop_revoke_purchase_content(public.shop_purchases) from public, anon, authenticated;

create or replace function public.shop_mark_refunded(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p shop_purchases%rowtype;
begin
  if not (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)) then
    raise exception 'Not authorized';
  end if;
  select * into p from shop_purchases where id = _id;
  if p.id is null then raise exception 'Purchase not found'; end if;
  perform public.shop_revoke_license_part(p);
  update shop_purchases set status = 'refunded', refunded_at = now() where id = _id;
  update shop_entitlements set expires_at = least(expires_at, now()), revoked_at = coalesce(revoked_at, now()) where purchase_id = _id;
  if p.user_id is not null then
    insert into vox_notifications (user_id, type, title, body, data)
    values (p.user_id, 'shop', 'Peníze vráceny', 'Platba ' || p.amount_czk || ' Kč za „' || p.title || '“ ti byla vrácena.',
            jsonb_build_object('purchase_id', _id, 'url', '/obchod'));
  end if;
end $$;

-- Vyřízení objednávky: licence a pass mají vlastní větev
create or replace function public.shop_fulfill_purchase(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  p public.shop_purchases%rowtype;
  it public.shop_items%rowtype;
  _order uuid;
  _base timestamptz;
  _len interval;
begin
  select * into p from public.shop_purchases where id = _id for update;
  if p.id is null then raise exception 'Purchase not found'; end if;

  if p.kind = 'software' and p.item_id is not null and p.user_id is not null then
    select * into it from public.shop_items where id = p.item_id;
    -- jednorázová licence / Upgrade pass
    if p.period in ('license', 'pass_month', 'pass_year') then
      perform public.shop_fulfill_license(p, it);
      return;
    end if;
    if not exists (select 1 from public.shop_entitlements where purchase_id = p.id) then
      _len := case when p.period in ('month', 'year') then public.shop_period_interval(p.period)
                   else make_interval(mins => greatest(1, coalesce(it.access_minutes, 30 * 24 * 60))) end;
      select greatest(now(), coalesce(max(expires_at), now())) into _base
        from public.shop_entitlements where user_id = p.user_id and item_id = p.item_id;
      insert into public.shop_entitlements (user_id, item_id, purchase_id, expires_at)
      values (p.user_id, p.item_id, p.id, _base + _len);
      insert into public.shop_subscriptions (user_id, item_id, period, auto_renew)
      values (p.user_id, p.item_id, coalesce(p.period, 'month'), p.auto_renew or p.renewal)
      on conflict (user_id, item_id) do update
        set period = coalesce(p.period, shop_subscriptions.period),
            auto_renew = case when p.renewal then shop_subscriptions.auto_renew else p.auto_renew end,
            updated_at = now();
    end if;
    update public.shop_purchases set status = 'paid', fulfilled = true, paid_at = coalesce(paid_at, now()) where id = _id;
    insert into public.vox_notifications (user_id, type, title, body, data)
    values (p.user_id, 'shop', 'Předplatné aktivní – potvrzení',
            'Předplatné „' || it.title || '“ (' || p.amount_czk || ' Kč) je zaplacené a aktivní. Soubor najdeš v Obchodě → Předplatné. ' ||
            'Při objednávce jsi výslovně souhlasil(a) s okamžitým dodáním digitálního obsahu a vzal(a) na vědomí ztrátu práva na odstoupení od smlouvy (§ 1837 písm. l) OZ). ' ||
            'Podle dobrovolné záruky můžeš do ' || to_char((now() + interval '30 minutes') at time zone 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
            ' požádat o vrácení peněz (Obchod → Předplatné). Obchodní podmínky: voxar.app/obchodni-podminky',
            jsonb_build_object('item_id', p.item_id, 'url', '/obchod?tab=software', 'terms_version', p.terms_version));
    return;
  end if;

  if p.kind = 'frame' and p.cosmetic_id is not null and p.user_id is not null then
    insert into public.user_cosmetics (user_id, cosmetic_id, quantity, equipped)
    values (p.user_id, p.cosmetic_id, 1, true)
    on conflict (user_id, cosmetic_id) do update set quantity = greatest(public.user_cosmetics.quantity, 1), equipped = true;
    update public.user_cosmetics set equipped = false where user_id = p.user_id and cosmetic_id <> p.cosmetic_id;
    update public.shop_purchases set status = 'paid', fulfilled = true, paid_at = coalesce(paid_at, now()) where id = _id;
    return;
  end if;

  if p.requires_manual and p.order_id is null then
    insert into public.orders (title, description, price, currency, status, created_by, is_public_request, notes)
    values (p.title, coalesce(p.note, p.title), p.amount_czk, p.currency, 'paid'::order_status, p.user_id, false,
            'Automaticky vytvořeno z nákupu v obchodě')
    returning id into _order;
  else
    _order := p.order_id;
  end if;
  update public.shop_purchases
    set status = 'paid', paid_at = coalesce(paid_at, now()), order_id = _order,
        fulfilled = case when p.requires_manual then fulfilled else true end
    where id = _id;
end $$;
revoke all on function public.shop_fulfill_purchase(uuid) from public, anon, authenticated;
grant execute on function public.shop_fulfill_purchase(uuid) to service_role;


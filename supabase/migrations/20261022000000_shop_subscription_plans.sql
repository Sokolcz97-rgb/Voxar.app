-- Předplatné: měsíční a roční tarif, automatické obnovení.
-- Platby jsou ruční (PayPal / QR): „automatické obnovení“ = 3 dny před koncem systém sám
-- vystaví platbu za další období a upozorní uživatele; po potvrzení platby se předplatné prodlouží.

alter table public.shop_items add column if not exists price_year_czk integer;
alter table public.shop_purchases
  add column if not exists period text,
  add column if not exists auto_renew boolean not null default false,
  add column if not exists renewal boolean not null default false;

create table if not exists public.shop_subscriptions (
  user_id uuid not null,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  period text not null default 'month' check (period in ('month', 'year')),
  auto_renew boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, item_id)
);
alter table public.shop_subscriptions enable row level security;
drop policy if exists shop_subscriptions_select on public.shop_subscriptions;
create policy shop_subscriptions_select on public.shop_subscriptions for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role));

create or replace function public.shop_period_interval(p_period text)
returns interval language sql immutable as $$
  select case when p_period = 'year' then interval '365 days' else interval '30 days' end
$$;

-- Zapnutí / vypnutí automatického obnovení (a volba tarifu pro příští období).
create or replace function public.shop_set_auto_renew(p_item uuid, p_on boolean, p_period text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Přihlas se.'; end if;
  insert into shop_subscriptions (user_id, item_id, period, auto_renew)
  values (auth.uid(), p_item, coalesce(nullif(p_period, ''), 'month'), p_on)
  on conflict (user_id, item_id) do update
    set auto_renew = excluded.auto_renew,
        period = coalesce(nullif(p_period, ''), shop_subscriptions.period),
        updated_at = now();
end $$;

-- Moje předplatné (stav, tarif, obnovení, čekající platba za obnovení).
drop function if exists public.shop_my_downloads();
create or replace function public.shop_my_downloads()
returns table (item_id uuid, title text, file_name text, file_size bigint, file_version text, file_sha256 text, file_parts text[],
               expires_at timestamptz, active boolean, period text, auto_renew boolean, pending_purchase uuid, pending_amount integer, pending_period text)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.file_name, i.file_size, i.file_version, i.file_sha256, i.file_parts,
         max(e.expires_at), max(e.expires_at) > now(),
         s.period, coalesce(s.auto_renew, false),
         pp.id, pp.amount_czk, pp.period
  from shop_entitlements e
  join shop_items i on i.id = e.item_id
  left join shop_subscriptions s on s.user_id = e.user_id and s.item_id = e.item_id
  left join lateral (
    select p.id, p.amount_czk, p.period from shop_purchases p
    where p.user_id = e.user_id and p.item_id = e.item_id and p.renewal and p.status = 'pending'
    order by p.created_at desc limit 1
  ) pp on true
  where e.user_id = auth.uid()
  group by i.id, s.period, s.auto_renew, pp.id, pp.amount_czk, pp.period
$$;

-- Potvrzení platby: předplatné se prodlouží o měsíc nebo rok (podle tarifu nákupu).
create or replace function public.shop_approve_purchase(_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
DECLARE
  p public.shop_purchases%ROWTYPE;
  it public.shop_items%ROWTYPE;
  _order uuid;
  _base timestamptz;
  _len interval;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT * INTO p FROM public.shop_purchases WHERE id = _id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Purchase not found'; END IF;

  IF p.kind = 'software' AND p.item_id IS NOT NULL AND p.user_id IS NOT NULL THEN
    SELECT * INTO it FROM public.shop_items WHERE id = p.item_id;
    IF NOT EXISTS (SELECT 1 FROM public.shop_entitlements WHERE purchase_id = p.id) THEN
      _len := CASE WHEN p.period IN ('month', 'year') THEN public.shop_period_interval(p.period)
                   ELSE make_interval(mins => greatest(1, coalesce(it.access_minutes, 30 * 24 * 60))) END;
      SELECT greatest(now(), coalesce(max(expires_at), now())) INTO _base
        FROM public.shop_entitlements WHERE user_id = p.user_id AND item_id = p.item_id;
      INSERT INTO public.shop_entitlements (user_id, item_id, purchase_id, expires_at)
      VALUES (p.user_id, p.item_id, p.id, _base + _len);
      INSERT INTO public.shop_subscriptions (user_id, item_id, period, auto_renew)
      VALUES (p.user_id, p.item_id, coalesce(p.period, 'month'), p.auto_renew OR p.renewal)
      ON CONFLICT (user_id, item_id) DO UPDATE
        SET period = coalesce(p.period, shop_subscriptions.period),
            auto_renew = CASE WHEN p.renewal THEN shop_subscriptions.auto_renew ELSE p.auto_renew END,
            updated_at = now();
    END IF;
    UPDATE public.shop_purchases SET status = 'paid', fulfilled = true, paid_at = COALESCE(paid_at, now()) WHERE id = _id;
    INSERT INTO public.vox_notifications (user_id, type, title, body, data)
    VALUES (p.user_id, 'shop', 'Předplatné aktivní', 'Předplatné „' || it.title || '“ je zaplacené. Soubor najdeš v Obchodě → Předplatné.',
            jsonb_build_object('item_id', p.item_id, 'url', '/obchod'));
    RETURN;
  END IF;

  IF p.kind = 'frame' AND p.cosmetic_id IS NOT NULL AND p.user_id IS NOT NULL THEN
    INSERT INTO public.user_cosmetics (user_id, cosmetic_id, quantity, equipped)
    VALUES (p.user_id, p.cosmetic_id, 1, true)
    ON CONFLICT (user_id, cosmetic_id) DO UPDATE SET quantity = GREATEST(public.user_cosmetics.quantity, 1), equipped = true;
    UPDATE public.user_cosmetics SET equipped = false WHERE user_id = p.user_id AND cosmetic_id <> p.cosmetic_id;
    UPDATE public.shop_purchases SET status = 'paid', fulfilled = true, paid_at = COALESCE(paid_at, now()) WHERE id = _id;
    RETURN;
  END IF;

  IF p.requires_manual AND p.order_id IS NULL THEN
    INSERT INTO public.orders (title, description, price, currency, status, created_by, is_public_request, notes)
    VALUES (p.title, COALESCE(p.note, p.title), p.amount_czk, p.currency, 'paid'::order_status, p.user_id, false,
            'Automaticky vytvořeno z nákupu v obchodě')
    RETURNING id INTO _order;
  ELSE
    _order := p.order_id;
  END IF;
  UPDATE public.shop_purchases
    SET status = 'paid', paid_at = COALESCE(paid_at, now()), order_id = _order,
        fulfilled = CASE WHEN p.requires_manual THEN fulfilled ELSE true END
    WHERE id = _id;
END;
$function$;

-- Automatické obnovení: 3 dny před koncem vystaví platbu za další období a upozorní uživatele.
create or replace function public.shop_run_renewals()
returns integer language plpgsql security definer set search_path = public as $$
declare
  r record;
  n integer := 0;
  price integer;
begin
  for r in
    select s.user_id, s.item_id, s.period, i.title, i.price_czk, i.price_year_czk, max(e.expires_at) as expires_at
    from shop_subscriptions s
    join shop_items i on i.id = s.item_id and i.active
    join shop_entitlements e on e.user_id = s.user_id and e.item_id = s.item_id
    where s.auto_renew
    group by s.user_id, s.item_id, s.period, i.title, i.price_czk, i.price_year_czk
    having max(e.expires_at) between now() - interval '7 days' and now() + interval '3 days'
  loop
    if exists (select 1 from shop_purchases p where p.user_id = r.user_id and p.item_id = r.item_id and p.renewal
               and p.status = 'pending' and p.created_at > now() - interval '10 days') then
      continue;
    end if;
    price := case when r.period = 'year' and r.price_year_czk is not null then r.price_year_czk else r.price_czk end;
    insert into shop_purchases (user_id, item_id, kind, title, amount_czk, requires_manual, payment_method, note, period, auto_renew, renewal)
    values (r.user_id, r.item_id, 'software', r.title || ' – obnovení (' || case when r.period = 'year' then 'rok' else 'měsíc' end || ')',
            price, false, 'renewal', r.title, coalesce(r.period, 'month'), true, true);
    insert into vox_notifications (user_id, type, title, body, data)
    values (r.user_id, 'shop', 'Obnovení předplatného',
            'Předplatné „' || r.title || '“ končí ' || to_char(r.expires_at at time zone 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
            '. Platba za obnovení (' || price || ' Kč) je připravená v Obchodě → Předplatné.',
            jsonb_build_object('item_id', r.item_id, 'url', '/obchod'));
    n := n + 1;
  end loop;
  return n;
end $$;

revoke all on function public.shop_set_auto_renew(uuid, boolean, text), public.shop_my_downloads(), public.shop_run_renewals() from public, anon;
grant execute on function public.shop_set_auto_renew(uuid, boolean, text), public.shop_my_downloads() to authenticated;

-- každou hodinu
do $$
begin
  perform cron.unschedule('shop-renewals') where exists (select 1 from cron.job where jobname = 'shop-renewals');
  perform cron.schedule('shop-renewals', '17 * * * *', 'select public.shop_run_renewals()');
end $$;

-- Uživatel zaplatil připravenou platbu za obnovení (PayPal / QR) – jen zaznamená způsob platby.
create or replace function public.shop_renewal_pay(p_purchase uuid, p_method text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update shop_purchases set payment_method = case when p_method in ('paypal', 'qr') then p_method else 'qr' end
  where id = p_purchase and user_id = auth.uid() and renewal and status = 'pending';
  if not found then raise exception 'Platba za obnovení nenalezena.'; end if;
end $$;
revoke all on function public.shop_renewal_pay(uuid, text) from public, anon;
grant execute on function public.shop_renewal_pay(uuid, text) to authenticated;

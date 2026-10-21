-- Obchod: záznam souhlasů při nákupu (obchodní podmínky + okamžité dodání digitálního obsahu),
-- evidence aktivace a stažení předplatného a dobrovolná záruka vrácení peněz u předplatného
-- (žádost do 30 minut od aktivace – přístup se okamžitě odebere, peníze vrací správce ručně).

alter table public.shop_purchases
  add column if not exists terms_version text,
  add column if not exists terms_accepted_at timestamptz,
  add column if not exists waiver_accepted_at timestamptz,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_reason text,
  add column if not exists refunded_at timestamptz;

alter table public.shop_entitlements
  add column if not exists first_download_at timestamptz,
  add column if not exists download_count integer not null default 0,
  add column if not exists revoked_at timestamptz;

-- Evidence stažení souboru předplatného (důkaz o užití programu).
create or replace function public.shop_log_download(p_item uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  update shop_entitlements
     set first_download_at = coalesce(first_download_at, now()),
         download_count = download_count + 1
   where user_id = auth.uid() and item_id = p_item and expires_at > now();
end $$;

-- Žádost o vrácení peněz u předplatného (dobrovolná záruka: do 30 minut od aktivace).
create or replace function public.shop_request_refund(p_item uuid, p_reason text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  e record;
  it_title text;
  admin_id uuid;
begin
  if auth.uid() is null then raise exception 'Přihlas se.'; end if;
  select en.id, en.created_at, en.purchase_id, en.first_download_at, en.download_count, p.amount_czk, p.status
    into e
    from shop_entitlements en
    join shop_purchases p on p.id = en.purchase_id
   where en.user_id = auth.uid() and en.item_id = p_item and en.revoked_at is null and p.status = 'paid'
   order by en.created_at desc
   limit 1;
  if e.id is null then raise exception 'Nenašli jsme zaplacené předplatné, ke kterému by šlo požádat o vrácení.'; end if;
  if public.shop_refund_used(auth.uid(), p_item) then
    raise exception 'Záruku vrácení peněz jsi u tohoto předplatného už využil(a). Pokud program nefunguje, napiš nám reklamaci přes Tickety.';
  end if;
  if now() - e.created_at > interval '30 minutes' then
    raise exception 'Lhůta 30 minut od aktivace předplatného uplynula, vrácení peněz podle záruky už nelze. Pokud program nefunguje, napiš nám reklamaci přes Tickety.';
  end if;

  update shop_entitlements set expires_at = least(expires_at, now()), revoked_at = now() where id = e.id;
  update shop_purchases
     set status = 'refund_requested', refund_requested_at = now(), refund_reason = left(coalesce(p_reason, ''), 1000)
   where id = e.purchase_id;
  update shop_subscriptions set auto_renew = false, updated_at = now() where user_id = auth.uid() and item_id = p_item;
  update shop_purchases set status = 'cancelled'
   where user_id = auth.uid() and item_id = p_item and renewal and status = 'pending';

  select title into it_title from shop_items where id = p_item;
  insert into vox_notifications (user_id, type, title, body, data)
  values (auth.uid(), 'shop', 'Žádost o vrácení peněz přijata',
          'Přístup k předplatnému „' || coalesce(it_title, '') || '“ byl ukončen. Částku ' || e.amount_czk ||
          ' Kč vrátíme stejnou platební metodou nejpozději do 14 dnů. Případné stažené kopie programu prosím smaž.',
          jsonb_build_object('item_id', p_item, 'url', '/obchod?tab=software'));
  for admin_id in select distinct ur.user_id from user_roles ur where ur.role::text = 'admin' loop
    insert into vox_notifications (user_id, type, title, body, data)
    values (admin_id, 'shop', 'Žádost o vrácení peněz',
            coalesce(it_title, 'Předplatné') || ' – ' || e.amount_czk || ' Kč. Vrať platbu a označ ji v Admin → Nákupy.',
            jsonb_build_object('purchase_id', e.purchase_id, 'url', '/admin/nakupy'));
  end loop;
  return jsonb_build_object('ok', true, 'amount', e.amount_czk, 'downloaded', e.download_count > 0);
end $$;

-- Správce: platba vrácena (i při oprávněné reklamaci) – odebere přístup a upozorní kupujícího.
create or replace function public.shop_mark_refunded(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare p shop_purchases%rowtype;
begin
  if not (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)) then
    raise exception 'Not authorized';
  end if;
  select * into p from shop_purchases where id = _id;
  if p.id is null then raise exception 'Purchase not found'; end if;
  update shop_purchases set status = 'refunded', refunded_at = now() where id = _id;
  update shop_entitlements set expires_at = least(expires_at, now()), revoked_at = coalesce(revoked_at, now()) where purchase_id = _id;
  if p.user_id is not null then
    insert into vox_notifications (user_id, type, title, body, data)
    values (p.user_id, 'shop', 'Peníze vráceny', 'Platba ' || p.amount_czk || ' Kč za „' || p.title || '“ ti byla vrácena.',
            jsonb_build_object('purchase_id', _id, 'url', '/obchod'));
  end if;
end $$;

-- Platba za obnovení – nově i se záznamem souhlasů.
drop function if exists public.shop_renewal_pay(uuid, text);
create or replace function public.shop_renewal_pay(p_purchase uuid, p_method text, p_terms text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update shop_purchases
     set payment_method = case when p_method in ('paypal', 'qr') then p_method else 'qr' end,
         terms_version = coalesce(p_terms, terms_version),
         terms_accepted_at = case when p_terms is not null then now() else terms_accepted_at end,
         waiver_accepted_at = case when p_terms is not null then now() else waiver_accepted_at end
   where id = p_purchase and user_id = auth.uid() and renewal and status = 'pending';
  if not found then raise exception 'Platba za obnovení nenalezena.'; end if;
end $$;

-- Moje předplatné: navíc čas aktivace posledního zaplaceného období (pro 30min záruku).
drop function if exists public.shop_my_downloads();
create or replace function public.shop_my_downloads()
returns table (item_id uuid, title text, file_name text, file_size bigint, file_version text, file_sha256 text, file_parts text[],
               expires_at timestamptz, active boolean, period text, auto_renew boolean, pending_purchase uuid, pending_amount integer,
               pending_period text, activated_at timestamptz, refundable_until timestamptz)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.file_name, i.file_size, i.file_version, i.file_sha256, i.file_parts,
         max(e.expires_at), max(e.expires_at) > now(),
         s.period, coalesce(s.auto_renew, false),
         pp.id, pp.amount_czk, pp.period,
         la.created_at,
         case when la.created_at is not null then la.created_at + interval '30 minutes' end
  from shop_entitlements e
  join shop_items i on i.id = e.item_id
  left join shop_subscriptions s on s.user_id = e.user_id and s.item_id = e.item_id
  left join lateral (
    select p.id, p.amount_czk, p.period from shop_purchases p
    where p.user_id = e.user_id and p.item_id = e.item_id and p.renewal and p.status = 'pending'
    order by p.created_at desc limit 1
  ) pp on true
  left join lateral (
    select en.created_at from shop_entitlements en join shop_purchases p on p.id = en.purchase_id
    where en.user_id = e.user_id and en.item_id = e.item_id and en.revoked_at is null and p.status = 'paid'
    order by en.created_at desc limit 1
  ) la on true
  where e.user_id = auth.uid()
  group by i.id, s.period, s.auto_renew, pp.id, pp.amount_czk, pp.period, la.created_at
$$;

revoke all on function public.shop_log_download(uuid), public.shop_request_refund(uuid, text), public.shop_mark_refunded(uuid),
  public.shop_renewal_pay(uuid, text, text), public.shop_my_downloads() from public, anon;
grant execute on function public.shop_log_download(uuid), public.shop_request_refund(uuid, text), public.shop_mark_refunded(uuid),
  public.shop_renewal_pay(uuid, text, text), public.shop_my_downloads() to authenticated;

-- Potvrzení aktivace předplatného (trvalý nosič: oznámení v účtu) se souhlasy a lhůtou záruky.
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
    VALUES (p.user_id, 'shop', 'Předplatné aktivní – potvrzení',
            'Předplatné „' || it.title || '“ (' || p.amount_czk || ' Kč) je zaplacené a aktivní. Soubor najdeš v Obchodě → Předplatné. ' ||
            'Při objednávce jsi výslovně souhlasil(a) s okamžitým dodáním digitálního obsahu a vzal(a) na vědomí ztrátu práva na odstoupení od smlouvy (§ 1837 písm. l) OZ). ' ||
            'Podle dobrovolné záruky můžeš do ' || to_char((now() + interval '30 minutes') at time zone 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
            ' požádat o vrácení peněz (Obchod → Předplatné). Obchodní podmínky: voxar.app/obchodni-podminky',
            jsonb_build_object('item_id', p.item_id, 'url', '/obchod?tab=software', 'terms_version', p.terms_version));
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

-- Obchod: platba kartou přes Stripe Checkout.
-- stripe-checkout (edge funkce) založí objednávku a platební stránku Stripe,
-- stripe-webhook po zaplacení objednávku vyřídí (shop_fulfill_purchase) – bez ručního schválení.

alter table public.shop_settings add column if not exists stripe_enabled boolean not null default false;
alter table public.shop_purchases
  add column if not exists stripe_session_id text,
  add column if not exists stripe_payment_intent text;
create unique index if not exists shop_purchases_stripe_session_idx on public.shop_purchases (stripe_session_id) where stripe_session_id is not null;

drop function if exists public.get_public_shop_config();
create or replace function public.get_public_shop_config()
returns table (id uuid, donate_min integer, donate_max integer, refund_notice text, paypal_me text, iban text,
               account_number text, bank_recipient text, stripe_enabled boolean)
language sql stable security definer set search_path = public as $$
  select id, donate_min, donate_max, refund_notice, paypal_me, iban, account_number, bank_recipient, stripe_enabled
  from public.shop_settings limit 1;
$$;
grant execute on function public.get_public_shop_config() to anon, authenticated;

-- Vyřízení zaplacené objednávky (dřív uvnitř shop_approve_purchase). Volá ho správce (přes
-- shop_approve_purchase) nebo Stripe webhook (service role). Klient ho volat nesmí.
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

create or replace function public.shop_approve_purchase(_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)) then
    raise exception 'Not authorized';
  end if;
  perform public.shop_fulfill_purchase(_id);
end $$;

-- obnovení předplatného lze zaplatit i kartou
create or replace function public.shop_renewal_pay(p_purchase uuid, p_method text, p_terms text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  update shop_purchases
     set payment_method = case when p_method in ('qr', 'stripe') then p_method else 'qr' end,
         terms_version = coalesce(p_terms, terms_version),
         terms_accepted_at = case when p_terms is not null then now() else terms_accepted_at end,
         waiver_accepted_at = case when p_terms is not null then now() else waiver_accepted_at end
   where id = p_purchase and user_id = auth.uid() and renewal and status = 'pending';
  if not found then raise exception 'Platba za obnovení nenalezena.'; end if;
end $$;

-- Oznámení: rozpracovaná platba kartou nehlásit (hlásí se až zaplacení z webhooku)
create or replace function public.shop_purchase_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kind text; head text; who text; ids text[]; fields jsonb; price text; per text;
begin
  if tg_op = 'INSERT' then
    if new.status = 'pending' and new.payment_method = 'stripe' then return new; end if;
    if new.status = 'paid' then kind := 'paid'; head := case when new.kind = 'donation' then '❤️ Podpora projektu – zaplaceno' else '✅ Zaplaceno' end;
    elsif new.renewal then kind := 'renewal'; head := '🔁 Obnovení předplatného – vystavena platba';
    elsif new.kind = 'donation' then kind := 'donation'; head := '❤️ Někdo chce podpořit projekt';
    else kind := 'order'; head := '🛒 Nová objednávka'; end if;
  else
    if new.status = 'paid' and old.status is distinct from 'paid' then kind := 'paid'; head := case when new.kind = 'donation' then '❤️ Podpora projektu – zaplaceno' else '✅ Zaplaceno' end;
    elsif new.refund_requested_at is not null and old.refund_requested_at is null then kind := 'refund'; head := '↩️ Žádost o vrácení peněz';
    else return new; end if;
  end if;

  ids := public.shop_notify_recipients();
  if coalesce(array_length(ids, 1), 0) = 0 then return new; end if;

  select coalesce(nullif(p.display_name, ''), nullif(p.username, ''), u.email, new.user_id::text) into who
  from auth.users u left join profiles p on p.user_id = u.id where u.id = new.user_id limit 1;
  price := coalesce(new.amount_czk::text || ' Kč', '—');
  per := case new.period when 'month' then 'měsíčně' when 'year' then 'ročně' else null end;
  fields := jsonb_build_array(
    jsonb_build_object('name', 'Položka', 'value', coalesce(new.title, '—'), 'inline', false),
    jsonb_build_object('name', 'Cena', 'value', price || coalesce(' · ' || per, ''), 'inline', true),
    jsonb_build_object('name', 'Platba', 'value', case new.payment_method when 'qr' then 'převod / QR' when 'stripe' then 'karta (Stripe)' when 'paypal' then 'PayPal' else coalesce(new.payment_method, '—') end, 'inline', true),
    jsonb_build_object('name', 'VS', 'value', public.shop_vs(new.id), 'inline', true),
    jsonb_build_object('name', 'Zákazník', 'value', coalesce(who, '—'), 'inline', true));
  if new.contact is not null and new.contact <> '' then fields := fields || jsonb_build_array(jsonb_build_object('name', 'Kontakt', 'value', new.contact, 'inline', true)); end if;
  if kind = 'refund' and new.refund_reason is not null then fields := fields || jsonb_build_array(jsonb_build_object('name', 'Důvod', 'value', new.refund_reason, 'inline', false)); end if;
  if new.note is not null and new.note <> '' and kind in ('order', 'donation') then fields := fields || jsonb_build_array(jsonb_build_object('name', 'Poznámka', 'value', new.note, 'inline', false)); end if;

  insert into bot_outbound_queue (payload, source)
  values (jsonb_build_object('action', 'dm_users', 'user_ids', to_jsonb(ids), 'kind', kind, 'title', head,
    'url', 'https://studiovoxario.com/admin/nakupy', 'fields', fields, 'at', now(), 'purchase_id', new.id), 'shop');
  return new;
exception when others then
  raise warning 'shop_purchase_notify: %', sqlerrm;
  return new;
end $$;

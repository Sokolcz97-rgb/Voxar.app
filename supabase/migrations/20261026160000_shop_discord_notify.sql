-- Oznámení z obchodu do soukromých zpráv na Discordu (správci s propojeným Discordem).
-- Nová objednávka, podpora projektu, zaplaceno, obnovení předplatného, žádost o vrácení peněz,
-- nová zakázka z formuláře /objednat.
-- Spouštěč nikdy nezablokuje nákup – chyba oznámení se jen zaloguje.

create or replace function public.shop_notify_recipients()
returns text[] language sql stable security definer set search_path = public as $$
  select coalesce(array_agg(distinct l.discord_user_id), '{}')
  from user_roles r join user_discord_links l on l.user_id = r.user_id
  where r.role = 'admin'::app_role and l.discord_user_id is not null
$$;
revoke all on function public.shop_notify_recipients() from public, anon, authenticated;

create or replace function public.shop_purchase_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  kind text; head text; who text; ids text[]; fields jsonb; price text; per text;
begin
  if tg_op = 'INSERT' then
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
    jsonb_build_object('name', 'Platba', 'value', coalesce(new.payment_method, '—'), 'inline', true),
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

drop trigger if exists shop_purchase_notify on public.shop_purchases;
create trigger shop_purchase_notify after insert or update of status, refund_requested_at on public.shop_purchases
  for each row execute function public.shop_purchase_notify();

-- Zakázky z formuláře /objednat
create or replace function public.order_notify()
returns trigger language plpgsql security definer set search_path = public as $$
declare ids text[]; fields jsonb;
begin
  ids := public.shop_notify_recipients();
  if coalesce(array_length(ids, 1), 0) = 0 then return new; end if;
  fields := jsonb_build_array(
    jsonb_build_object('name', 'Zakázka', 'value', coalesce(new.title, '—'), 'inline', false),
    jsonb_build_object('name', 'Zákazník', 'value', coalesce(new.customer_name, '—'), 'inline', true),
    jsonb_build_object('name', 'E-mail', 'value', coalesce(new.customer_email, '—'), 'inline', true));
  if new.phone is not null and new.phone <> '' then fields := fields || jsonb_build_array(jsonb_build_object('name', 'Telefon', 'value', new.phone, 'inline', true)); end if;
  if new.price is not null then fields := fields || jsonb_build_array(jsonb_build_object('name', 'Cena', 'value', new.price::text || ' ' || coalesce(new.currency, 'Kč'), 'inline', true)); end if;
  if new.description is not null and new.description <> '' then fields := fields || jsonb_build_array(jsonb_build_object('name', 'Popis', 'value', new.description, 'inline', false)); end if;
  insert into bot_outbound_queue (payload, source)
  values (jsonb_build_object('action', 'dm_users', 'user_ids', to_jsonb(ids), 'kind', 'order', 'title', '📦 Nová zakázka',
    'url', 'https://studiovoxario.com/zakazky', 'fields', fields, 'at', now(), 'order_id', new.id), 'shop');
  return new;
exception when others then
  raise warning 'order_notify: %', sqlerrm;
  return new;
end $$;

drop trigger if exists order_notify on public.orders;
create trigger order_notify after insert on public.orders for each row execute function public.order_notify();

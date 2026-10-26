-- Obchod: platby jen převodem / QR (PayPal zablokovaný). Variabilní symbol z ID objednávky
-- (stejný výpočet jako variableSymbol() v src/lib/payments.ts), VS i v oznámeních na Discord.

create or replace function public.shop_vs(p_id uuid)
returns text language sql immutable as $$
  select lpad((('x' || left(replace(p_id::text, '-', ''), 12))::bit(48)::bigint % 10000000000)::text, 10, '0')
$$;
grant execute on function public.shop_vs(uuid) to authenticated;

update public.shop_settings set paypal_me = null, paypal_email = null, updated_at = now();

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
    jsonb_build_object('name', 'Platba', 'value', case new.payment_method when 'qr' then 'převod / QR' when 'paypal' then 'PayPal' else coalesce(new.payment_method, '—') end, 'inline', true),
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


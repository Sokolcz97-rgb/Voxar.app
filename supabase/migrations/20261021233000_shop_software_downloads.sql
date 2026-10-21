-- Obchod: software ke stažení (instalátor / Setup) s cenou a časově omezeným přístupem.
-- Soubor se nahrává po částech (do 45 MB) do soukromého bucketu shop-files.
-- Po potvrzení platby (shop_approve_purchase) dostane kupující právo stahovat
-- do expires_at; storage ho pustí jen k souborům položky, kterou má zaplacenou.

alter table public.shop_items drop constraint if exists shop_items_kind_check;
alter table public.shop_items add constraint shop_items_kind_check check (kind = any (array['frame', 'plugin', 'software']));
alter table public.shop_items
  add column if not exists access_minutes integer,
  add column if not exists file_name text,
  add column if not exists file_size bigint,
  add column if not exists file_sha256 text,
  add column if not exists file_version text,
  add column if not exists file_parts text[] not null default '{}',
  add column if not exists file_uploaded_at timestamptz;

create table if not exists public.shop_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  purchase_id uuid references public.shop_purchases(id) on delete set null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists shop_entitlements_user on public.shop_entitlements (user_id, item_id);
alter table public.shop_entitlements enable row level security;
drop policy if exists shop_entitlements_select on public.shop_entitlements;
create policy shop_entitlements_select on public.shop_entitlements for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role));
drop policy if exists shop_entitlements_staff on public.shop_entitlements;
create policy shop_entitlements_staff on public.shop_entitlements for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role));

-- Má uživatel aktivní přístup ke stažení položky?
create or replace function public.shop_can_download(p_item uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from shop_entitlements e
    where e.user_id = auth.uid() and e.item_id = p_item and e.expires_at > now()
  ) or public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)
$$;

-- Moje stažení: položky s aktivním (nebo prošlým) přístupem.
create or replace function public.shop_my_downloads()
returns table (item_id uuid, title text, file_name text, file_size bigint, file_version text, file_sha256 text, file_parts text[], expires_at timestamptz, active boolean)
language sql stable security definer set search_path = public as $$
  select i.id, i.title, i.file_name, i.file_size, i.file_version, i.file_sha256, i.file_parts,
         max(e.expires_at), max(e.expires_at) > now()
  from shop_entitlements e join shop_items i on i.id = e.item_id
  where e.user_id = auth.uid()
  group by i.id
$$;

-- Ruční udělení přístupu (např. dárek, reklamace) – jen správci.
create or replace function public.shop_grant_download(p_user uuid, p_item uuid, p_minutes integer)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)) then
    raise exception 'Not authorized';
  end if;
  insert into shop_entitlements (user_id, item_id, expires_at)
  values (p_user, p_item, now() + make_interval(mins => greatest(1, coalesce(p_minutes, 60))));
end $$;

revoke all on function public.shop_can_download(uuid), public.shop_my_downloads(), public.shop_grant_download(uuid, uuid, integer) from public, anon;
grant execute on function public.shop_can_download(uuid), public.shop_my_downloads(), public.shop_grant_download(uuid, uuid, integer) to authenticated;

-- Potvrzení platby: software → přístup ke stažení na zvolenou dobu.
create or replace function public.shop_approve_purchase(_id uuid)
returns void language plpgsql security definer set search_path = public as $function$
DECLARE
  p public.shop_purchases%ROWTYPE;
  it public.shop_items%ROWTYPE;
  _order uuid;
  _base timestamptz;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO p FROM public.shop_purchases WHERE id = _id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Purchase not found'; END IF;

  IF p.kind = 'software' AND p.item_id IS NOT NULL AND p.user_id IS NOT NULL THEN
    SELECT * INTO it FROM public.shop_items WHERE id = p.item_id;
    IF NOT EXISTS (SELECT 1 FROM public.shop_entitlements WHERE purchase_id = p.id) THEN
      -- prodloužení: když už přístup běží, přičte se k jeho konci
      SELECT greatest(now(), coalesce(max(expires_at), now())) INTO _base
        FROM public.shop_entitlements WHERE user_id = p.user_id AND item_id = p.item_id;
      INSERT INTO public.shop_entitlements (user_id, item_id, purchase_id, expires_at)
      VALUES (p.user_id, p.item_id, p.id, _base + make_interval(mins => greatest(1, coalesce(it.access_minutes, 7 * 24 * 60))));
    END IF;
    UPDATE public.shop_purchases
      SET status = 'paid', fulfilled = true, paid_at = COALESCE(paid_at, now())
      WHERE id = _id;
    RETURN;
  END IF;

  IF p.kind = 'frame' AND p.cosmetic_id IS NOT NULL AND p.user_id IS NOT NULL THEN
    INSERT INTO public.user_cosmetics (user_id, cosmetic_id, quantity, equipped)
    VALUES (p.user_id, p.cosmetic_id, 1, true)
    ON CONFLICT (user_id, cosmetic_id) DO UPDATE SET quantity = GREATEST(public.user_cosmetics.quantity, 1), equipped = true;

    UPDATE public.user_cosmetics SET equipped = false
      WHERE user_id = p.user_id AND cosmetic_id <> p.cosmetic_id;

    UPDATE public.shop_purchases
      SET status = 'paid', fulfilled = true, paid_at = COALESCE(paid_at, now())
      WHERE id = _id;
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
    SET status = 'paid',
        paid_at = COALESCE(paid_at, now()),
        order_id = _order,
        fulfilled = CASE WHEN p.requires_manual THEN fulfilled ELSE true END
    WHERE id = _id;
END;
$function$;

-- ------------------------------------------------------------------ úložiště souborů
insert into storage.buckets (id, name, public, file_size_limit)
values ('shop-files', 'shop-files', false, 52428800)
on conflict (id) do update set public = false;

drop policy if exists shop_files_staff_all on storage.objects;
create policy shop_files_staff_all on storage.objects for all to authenticated
  using (bucket_id = 'shop-files' and (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)))
  with check (bucket_id = 'shop-files' and (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role)));

-- kupující čte jen části souboru položky, ke které má aktivní přístup
drop policy if exists shop_files_buyer_read on storage.objects;
create policy shop_files_buyer_read on storage.objects for select to authenticated
  using (
    bucket_id = 'shop-files' and exists (
      select 1 from public.shop_items i
      join public.shop_entitlements e on e.item_id = i.id
      where e.user_id = auth.uid() and e.expires_at > now() and storage.objects.name = any (i.file_parts)
    )
  );

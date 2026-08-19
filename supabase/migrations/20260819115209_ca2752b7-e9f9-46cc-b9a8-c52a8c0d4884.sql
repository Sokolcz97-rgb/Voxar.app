
CREATE TABLE public.shop_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'frame',
  title text NOT NULL,
  description text,
  price_czk integer NOT NULL DEFAULT 0,
  cosmetic_id text,
  features text[] NOT NULL DEFAULT '{}',
  image_url text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_items_kind_check CHECK (kind IN ('frame','plugin'))
);

GRANT SELECT ON public.shop_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_items TO authenticated;
GRANT ALL ON public.shop_items TO service_role;

ALTER TABLE public.shop_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_items_public_read" ON public.shop_items
  FOR SELECT USING (active OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "shop_items_admin_insert" ON public.shop_items
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "shop_items_admin_update" ON public.shop_items
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "shop_items_admin_delete" ON public.shop_items
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

CREATE TRIGGER shop_items_updated_at BEFORE UPDATE ON public.shop_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.shop_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paypal_email text,
  paypal_me text,
  iban text,
  account_number text,
  bank_recipient text,
  donate_min integer NOT NULL DEFAULT 0,
  donate_max integer NOT NULL DEFAULT 500,
  refund_notice text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.shop_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.shop_settings TO authenticated;
GRANT ALL ON public.shop_settings TO service_role;

ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "shop_settings_public_read" ON public.shop_settings FOR SELECT USING (true);
CREATE POLICY "shop_settings_admin_insert" ON public.shop_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));
CREATE POLICY "shop_settings_admin_update" ON public.shop_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'editor'));

CREATE TRIGGER shop_settings_updated_at BEFORE UPDATE ON public.shop_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.shop_settings (donate_min, donate_max, refund_notice)
VALUES (0, 500, 'Na dary ani na zakoupené rámečky a digitální obsah neposkytujeme vrácení peněz (refund).');

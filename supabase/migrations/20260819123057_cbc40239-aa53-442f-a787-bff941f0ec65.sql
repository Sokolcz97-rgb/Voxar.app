CREATE TABLE public.shop_purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.shop_items(id) ON DELETE SET NULL,
  kind text NOT NULL DEFAULT 'frame',
  title text NOT NULL,
  amount_czk integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'CZK',
  cosmetic_id text,
  requires_manual boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'pending',
  fulfilled boolean NOT NULL DEFAULT false,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  payment_method text,
  contact text,
  note text,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.shop_purchases TO authenticated;
GRANT UPDATE, DELETE ON public.shop_purchases TO authenticated;
GRANT ALL ON public.shop_purchases TO service_role;

ALTER TABLE public.shop_purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY shop_purchases_insert_own ON public.shop_purchases
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

CREATE POLICY shop_purchases_select_own_or_staff ON public.shop_purchases
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role));

CREATE POLICY shop_purchases_staff_update ON public.shop_purchases
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role));

CREATE POLICY shop_purchases_admin_delete ON public.shop_purchases
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role));

CREATE TRIGGER shop_purchases_updated_at BEFORE UPDATE ON public.shop_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Approve a purchase: grants the cosmetic automatically and opens an order for manual items
CREATE OR REPLACE FUNCTION public.shop_approve_purchase(_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.shop_purchases%ROWTYPE;
  _order uuid;
BEGIN
  IF NOT (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role)) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO p FROM public.shop_purchases WHERE id = _id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Purchase not found'; END IF;

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
$$;

-- Public, non-sensitive shop configuration (no payment account identifiers)
CREATE OR REPLACE FUNCTION public.get_public_shop_config()
RETURNS TABLE(id uuid, donate_min integer, donate_max integer, refund_notice text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, donate_min, donate_max, refund_notice FROM public.shop_settings LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_shop_config() TO anon, authenticated;

-- Restrict raw shop_settings (bank/PayPal details) to signed-in users only
DROP POLICY IF EXISTS shop_settings_public_read ON public.shop_settings;
REVOKE SELECT ON public.shop_settings FROM anon;

CREATE POLICY shop_settings_authenticated_read ON public.shop_settings
  FOR SELECT TO authenticated USING (true);
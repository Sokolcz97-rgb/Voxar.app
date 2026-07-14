
-- 1) Extend orders table with public/customer fields
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS product_size text CHECK (product_size IN ('S','M','L')),
  ADD COLUMN IF NOT EXISTS product_url text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS notify_preference text CHECK (notify_preference IN ('email','phone')),
  ADD COLUMN IF NOT EXISTS model_id uuid,
  ADD COLUMN IF NOT EXISTS is_public_request boolean NOT NULL DEFAULT false;

-- 2) Update RLS on orders so customers can create & see their own
DROP POLICY IF EXISTS "Orders insert (perm)" ON public.orders;
DROP POLICY IF EXISTS "Orders view (perm)" ON public.orders;

CREATE POLICY "Orders insert own or manager"
  ON public.orders FOR INSERT
  TO authenticated
  WITH CHECK (
    (created_by = auth.uid() AND is_public_request = true)
    OR can('orders','manage')
  );

CREATE POLICY "Orders view own or manager"
  ON public.orders FOR SELECT
  TO authenticated
  USING (
    can('orders','access')
    OR created_by = auth.uid()
  );

-- 3) Create catalog of Public Domain 3D models (admin managed)
CREATE TABLE IF NOT EXISTS public.order_models (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  source_url text NOT NULL,
  category text,
  license text NOT NULL DEFAULT 'Public Domain',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.order_models TO anon, authenticated;
GRANT ALL ON public.order_models TO service_role;

ALTER TABLE public.order_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order models: public read active"
  ON public.order_models FOR SELECT
  USING (is_active = true OR can('orders','manage'));

CREATE POLICY "Order models: manage insert"
  ON public.order_models FOR INSERT
  TO authenticated
  WITH CHECK (can('orders','manage'));

CREATE POLICY "Order models: manage update"
  ON public.order_models FOR UPDATE
  TO authenticated
  USING (can('orders','manage'))
  WITH CHECK (can('orders','manage'));

CREATE POLICY "Order models: manage delete"
  ON public.order_models FOR DELETE
  TO authenticated
  USING (can('orders','manage'));

CREATE TRIGGER order_models_updated_at
  BEFORE UPDATE ON public.order_models
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

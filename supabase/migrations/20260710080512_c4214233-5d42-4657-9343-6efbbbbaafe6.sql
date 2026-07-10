
-- Enum stavu zakázky
DO $$ BEGIN
  CREATE TYPE public.order_status AS ENUM ('paid','done','processing','cancelled','paused');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tabulka orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  customer_name TEXT,
  customer_email TEXT,
  price NUMERIC(12,2),
  currency TEXT NOT NULL DEFAULT 'CZK',
  notes TEXT,
  status public.order_status NOT NULL DEFAULT 'processing',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders TO authenticated;
GRANT ALL ON public.orders TO service_role;

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Orders view (perm)" ON public.orders FOR SELECT
  TO authenticated USING (public.can('orders','access'));

CREATE POLICY "Orders insert (perm)" ON public.orders FOR INSERT
  TO authenticated WITH CHECK (public.can('orders','manage'));

CREATE POLICY "Orders update (perm)" ON public.orders FOR UPDATE
  TO authenticated USING (public.can('orders','manage')) WITH CHECK (public.can('orders','manage'));

CREATE POLICY "Orders delete (perm)" ON public.orders FOR DELETE
  TO authenticated USING (public.can('orders','manage'));

CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS orders_status_idx ON public.orders(status);
CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders(created_at DESC);

-- Přidat oprávnění (pokud ještě neexistují)
INSERT INTO public.permissions (module, action, label)
VALUES
  ('orders','access','Přístup k zakázkám'),
  ('orders','manage','Spravovat zakázky (vytvářet, upravovat, mazat)')
ON CONFLICT (module, action) DO NOTHING;

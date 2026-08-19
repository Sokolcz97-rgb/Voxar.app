CREATE TABLE public.bounties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  difficulty text NOT NULL DEFAULT 'standard',
  reward_label text NOT NULL DEFAULT 'Digitální odměna',
  reward_cosmetic_id text,
  slots integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bounties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounties TO authenticated;
GRANT ALL ON public.bounties TO service_role;
ALTER TABLE public.bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bounties are public" ON public.bounties FOR SELECT USING (true);
CREATE POLICY "Admins manage bounties" ON public.bounties FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER bounties_updated_at BEFORE UPDATE ON public.bounties
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bounty_contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bounty_id uuid NOT NULL REFERENCES public.bounties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'accepted',
  note text,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  UNIQUE (bounty_id, user_id)
);

GRANT SELECT ON public.bounty_contracts TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bounty_contracts TO authenticated;
GRANT ALL ON public.bounty_contracts TO service_role;
ALTER TABLE public.bounty_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Contracts are public" ON public.bounty_contracts FOR SELECT USING (true);
CREATE POLICY "Users accept own contracts" ON public.bounty_contracts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'accepted');
CREATE POLICY "Users abandon own contracts" ON public.bounty_contracts FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND status = 'accepted');
CREATE POLICY "Admins manage contracts" ON public.bounty_contracts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.bounty_complete(_contract_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _c public.bounty_contracts%ROWTYPE;
  _b public.bounties%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT * INTO _c FROM public.bounty_contracts WHERE id = _contract_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'contract not found'; END IF;
  IF _c.status = 'completed' THEN RETURN; END IF;

  SELECT * INTO _b FROM public.bounties WHERE id = _c.bounty_id;

  UPDATE public.bounty_contracts
     SET status = 'completed', completed_at = now()
   WHERE id = _contract_id;

  IF _b.reward_cosmetic_id IS NOT NULL AND _b.reward_cosmetic_id <> '' THEN
    INSERT INTO public.user_cosmetics (user_id, cosmetic_id, quantity, equipped)
    VALUES (_c.user_id, _b.reward_cosmetic_id, 1, false)
    ON CONFLICT (user_id, cosmetic_id)
    DO UPDATE SET quantity = public.user_cosmetics.quantity + 1;
  END IF;
END;
$$;
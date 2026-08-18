CREATE TABLE public.user_cosmetics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cosmetic_id text not null,
  quantity integer not null default 1 check (quantity >= 0),
  equipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, cosmetic_id)
);

GRANT SELECT ON public.user_cosmetics TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_cosmetics TO authenticated;
GRANT ALL ON public.user_cosmetics TO service_role;

ALTER TABLE public.user_cosmetics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Cosmetics are viewable by everyone"
ON public.user_cosmetics FOR SELECT USING (true);

CREATE POLICY "Admins manage cosmetics"
ON public.user_cosmetics FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can toggle equipped on own cosmetics"
ON public.user_cosmetics FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.user_cosmetics_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.quantity := OLD.quantity;
    NEW.cosmetic_id := OLD.cosmetic_id;
    NEW.user_id := OLD.user_id;
  END IF;
  IF NEW.quantity = 0 THEN
    NEW.equipped := false;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_cosmetics_guard_trg
BEFORE UPDATE ON public.user_cosmetics
FOR EACH ROW EXECUTE FUNCTION public.user_cosmetics_guard();
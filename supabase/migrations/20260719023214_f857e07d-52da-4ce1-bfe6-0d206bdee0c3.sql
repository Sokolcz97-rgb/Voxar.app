
CREATE TABLE public.download_access_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  label text,
  expires_at timestamptz,
  max_uses integer,
  uses integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.download_access_codes TO authenticated;
GRANT ALL ON public.download_access_codes TO service_role;

ALTER TABLE public.download_access_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/editors can view codes" ON public.download_access_codes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role));

CREATE POLICY "Admins/editors can insert codes" ON public.download_access_codes
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role));

CREATE POLICY "Admins/editors can update codes" ON public.download_access_codes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role));

CREATE POLICY "Admins/editors can delete codes" ON public.download_access_codes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'editor'::app_role));

CREATE OR REPLACE FUNCTION public.redeem_download_code(_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _row public.download_access_codes%ROWTYPE;
BEGIN
  SELECT * INTO _row FROM public.download_access_codes
    WHERE lower(code) = lower(trim(_code)) LIMIT 1;
  IF _row.id IS NULL THEN RETURN false; END IF;
  IF NOT _row.active THEN RETURN false; END IF;
  IF _row.expires_at IS NOT NULL AND _row.expires_at < now() THEN RETURN false; END IF;
  IF _row.max_uses IS NOT NULL AND _row.uses >= _row.max_uses THEN RETURN false; END IF;
  UPDATE public.download_access_codes SET uses = uses + 1 WHERE id = _row.id;
  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_download_code(text) TO anon, authenticated;

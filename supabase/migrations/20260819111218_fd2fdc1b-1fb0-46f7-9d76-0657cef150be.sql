CREATE TABLE public.cosmetic_styles (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text NOT NULL,
  storage_path text,
  scale numeric NOT NULL DEFAULT 135,
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.cosmetic_styles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cosmetic_styles TO authenticated;
GRANT ALL ON public.cosmetic_styles TO service_role;

ALTER TABLE public.cosmetic_styles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cosmetic_styles_public_read" ON public.cosmetic_styles
  FOR SELECT USING (true);
CREATE POLICY "cosmetic_styles_admin_insert" ON public.cosmetic_styles
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "cosmetic_styles_admin_update" ON public.cosmetic_styles
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));
CREATE POLICY "cosmetic_styles_admin_delete" ON public.cosmetic_styles
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role));

CREATE POLICY "cosmetics_read_authenticated" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'cosmetics');
CREATE POLICY "cosmetics_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'cosmetics' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role)));
CREATE POLICY "cosmetics_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'cosmetics' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role)));
CREATE POLICY "cosmetics_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'cosmetics' AND (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'editor'::app_role)));
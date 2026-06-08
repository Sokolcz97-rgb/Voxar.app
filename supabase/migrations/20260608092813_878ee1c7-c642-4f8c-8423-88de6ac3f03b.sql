-- Remove broad public SELECT policy on site_settings and expose safe columns via RPC
DROP POLICY IF EXISTS "Site settings safe columns public" ON public.site_settings;

CREATE OR REPLACE FUNCTION public.get_public_site_settings()
RETURNS TABLE (
  id uuid,
  site_name text,
  site_tagline text,
  hero_badge text,
  hero_title_1 text,
  hero_title_2 text,
  hero_subtitle text,
  hero_cta_label text,
  footer_text text,
  logo_url text,
  favicon_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, site_name, site_tagline, hero_badge, hero_title_1, hero_title_2,
         hero_subtitle, hero_cta_label, footer_text, logo_url, favicon_url
  FROM public.site_settings
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_public_site_settings() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_site_settings() TO anon, authenticated;

ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS contact_phone_dial_code text,
  ADD COLUMN IF NOT EXISTS contact_phone_number text;

DROP FUNCTION IF EXISTS public.get_public_site_settings();

CREATE OR REPLACE FUNCTION public.get_public_site_settings()
 RETURNS TABLE(id uuid, site_name text, site_tagline text, hero_badge text, hero_title_1 text, hero_title_2 text, hero_subtitle text, hero_cta_label text, footer_text text, logo_url text, favicon_url text, contact_section_title text, contact_full_name text, contact_address text, contact_zip text, contact_ico text, contact_registration text, contact_phone_dial_code text, contact_phone_number text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT id, site_name, site_tagline, hero_badge, hero_title_1, hero_title_2,
         hero_subtitle, hero_cta_label, footer_text, logo_url, favicon_url,
         contact_section_title, contact_full_name, contact_address, contact_zip, contact_ico, contact_registration,
         contact_phone_dial_code, contact_phone_number
  FROM public.site_settings
  LIMIT 1;
$function$;

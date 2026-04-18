CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  site_name TEXT NOT NULL DEFAULT 'NEONHUB',
  site_tagline TEXT,
  hero_badge TEXT,
  hero_title_1 TEXT,
  hero_title_2 TEXT,
  hero_subtitle TEXT,
  hero_cta_label TEXT,
  footer_text TEXT,
  logo_url TEXT,
  favicon_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Site settings public view"
  ON public.site_settings FOR SELECT USING (true);

CREATE POLICY "Site settings update"
  ON public.site_settings FOR UPDATE TO authenticated
  USING (public.can('site','manage'));

CREATE POLICY "Site settings insert"
  ON public.site_settings FOR INSERT TO authenticated
  WITH CHECK (public.can('site','manage'));

CREATE TRIGGER update_site_settings_updated_at
  BEFORE UPDATE ON public.site_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Permission
INSERT INTO public.permissions (module, action, label, description, position)
VALUES ('site', 'manage', 'Spravovat nastavení webu', 'Upravit název, hero, footer a loga', 5)
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin' AND p.module = 'site' AND p.action = 'manage'
ON CONFLICT DO NOTHING;

-- Default row
INSERT INTO public.site_settings (
  site_name, site_tagline, hero_badge, hero_title_1, hero_title_2,
  hero_subtitle, hero_cta_label, footer_text
) VALUES (
  'NEONHUB',
  'Herní komunita',
  'Next-gen herní hub',
  'Vstup do',
  'NEONHUB',
  'Připoj se k tisícům hráčů. Sleduj streamy, diskutuj na fóru a buduj svou hráčskou identitu.',
  'Vstoupit do Hubu',
  '© 2026 — Herní komunita'
);
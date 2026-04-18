-- Tabulka discord serverů
CREATE TABLE public.discord_servers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  invite_url TEXT NOT NULL,
  icon_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  position INTEGER NOT NULL DEFAULT 100,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.discord_servers ENABLE ROW LEVEL SECURITY;

-- Veřejně viditelné aktivní; všechny vidí, kdo má discord.manage
CREATE POLICY "Discord servers view"
  ON public.discord_servers FOR SELECT
  USING (is_active = true OR public.can('discord','manage'));

CREATE POLICY "Discord servers insert"
  ON public.discord_servers FOR INSERT TO authenticated
  WITH CHECK (public.can('discord','manage'));

CREATE POLICY "Discord servers update"
  ON public.discord_servers FOR UPDATE TO authenticated
  USING (public.can('discord','manage'));

CREATE POLICY "Discord servers delete"
  ON public.discord_servers FOR DELETE TO authenticated
  USING (public.can('discord','manage'));

CREATE TRIGGER update_discord_servers_updated_at
  BEFORE UPDATE ON public.discord_servers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger: jen jeden featured
CREATE OR REPLACE FUNCTION public.ensure_single_featured_discord()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_featured THEN
    UPDATE public.discord_servers
      SET is_featured = false
      WHERE id <> NEW.id AND is_featured = true;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ensure_single_featured_discord_trigger
  BEFORE INSERT OR UPDATE ON public.discord_servers
  FOR EACH ROW EXECUTE FUNCTION public.ensure_single_featured_discord();

-- Permissions
INSERT INTO public.permissions (module, action, label, description, position)
VALUES ('discord', 'manage', 'Spravovat Discord servery', 'Přidávat, upravovat a mazat Discord servery', 10)
ON CONFLICT DO NOTHING;

-- Přiřadit admin a editor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('admin', 'editor')
  AND p.module = 'discord' AND p.action = 'manage'
ON CONFLICT DO NOTHING;
-- ========================================
-- 1. ROLES catalog
-- ========================================
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  color text,
  is_builtin boolean NOT NULL DEFAULT false,
  position integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Roles viewable by authenticated"
  ON public.roles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert roles"
  ON public.roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update roles"
  ON public.roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Prevent deleting builtin roles
CREATE POLICY "Admins delete custom roles"
  ON public.roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) AND is_builtin = false);

CREATE TRIGGER update_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Protect builtin slug from rename
CREATE OR REPLACE FUNCTION public.protect_builtin_role_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.is_builtin AND NEW.slug <> OLD.slug THEN
    RAISE EXCEPTION 'Cannot rename slug of builtin role';
  END IF;
  IF OLD.is_builtin AND NEW.is_builtin = false THEN
    RAISE EXCEPTION 'Cannot unmark builtin role';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER protect_builtin_role_slug_trigger
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_builtin_role_slug();

-- ========================================
-- 2. PERMISSIONS catalog
-- ========================================
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  description text,
  position integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (module, action)
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permissions viewable by authenticated"
  ON public.permissions FOR SELECT TO authenticated USING (true);

-- Permissions catalog is seeded by code/migrations only; admins can extend
CREATE POLICY "Admins insert permissions"
  ON public.permissions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update permissions"
  ON public.permissions FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete permissions"
  ON public.permissions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- 3. ROLE_PERMISSIONS link
-- ========================================
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_id, permission_id)
);

CREATE INDEX idx_role_permissions_role ON public.role_permissions(role_id);
CREATE INDEX idx_role_permissions_perm ON public.role_permissions(permission_id);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Role permissions viewable by authenticated"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert role permissions"
  ON public.role_permissions FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins delete role permissions"
  ON public.role_permissions FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ========================================
-- 4. user_roles: add role_id (nullable for backward compat)
-- ========================================
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS role_id uuid REFERENCES public.roles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_user_roles_role_id ON public.user_roles(role_id);

-- ========================================
-- 5. Seed builtin roles
-- ========================================
INSERT INTO public.roles (slug, name, description, color, is_builtin, position) VALUES
  ('admin', 'Admin', 'Plný přístup ke všemu', 'hsl(0 80% 60%)', true, 10),
  ('editor', 'Editor', 'Moderace obsahu a stránek', 'hsl(280 80% 60%)', true, 20),
  ('content_creator', 'Content Creator', 'Může přidávat servery a obsah', 'hsl(200 80% 60%)', true, 30),
  ('user', 'Uživatel', 'Standardní přihlášený uživatel', 'hsl(160 60% 50%)', true, 90),
  ('banned', 'Zabanován', 'Bez přístupu k zápisu', 'hsl(0 0% 40%)', true, 100)
ON CONFLICT (slug) DO NOTHING;

-- ========================================
-- 6. Seed permissions
-- ========================================
INSERT INTO public.permissions (module, action, label, description, position) VALUES
  -- Forum
  ('forum', 'view', 'Zobrazit fórum', NULL, 110),
  ('forum', 'create_thread', 'Vytvářet vlákna', NULL, 111),
  ('forum', 'create_post', 'Psát příspěvky', NULL, 112),
  ('forum', 'edit_own', 'Upravit vlastní obsah', NULL, 113),
  ('forum', 'edit_any', 'Upravit cizí obsah', 'Moderátorská akce', 114),
  ('forum', 'delete_own', 'Smazat vlastní obsah', NULL, 115),
  ('forum', 'delete_any', 'Smazat cizí obsah', 'Moderátorská akce', 116),
  ('forum', 'manage_categories', 'Spravovat kategorie', NULL, 117),
  -- Tickets
  ('tickets', 'create', 'Vytvořit ticket', NULL, 210),
  ('tickets', 'reply_own', 'Odpovídat na vlastní tickety', NULL, 211),
  ('tickets', 'view_all', 'Vidět všechny tickety', 'Helpdesk staff', 212),
  ('tickets', 'reply_any', 'Odpovídat na všechny tickety', 'Helpdesk staff', 213),
  ('tickets', 'manage', 'Měnit status, prioritu, přiřazení', NULL, 214),
  -- Servers
  ('servers', 'view', 'Zobrazit server list', NULL, 310),
  ('servers', 'create', 'Přidat server', NULL, 311),
  ('servers', 'edit_own', 'Upravit vlastní server', NULL, 312),
  ('servers', 'edit_any', 'Upravit cizí server', NULL, 313),
  ('servers', 'delete_own', 'Smazat vlastní server', NULL, 314),
  ('servers', 'delete_any', 'Smazat cizí server', NULL, 315),
  ('servers', 'approve', 'Schvalovat servery od běžných uživatelů', NULL, 316),
  ('servers', 'manage_games', 'Spravovat katalog her', NULL, 317),
  -- Page Builder
  ('pages', 'view_drafts', 'Vidět rozpracované stránky', NULL, 410),
  ('pages', 'edit', 'Editovat stránky', NULL, 411),
  ('pages', 'publish', 'Publikovat stránky', NULL, 412),
  ('pages', 'delete', 'Mazat stránky', NULL, 413),
  -- Messages
  ('messages', 'send', 'Posílat zprávy', NULL, 510),
  ('messages', 'view_all', 'Vidět všechny konverzace (audit)', NULL, 511),
  -- Profiles
  ('profiles', 'edit_any', 'Upravit cizí profil', NULL, 610),
  -- Admin
  ('admin', 'access', 'Přístup do administrace', NULL, 910),
  ('admin', 'manage_users', 'Spravovat uživatele a role', NULL, 911),
  ('admin', 'manage_roles', 'Spravovat role a oprávnění', NULL, 912),
  ('admin', 'view_moderation_log', 'Vidět moderation log', NULL, 913)
ON CONFLICT (module, action) DO NOTHING;

-- ========================================
-- 7. Seed default permissions for builtin roles
-- ========================================
-- Admin: all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'admin'
ON CONFLICT DO NOTHING;

-- Editor: moderation + content management (no role/permission management)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'editor'
  AND (
    p.module IN ('forum', 'pages', 'servers')
    OR (p.module = 'tickets' AND p.action IN ('view_all','reply_any','manage','create','reply_own'))
    OR (p.module = 'admin' AND p.action IN ('access','view_moderation_log'))
    OR (p.module = 'messages' AND p.action = 'send')
  )
ON CONFLICT DO NOTHING;

-- Content Creator: forum participation + own servers
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'content_creator'
  AND (
    (p.module = 'forum' AND p.action IN ('view','create_thread','create_post','edit_own','delete_own'))
    OR (p.module = 'servers' AND p.action IN ('view','create','edit_own','delete_own'))
    OR (p.module = 'tickets' AND p.action IN ('create','reply_own'))
    OR (p.module = 'messages' AND p.action = 'send')
  )
ON CONFLICT DO NOTHING;

-- User: basic participation
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r, public.permissions p
WHERE r.slug = 'user'
  AND (
    (p.module = 'forum' AND p.action IN ('view','create_thread','create_post','edit_own','delete_own'))
    OR (p.module = 'servers' AND p.action = 'view')
    OR (p.module = 'tickets' AND p.action IN ('create','reply_own'))
    OR (p.module = 'messages' AND p.action = 'send')
  )
ON CONFLICT DO NOTHING;

-- Banned: nothing (no inserts)

-- ========================================
-- 8. Backfill role_id for existing user_roles
-- ========================================
UPDATE public.user_roles ur
SET role_id = r.id
FROM public.roles r
WHERE ur.role_id IS NULL
  AND r.slug = ur.role::text;

-- ========================================
-- 9. user_has_permission function
-- ========================================
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = ur.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND p.action = _action
  )
  OR EXISTS (
    -- Fallback: legacy enum-based roles still grant permission via role slug match
    SELECT 1
    FROM public.user_roles ur
    JOIN public.roles r ON r.slug = ur.role::text
    JOIN public.role_permissions rp ON rp.role_id = r.id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = _user_id
      AND p.module = _module
      AND p.action = _action
  );
$$;

-- ========================================
-- 10. Auto-create role_id on insert into user_roles for builtin enum roles
-- ========================================
CREATE OR REPLACE FUNCTION public.sync_user_role_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role_id IS NULL THEN
    SELECT id INTO NEW.role_id FROM public.roles WHERE slug = NEW.role::text;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER sync_user_role_id_trigger
  BEFORE INSERT ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_id();
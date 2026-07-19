
-- 1) RBAC read tables: restrict SELECT to admins/staff, expose own perms via SECURITY DEFINER RPC
DROP POLICY IF EXISTS "Roles viewable by authenticated" ON public.roles;
CREATE POLICY "Roles viewable by staff"
  ON public.roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.can('roles','manage'));

DROP POLICY IF EXISTS "Permissions viewable by authenticated" ON public.permissions;
CREATE POLICY "Permissions viewable by staff"
  ON public.permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.can('roles','manage'));

DROP POLICY IF EXISTS "Role permissions viewable by authenticated" ON public.role_permissions;
CREATE POLICY "Role permissions viewable by staff"
  ON public.role_permissions FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.can('roles','manage'));

CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE(module text, action text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid()
  UNION
  SELECT DISTINCT p.module, p.action
  FROM public.user_roles ur
  JOIN public.roles r ON r.slug = ur.role::text
  JOIN public.role_permissions rp ON rp.role_id = r.id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE ur.user_id = auth.uid();
$$;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- 2) Guild-scoped tables: scope policies to 'authenticated' instead of 'public'
-- bot_guild_config
DROP POLICY IF EXISTS "Guild config view" ON public.bot_guild_config;
DROP POLICY IF EXISTS "Guild config insert" ON public.bot_guild_config;
DROP POLICY IF EXISTS "Guild config update" ON public.bot_guild_config;
DROP POLICY IF EXISTS "Guild config delete" ON public.bot_guild_config;
CREATE POLICY "Guild config view"   ON public.bot_guild_config FOR SELECT TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "Guild config insert" ON public.bot_guild_config FOR INSERT TO authenticated WITH CHECK (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "Guild config update" ON public.bot_guild_config FOR UPDATE TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "Guild config delete" ON public.bot_guild_config FOR DELETE TO authenticated USING (public.can('bot','manage'));

-- bot_guilds (only the three public-role policies)
DROP POLICY IF EXISTS "Bot guilds view" ON public.bot_guilds;
DROP POLICY IF EXISTS "Bot guilds insert" ON public.bot_guilds;
DROP POLICY IF EXISTS "Bot guilds delete" ON public.bot_guilds;
CREATE POLICY "Bot guilds view" ON public.bot_guilds FOR SELECT TO authenticated
  USING (public.can('bot','manage') OR (owner_user_id = auth.uid()) OR (owner_discord_id IS NOT NULL AND owner_discord_id = public.current_user_discord_id()));
CREATE POLICY "Bot guilds insert" ON public.bot_guilds FOR INSERT TO authenticated
  WITH CHECK (public.can('bot','manage') OR owner_user_id = auth.uid());
CREATE POLICY "Bot guilds delete" ON public.bot_guilds FOR DELETE TO authenticated
  USING (public.can('bot','manage'));

-- bot_minecraft_config
DROP POLICY IF EXISTS "MC config view" ON public.bot_minecraft_config;
DROP POLICY IF EXISTS "MC config insert" ON public.bot_minecraft_config;
DROP POLICY IF EXISTS "MC config update" ON public.bot_minecraft_config;
CREATE POLICY "MC config view"   ON public.bot_minecraft_config FOR SELECT TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "MC config insert" ON public.bot_minecraft_config FOR INSERT TO authenticated WITH CHECK (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "MC config update" ON public.bot_minecraft_config FOR UPDATE TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id));

-- bot_minecraft_links
DROP POLICY IF EXISTS "MC links view" ON public.bot_minecraft_links;
DROP POLICY IF EXISTS "MC links insert" ON public.bot_minecraft_links;
DROP POLICY IF EXISTS "MC links delete" ON public.bot_minecraft_links;
CREATE POLICY "MC links view"   ON public.bot_minecraft_links FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "MC links insert" ON public.bot_minecraft_links FOR INSERT TO authenticated WITH CHECK (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "MC links delete" ON public.bot_minecraft_links FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.is_guild_manager(auth.uid(), guild_id));

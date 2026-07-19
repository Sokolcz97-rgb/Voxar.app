
-- 1) TABLE: vox_roles
CREATE TABLE public.vox_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES public.vox_guilds(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '#94a3b8',
  icon text,          -- emoji NEBO název Lucide ikony (např. "Crown")
  badge_url text,     -- volitelný obrázkový badge (CDN URL)
  position integer NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  permissions jsonb NOT NULL DEFAULT '{
    "manage_server": false,
    "manage_channels": false,
    "manage_roles": false,
    "manage_messages": false,
    "kick_members": false,
    "ban_members": false,
    "create_invite": true,
    "mention_everyone": false
  }'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guild_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_roles TO authenticated;
GRANT ALL ON public.vox_roles TO service_role;

ALTER TABLE public.vox_roles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER vox_roles_updated
BEFORE UPDATE ON public.vox_roles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) TABLE: vox_member_roles (M:N)
CREATE TABLE public.vox_member_roles (
  guild_id uuid NOT NULL REFERENCES public.vox_guilds(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role_id uuid NOT NULL REFERENCES public.vox_roles(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id, role_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vox_member_roles TO authenticated;
GRANT ALL ON public.vox_member_roles TO service_role;

ALTER TABLE public.vox_member_roles ENABLE ROW LEVEL SECURITY;

-- 3) helper: vox_has_perm(guild, user, perm)
CREATE OR REPLACE FUNCTION public.vox_has_perm(_guild uuid, _user uuid, _perm text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- owner má vše
    EXISTS (SELECT 1 FROM public.vox_guilds g WHERE g.id = _guild AND g.owner_id = _user)
    -- legacy enum owner/mod = manage_* + moderate
    OR (
      _perm IN ('manage_server','manage_channels','manage_roles','manage_messages','kick_members','ban_members','create_invite','mention_everyone')
      AND public.vox_member_role(_guild, _user) IN ('owner'::vox_member_role, 'mod'::vox_member_role)
    )
    -- vlastní role s daným permem
    OR EXISTS (
      SELECT 1 FROM public.vox_member_roles mr
      JOIN public.vox_roles r ON r.id = mr.role_id
      WHERE mr.guild_id = _guild
        AND mr.user_id  = _user
        AND COALESCE( (r.permissions ->> _perm)::boolean, false ) = true
    );
$$;

-- 4) RLS pro vox_roles
CREATE POLICY vox_roles_select ON public.vox_roles
  FOR SELECT USING (public.is_vox_member(guild_id, auth.uid()));

CREATE POLICY vox_roles_insert ON public.vox_roles
  FOR INSERT WITH CHECK (public.vox_has_perm(guild_id, auth.uid(), 'manage_roles'));

CREATE POLICY vox_roles_update ON public.vox_roles
  FOR UPDATE USING (public.vox_has_perm(guild_id, auth.uid(), 'manage_roles'))
  WITH CHECK (public.vox_has_perm(guild_id, auth.uid(), 'manage_roles'));

CREATE POLICY vox_roles_delete ON public.vox_roles
  FOR DELETE USING (public.vox_has_perm(guild_id, auth.uid(), 'manage_roles'));

-- 5) RLS pro vox_member_roles
CREATE POLICY vox_member_roles_select ON public.vox_member_roles
  FOR SELECT USING (public.is_vox_member(guild_id, auth.uid()));

CREATE POLICY vox_member_roles_insert ON public.vox_member_roles
  FOR INSERT WITH CHECK (public.vox_has_perm(guild_id, auth.uid(), 'manage_roles'));

CREATE POLICY vox_member_roles_delete ON public.vox_member_roles
  FOR DELETE USING (public.vox_has_perm(guild_id, auth.uid(), 'manage_roles'));

-- 6) rozšíření politik: vox_channels — INSERT/UPDATE/DELETE dle manage_channels
DROP POLICY IF EXISTS vox_channels_write_admin ON public.vox_channels;
DROP POLICY IF EXISTS vox_channels_update_admin ON public.vox_channels;
DROP POLICY IF EXISTS vox_channels_delete_admin ON public.vox_channels;

CREATE POLICY vox_channels_insert ON public.vox_channels
  FOR INSERT WITH CHECK (public.vox_has_perm(guild_id, auth.uid(), 'manage_channels'));

CREATE POLICY vox_channels_update ON public.vox_channels
  FOR UPDATE USING (public.vox_has_perm(guild_id, auth.uid(), 'manage_channels'))
  WITH CHECK (public.vox_has_perm(guild_id, auth.uid(), 'manage_channels'));

CREATE POLICY vox_channels_delete ON public.vox_channels
  FOR DELETE USING (public.vox_has_perm(guild_id, auth.uid(), 'manage_channels'));

-- 7) rozšíření politik: vox_guilds UPDATE — manage_server (owner zůstává z helperu)
DROP POLICY IF EXISTS vox_guilds_update_owner ON public.vox_guilds;
CREATE POLICY vox_guilds_update ON public.vox_guilds
  FOR UPDATE USING (public.vox_has_perm(id, auth.uid(), 'manage_server'))
  WITH CHECK (public.vox_has_perm(id, auth.uid(), 'manage_server'));

-- 8) rozšíření politik: vox_guild_members — kick přes kick_members; self-leave zůstává
DROP POLICY IF EXISTS vox_members_delete_admin_or_self ON public.vox_guild_members;
DROP POLICY IF EXISTS vox_members_update_admin ON public.vox_guild_members;

CREATE POLICY vox_members_delete ON public.vox_guild_members
  FOR DELETE USING (
    user_id = auth.uid()
    OR public.vox_has_perm(guild_id, auth.uid(), 'kick_members')
  );

CREATE POLICY vox_members_update ON public.vox_guild_members
  FOR UPDATE USING (
    user_id = auth.uid()
    OR public.vox_has_perm(guild_id, auth.uid(), 'manage_server')
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.vox_has_perm(guild_id, auth.uid(), 'manage_server')
  );

-- 9) chraň ownera
CREATE OR REPLACE FUNCTION public.vox_protect_owner_membership()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.vox_guilds g WHERE g.id = OLD.guild_id AND g.owner_id = OLD.user_id) THEN
    RAISE EXCEPTION 'Nelze odebrat majitele serveru';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER vox_members_protect_owner
BEFORE DELETE ON public.vox_guild_members
FOR EACH ROW EXECUTE FUNCTION public.vox_protect_owner_membership();

-- 10) auto-seed defaultních rolí při vytvoření serveru
CREATE OR REPLACE FUNCTION public.vox_seed_default_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.vox_roles (guild_id, name, color, icon, position, is_default, permissions)
  VALUES
    (NEW.id, 'Admin', '#ef4444', 'Crown', 100, false, '{
       "manage_server": true, "manage_channels": true, "manage_roles": true,
       "manage_messages": true, "kick_members": true, "ban_members": true,
       "create_invite": true, "mention_everyone": true
     }'::jsonb),
    (NEW.id, 'Moderátor', '#3b82f6', 'Shield', 50, false, '{
       "manage_server": false, "manage_channels": true, "manage_roles": false,
       "manage_messages": true, "kick_members": true, "ban_members": false,
       "create_invite": true, "mention_everyone": false
     }'::jsonb),
    (NEW.id, 'Člen', '#94a3b8', 'User', 0, true, '{
       "manage_server": false, "manage_channels": false, "manage_roles": false,
       "manage_messages": false, "kick_members": false, "ban_members": false,
       "create_invite": true, "mention_everyone": false
     }'::jsonb);
  RETURN NEW;
END;
$$;

CREATE TRIGGER vox_guilds_seed_default_roles
AFTER INSERT ON public.vox_guilds
FOR EACH ROW EXECUTE FUNCTION public.vox_seed_default_roles();

-- 11) seed default rolí i pro existující servery (aby UI mělo s čím pracovat)
INSERT INTO public.vox_roles (guild_id, name, color, icon, position, is_default, permissions)
SELECT g.id, 'Admin', '#ef4444', 'Crown', 100, false, '{
   "manage_server": true, "manage_channels": true, "manage_roles": true,
   "manage_messages": true, "kick_members": true, "ban_members": true,
   "create_invite": true, "mention_everyone": true
 }'::jsonb
FROM public.vox_guilds g
WHERE NOT EXISTS (SELECT 1 FROM public.vox_roles r WHERE r.guild_id = g.id);

INSERT INTO public.vox_roles (guild_id, name, color, icon, position, is_default, permissions)
SELECT g.id, 'Člen', '#94a3b8', 'User', 0, true, '{
   "manage_server": false, "manage_channels": false, "manage_roles": false,
   "manage_messages": false, "kick_members": false, "ban_members": false,
   "create_invite": true, "mention_everyone": false
 }'::jsonb
FROM public.vox_guilds g
WHERE NOT EXISTS (SELECT 1 FROM public.vox_roles r WHERE r.guild_id = g.id AND r.name = 'Člen');

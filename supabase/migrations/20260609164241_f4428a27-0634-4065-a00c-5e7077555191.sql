
-- 1) Helper: current user's Discord ID from auth.identities
CREATE OR REPLACE FUNCTION public.current_user_discord_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT i.provider_id
  FROM auth.identities i
  WHERE i.user_id = auth.uid()
    AND i.provider = 'discord'
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_user_discord_id() TO authenticated, anon, service_role;

-- 2) Update is_guild_manager to also match by Discord ID (covers owners
--    whose account wasn't attached to the bot_guilds row directly)
CREATE OR REPLACE FUNCTION public.is_guild_manager(_user_id uuid, _guild_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.bot_guilds g
      LEFT JOIN auth.identities i
        ON i.user_id = _user_id AND i.provider = 'discord'
      WHERE g.guild_id = _guild_id
        AND g.status = 'approved'
        AND (
          g.owner_user_id = _user_id
          OR (g.owner_discord_id IS NOT NULL AND g.owner_discord_id = i.provider_id)
        )
    );
$$;

-- 3) Update bot_guilds SELECT policy: each owner only sees their own guilds
--    (admins still see all). Match by account OR Discord ID.
DROP POLICY IF EXISTS "Bot guilds view" ON public.bot_guilds;
CREATE POLICY "Bot guilds view"
  ON public.bot_guilds
  FOR SELECT
  USING (
    public.can('bot', 'manage')
    OR owner_user_id = auth.uid()
    OR (
      owner_discord_id IS NOT NULL
      AND owner_discord_id = public.current_user_discord_id()
    )
  );

-- 4) Backfill owner_user_id for existing guilds where we can match by Discord ID
UPDATE public.bot_guilds g
SET owner_user_id = i.user_id
FROM auth.identities i
WHERE g.owner_user_id IS NULL
  AND g.owner_discord_id IS NOT NULL
  AND i.provider = 'discord'
  AND i.provider_id = g.owner_discord_id;

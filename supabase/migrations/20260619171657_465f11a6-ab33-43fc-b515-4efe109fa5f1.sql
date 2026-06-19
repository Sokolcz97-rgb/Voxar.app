CREATE TABLE IF NOT EXISTS public.user_discord_links (
  user_id uuid PRIMARY KEY,
  discord_user_id text NOT NULL UNIQUE,
  discord_username text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_discord_links TO authenticated;
GRANT ALL ON public.user_discord_links TO service_role;

ALTER TABLE public.user_discord_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own Discord link" ON public.user_discord_links;
CREATE POLICY "Users can view their own Discord link"
  ON public.user_discord_links
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own Discord link" ON public.user_discord_links;
CREATE POLICY "Users can create their own Discord link"
  ON public.user_discord_links
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own Discord link" ON public.user_discord_links;
CREATE POLICY "Users can update their own Discord link"
  ON public.user_discord_links
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS user_discord_links_set_updated_at ON public.user_discord_links;
CREATE TRIGGER user_discord_links_set_updated_at
  BEFORE UPDATE ON public.user_discord_links
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.user_discord_links (user_id, discord_user_id, discord_username, created_at, updated_at)
SELECT DISTINCT ON (user_id)
  user_id,
  discord_user_id,
  discord_username,
  created_at,
  now()
FROM public.discord_oauth_sessions
WHERE user_id IS NOT NULL
  AND discord_user_id IS NOT NULL
ORDER BY user_id, created_at DESC
ON CONFLICT (user_id) DO UPDATE SET
  discord_user_id = EXCLUDED.discord_user_id,
  discord_username = EXCLUDED.discord_username,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.discord_id_for_user(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT COALESCE(
    (SELECT l.discord_user_id FROM public.user_discord_links l WHERE l.user_id = _user_id LIMIT 1),
    (SELECT i.provider_id FROM auth.identities i WHERE i.user_id = _user_id AND i.provider = 'discord' LIMIT 1)
  );
$$;

GRANT EXECUTE ON FUNCTION public.discord_id_for_user(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.current_user_discord_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT public.discord_id_for_user(auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.current_user_discord_id() TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION public.is_guild_manager(_user_id uuid, _guild_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.can('bot','manage')
    OR EXISTS (
      SELECT 1
      FROM public.bot_guilds g
      WHERE g.guild_id = _guild_id
        AND g.status = 'approved'
        AND (
          g.owner_user_id = _user_id
          OR (
            g.owner_discord_id IS NOT NULL
            AND g.owner_discord_id = public.discord_id_for_user(_user_id)
          )
        )
    );
$$;
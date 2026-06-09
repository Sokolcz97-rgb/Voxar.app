CREATE OR REPLACE FUNCTION public.is_guild_manager(_user_id uuid, _guild_id text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.can('bot','manage')
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
$function$;
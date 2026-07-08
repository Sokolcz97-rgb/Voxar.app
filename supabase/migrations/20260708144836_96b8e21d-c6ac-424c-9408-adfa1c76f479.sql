
-- 1) Tighten Minecraft config DELETE to guild-scoped managers
DROP POLICY IF EXISTS "MC config delete" ON public.bot_minecraft_config;
CREATE POLICY "MC config delete" ON public.bot_minecraft_config
  FOR DELETE TO authenticated
  USING (public.is_guild_manager(auth.uid(), guild_id));

-- 2) Tighten bot_outbound_queue scan insert: whitelist action values and required shape
DROP POLICY IF EXISTS "Guild managers queue scan members" ON public.bot_outbound_queue;
CREATE POLICY "Guild managers queue scan members" ON public.bot_outbound_queue
  FOR INSERT TO authenticated
  WITH CHECK (
    source = 'bot_scan'
    AND webhook_url IS NULL
    AND channel_id IS NULL
    AND jsonb_typeof(payload) = 'object'
    AND (payload ->> 'action') IN ('scan_members', 'scan_messages')
    AND (payload ->> 'guild_id') IS NOT NULL
    AND public.is_guild_manager(auth.uid(), payload ->> 'guild_id')
  );

-- 3) Add explicit owner-only policies on discord_oauth_sessions (RLS already enabled)
DROP POLICY IF EXISTS "Owners view own oauth sessions" ON public.discord_oauth_sessions;
DROP POLICY IF EXISTS "Owners insert own oauth sessions" ON public.discord_oauth_sessions;
DROP POLICY IF EXISTS "Owners update own oauth sessions" ON public.discord_oauth_sessions;
DROP POLICY IF EXISTS "Owners delete own oauth sessions" ON public.discord_oauth_sessions;

CREATE POLICY "Owners view own oauth sessions" ON public.discord_oauth_sessions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Owners insert own oauth sessions" ON public.discord_oauth_sessions
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners update own oauth sessions" ON public.discord_oauth_sessions
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners delete own oauth sessions" ON public.discord_oauth_sessions
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

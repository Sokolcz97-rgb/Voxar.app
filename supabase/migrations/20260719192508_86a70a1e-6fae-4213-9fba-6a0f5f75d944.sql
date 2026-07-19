
-- Fix 1: Restrict bot_guilds INSERT so owner_discord_id (if provided) must match caller's verified Discord ID
DROP POLICY IF EXISTS "Bot guilds insert" ON public.bot_guilds;
CREATE POLICY "Bot guilds insert" ON public.bot_guilds
FOR INSERT TO authenticated
WITH CHECK (
  public.can('bot','manage')
  OR (
    owner_user_id = auth.uid()
    AND status = 'pending'::bot_guild_status
    AND reviewed_at IS NULL
    AND (
      owner_discord_id IS NULL
      OR owner_discord_id = public.discord_id_for_user(auth.uid())
    )
  )
);

-- Fix 2: Remove self-insert on moderation_log; only service_role / SECURITY DEFINER can insert
DROP POLICY IF EXISTS "moderation_log_insert_self" ON public.moderation_log;

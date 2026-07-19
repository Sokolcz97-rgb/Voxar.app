
DROP POLICY "Bot guilds insert" ON public.bot_guilds;
CREATE POLICY "Bot guilds insert" ON public.bot_guilds FOR INSERT
  WITH CHECK (
    can('bot','manage')
    OR (
      owner_user_id = auth.uid()
      AND status = 'pending'::bot_guild_status
      AND reviewed_at IS NULL
    )
  );

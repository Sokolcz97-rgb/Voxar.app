
ALTER TABLE public.bot_points_config
  ADD COLUMN IF NOT EXISTS public_leaderboard boolean NOT NULL DEFAULT true;

DROP POLICY IF EXISTS "points read for guild managers or public leaderboard" ON public.bot_points;

CREATE POLICY "points read scoped"
  ON public.bot_points
  FOR SELECT
  TO authenticated
  USING (
    public.is_guild_manager(auth.uid(), guild_id)
    OR user_id = public.current_user_discord_id()
    OR EXISTS (
      SELECT 1 FROM public.bot_points_config c
      WHERE c.guild_id = bot_points.guild_id
        AND c.public_leaderboard = true
    )
  );

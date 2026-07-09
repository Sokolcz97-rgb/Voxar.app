
-- Voice points system
CREATE TABLE IF NOT EXISTS public.bot_points_config (
  guild_id text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  minutes_per_point integer NOT NULL DEFAULT 10,
  goal_channel_id text,
  milestones integer[] NOT NULL DEFAULT ARRAY[10,100,1000]::integer[],
  repeat_every integer NOT NULL DEFAULT 0, -- 0 = disabled
  announce_message text NOT NULL DEFAULT '🎉 {user} právě dosáhl **{points} bodů**! Skvělá práce v hlasovém kanálu.',
  ignore_afk boolean NOT NULL DEFAULT true,
  ignore_muted boolean NOT NULL DEFAULT true,
  ignore_deafened boolean NOT NULL DEFAULT true,
  min_members integer NOT NULL DEFAULT 2,
  ignored_channel_ids text[] NOT NULL DEFAULT '{}'::text[],
  bonus_role_ids text[] NOT NULL DEFAULT '{}'::text[],
  bonus_multiplier numeric NOT NULL DEFAULT 1.0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_points_config TO authenticated;
GRANT ALL ON public.bot_points_config TO service_role;
ALTER TABLE public.bot_points_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points config select" ON public.bot_points_config FOR SELECT TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "points config insert" ON public.bot_points_config FOR INSERT TO authenticated WITH CHECK (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "points config update" ON public.bot_points_config FOR UPDATE TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id)) WITH CHECK (public.is_guild_manager(auth.uid(), guild_id));
CREATE POLICY "points config delete" ON public.bot_points_config FOR DELETE TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id));

CREATE TRIGGER trg_bot_points_config_updated_at BEFORE UPDATE ON public.bot_points_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.bot_points (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  points integer NOT NULL DEFAULT 0,
  total_minutes integer NOT NULL DEFAULT 0,
  last_milestone integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
GRANT SELECT ON public.bot_points TO authenticated;
GRANT ALL ON public.bot_points TO service_role;
ALTER TABLE public.bot_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points read for guild managers or public leaderboard" ON public.bot_points
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_bot_points_guild_points ON public.bot_points(guild_id, points DESC);

CREATE TABLE IF NOT EXISTS public.bot_voice_sessions (
  guild_id text NOT NULL,
  user_id text NOT NULL,
  channel_id text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
GRANT ALL ON public.bot_voice_sessions TO service_role;
ALTER TABLE public.bot_voice_sessions ENABLE ROW LEVEL SECURITY;
-- No client policies; bot uses service role.

CREATE TABLE IF NOT EXISTS public.bot_points_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  user_id text NOT NULL,
  delta integer NOT NULL,
  reason text,
  actor_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.bot_points_log TO authenticated;
GRANT ALL ON public.bot_points_log TO service_role;
ALTER TABLE public.bot_points_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "points log guild managers" ON public.bot_points_log
  FOR SELECT TO authenticated USING (public.is_guild_manager(auth.uid(), guild_id));

CREATE INDEX IF NOT EXISTS idx_bot_points_log_guild ON public.bot_points_log(guild_id, created_at DESC);

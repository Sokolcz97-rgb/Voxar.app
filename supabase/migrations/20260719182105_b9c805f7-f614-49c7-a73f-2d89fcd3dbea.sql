
-- Bot guild-scoped configs: add WITH CHECK mirroring USING
DROP POLICY "Bot commands update" ON public.bot_commands;
CREATE POLICY "Bot commands update" ON public.bot_commands FOR UPDATE
  USING (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)))
  WITH CHECK (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)));

DROP POLICY "Guild config update" ON public.bot_guild_config;
CREATE POLICY "Guild config update" ON public.bot_guild_config FOR UPDATE
  USING (is_guild_manager(auth.uid(), guild_id))
  WITH CHECK (is_guild_manager(auth.uid(), guild_id));

DROP POLICY "MC config update" ON public.bot_minecraft_config;
CREATE POLICY "MC config update" ON public.bot_minecraft_config FOR UPDATE
  USING (is_guild_manager(auth.uid(), guild_id))
  WITH CHECK (is_guild_manager(auth.uid(), guild_id));

DROP POLICY "Bot status checks update" ON public.bot_status_checks;
CREATE POLICY "Bot status checks update" ON public.bot_status_checks FOR UPDATE
  USING (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)))
  WITH CHECK (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)));

DROP POLICY "Bot streams update" ON public.bot_stream_notifications;
CREATE POLICY "Bot streams update" ON public.bot_stream_notifications FOR UPDATE
  USING (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)))
  WITH CHECK (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)));

DROP POLICY "Bot welcome update" ON public.bot_welcome;
CREATE POLICY "Bot welcome update" ON public.bot_welcome FOR UPDATE
  USING (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)))
  WITH CHECK (can('bot','manage') OR (guild_id IS NOT NULL AND is_guild_manager(auth.uid(), guild_id)));

-- Forum threads/posts: prevent user_id reassignment
DROP POLICY "Posts update" ON public.forum_posts;
CREATE POLICY "Posts update" ON public.forum_posts FOR UPDATE
  USING (((auth.uid() = user_id) AND can('forum','edit_own')) OR can('forum','edit_any'))
  WITH CHECK (((auth.uid() = user_id) AND can('forum','edit_own')) OR can('forum','edit_any'));

DROP POLICY "Threads update" ON public.forum_threads;
CREATE POLICY "Threads update" ON public.forum_threads FOR UPDATE
  USING (((auth.uid() = user_id) AND can('forum','edit_own')) OR can('forum','edit_any'))
  WITH CHECK (((auth.uid() = user_id) AND can('forum','edit_own')) OR can('forum','edit_any'));

-- Servers/games/discord_servers
DROP POLICY "Discord servers update" ON public.discord_servers;
CREATE POLICY "Discord servers update" ON public.discord_servers FOR UPDATE
  USING (can('discord','manage'))
  WITH CHECK (can('discord','manage'));

DROP POLICY "Games manage update" ON public.games;
CREATE POLICY "Games manage update" ON public.games FOR UPDATE
  USING (can('servers','manage_games'))
  WITH CHECK (can('servers','manage_games'));

DROP POLICY "Servers update" ON public.servers;
CREATE POLICY "Servers update" ON public.servers FOR UPDATE
  USING (((auth.uid() = owner_id) AND can('servers','edit_own')) OR can('servers','edit_any'))
  WITH CHECK (((auth.uid() = owner_id) AND can('servers','edit_own')) OR can('servers','edit_any'));

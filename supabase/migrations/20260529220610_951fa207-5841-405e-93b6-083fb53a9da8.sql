ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_server_stats;
ALTER TABLE public.bot_server_stats REPLICA IDENTITY FULL;
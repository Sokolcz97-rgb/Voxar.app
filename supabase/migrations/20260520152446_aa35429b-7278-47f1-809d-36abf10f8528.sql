DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_tickets_config';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_outbound_queue';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
ALTER TABLE public.bot_tickets_config REPLICA IDENTITY FULL;
ALTER TABLE public.bot_outbound_queue REPLICA IDENTITY FULL;
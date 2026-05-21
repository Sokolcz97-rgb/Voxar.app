ALTER TABLE public.bot_tickets_config
  ADD COLUMN IF NOT EXISTS notify_channel_id text;
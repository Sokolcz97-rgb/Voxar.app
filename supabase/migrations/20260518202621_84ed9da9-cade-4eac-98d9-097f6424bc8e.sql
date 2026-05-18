
ALTER TABLE public.bot_stream_notifications ADD COLUMN IF NOT EXISTS webhook_url text;
ALTER TABLE public.bot_status_checks ADD COLUMN IF NOT EXISTS webhook_url text;

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

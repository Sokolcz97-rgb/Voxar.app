ALTER TABLE public.bot_stream_notifications
  ADD COLUMN IF NOT EXISTS last_subscribed_at timestamptz;

DO $$
BEGIN
  PERFORM cron.unschedule('bot-poll-streams-job');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'bot-poll-streams-job',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rioexuvgvmdwvidfakxy.supabase.co/functions/v1/bot-poll-streams',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpb2V4dXZndm1kd3ZpZGZha3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzM5NTUsImV4cCI6MjA5MjAwOTk1NX0.LdZvFJw_W-0wD1XUFPFjGpu9Mp1BT_j_HJOOMr3VbLE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
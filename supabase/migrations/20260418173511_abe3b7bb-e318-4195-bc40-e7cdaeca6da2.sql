CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove existing schedule with same name (idempotent)
DO $$
BEGIN
  PERFORM cron.unschedule('check-live-streams-job');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'check-live-streams-job',
  '*/2 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://rioexuvgvmdwvidfakxy.supabase.co/functions/v1/check-live-streams',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpb2V4dXZndm1kd3ZpZGZha3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0MzM5NTUsImV4cCI6MjA5MjAwOTk1NX0.LdZvFJw_W-0wD1XUFPFjGpu9Mp1BT_j_HJOOMr3VbLE"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
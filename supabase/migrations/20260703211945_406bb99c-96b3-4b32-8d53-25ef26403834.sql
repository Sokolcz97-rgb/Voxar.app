CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $$
BEGIN
  PERFORM cron.unschedule('bot-check-status-every-minute');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'bot-check-status-every-minute',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://rioexuvgvmdwvidfakxy.supabase.co/functions/v1/bot-check-status',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
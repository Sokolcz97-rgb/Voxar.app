ALTER TABLE public.site_settings
  ADD COLUMN IF NOT EXISTS web_tickets_category_id text,
  ADD COLUMN IF NOT EXISTS web_tickets_notify_channel_id text;
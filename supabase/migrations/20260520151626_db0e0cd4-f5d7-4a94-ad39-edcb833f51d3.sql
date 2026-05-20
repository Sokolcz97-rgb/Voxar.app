ALTER TABLE public.bot_tickets_config
  ADD COLUMN IF NOT EXISTS panel_mode text NOT NULL DEFAULT 'button';

ALTER TABLE public.bot_tickets_config
  DROP CONSTRAINT IF EXISTS bot_tickets_config_panel_mode_check;

ALTER TABLE public.bot_tickets_config
  ADD CONSTRAINT bot_tickets_config_panel_mode_check
  CHECK (panel_mode IN ('button','markdown'));
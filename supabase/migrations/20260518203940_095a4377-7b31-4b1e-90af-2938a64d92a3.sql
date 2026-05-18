
-- Discord sync columns on tickets
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS discord_channel_id text,
  ADD COLUMN IF NOT EXISTS discord_message_id text;

-- Sync config on bot_tickets_config
ALTER TABLE public.bot_tickets_config
  ADD COLUMN IF NOT EXISTS mirror_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sync_channel_id text,
  ADD COLUMN IF NOT EXISTS sync_webhook_url text;

-- Ensure replies cascade delete with ticket so bulk delete works
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'ticket_replies_ticket_id_fkey'
      AND table_name = 'ticket_replies'
  ) THEN
    ALTER TABLE public.ticket_replies
      ADD CONSTRAINT ticket_replies_ticket_id_fkey
      FOREIGN KEY (ticket_id) REFERENCES public.tickets(id) ON DELETE CASCADE;
  END IF;
END $$;

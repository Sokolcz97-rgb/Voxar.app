
ALTER TABLE public.bot_open_tickets
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'discord',
  ADD COLUMN IF NOT EXISTS web_ticket_id uuid;

CREATE INDEX IF NOT EXISTS idx_bot_open_tickets_web_ticket ON public.bot_open_tickets(web_ticket_id);
CREATE INDEX IF NOT EXISTS idx_bot_open_tickets_channel ON public.bot_open_tickets(channel_id);

-- Allow the edge function (using user JWT) to insert outbound jobs for creating
-- a Discord channel for a web ticket the user owns or can manage.
DROP POLICY IF EXISTS "Users queue web ticket channel" ON public.bot_outbound_queue;
CREATE POLICY "Users queue web ticket channel"
ON public.bot_outbound_queue
FOR INSERT
TO authenticated
WITH CHECK (source = 'web_ticket' AND auth.uid() IS NOT NULL);


ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS guild_id text,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'web';

CREATE INDEX IF NOT EXISTS idx_tickets_guild_id ON public.tickets(guild_id);

ALTER TABLE public.bot_tickets_config
  ADD COLUMN IF NOT EXISTS external_webhook_url text;

-- Expand visibility: author, manager of target guild, or platform admin
DROP POLICY IF EXISTS "Tickets view" ON public.tickets;
CREATE POLICY "Tickets view" ON public.tickets FOR SELECT
USING (
  auth.uid() = user_id
  OR public.can('tickets','view_all')
  OR (guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), guild_id))
);

DROP POLICY IF EXISTS "Tickets update" ON public.tickets;
CREATE POLICY "Tickets update" ON public.tickets FOR UPDATE
USING (
  auth.uid() = user_id
  OR public.can('tickets','manage')
  OR (guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), guild_id))
);

DROP POLICY IF EXISTS "Tickets delete" ON public.tickets;
CREATE POLICY "Tickets delete" ON public.tickets FOR DELETE
USING (
  auth.uid() = user_id
  OR public.can('tickets','manage')
  OR (guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), guild_id))
);

-- Replies: guild managers can view + reply on tickets belonging to their guild
DROP POLICY IF EXISTS "Replies view" ON public.ticket_replies;
CREATE POLICY "Replies view" ON public.ticket_replies FOR SELECT
USING (
  public.can('tickets','view_all')
  OR (
    NOT is_internal AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_replies.ticket_id AND t.user_id = auth.uid()
    )
  )
  OR EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_replies.ticket_id
      AND t.guild_id IS NOT NULL
      AND public.is_guild_manager(auth.uid(), t.guild_id)
  )
);

DROP POLICY IF EXISTS "Replies create" ON public.ticket_replies;
CREATE POLICY "Replies create" ON public.ticket_replies FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND (
    public.can('tickets','reply_any')
    OR (
      is_internal = false AND public.can('tickets','reply_own')
      AND EXISTS (
        SELECT 1 FROM public.tickets t
        WHERE t.id = ticket_replies.ticket_id AND t.user_id = auth.uid()
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_replies.ticket_id
        AND t.guild_id IS NOT NULL
        AND public.is_guild_manager(auth.uid(), t.guild_id)
    )
  )
);

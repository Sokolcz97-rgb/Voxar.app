
CREATE POLICY "Guild managers queue ticket actions"
  ON public.bot_outbound_queue FOR INSERT TO authenticated
  WITH CHECK (
    source = 'ticket_dashboard'
    AND EXISTS (
      SELECT 1 FROM public.bot_open_tickets t
      WHERE t.channel_id = bot_outbound_queue.channel_id
        AND is_guild_manager(auth.uid(), t.guild_id)
    )
  );

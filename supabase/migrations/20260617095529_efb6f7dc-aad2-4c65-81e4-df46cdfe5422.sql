
-- 1) profiles: revoke column SELECT on notify_sound/notify_browser; reads via get_my_notification_prefs RPC
REVOKE SELECT (notify_sound, notify_browser) ON public.profiles FROM anon, authenticated;

-- 2) pages: revoke column SELECT on draft_blocks; reads via get_page_draft_blocks RPC
REVOKE SELECT (draft_blocks) ON public.pages FROM anon, authenticated;

-- 3) bot_outbound_queue: tighten guild-manager INSERT policies to forbid webhook_url injection
DROP POLICY IF EXISTS "Guild managers queue scan members" ON public.bot_outbound_queue;
CREATE POLICY "Guild managers queue scan members"
  ON public.bot_outbound_queue
  FOR INSERT
  WITH CHECK (
    source = 'bot_scan'
    AND (payload ->> 'guild_id') IS NOT NULL
    AND webhook_url IS NULL
    AND is_guild_manager(auth.uid(), payload ->> 'guild_id')
  );

DROP POLICY IF EXISTS "Guild managers queue ticket actions" ON public.bot_outbound_queue;
CREATE POLICY "Guild managers queue ticket actions"
  ON public.bot_outbound_queue
  FOR INSERT
  WITH CHECK (
    source = 'ticket_dashboard'
    AND webhook_url IS NULL
    AND EXISTS (
      SELECT 1 FROM public.bot_open_tickets t
      WHERE t.channel_id = bot_outbound_queue.channel_id
        AND is_guild_manager(auth.uid(), t.guild_id)
    )
  );

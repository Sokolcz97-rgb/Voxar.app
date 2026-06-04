
-- 1) Odstranit příliš volné insert pravidlo do bot_outbound_queue.
-- Klient nikdy přímo neposílá web_ticket akce (jdou přes edge funkci se service rolí),
-- takže smazání této politiky nic nerozbije.
DROP POLICY IF EXISTS "Users queue web ticket channel" ON public.bot_outbound_queue;

-- 2) Skrýt interní Discord ID v site_settings před veřejností.
-- Sloupce zůstávají v tabulce, ale klientské role je neuvidí; service_role čte vše.
REVOKE SELECT (web_tickets_guild_id, web_tickets_category_id, web_tickets_notify_channel_id)
  ON public.site_settings FROM anon, authenticated;

-- 3) Zpřísnit veřejnou SELECT politiku na streamer_overrides (admin/editor only).
DROP POLICY IF EXISTS "Streamer overrides viewable by everyone" ON public.streamer_overrides;
DROP POLICY IF EXISTS "Streamer overrides public view" ON public.streamer_overrides;
DROP POLICY IF EXISTS "Streamer overrides view" ON public.streamer_overrides;

CREATE POLICY "Streamer overrides staff view"
  ON public.streamer_overrides FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

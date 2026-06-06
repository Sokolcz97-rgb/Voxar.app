
-- 1. Drop bot_outbound_queue from realtime publication (contains webhook URLs)
ALTER PUBLICATION supabase_realtime DROP TABLE public.bot_outbound_queue;

-- 2. Tighten SELECT on bot_status_checks (drop broad bot:view)
DROP POLICY IF EXISTS "Bot status checks view" ON public.bot_status_checks;
CREATE POLICY "Bot status checks view"
  ON public.bot_status_checks FOR SELECT
  TO authenticated
  USING (
    public.can('bot','manage')
    OR (guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), guild_id))
  );

-- 3. Tighten SELECT on bot_stream_notifications (drop broad bot:view)
DROP POLICY IF EXISTS "Bot streams view" ON public.bot_stream_notifications;
CREATE POLICY "Bot streams view"
  ON public.bot_stream_notifications FOR SELECT
  TO authenticated
  USING (
    public.can('bot','manage')
    OR (guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), guild_id))
  );

-- 4. site_settings: stop exposing web_tickets_* IDs publicly.
--    Restrict base table SELECT to site managers; add public view with safe columns only.
DROP POLICY IF EXISTS "Site settings public view" ON public.site_settings;

CREATE POLICY "Site settings managers view"
  ON public.site_settings FOR SELECT
  TO authenticated
  USING (public.can('site','manage'));

CREATE OR REPLACE VIEW public.site_settings_public
WITH (security_invoker = on) AS
SELECT
  id, site_name, site_tagline, hero_badge,
  hero_title_1, hero_title_2, hero_subtitle, hero_cta_label,
  footer_text, logo_url, favicon_url, updated_at
FROM public.site_settings;

GRANT SELECT ON public.site_settings_public TO anon, authenticated;

-- The view runs as invoker, so it needs SELECT on base columns for anon/auth.
-- Grant column-level SELECT on the safe public columns only.
GRANT SELECT (
  id, site_name, site_tagline, hero_badge,
  hero_title_1, hero_title_2, hero_subtitle, hero_cta_label,
  footer_text, logo_url, favicon_url, updated_at
) ON public.site_settings TO anon, authenticated;

-- Re-add a permissive SELECT policy restricted to the safe columns via the view.
-- Since RLS still applies under security_invoker, we need a policy that allows
-- the row to be read; column-level grants prevent access to sensitive columns.
CREATE POLICY "Site settings safe columns public"
  ON public.site_settings FOR SELECT
  TO anon, authenticated
  USING (true);

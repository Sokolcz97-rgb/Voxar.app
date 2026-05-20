ALTER TABLE public.bot_tickets_config
  DROP CONSTRAINT IF EXISTS bot_tickets_config_panel_mode_check;

ALTER TABLE public.bot_tickets_config
  ADD CONSTRAINT bot_tickets_config_panel_mode_check
  CHECK (panel_mode IN ('button','markdown','categories'));

CREATE TABLE IF NOT EXISTS public.bot_ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  label text NOT NULL,
  description text,
  emoji text,
  discord_category_id text,
  position integer NOT NULL DEFAULT 100,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (guild_id, label)
);

ALTER TABLE public.bot_ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_bot_ticket_categories_guild
  ON public.bot_ticket_categories(guild_id, position);

DROP POLICY IF EXISTS "Bot ticket categories view" ON public.bot_ticket_categories;
DROP POLICY IF EXISTS "Bot ticket categories insert" ON public.bot_ticket_categories;
DROP POLICY IF EXISTS "Bot ticket categories update" ON public.bot_ticket_categories;
DROP POLICY IF EXISTS "Bot ticket categories delete" ON public.bot_ticket_categories;

CREATE POLICY "Bot ticket categories view"
  ON public.bot_ticket_categories FOR SELECT TO authenticated
  USING (
    can('bot','manage') OR can('bot','view') OR public.is_guild_manager(auth.uid(), guild_id)
  );

CREATE POLICY "Bot ticket categories insert"
  ON public.bot_ticket_categories FOR INSERT TO authenticated
  WITH CHECK (
    can('bot','manage') OR public.is_guild_manager(auth.uid(), guild_id)
  );

CREATE POLICY "Bot ticket categories update"
  ON public.bot_ticket_categories FOR UPDATE TO authenticated
  USING (
    can('bot','manage') OR public.is_guild_manager(auth.uid(), guild_id)
  )
  WITH CHECK (
    can('bot','manage') OR public.is_guild_manager(auth.uid(), guild_id)
  );

CREATE POLICY "Bot ticket categories delete"
  ON public.bot_ticket_categories FOR DELETE TO authenticated
  USING (
    can('bot','manage') OR public.is_guild_manager(auth.uid(), guild_id)
  );

DROP TRIGGER IF EXISTS bot_ticket_categories_updated_at ON public.bot_ticket_categories;
CREATE TRIGGER bot_ticket_categories_updated_at
  BEFORE UPDATE ON public.bot_ticket_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  BEGIN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.bot_ticket_categories';
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;

ALTER TABLE public.bot_ticket_categories REPLICA IDENTITY FULL;
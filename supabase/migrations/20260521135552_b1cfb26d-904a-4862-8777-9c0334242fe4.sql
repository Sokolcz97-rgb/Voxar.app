
CREATE TABLE IF NOT EXISTS public.bot_open_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL,
  channel_id text NOT NULL UNIQUE,
  user_id text NOT NULL,
  user_tag text,
  category_id uuid,
  category_label text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bot_open_tickets_guild ON public.bot_open_tickets(guild_id);

ALTER TABLE public.bot_open_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Bot open tickets view"
  ON public.bot_open_tickets FOR SELECT TO authenticated
  USING (can('bot','manage') OR can('bot','view') OR is_guild_manager(auth.uid(), guild_id));

CREATE POLICY "Bot open tickets insert"
  ON public.bot_open_tickets FOR INSERT TO authenticated
  WITH CHECK (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id));

CREATE POLICY "Bot open tickets delete"
  ON public.bot_open_tickets FOR DELETE TO authenticated
  USING (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id));

CREATE POLICY "Bot open tickets update"
  ON public.bot_open_tickets FOR UPDATE TO authenticated
  USING (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id))
  WITH CHECK (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id));

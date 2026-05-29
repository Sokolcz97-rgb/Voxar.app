CREATE TABLE public.bot_server_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  category_name text NOT NULL DEFAULT '📊 Statistiky',
  category_id text,
  slots jsonb NOT NULL DEFAULT '[
    {"kind":"members","template":"👥 Členové: {value}","channel_id":null},
    {"kind":"online","template":"🟢 Online: {value}","channel_id":null},
    {"kind":"web_status","template":"🌐 Web: {value}","channel_id":null},
    {"kind":"bot_status","template":"🤖 Bot: {value}","channel_id":null}
  ]'::jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_server_stats TO authenticated;
GRANT ALL ON public.bot_server_stats TO service_role;

ALTER TABLE public.bot_server_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Server stats view"
ON public.bot_server_stats FOR SELECT TO authenticated
USING (can('bot','manage') OR can('bot','view') OR is_guild_manager(auth.uid(), guild_id));

CREATE POLICY "Server stats insert"
ON public.bot_server_stats FOR INSERT TO authenticated
WITH CHECK (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id));

CREATE POLICY "Server stats update"
ON public.bot_server_stats FOR UPDATE TO authenticated
USING (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id))
WITH CHECK (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id));

CREATE POLICY "Server stats delete"
ON public.bot_server_stats FOR DELETE TO authenticated
USING (can('bot','manage') OR is_guild_manager(auth.uid(), guild_id));
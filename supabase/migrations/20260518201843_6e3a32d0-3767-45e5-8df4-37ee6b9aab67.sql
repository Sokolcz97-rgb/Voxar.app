
-- Bot config (singleton)
CREATE TABLE public.bot_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_singleton boolean NOT NULL DEFAULT true,
  prefix text NOT NULL DEFAULT '!',
  default_welcome_channel text,
  default_log_channel text,
  default_alerts_channel text,
  automod_enabled boolean NOT NULL DEFAULT false,
  automod_blocked_words text[] NOT NULL DEFAULT '{}',
  automod_max_mentions int NOT NULL DEFAULT 5,
  automod_max_emojis int NOT NULL DEFAULT 10,
  automod_spam_threshold int NOT NULL DEFAULT 5,
  automod_action text NOT NULL DEFAULT 'warn',
  nsfw_protection boolean NOT NULL DEFAULT false,
  nsfw_allowed_channels text[] NOT NULL DEFAULT '{}',
  bot_maintenance boolean NOT NULL DEFAULT false,
  web_maintenance boolean NOT NULL DEFAULT false,
  maintenance_channel text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  CONSTRAINT bot_config_singleton CHECK (is_singleton)
);
CREATE UNIQUE INDEX bot_config_singleton_idx ON public.bot_config(is_singleton);
ALTER TABLE public.bot_config ENABLE ROW LEVEL SECURITY;

-- Bot commands
CREATE TABLE public.bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  response_type text NOT NULL DEFAULT 'text', -- 'text' | 'embed'
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_commands ENABLE ROW LEVEL SECURITY;

-- Welcome messages
CREATE TABLE public.bot_welcome (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text NOT NULL,
  message_type text NOT NULL DEFAULT 'text', -- 'text' | 'embed'
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_welcome ENABLE ROW LEVEL SECURITY;

-- Stream notifications
CREATE TABLE public.bot_stream_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL, -- 'twitch' | 'youtube'
  handle text NOT NULL,
  discord_channel_id text NOT NULL,
  template text NOT NULL DEFAULT '🔴 {handle} právě vysílá: {title}',
  enabled boolean NOT NULL DEFAULT true,
  last_notified_at timestamptz,
  last_video_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, handle)
);
ALTER TABLE public.bot_stream_notifications ENABLE ROW LEVEL SECURITY;

-- Tickets config (singleton)
CREATE TABLE public.bot_tickets_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_singleton boolean NOT NULL DEFAULT true,
  category_id text,
  support_role_id text,
  welcome_md text DEFAULT 'Ahoj! Popiš svůj problém a tým ti odpoví co nejdřív.',
  transcripts_enabled boolean NOT NULL DEFAULT true,
  panel_channel_id text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_tickets_singleton CHECK (is_singleton)
);
CREATE UNIQUE INDEX bot_tickets_singleton_idx ON public.bot_tickets_config(is_singleton);
ALTER TABLE public.bot_tickets_config ENABLE ROW LEVEL SECURITY;

-- Status checks
CREATE TABLE public.bot_status_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL,
  target_type text NOT NULL DEFAULT 'url', -- 'url' | 'server'
  target text NOT NULL,
  discord_channel_id text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  last_status text,
  last_checked_at timestamptz,
  last_changed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bot_status_checks ENABLE ROW LEVEL SECURITY;

-- Outbound queue
CREATE TABLE public.bot_outbound_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id text,
  webhook_url text,
  payload jsonb NOT NULL,
  source text NOT NULL DEFAULT 'web',
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  error text
);
ALTER TABLE public.bot_outbound_queue ENABLE ROW LEVEL SECURITY;

-- Bot status (singleton)
CREATE TABLE public.bot_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_singleton boolean NOT NULL DEFAULT true,
  last_heartbeat timestamptz,
  version text,
  guild_count int DEFAULT 0,
  CONSTRAINT bot_status_singleton CHECK (is_singleton)
);
CREATE UNIQUE INDEX bot_status_singleton_idx ON public.bot_status(is_singleton);
ALTER TABLE public.bot_status ENABLE ROW LEVEL SECURITY;

-- Permissions
INSERT INTO public.permissions (module, action, label, description, position) VALUES
  ('bot', 'manage', 'Spravovat Discord bota', 'Konfigurace bota, příkazy, notifikace', 50),
  ('bot', 'view', 'Zobrazit Discord bota', 'Vidět stav a nastavení bota', 51)
ON CONFLICT DO NOTHING;

-- Assign to admin + editor roles
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug IN ('admin', 'editor')
  AND p.module = 'bot'
ON CONFLICT DO NOTHING;

-- RLS policies
CREATE POLICY "Bot config view" ON public.bot_config FOR SELECT TO authenticated USING (can('bot','view') OR can('bot','manage'));
CREATE POLICY "Bot config manage insert" ON public.bot_config FOR INSERT TO authenticated WITH CHECK (can('bot','manage'));
CREATE POLICY "Bot config manage update" ON public.bot_config FOR UPDATE TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot config manage delete" ON public.bot_config FOR DELETE TO authenticated USING (can('bot','manage'));

CREATE POLICY "Bot commands view" ON public.bot_commands FOR SELECT TO authenticated USING (can('bot','view') OR can('bot','manage'));
CREATE POLICY "Bot commands manage insert" ON public.bot_commands FOR INSERT TO authenticated WITH CHECK (can('bot','manage'));
CREATE POLICY "Bot commands manage update" ON public.bot_commands FOR UPDATE TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot commands manage delete" ON public.bot_commands FOR DELETE TO authenticated USING (can('bot','manage'));

CREATE POLICY "Bot welcome view" ON public.bot_welcome FOR SELECT TO authenticated USING (can('bot','view') OR can('bot','manage'));
CREATE POLICY "Bot welcome manage insert" ON public.bot_welcome FOR INSERT TO authenticated WITH CHECK (can('bot','manage'));
CREATE POLICY "Bot welcome manage update" ON public.bot_welcome FOR UPDATE TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot welcome manage delete" ON public.bot_welcome FOR DELETE TO authenticated USING (can('bot','manage'));

CREATE POLICY "Bot streams view" ON public.bot_stream_notifications FOR SELECT TO authenticated USING (can('bot','view') OR can('bot','manage'));
CREATE POLICY "Bot streams manage insert" ON public.bot_stream_notifications FOR INSERT TO authenticated WITH CHECK (can('bot','manage'));
CREATE POLICY "Bot streams manage update" ON public.bot_stream_notifications FOR UPDATE TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot streams manage delete" ON public.bot_stream_notifications FOR DELETE TO authenticated USING (can('bot','manage'));

CREATE POLICY "Bot tickets view" ON public.bot_tickets_config FOR SELECT TO authenticated USING (can('bot','view') OR can('bot','manage'));
CREATE POLICY "Bot tickets manage insert" ON public.bot_tickets_config FOR INSERT TO authenticated WITH CHECK (can('bot','manage'));
CREATE POLICY "Bot tickets manage update" ON public.bot_tickets_config FOR UPDATE TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot tickets manage delete" ON public.bot_tickets_config FOR DELETE TO authenticated USING (can('bot','manage'));

CREATE POLICY "Bot status checks view" ON public.bot_status_checks FOR SELECT TO authenticated USING (can('bot','view') OR can('bot','manage'));
CREATE POLICY "Bot status checks manage insert" ON public.bot_status_checks FOR INSERT TO authenticated WITH CHECK (can('bot','manage'));
CREATE POLICY "Bot status checks manage update" ON public.bot_status_checks FOR UPDATE TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot status checks manage delete" ON public.bot_status_checks FOR DELETE TO authenticated USING (can('bot','manage'));

CREATE POLICY "Bot queue view" ON public.bot_outbound_queue FOR SELECT TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot queue insert" ON public.bot_outbound_queue FOR INSERT TO authenticated WITH CHECK (can('bot','manage'));
CREATE POLICY "Bot queue update" ON public.bot_outbound_queue FOR UPDATE TO authenticated USING (can('bot','manage'));
CREATE POLICY "Bot queue delete" ON public.bot_outbound_queue FOR DELETE TO authenticated USING (can('bot','manage'));

CREATE POLICY "Bot status public view" ON public.bot_status FOR SELECT USING (true);
CREATE POLICY "Bot status manage" ON public.bot_status FOR ALL TO authenticated USING (can('bot','manage')) WITH CHECK (can('bot','manage'));

-- updated_at triggers
CREATE TRIGGER bot_config_updated_at BEFORE UPDATE ON public.bot_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bot_commands_updated_at BEFORE UPDATE ON public.bot_commands FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bot_welcome_updated_at BEFORE UPDATE ON public.bot_welcome FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER bot_tickets_updated_at BEFORE UPDATE ON public.bot_tickets_config FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed singletons
INSERT INTO public.bot_config (is_singleton) VALUES (true) ON CONFLICT DO NOTHING;
INSERT INTO public.bot_tickets_config (is_singleton) VALUES (true) ON CONFLICT DO NOTHING;
INSERT INTO public.bot_status (is_singleton) VALUES (true) ON CONFLICT DO NOTHING;


-- 1. Permission for the new module
INSERT INTO public.permissions (module, action, label, description)
VALUES ('chat_bot', 'manage', 'Spravovat chat bota', 'Konfigurovat Twitch/YouTube chat bota a jeho automod')
ON CONFLICT (module, action) DO NOTHING;

-- Grant to admin role
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE r.slug = 'admin' AND p.module = 'chat_bot' AND p.action = 'manage'
ON CONFLICT DO NOTHING;

-- 2. Channels table
CREATE TABLE IF NOT EXISTS public.chat_bot_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  platform text NOT NULL CHECK (platform IN ('twitch','youtube')),
  handle text NOT NULL,
  channel_id text,
  display_name text,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  enabled boolean NOT NULL DEFAULT true,
  automod_enabled boolean NOT NULL DEFAULT true,
  antiscam_enabled boolean NOT NULL DEFAULT true,
  welcome_enabled boolean NOT NULL DEFAULT false,
  welcome_message text DEFAULT 'Vítej v chatu {user}! 👋',
  last_connected_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(platform, handle)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_channels TO authenticated;
GRANT ALL ON public.chat_bot_channels TO service_role;

ALTER TABLE public.chat_bot_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_bot manage select"
  ON public.chat_bot_channels FOR SELECT TO authenticated
  USING (public.can('chat_bot','manage'));
CREATE POLICY "chat_bot manage insert"
  ON public.chat_bot_channels FOR INSERT TO authenticated
  WITH CHECK (public.can('chat_bot','manage'));
CREATE POLICY "chat_bot manage update"
  ON public.chat_bot_channels FOR UPDATE TO authenticated
  USING (public.can('chat_bot','manage'))
  WITH CHECK (public.can('chat_bot','manage'));
CREATE POLICY "chat_bot manage delete"
  ON public.chat_bot_channels FOR DELETE TO authenticated
  USING (public.can('chat_bot','manage'));

CREATE TRIGGER trg_chat_bot_channels_updated
  BEFORE UPDATE ON public.chat_bot_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Automod per channel
CREATE TABLE IF NOT EXISTS public.chat_bot_automod (
  channel_id uuid PRIMARY KEY REFERENCES public.chat_bot_channels(id) ON DELETE CASCADE,
  blocked_words text[] NOT NULL DEFAULT '{}',
  max_caps_pct int NOT NULL DEFAULT 70,
  caps_min_length int NOT NULL DEFAULT 8,
  max_links int NOT NULL DEFAULT 0,
  allow_links_for_subs boolean NOT NULL DEFAULT true,
  allow_links_for_mods boolean NOT NULL DEFAULT true,
  link_whitelist text[] NOT NULL DEFAULT ARRAY['twitch.tv','youtube.com','youtu.be'],
  max_emojis int NOT NULL DEFAULT 10,
  spam_threshold int NOT NULL DEFAULT 5,
  spam_window_seconds int NOT NULL DEFAULT 5,
  action text NOT NULL DEFAULT 'delete' CHECK (action IN ('warn','delete','timeout','ban')),
  timeout_seconds int NOT NULL DEFAULT 60,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_automod TO authenticated;
GRANT ALL ON public.chat_bot_automod TO service_role;
ALTER TABLE public.chat_bot_automod ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_bot_automod manage all"
  ON public.chat_bot_automod FOR ALL TO authenticated
  USING (public.can('chat_bot','manage'))
  WITH CHECK (public.can('chat_bot','manage'));

CREATE TRIGGER trg_chat_bot_automod_updated
  BEFORE UPDATE ON public.chat_bot_automod
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Custom commands per channel
CREATE TABLE IF NOT EXISTS public.chat_bot_commands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.chat_bot_channels(id) ON DELETE CASCADE,
  trigger text NOT NULL,
  response text NOT NULL,
  cooldown_seconds int NOT NULL DEFAULT 5,
  mods_only boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true,
  uses int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, trigger)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_bot_commands TO authenticated;
GRANT ALL ON public.chat_bot_commands TO service_role;
ALTER TABLE public.chat_bot_commands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_bot_commands manage all"
  ON public.chat_bot_commands FOR ALL TO authenticated
  USING (public.can('chat_bot','manage'))
  WITH CHECK (public.can('chat_bot','manage'));

CREATE TRIGGER trg_chat_bot_commands_updated
  BEFORE UPDATE ON public.chat_bot_commands
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Moderation log
CREATE TABLE IF NOT EXISTS public.chat_bot_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.chat_bot_channels(id) ON DELETE CASCADE,
  platform text NOT NULL,
  viewer_name text,
  viewer_id text,
  action text NOT NULL,
  reason text,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.chat_bot_log TO authenticated;
GRANT ALL ON public.chat_bot_log TO service_role;
ALTER TABLE public.chat_bot_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_bot_log manage view"
  ON public.chat_bot_log FOR SELECT TO authenticated
  USING (public.can('chat_bot','manage'));

CREATE INDEX IF NOT EXISTS idx_chat_bot_log_channel_created
  ON public.chat_bot_log(channel_id, created_at DESC);

-- 6. Auto-create automod row when channel is created
CREATE OR REPLACE FUNCTION public.ensure_chat_bot_automod()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.chat_bot_automod (channel_id) VALUES (NEW.id)
  ON CONFLICT (channel_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_chat_bot_channels_init_automod
  AFTER INSERT ON public.chat_bot_channels
  FOR EACH ROW EXECUTE FUNCTION public.ensure_chat_bot_automod();

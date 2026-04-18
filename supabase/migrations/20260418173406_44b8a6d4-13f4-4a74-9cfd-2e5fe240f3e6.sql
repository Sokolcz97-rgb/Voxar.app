-- Profile stream handles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twitch_username TEXT,
  ADD COLUMN IF NOT EXISTS youtube_handle TEXT,
  ADD COLUMN IF NOT EXISTS kick_username TEXT;

-- Override table
CREATE TABLE public.streamer_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_included BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.streamer_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Streamer overrides public view"
  ON public.streamer_overrides FOR SELECT USING (true);

CREATE POLICY "Streamer overrides manage insert"
  ON public.streamer_overrides FOR INSERT TO authenticated
  WITH CHECK (public.can('streams','manage'));

CREATE POLICY "Streamer overrides manage update"
  ON public.streamer_overrides FOR UPDATE TO authenticated
  USING (public.can('streams','manage'));

CREATE POLICY "Streamer overrides manage delete"
  ON public.streamer_overrides FOR DELETE TO authenticated
  USING (public.can('streams','manage'));

CREATE TRIGGER update_streamer_overrides_updated_at
  BEFORE UPDATE ON public.streamer_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Live streams cache
CREATE TABLE public.live_streams_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('twitch', 'youtube', 'kick')),
  handle TEXT NOT NULL,
  is_live BOOLEAN NOT NULL DEFAULT false,
  title TEXT,
  game_name TEXT,
  viewer_count INTEGER DEFAULT 0,
  thumbnail_url TEXT,
  stream_url TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, platform)
);

ALTER TABLE public.live_streams_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Live streams public view"
  ON public.live_streams_cache FOR SELECT USING (true);

-- Only edge function (service role) writes; no public write policies needed.

CREATE INDEX idx_live_streams_is_live ON public.live_streams_cache (is_live, platform);

-- Permissions
INSERT INTO public.permissions (module, action, label, description, position) VALUES
  ('streams', 'featured', 'Být zobrazen jako Featured streamer', 'Streamy uživatelů s touto rolí se zobrazí na úvodce', 10),
  ('streams', 'manage', 'Spravovat streamy', 'Override seznamu featured streamerů a ruční refresh', 20)
ON CONFLICT DO NOTHING;

-- streams.manage -> admin
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'admin' AND p.module = 'streams' AND p.action IN ('manage','featured')
ON CONFLICT DO NOTHING;

-- streams.featured -> content_creator
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p
WHERE r.slug = 'content_creator' AND p.module = 'streams' AND p.action = 'featured'
ON CONFLICT DO NOTHING;

-- Helper view: featured streamer user_ids = users s permission streams.featured + override include - override exclude
CREATE OR REPLACE FUNCTION public.get_featured_streamers()
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Users with streams.featured permission via roles
  SELECT DISTINCT ur.user_id
  FROM public.user_roles ur
  JOIN public.role_permissions rp ON rp.role_id = ur.role_id
  JOIN public.permissions p ON p.id = rp.permission_id
  WHERE p.module = 'streams' AND p.action = 'featured'
    AND NOT EXISTS (
      SELECT 1 FROM public.streamer_overrides so
      WHERE so.user_id = ur.user_id AND so.is_included = false
    )
  UNION
  -- Manually included overrides (regardless of role)
  SELECT so.user_id
  FROM public.streamer_overrides so
  WHERE so.is_included = true;
$$;
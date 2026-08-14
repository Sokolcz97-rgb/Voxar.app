
ALTER TABLE public.vox_voice_participants
  ADD COLUMN IF NOT EXISTS last_seen timestamptz NOT NULL DEFAULT now();

-- purge every currently stuck participant so we start fresh
DELETE FROM public.vox_voice_participants;

CREATE OR REPLACE FUNCTION public.vox_voice_heartbeat(_channel uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.vox_voice_participants
    SET last_seen = now()
    WHERE channel_id = _channel AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.vox_voice_purge_stale(_channel uuid DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _n integer;
BEGIN
  WITH d AS (
    DELETE FROM public.vox_voice_participants
    WHERE last_seen < now() - interval '45 seconds'
      AND (_channel IS NULL OR channel_id = _channel)
    RETURNING 1
  ) SELECT count(*)::int INTO _n FROM d;
  RETURN _n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.vox_voice_heartbeat(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.vox_voice_purge_stale(uuid) TO authenticated, anon;

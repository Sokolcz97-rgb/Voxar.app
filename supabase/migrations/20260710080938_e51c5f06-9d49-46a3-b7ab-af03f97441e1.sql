
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conversation_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _count integer;
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND (c.user_a = _me OR c.user_b = _me)
  ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  WITH updated AS (
    UPDATE public.messages
      SET read_at = now()
      WHERE conversation_id = _conversation_id
        AND sender_id <> _me
        AND read_at IS NULL
      RETURNING 1
  )
  SELECT count(*)::int INTO _count FROM updated;

  RETURN _count;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_conversation_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(uuid) TO authenticated;

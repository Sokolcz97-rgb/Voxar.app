
DROP POLICY IF EXISTS "Message recipients can mark as read" ON public.messages;

CREATE OR REPLACE FUNCTION public.mark_message_read(_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conv uuid;
  _sender uuid;
  _me uuid := auth.uid();
BEGIN
  IF _me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT conversation_id, sender_id INTO _conv, _sender
  FROM public.messages WHERE id = _message_id;

  IF _conv IS NULL THEN
    RAISE EXCEPTION 'Message not found';
  END IF;

  IF _sender = _me THEN
    RETURN; -- senders don't need read receipts for own messages
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conv AND (c.user_a = _me OR c.user_b = _me)
  ) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;

  UPDATE public.messages
    SET read_at = COALESCE(read_at, now())
    WHERE id = _message_id;
END;
$$;

REVOKE ALL ON FUNCTION public.mark_message_read(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_read(uuid) TO authenticated;

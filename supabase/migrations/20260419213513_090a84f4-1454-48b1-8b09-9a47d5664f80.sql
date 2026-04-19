DROP POLICY IF EXISTS "Sender can update own message" ON public.messages;

CREATE POLICY "Message senders can update own message"
ON public.messages
FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Message recipients can mark as read"
ON public.messages
FOR UPDATE
TO authenticated
USING (
  sender_id <> auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
)
WITH CHECK (
  sender_id <> auth.uid()
  AND read_at IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);

CREATE OR REPLACE FUNCTION public.enforce_message_update_permissions()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  is_participant boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF auth.uid() = OLD.sender_id THEN
    RETURN NEW;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = OLD.conversation_id
      AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  ) INTO is_participant;

  IF NOT is_participant THEN
    RAISE EXCEPTION 'Not allowed to update this message';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Recipients may only mark messages as read';
  END IF;

  IF NEW.read_at IS NULL THEN
    RAISE EXCEPTION 'Recipients may only set a read timestamp';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_message_update_permissions_trigger ON public.messages;

CREATE TRIGGER enforce_message_update_permissions_trigger
BEFORE UPDATE ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.enforce_message_update_permissions();
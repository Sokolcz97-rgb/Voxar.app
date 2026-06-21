
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS cleared_at_a timestamptz,
  ADD COLUMN IF NOT EXISTS cleared_at_b timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_at_a  timestamptz,
  ADD COLUMN IF NOT EXISTS hidden_at_b  timestamptz;

DROP POLICY IF EXISTS "Participants update own flags" ON public.conversations;
CREATE POLICY "Participants update own flags"
ON public.conversations FOR UPDATE
USING (auth.uid() = user_a OR auth.uid() = user_b)
WITH CHECK (auth.uid() = user_a OR auth.uid() = user_b);

CREATE OR REPLACE FUNCTION public.clear_conversation_for_me(_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _ua uuid; _ub uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_a, user_b INTO _ua, _ub FROM public.conversations WHERE id = _conv_id;
  IF _ua IS NULL THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF _me = _ua THEN
    UPDATE public.conversations SET cleared_at_a = now() WHERE id = _conv_id;
  ELSIF _me = _ub THEN
    UPDATE public.conversations SET cleared_at_b = now() WHERE id = _conv_id;
  ELSE
    RAISE EXCEPTION 'Not a participant';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.hide_conversation_for_me(_conv_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _ua uuid; _ub uuid;
BEGIN
  IF _me IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_a, user_b INTO _ua, _ub FROM public.conversations WHERE id = _conv_id;
  IF _ua IS NULL THEN RAISE EXCEPTION 'Conversation not found'; END IF;
  IF _me = _ua THEN
    UPDATE public.conversations SET hidden_at_a = now(), cleared_at_a = now() WHERE id = _conv_id;
  ELSIF _me = _ub THEN
    UPDATE public.conversations SET hidden_at_b = now(), cleared_at_b = now() WHERE id = _conv_id;
  ELSE
    RAISE EXCEPTION 'Not a participant';
  END IF;
END;
$$;

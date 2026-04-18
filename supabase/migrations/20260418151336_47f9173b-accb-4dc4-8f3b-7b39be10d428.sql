
-- Block banned users from inserting content via RLS

-- Messages
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in their conversations"
ON public.messages FOR INSERT TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'banned')
  AND EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
  )
);

-- Forum threads
DROP POLICY IF EXISTS "Users can create threads" ON public.forum_threads;
CREATE POLICY "Users can create threads"
ON public.forum_threads FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND NOT public.has_role(auth.uid(), 'banned'));

-- Forum posts
DROP POLICY IF EXISTS "Users can create posts" ON public.forum_posts;
CREATE POLICY "Users can create posts"
ON public.forum_posts FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND NOT public.has_role(auth.uid(), 'banned'));

-- Tickets
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;
CREATE POLICY "Users can create tickets"
ON public.tickets FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND NOT public.has_role(auth.uid(), 'banned'));

-- Ticket replies
DROP POLICY IF EXISTS "Users can reply to their tickets" ON public.ticket_replies;
CREATE POLICY "Users can reply to their tickets"
ON public.ticket_replies FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND NOT public.has_role(auth.uid(), 'banned')
  AND EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'))
  )
);

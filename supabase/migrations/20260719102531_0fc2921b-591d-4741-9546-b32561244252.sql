DROP POLICY IF EXISTS "Users can insert their own moderation log" ON public.moderation_log;
DROP POLICY IF EXISTS "moderation_log_insert" ON public.moderation_log;
DROP POLICY IF EXISTS "Users insert moderation log" ON public.moderation_log;
DROP POLICY IF EXISTS "users_insert_moderation_log" ON public.moderation_log;

CREATE POLICY "moderation_log_insert_self"
ON public.moderation_log
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NOT NULL AND user_id = auth.uid());
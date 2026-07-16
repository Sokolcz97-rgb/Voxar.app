
-- Fix mutable search_path on email queue functions
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public, pgmq;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public, pgmq;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public, pgmq;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public, pgmq;

-- Prevent bot_guilds self-approval: add WITH CHECK to the owner update policy
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'bot_guilds' AND cmd = 'UPDATE'
  LOOP
    EXECUTE format('DROP POLICY %I ON public.bot_guilds', pol.policyname);
  END LOOP;
END $$;

CREATE POLICY "Admins can update any bot guild"
ON public.bot_guilds
FOR UPDATE
TO authenticated
USING (public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.can('bot','manage') OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can edit their pending bot guild claim"
ON public.bot_guilds
FOR UPDATE
TO authenticated
USING (
  owner_user_id = auth.uid()
  AND status <> 'approved'::bot_guild_status
)
WITH CHECK (
  owner_user_id = auth.uid()
  AND status <> 'approved'::bot_guild_status
);

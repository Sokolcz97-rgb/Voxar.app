
-- 1) Tighten bot_minecraft_links INSERT policy
DROP POLICY IF EXISTS "MC links insert" ON public.bot_minecraft_links;
CREATE POLICY "MC links insert self via pending" ON public.bot_minecraft_links
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.bot_minecraft_pending_links p
    WHERE p.guild_id = bot_minecraft_links.guild_id
      AND p.user_id = auth.uid()
      AND p.expires_at > now()
  )
);

-- 2) Remove permissive moderation_log INSERT policy allowing NULL user_id
DROP POLICY IF EXISTS "Authenticated users can insert moderation log" ON public.moderation_log;
-- moderation_log_insert_self remains (requires user_id = auth.uid())

-- 3) Set fixed search_path on remaining functions
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

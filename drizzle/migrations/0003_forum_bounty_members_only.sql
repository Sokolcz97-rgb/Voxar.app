DROP POLICY IF EXISTS "Threads view" ON public.forum_threads;
CREATE POLICY "Threads view" ON public.forum_threads FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Posts view" ON public.forum_posts;
CREATE POLICY "Posts view" ON public.forum_posts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Contracts are public" ON public.bounty_contracts;
CREATE POLICY "Contracts members view" ON public.bounty_contracts FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
REVOKE SELECT ON public.forum_threads, public.forum_posts, public.bounty_contracts FROM anon;
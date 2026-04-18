-- Helper: convenience wrapper
CREATE OR REPLACE FUNCTION public.can(_module text, _action text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_permission(auth.uid(), _module, _action);
$$;

-- ========================================
-- FORUM_THREADS
-- ========================================
DROP POLICY IF EXISTS "Threads viewable by everyone" ON public.forum_threads;
DROP POLICY IF EXISTS "Authenticated users create threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Owner or moderator update threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Owner or admin delete threads" ON public.forum_threads;
DROP POLICY IF EXISTS "Users can create threads" ON public.forum_threads;

CREATE POLICY "Threads view"
  ON public.forum_threads FOR SELECT USING (true);

CREATE POLICY "Threads create"
  ON public.forum_threads FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can('forum','create_thread'));

CREATE POLICY "Threads update"
  ON public.forum_threads FOR UPDATE TO authenticated
  USING (
    (auth.uid() = user_id AND public.can('forum','edit_own'))
    OR public.can('forum','edit_any')
  );

CREATE POLICY "Threads delete"
  ON public.forum_threads FOR DELETE TO authenticated
  USING (
    (auth.uid() = user_id AND public.can('forum','delete_own'))
    OR public.can('forum','delete_any')
  );

-- ========================================
-- FORUM_POSTS
-- ========================================
DROP POLICY IF EXISTS "Posts viewable by everyone" ON public.forum_posts;
DROP POLICY IF EXISTS "Authenticated users create posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Owner or moderator update posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Owner or admin delete posts" ON public.forum_posts;
DROP POLICY IF EXISTS "Users can create posts" ON public.forum_posts;

CREATE POLICY "Posts view" ON public.forum_posts FOR SELECT USING (true);

CREATE POLICY "Posts create"
  ON public.forum_posts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can('forum','create_post'));

CREATE POLICY "Posts update"
  ON public.forum_posts FOR UPDATE TO authenticated
  USING (
    (auth.uid() = user_id AND public.can('forum','edit_own'))
    OR public.can('forum','edit_any')
  );

CREATE POLICY "Posts delete"
  ON public.forum_posts FOR DELETE TO authenticated
  USING (
    (auth.uid() = user_id AND public.can('forum','delete_own'))
    OR public.can('forum','delete_any')
  );

-- ========================================
-- FORUM_CATEGORIES
-- ========================================
DROP POLICY IF EXISTS "Editors can insert categories" ON public.forum_categories;
DROP POLICY IF EXISTS "Editors can update categories" ON public.forum_categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.forum_categories;

CREATE POLICY "Categories manage insert"
  ON public.forum_categories FOR INSERT TO authenticated
  WITH CHECK (public.can('forum','manage_categories'));

CREATE POLICY "Categories manage update"
  ON public.forum_categories FOR UPDATE TO authenticated
  USING (public.can('forum','manage_categories'));

CREATE POLICY "Categories manage delete"
  ON public.forum_categories FOR DELETE TO authenticated
  USING (public.can('forum','manage_categories'));

-- ========================================
-- POST_REACTIONS
-- ========================================
DROP POLICY IF EXISTS "Users can add their own reactions" ON public.post_reactions;

CREATE POLICY "Reactions add"
  ON public.post_reactions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can('forum','create_post'));

-- ========================================
-- TICKETS
-- ========================================
DROP POLICY IF EXISTS "Users view own tickets, staff view all" ON public.tickets;
DROP POLICY IF EXISTS "Authenticated users create own tickets" ON public.tickets;
DROP POLICY IF EXISTS "Owner edits subject/desc, staff edits everything" ON public.tickets;
DROP POLICY IF EXISTS "Admins delete tickets" ON public.tickets;
DROP POLICY IF EXISTS "Users can create tickets" ON public.tickets;

CREATE POLICY "Tickets view"
  ON public.tickets FOR SELECT
  USING (auth.uid() = user_id OR public.can('tickets','view_all'));

CREATE POLICY "Tickets create"
  ON public.tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can('tickets','create'));

CREATE POLICY "Tickets update"
  ON public.tickets FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR public.can('tickets','manage'));

CREATE POLICY "Tickets delete"
  ON public.tickets FOR DELETE TO authenticated
  USING (public.can('tickets','manage'));

-- ========================================
-- TICKET_REPLIES
-- ========================================
DROP POLICY IF EXISTS "View ticket replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Insert ticket replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Author updates own reply" ON public.ticket_replies;
DROP POLICY IF EXISTS "Admin deletes replies" ON public.ticket_replies;
DROP POLICY IF EXISTS "Users can reply to their tickets" ON public.ticket_replies;

CREATE POLICY "Replies view"
  ON public.ticket_replies FOR SELECT
  USING (
    public.can('tickets','view_all')
    OR (
      NOT is_internal
      AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
    )
  );

CREATE POLICY "Replies create"
  ON public.ticket_replies FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      public.can('tickets','reply_any')
      OR (
        is_internal = false
        AND public.can('tickets','reply_own')
        AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id = ticket_id AND t.user_id = auth.uid())
      )
    )
  );

CREATE POLICY "Replies update"
  ON public.ticket_replies FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Replies delete"
  ON public.ticket_replies FOR DELETE TO authenticated
  USING (public.can('tickets','manage'));

-- ========================================
-- SERVERS
-- ========================================
DROP POLICY IF EXISTS "Approved servers viewable by everyone" ON public.servers;
DROP POLICY IF EXISTS "Allowed roles insert servers" ON public.servers;
DROP POLICY IF EXISTS "Owner or staff update servers" ON public.servers;
DROP POLICY IF EXISTS "Owner or admin delete servers" ON public.servers;

CREATE POLICY "Servers view"
  ON public.servers FOR SELECT
  USING (
    is_approved = true
    OR auth.uid() = owner_id
    OR public.can('servers','approve')
    OR public.can('servers','edit_any')
  );

CREATE POLICY "Servers create"
  ON public.servers FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = owner_id AND public.can('servers','create'));

CREATE POLICY "Servers update"
  ON public.servers FOR UPDATE TO authenticated
  USING (
    (auth.uid() = owner_id AND public.can('servers','edit_own'))
    OR public.can('servers','edit_any')
  );

CREATE POLICY "Servers delete"
  ON public.servers FOR DELETE TO authenticated
  USING (
    (auth.uid() = owner_id AND public.can('servers','delete_own'))
    OR public.can('servers','delete_any')
  );

-- ========================================
-- GAMES
-- ========================================
DROP POLICY IF EXISTS "Editors manage games insert" ON public.games;
DROP POLICY IF EXISTS "Editors manage games update" ON public.games;
DROP POLICY IF EXISTS "Admins delete games" ON public.games;

CREATE POLICY "Games manage insert"
  ON public.games FOR INSERT TO authenticated
  WITH CHECK (public.can('servers','manage_games'));

CREATE POLICY "Games manage update"
  ON public.games FOR UPDATE TO authenticated
  USING (public.can('servers','manage_games'));

CREATE POLICY "Games manage delete"
  ON public.games FOR DELETE TO authenticated
  USING (public.can('servers','manage_games'));

-- ========================================
-- PAGES
-- ========================================
DROP POLICY IF EXISTS "Published pages viewable by everyone" ON public.pages;
DROP POLICY IF EXISTS "Editors can insert pages" ON public.pages;
DROP POLICY IF EXISTS "Editors can update pages" ON public.pages;
DROP POLICY IF EXISTS "Editors can delete non-system pages" ON public.pages;

CREATE POLICY "Pages view"
  ON public.pages FOR SELECT
  USING (is_published = true OR public.can('pages','view_drafts'));

CREATE POLICY "Pages insert"
  ON public.pages FOR INSERT TO authenticated
  WITH CHECK (public.can('pages','edit'));

CREATE POLICY "Pages update"
  ON public.pages FOR UPDATE TO authenticated
  USING (public.can('pages','edit'));

CREATE POLICY "Pages delete"
  ON public.pages FOR DELETE TO authenticated
  USING (public.can('pages','delete') AND is_system = false);

-- ========================================
-- MESSAGES (send permission)
-- ========================================
DROP POLICY IF EXISTS "Participants insert messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;

CREATE POLICY "Messages send"
  ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND public.can('messages','send')
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (c.user_a = auth.uid() OR c.user_b = auth.uid())
    )
  );

-- ========================================
-- USER_ROLES (manage_users permission)
-- ========================================
DROP POLICY IF EXISTS "Admins can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can delete roles" ON public.user_roles;

CREATE POLICY "User roles assign"
  ON public.user_roles FOR INSERT TO authenticated
  WITH CHECK (public.can('admin','manage_users'));

CREATE POLICY "User roles update"
  ON public.user_roles FOR UPDATE TO authenticated
  USING (public.can('admin','manage_users'));

CREATE POLICY "User roles remove"
  ON public.user_roles FOR DELETE TO authenticated
  USING (public.can('admin','manage_users'));
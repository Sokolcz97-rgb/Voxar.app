
-- pages.draft_blocks: never expose via the public table; only the SECURITY DEFINER
-- function get_page_draft_blocks() should return it.
REVOKE SELECT (draft_blocks) ON public.pages FROM anon, authenticated;

-- servers.ip / servers.port: hide from anonymous visitors. Authenticated users
-- (including server owners) keep access.
REVOKE SELECT (ip, port) ON public.servers FROM anon;

-- profiles: hide internal notification prefs from everyone reading the table.
-- Users still read their own via get_my_notification_prefs(). Also hide
-- last_seen_at from anonymous visitors (presence is for signed-in users).
REVOKE SELECT (notify_browser, notify_sound) ON public.profiles FROM anon, authenticated;
REVOKE SELECT (last_seen_at) ON public.profiles FROM anon;

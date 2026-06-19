REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (id, user_id, username, display_name, avatar_url, bio, created_at, updated_at, last_seen_at, twitch_username, youtube_handle, kick_username) ON public.profiles TO anon, authenticated;

GRANT SELECT (notify_sound, notify_browser) ON public.profiles TO service_role;
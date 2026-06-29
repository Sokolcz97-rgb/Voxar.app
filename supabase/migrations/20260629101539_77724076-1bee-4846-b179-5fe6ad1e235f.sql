REVOKE SELECT (notify_sound, notify_browser) ON public.profiles FROM anon;
REVOKE SELECT (notify_sound, notify_browser) ON public.profiles FROM authenticated;
GRANT SELECT (notify_sound, notify_browser) ON public.profiles TO service_role;
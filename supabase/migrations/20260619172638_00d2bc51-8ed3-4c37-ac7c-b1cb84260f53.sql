-- profiles: hide notification prefs from Data API (read via get_my_notification_prefs RPC)
REVOKE SELECT (notify_sound, notify_browser) ON public.profiles FROM anon, authenticated;

-- bot_status_checks: hide raw webhook_url from clients
REVOKE SELECT (webhook_url) ON public.bot_status_checks FROM anon, authenticated;

-- bot_outbound_queue: hide raw webhook_url from clients
REVOKE SELECT (webhook_url) ON public.bot_outbound_queue FROM anon, authenticated;
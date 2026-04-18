-- Revoke SELECT on private preference columns from anon and authenticated.
-- Owners will read their own preferences via a dedicated owner-scoped path.
REVOKE SELECT (notify_sound, notify_browser) ON public.profiles FROM anon;
REVOKE SELECT (notify_sound, notify_browser) ON public.profiles FROM authenticated;

-- Create a security-definer function so an authenticated user can read
-- their own notification preferences without exposing the columns broadly.
CREATE OR REPLACE FUNCTION public.get_my_notification_prefs()
RETURNS TABLE (notify_sound boolean, notify_browser boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT notify_sound, notify_browser
  FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_notification_prefs() TO authenticated;
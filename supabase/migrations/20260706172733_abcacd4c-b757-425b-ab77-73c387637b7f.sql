
-- User restrictions table (admin-managed limits on site actions)
CREATE TABLE public.user_restrictions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  can_post_forum boolean NOT NULL DEFAULT true,
  can_comment boolean NOT NULL DEFAULT true,
  can_message boolean NOT NULL DEFAULT true,
  can_upload boolean NOT NULL DEFAULT true,
  muted_until timestamptz,
  banned_until timestamptz,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_restrictions TO authenticated;
GRANT ALL ON public.user_restrictions TO service_role;

ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;

-- Users can read their own restrictions
CREATE POLICY "Users read own restrictions"
ON public.user_restrictions FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role) OR public.can('admin','manage_users'));

-- Only admins can write
CREATE POLICY "Admins insert restrictions"
ON public.user_restrictions FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.can('admin','manage_users'));

CREATE POLICY "Admins update restrictions"
ON public.user_restrictions FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.can('admin','manage_users'))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.can('admin','manage_users'));

CREATE POLICY "Admins delete restrictions"
ON public.user_restrictions FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.can('admin','manage_users'));

CREATE TRIGGER user_restrictions_set_updated_at
BEFORE UPDATE ON public.user_restrictions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Helper to check if the current user is currently allowed a capability
CREATE OR REPLACE FUNCTION public.user_can_do(_capability text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM public.user_restrictions r
      WHERE r.user_id = auth.uid()
        AND (
          (r.banned_until IS NOT NULL AND r.banned_until > now())
          OR (_capability IN ('post','comment','message','upload') AND r.muted_until IS NOT NULL AND r.muted_until > now())
          OR (_capability = 'post' AND r.can_post_forum = false)
          OR (_capability = 'comment' AND r.can_comment = false)
          OR (_capability = 'message' AND r.can_message = false)
          OR (_capability = 'upload' AND r.can_upload = false)
        )
    )
  END;
$$;

-- Add admin.manage_users permission if it doesn't exist
INSERT INTO public.permissions (module, action, label, description, position)
VALUES ('admin','manage_users','Spravovat uživatele','Upravovat, banovat, mazat a omezovat uživatele', 100)
ON CONFLICT DO NOTHING;

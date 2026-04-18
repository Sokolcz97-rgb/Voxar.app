
CREATE TABLE public.moderation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  source text NOT NULL,
  action text NOT NULL,
  reason text,
  original text NOT NULL,
  result text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view moderation log"
ON public.moderation_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'editor'));

CREATE POLICY "Authenticated users can insert moderation log"
ON public.moderation_log FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

CREATE INDEX moderation_log_created_idx ON public.moderation_log (created_at DESC);

CREATE POLICY "Admins can delete moderation log"
ON public.moderation_log
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'editor'::app_role));

GRANT DELETE ON public.moderation_log TO authenticated;

ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- Allow form owners to update responses (fail-closed previously)
CREATE POLICY "Form owners can update responses"
ON public.form_responses
FOR UPDATE
TO authenticated
USING (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_responses.form_id AND f.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.forms f WHERE f.id = form_responses.form_id AND f.owner_id = auth.uid()));

-- Allow users to delete their own presence rows
CREATE POLICY "Users can delete own presence"
ON public.vox_presence
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Tickets delete" ON public.tickets;
CREATE POLICY "Tickets delete" ON public.tickets
FOR DELETE TO authenticated
USING (auth.uid() = user_id OR can('tickets'::text, 'manage'::text));
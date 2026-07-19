
-- ticket_replies: add WITH CHECK so authors can only keep is_internal false and cannot reassign
DROP POLICY IF EXISTS "Replies update" ON public.ticket_replies;
CREATE POLICY "Replies update"
ON public.ticket_replies
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_internal = false
);

-- tickets: add WITH CHECK; staff/guild manager retain full edit, owner constrained to their row
DROP POLICY IF EXISTS "Tickets update" ON public.tickets;
CREATE POLICY "Tickets update"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.can('tickets','manage')
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), guild_id))
)
WITH CHECK (
  auth.uid() = user_id
  OR public.can('tickets','manage')
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR (guild_id IS NOT NULL AND public.is_guild_manager(auth.uid(), guild_id))
);
-- Column-level restrictions for non-staff owners are enforced by trigger tickets_guard_owner_columns.

-- bot_guilds: restrict pending-claim self edit; column-level restrictions enforced by
-- trigger bot_guilds_guard_owner_columns. Ensure WITH CHECK also blocks flipping to approved.
DROP POLICY IF EXISTS "Owners can edit their pending bot guild claim" ON public.bot_guilds;
CREATE POLICY "Owners can edit their pending bot guild claim"
ON public.bot_guilds
FOR UPDATE
TO authenticated
USING (
  status <> 'approved'
  AND (
    owner_user_id = auth.uid()
    OR (owner_discord_id IS NOT NULL AND owner_discord_id = public.discord_id_for_user(auth.uid()))
  )
)
WITH CHECK (
  status <> 'approved'
  AND (
    owner_user_id = auth.uid()
    OR (owner_discord_id IS NOT NULL AND owner_discord_id = public.discord_id_for_user(auth.uid()))
  )
);

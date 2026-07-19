DROP POLICY IF EXISTS vox_members_insert_self ON public.vox_guild_members;

-- All legitimate inserts go through SECURITY DEFINER paths:
--   * public.vox_join_by_invite(code) — validates invite code
--   * public.vox_after_guild_insert() trigger — inserts owner on guild creation
-- Deny any direct client INSERT. Guild managers can still add members via
-- the manage_server permission check.
CREATE POLICY vox_members_insert_managers
ON public.vox_guild_members
FOR INSERT
TO authenticated
WITH CHECK (public.vox_has_perm(guild_id, auth.uid(), 'manage_server'));
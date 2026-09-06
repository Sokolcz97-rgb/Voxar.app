-- Voxar V28 hotfix: allow the authenticated app client to use notification rows
-- while RLS continues to restrict each user to their own notifications.
grant select, insert, update, delete on public.vox_notifications to authenticated;
grant all on public.vox_notifications to service_role;

-- Ensure update/delete realtime payloads contain enough row information.
alter table public.vox_notifications replica identity full;

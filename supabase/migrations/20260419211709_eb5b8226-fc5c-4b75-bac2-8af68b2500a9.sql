-- Replace broad public SELECT with one that prevents listing.
-- Direct downloads via public URL still work (Storage handles object access via service role for public buckets).
drop policy if exists "Forum attachments public read" on storage.objects;

create policy "Forum attachments owner read"
on storage.objects for select
to authenticated
using (
  bucket_id = 'forum-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);
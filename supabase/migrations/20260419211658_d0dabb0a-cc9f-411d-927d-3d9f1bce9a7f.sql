-- Public bucket for forum/ticket/message attachments (25 MB limit)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'forum-attachments',
  'forum-attachments',
  true,
  26214400,
  array[
    'image/png','image/jpeg','image/webp','image/gif',
    'video/mp4','video/webm','video/quicktime',
    'application/pdf','application/zip','text/plain'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Public read
create policy "Forum attachments public read"
on storage.objects for select
using (bucket_id = 'forum-attachments');

-- Authenticated users can upload to their own folder (folder name = auth.uid())
create policy "Forum attachments user upload"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'forum-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Update own
create policy "Forum attachments user update"
on storage.objects for update
to authenticated
using (
  bucket_id = 'forum-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);

-- Delete own
create policy "Forum attachments user delete"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'forum-attachments'
  and auth.uid()::text = (storage.foldername(name))[1]
);
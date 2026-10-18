-- Ashes of Eryon: privátní úložiště instalátorů jen pro administrátory.
-- Ostatní uživatelé na webu vidí „Připravuje se…“ a k souborům nemají
-- přístup ani přímým odkazem (bucket není veřejný, RLS povoluje jen adminy).
insert into storage.buckets (id, name, public, file_size_limit)
values ('game-builds', 'game-builds', false, 52428800)
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

drop policy if exists "game_builds_admin_select" on storage.objects;
drop policy if exists "game_builds_admin_insert" on storage.objects;
drop policy if exists "game_builds_admin_update" on storage.objects;
drop policy if exists "game_builds_admin_delete" on storage.objects;

create policy "game_builds_admin_select" on storage.objects for select to authenticated
  using (bucket_id = 'game-builds' and public.has_role(auth.uid(), 'admin'));
create policy "game_builds_admin_insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'game-builds' and public.has_role(auth.uid(), 'admin'));
create policy "game_builds_admin_update" on storage.objects for update to authenticated
  using (bucket_id = 'game-builds' and public.has_role(auth.uid(), 'admin'))
  with check (bucket_id = 'game-builds' and public.has_role(auth.uid(), 'admin'));
create policy "game_builds_admin_delete" on storage.objects for delete to authenticated
  using (bucket_id = 'game-builds' and public.has_role(auth.uid(), 'admin'));

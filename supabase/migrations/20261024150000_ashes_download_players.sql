-- Instalátor Ashes of Eryon smí stáhnout každý, kdo smí hrát (testeři z ashes_access, editoři, správci).
-- Nahrávat / mazat dál jen správci (policies game_builds_admin_*).
drop policy if exists game_builds_players_select on storage.objects;
create policy game_builds_players_select on storage.objects for select to authenticated
  using (bucket_id = 'game-builds' and name like 'ashes/%' and public.ashes_can_play());

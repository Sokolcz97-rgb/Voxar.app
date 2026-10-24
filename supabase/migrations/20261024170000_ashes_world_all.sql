-- Společný svět: hráči obou frakcí se vidí v kanálu ashes:world:all.
-- Frakční kanály ashes:world:<frakce> zůstávají povolené pro starší verze hry.
drop policy if exists ashes_rt_read on realtime.messages;
create policy ashes_rt_read on realtime.messages for select to authenticated using (
  realtime.topic() like 'ashes:%' and public.ashes_can_play() and (
    realtime.topic() = 'ashes:world:all'
    or realtime.topic() = 'ashes:world:' || coalesce((select c.faction from public.ashes_characters c where c.user_id = auth.uid()), 'kalidra')
  )
);
drop policy if exists ashes_rt_write on realtime.messages;
create policy ashes_rt_write on realtime.messages for insert to authenticated with check (
  realtime.topic() like 'ashes:%' and public.ashes_can_play() and (
    realtime.topic() = 'ashes:world:all'
    or realtime.topic() = 'ashes:world:' || coalesce((select c.faction from public.ashes_characters c where c.user_id = auth.uid()), 'kalidra')
  )
);

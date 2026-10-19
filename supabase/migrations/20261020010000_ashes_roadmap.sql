-- Ashes of Eryon: veřejná roadmapa upravovatelná za běhu (správce na /ashes).
create table if not exists public.ashes_roadmap (
  id uuid primary key default gen_random_uuid(),
  sort integer not null default 0,
  starts_at timestamptz,
  when_cs text not null default '',
  when_en text not null default '',
  title_cs text not null default '',
  title_en text not null default '',
  act text,
  status text not null default 'planned' check (status in ('now', 'next', 'planned', 'done')),
  text_cs text not null default '',
  text_en text not null default '',
  items jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ashes_roadmap enable row level security;

drop policy if exists "ashes_roadmap_read" on public.ashes_roadmap;
drop policy if exists "ashes_roadmap_admin_insert" on public.ashes_roadmap;
drop policy if exists "ashes_roadmap_admin_update" on public.ashes_roadmap;
drop policy if exists "ashes_roadmap_admin_delete" on public.ashes_roadmap;
create policy "ashes_roadmap_read" on public.ashes_roadmap for select to anon, authenticated using (true);
create policy "ashes_roadmap_admin_insert" on public.ashes_roadmap for insert to authenticated with check (public.has_role(auth.uid(), 'admin'));
create policy "ashes_roadmap_admin_update" on public.ashes_roadmap for update to authenticated using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));
create policy "ashes_roadmap_admin_delete" on public.ashes_roadmap for delete to authenticated using (public.has_role(auth.uid(), 'admin'));

grant select on public.ashes_roadmap to anon, authenticated;
grant insert, update, delete on public.ashes_roadmap to authenticated;

create or replace function public.ashes_roadmap_touch() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;
drop trigger if exists ashes_roadmap_touch on public.ashes_roadmap;
create trigger ashes_roadmap_touch before update on public.ashes_roadmap for each row execute function public.ashes_roadmap_touch();

-- živé změny pro otevřené stránky
do $$ begin
  begin
    alter publication supabase_realtime add table public.ashes_roadmap;
  exception when duplicate_object then null;
  end;
end $$;

-- výchozí obsah (jen když je tabulka prázdná)
insert into public.ashes_roadmap (sort, starts_at, when_cs, when_en, title_cs, title_en, act, status, text_cs, text_en, items)
select * from (values
  (10, '2026-10-24T17:00:00+02:00'::timestamptz, 'Sobota 24. 10. 2026 · 17:00', 'Saturday 24 Oct 2026 · 5 PM CEST', 'První testování', 'First playtest', 'I', 'now',
   'Uzavřený test 1. aktu „Poslední štít“. Otevřený svět pobřeží Kalidry, obě strany války a první příběhové úkoly.',
   'Closed test of Act I “The Last Shield”. The open world of Kalidra''s coast, both sides of the war and the first story quests.',
   '[{"cs":"Přihláška přes ticket na studiovoxario.com","en":"Sign up with a ticket on studiovoxario.com"},{"cs":"Obránci Kalidry i Legie Rudého slunce","en":"Defenders of Kalidra and the Legion of the Red Sun"},{"cs":"16 postav s rozhovory, 15 úkolů, aréna a válka o hradby","en":"16 characters to talk to, 15 quests, the arena and the war for the walls"},{"cs":"Hra v prohlížeči i přes launcher pro Windows","en":"Play in the browser or through the Windows launcher"}]'::jsonb),
  (20, null, 'Listopad 2026', 'November 2026', 'Opravy a otevřená alfa', 'Fixes and open alpha', 'I', 'next',
   'Opravíme vše, co najdete při testu, a otevřeme brány Kalidry všem přihlášeným hráčům.',
   'We fix everything you find during the test and open the gates of Kalidra to every signed-in player.',
   '[{"cs":"Úpravy podle zpětné vazby testerů","en":"Changes based on tester feedback"},{"cs":"Lepší modely postav a zvířat","en":"Better character and animal models"},{"cs":"Hra otevřená všem s účtem StudioVoxario","en":"Open to everyone with a StudioVoxario account"}]'::jsonb),
  (30, null, 'Prosinec 2026', 'December 2026', 'Oheň Kalidry', 'Fire of Kalidra', 'II', 'planned',
   'Druhý akt ságy. Ohně na horách, obležené město a nové části mapy za hradbami.',
   'The second act of the saga. Fires on the mountains, a besieged city and new parts of the map beyond the walls.',
   '[{"cs":"Nové území a příběhové úkoly","en":"New territory and story quests"},{"cs":"Píseň „Oheň Kalidry“ v celé kapitole","en":"The song “Fire of Kalidra” throughout the chapter"}]'::jsonb),
  (40, null, 'Začátek roku 2027', 'Early 2027', 'Pochod bronzu', 'March of Bronze', 'III', 'planned',
   'Třetí akt. Vojska vyrážejí z Kalidry a hráči se poprvé spojí do družin.',
   'Act III. Armies march out of Kalidra and players band together for the first time.',
   '[{"cs":"Družiny a společné výpravy","en":"Warbands and group expeditions"},{"cs":"Bitvy více hráčů najednou","en":"Battles with several players at once"}]'::jsonb),
  (50, null, 'Jaro 2027', 'Spring 2027', 'Moře krve', 'Sea of Blood', 'IV', 'planned',
   'Čtvrtý akt. Válka se přenese na moře k černým lodím Legie.', 'Act IV. The war moves to the sea and the Legion''s black ships.',
   '[{"cs":"Bitvy u pobřeží a na lodích","en":"Battles on the coast and aboard ships"}]'::jsonb),
  (60, null, 'Léto 2027', 'Summer 2027', 'Koruna popela', 'Crown of Ash', 'V', 'planned',
   'Pátý akt. Kdo vládne popelu, vládne Kalidře.', 'Act V. Whoever rules the ashes rules Kalidra.',
   '[{"cs":"Rozhodnutí, která změní svět pro všechny hráče","en":"Decisions that change the world for every player"}]'::jsonb),
  (70, null, 'Podzim 2027', 'Autumn 2027', 'Poslední pochod', 'The Last March', 'VI', 'planned',
   'Finále ságy Eryona a Azkara.', 'The finale of the saga of Eryon and Azkar.',
   '[{"cs":"Závěrečná bitva obou stran","en":"The final battle of both sides"}]'::jsonb)
) as v
where not exists (select 1 from public.ashes_roadmap);

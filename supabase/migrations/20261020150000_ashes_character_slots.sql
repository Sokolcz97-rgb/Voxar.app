-- Ashes of Eryon: více postav na účet + pohlaví postavy.
-- Hraje se vždy jedna aktivní postava (řádky v ashes_characters / items / quests / wquests).
-- Ostatní postavy jsou uložené v ashes_character_slots a při přepnutí se prohodí.

-- dosavadní postavy dostanou mužský model
update public.ashes_characters set appearance = coalesce(appearance, '{}'::jsonb) || '{"gender":"m"}'::jsonb
where not coalesce(appearance, '{}'::jsonb) ? 'gender';

create table if not exists public.ashes_character_slots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  class text not null,
  faction text not null default 'kalidra',
  level int not null default 1,
  appearance jsonb not null default '{}'::jsonb,
  data jsonb not null,
  items jsonb not null default '[]'::jsonb,
  quests jsonb not null default '[]'::jsonb,
  wquests jsonb not null default '[]'::jsonb,
  saved_at timestamptz not null default now()
);
create index if not exists ashes_character_slots_user_idx on public.ashes_character_slots (user_id);
alter table public.ashes_character_slots enable row level security;
drop policy if exists ashes_character_slots_own on public.ashes_character_slots;
create policy ashes_character_slots_own on public.ashes_character_slots for select to authenticated using (user_id = auth.uid());

-- uloží aktivní postavu do slotu (interní)
create or replace function public.ashes_archive_active(uid uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare ch public.ashes_characters;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if ch.user_id is null then return; end if;
  if ch.is_eryon or ch.is_azkar then
    raise exception 'Legendu nelze odložit. Nejdřív se vzdej role % (Hradby / Tábor a válka).', case when ch.is_eryon then 'Eryona' else 'Azkara' end;
  end if;
  insert into public.ashes_character_slots (user_id, name, class, faction, level, appearance, data, items, quests, wquests)
  values (uid, ch.name, ch.class, ch.faction, ch.level, ch.appearance, to_jsonb(ch),
    coalesce((select jsonb_agg(to_jsonb(i)) from public.ashes_items i where i.user_id = uid), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(q)) from public.ashes_quests q where q.user_id = uid), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(w)) from public.ashes_wquests w where w.user_id = uid), '[]'::jsonb));
  delete from public.ashes_items where user_id = uid;
  delete from public.ashes_quests where user_id = uid;
  delete from public.ashes_wquests where user_id = uid;
  delete from public.ashes_characters where user_id = uid;
end;
$$;
revoke all on function public.ashes_archive_active(uuid) from public, anon, authenticated;

-- seznam postav hráče
create or replace function public.ashes_characters_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.ashes_require();
begin
  return jsonb_build_object(
    'max', 4,
    'active', (select jsonb_build_object('name', c.name, 'class', c.class, 'faction', c.faction, 'level', c.level, 'appearance', c.appearance, 'eryon', c.is_eryon, 'azkar', c.is_azkar)
               from public.ashes_characters c where c.user_id = uid),
    'others', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'class', s.class, 'faction', s.faction, 'level', s.level, 'appearance', s.appearance) order by s.saved_at desc)
               from public.ashes_character_slots s where s.user_id = uid), '[]'::jsonb));
end;
$$;

-- přepne na uloženou postavu (aktivní se uloží)
create or replace function public.ashes_switch_character(p_slot uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); s public.ashes_character_slots;
begin
  select * into s from public.ashes_character_slots where id = p_slot and user_id = uid for update;
  if s.id is null then raise exception 'Postava nenalezena.'; end if;
  perform public.ashes_archive_active(uid);
  insert into public.ashes_characters select * from jsonb_populate_record(null::public.ashes_characters, s.data || jsonb_build_object('user_id', uid, 'is_eryon', false, 'is_azkar', false));
  insert into public.ashes_items select * from jsonb_populate_recordset(null::public.ashes_items, s.items);
  insert into public.ashes_quests select * from jsonb_populate_recordset(null::public.ashes_quests, s.quests);
  insert into public.ashes_wquests select * from jsonb_populate_recordset(null::public.ashes_wquests, s.wquests);
  delete from public.ashes_character_slots where id = s.id;
  return public.ashes_state();
end;
$$;

-- uvolní místo pro novou postavu (aktivní se uloží)
create or replace function public.ashes_new_character()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require();
begin
  if (select count(*) from public.ashes_character_slots where user_id = uid)
     + (select count(*) from public.ashes_characters where user_id = uid) >= 4 then
    raise exception 'Můžeš mít nejvýše 4 postavy.';
  end if;
  perform public.ashes_archive_active(uid);
  return public.ashes_state();
end;
$$;

-- smaže uloženou (neaktivní) postavu
create or replace function public.ashes_delete_character(p_slot uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require();
begin
  delete from public.ashes_character_slots where id = p_slot and user_id = uid;
  if not found then raise exception 'Postava nenalezena.'; end if;
  return public.ashes_characters_list();
end;
$$;

-- tvorba postavy: pohlaví + jména unikátní i mezi uloženými postavami
create or replace function public.ashes_create_character(p_name text, p_class text, p_appearance jsonb, p_faction text default 'kalidra')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); nm text := btrim(coalesce(p_name, '')); starter uuid; ap jsonb;
begin
  if exists (select 1 from public.ashes_characters where user_id = uid) then raise exception 'Postavu už máš.'; end if;
  if (select count(*) from public.ashes_character_slots where user_id = uid) >= 4 then raise exception 'Můžeš mít nejvýše 4 postavy.'; end if;
  if nm !~ '^[[:alpha:]][[:alpha:][:digit:] _-]{2,19}$' then raise exception 'Jméno musí mít 3–20 znaků a začínat písmenem.'; end if;
  if lower(nm) in ('eryon', 'azkar') then raise exception 'Toto jméno patří legendě.'; end if;
  if exists (select 1 from public.ashes_characters where lower(name) = lower(nm))
     or exists (select 1 from public.ashes_character_slots where lower(name) = lower(nm)) then
    raise exception 'Toto jméno už nosí jiný hrdina.';
  end if;
  if p_class not in ('hoplit', 'lucistnik', 'vestec') then raise exception 'Neznámé povolání.'; end if;
  if p_faction not in ('kalidra', 'legie') then raise exception 'Neznámá strana.'; end if;
  ap := coalesce(p_appearance, '{}'::jsonb) - 'enemy' - 'kalidran' - 'boss' - 'hero';
  if coalesce(ap ->> 'gender', '') not in ('m', 'f') then ap := ap || '{"gender":"m"}'::jsonb; end if;

  insert into public.ashes_characters (user_id, name, class, faction, appearance, sila, obratnost, intelekt, vydrz, stesti)
  values (uid, nm, p_class, p_faction, ap,
    case p_class when 'hoplit' then 10 else 5 end,
    case p_class when 'lucistnik' then 10 else 5 end,
    case p_class when 'vestec' then 10 else 5 end,
    case p_class when 'hoplit' then 10 else 8 end, 5);
  starter := public.ashes_make_item(uid, p_class, 1, 'zbran', -1);
  update public.ashes_items set equipped = true where id = starter;
  if p_class = 'hoplit' then
    starter := public.ashes_make_item(uid, p_class, 1, 'stit', -1);
    update public.ashes_items set equipped = true where id = starter;
  end if;
  if p_faction = 'legie' then
    perform public.ashes_log('hero', format('Z černé lodi vystoupil nový voják Legie Rudého slunce: %s.', nm));
  else
    perform public.ashes_log('hero', format('Na Bezejmenném břehu se probudil nový obránce Kalidry: %s.', nm));
  end if;
  return public.ashes_state();
end;
$$;

grant execute on function public.ashes_characters_list() to authenticated;
grant execute on function public.ashes_switch_character(uuid) to authenticated;
grant execute on function public.ashes_new_character() to authenticated;
grant execute on function public.ashes_delete_character(uuid) to authenticated;
grant execute on function public.ashes_create_character(text, text, jsonb, text) to authenticated;
revoke all on function public.ashes_characters_list() from anon;
revoke all on function public.ashes_switch_character(uuid) from anon;
revoke all on function public.ashes_new_character() from anon;
revoke all on function public.ashes_delete_character(uuid) from anon;
revoke all on function public.ashes_create_character(text, text, jsonb, text) from anon;

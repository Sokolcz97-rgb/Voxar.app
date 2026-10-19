-- Ashes of Eryon – otevřený svět 1. aktu (pobřeží Kalidry)
-- Úkoly od NPC a souboje s nepřáteli v krajině. Pohyb po mapě je na klientovi,
-- ale odměny, postup úkolů a výsledky soubojů počítá jen server.

alter table public.ashes_characters add column if not exists last_world_fight_at timestamptz not null default now() - interval '1 hour';

create table if not exists public.ashes_wquests (
  user_id uuid not null references auth.users (id) on delete cascade,
  quest_id text not null,
  state text not null default 'active' check (state in ('active', 'ready', 'done')),
  progress int not null default 0,
  targets text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, quest_id)
);
alter table public.ashes_wquests enable row level security;
drop policy if exists ashes_wquests_own on public.ashes_wquests;
create policy ashes_wquests_own on public.ashes_wquests for select to authenticated using (user_id = auth.uid());

-- Katalog úkolů od NPC. Texty rozhovorů jsou na klientovi (CZ/EN), server drží jen pravidla.
-- type: talk (promluvit s target), kill (porazit count nepřátel s tagem target),
--       beacon (navštívit count různých vater), visit (dojít na místo target)
create or replace function public.ashes_wq_catalog()
returns jsonb language sql immutable as $$
  select $j${
    "k1":{"f":"kalidra","giver":"nikias","type":"talk","target":"nikias","count":1,"req":[],"xp":0.12,"gold":10},
    "k2":{"f":"kalidra","giver":"nikias","type":"kill","target":"vrakar","count":3,"req":["k1"],"xp":0.35,"gold":30},
    "k3":{"f":"kalidra","giver":"nikias","type":"talk","target":"damon","count":1,"req":["k1"],"xp":0.2,"gold":20},
    "k4":{"f":"kalidra","giver":"damon","type":"beacon","target":"beacon","count":3,"req":["k3"],"xp":0.45,"gold":45},
    "k5":{"f":"kalidra","giver":"damon","type":"kill","target":"zved-legie","count":4,"req":["k3"],"xp":0.5,"gold":50},
    "k6":{"f":"kalidra","giver":"tharos","type":"kill","target":"lapka","count":3,"req":["k1"],"xp":0.35,"gold":60},
    "k7":{"f":"kalidra","giver":"thalia","type":"visit","target":"memorial","count":1,"req":["k3"],"xp":0.3,"gold":25},
    "k8":{"f":"kalidra","giver":"eryon","type":"talk","target":"eryon","count":1,"req":["k4","k5"],"xp":0.6,"gold":80},
    "l1":{"f":"legie","giver":"varkas","type":"talk","target":"varkas","count":1,"req":[],"xp":0.12,"gold":10},
    "l2":{"f":"legie","giver":"varkas","type":"kill","target":"strazny-utesy","count":3,"req":["l1"],"xp":0.35,"gold":30},
    "l3":{"f":"legie","giver":"varkas","type":"talk","target":"oren","count":1,"req":["l1"],"xp":0.2,"gold":20},
    "l4":{"f":"legie","giver":"oren","type":"beacon","target":"beacon","count":3,"req":["l3"],"xp":0.45,"gold":45},
    "l5":{"f":"legie","giver":"oren","type":"kill","target":"zved-kalidra","count":4,"req":["l3"],"xp":0.5,"gold":50},
    "l6":{"f":"legie","giver":"azkar","type":"talk","target":"azkar","count":1,"req":["l4","l5"],"xp":0.6,"gold":80},
    "l7":{"f":"legie","giver":"rukmar","type":"kill","target":"strazce-akvaduktu","count":3,"req":["l1"],"xp":0.35,"gold":60}
  }$j$::jsonb;
$$;

-- Nepřátelé v krajině podle strany hráče a oblasti mapy.
create or replace function public.ashes_region_enemies()
returns jsonb language sql immutable as $$
  select $j${
    "kalidra":{
      "shore":[{"id":"vrakar","n":"Vrakař","c":"lucistnik","l":[1,2]},{"id":"pasarak","n":"Pašerák z útesů","c":"lucistnik","l":[1,2]}],
      "aqueduct":[{"id":"lapka","n":"Lapka od akvaduktu","c":"hoplit","l":[2,3]},{"id":"kultista","n":"Kultista popela","c":"vestec","l":[2,3]}],
      "hills":[{"id":"zved-legie","n":"Zvěd Rudého slunce","c":"lucistnik","l":[3,5]},{"id":"predvoj","n":"Předvoj legie","c":"hoplit","l":[3,5]}],
      "plain":[{"id":"kopinik","n":"Kopiník Rudého slunce","c":"hoplit","l":[4,6]},{"id":"knez-slunce","n":"Kněz Rudého slunce","c":"vestec","l":[4,6]}],
      "cove":[{"id":"strazce-lodi","n":"Strážce černých lodí","c":"hoplit","l":[5,7]}],
      "camp":[{"id":"garda","n":"Azkarova garda","c":"hoplit","l":[6,8]}]
    },
    "legie":{
      "cove":[{"id":"strazny-utesy","n":"Strážný z útesů","c":"lucistnik","l":[1,2]},{"id":"vrakar","n":"Vrakař","c":"lucistnik","l":[1,2]}],
      "shore":[{"id":"vrakar","n":"Vrakař","c":"lucistnik","l":[2,3]},{"id":"rybar","n":"Rybář s harpunou","c":"hoplit","l":[2,3]}],
      "aqueduct":[{"id":"strazce-akvaduktu","n":"Strážce akvaduktu","c":"hoplit","l":[2,3]},{"id":"knezka","n":"Kněžka přílivu","c":"vestec","l":[2,3]}],
      "hills":[{"id":"zved-kalidra","n":"Kalidrský zvěd","c":"lucistnik","l":[3,5]},{"id":"strazce-ohne","n":"Strážce ohně","c":"hoplit","l":[3,5]}],
      "plain":[{"id":"obrance","n":"Obránce Kalidry","c":"hoplit","l":[4,6]},{"id":"knez-kalidry","n":"Kněz Kalidry","c":"vestec","l":[4,6]}],
      "kalidra":[{"id":"straz-kalidry","n":"Stráž Kalidry","c":"hoplit","l":[6,8]}]
    }
  }$j$::jsonb;
$$;

create or replace function public.ashes_wq_reqs_done(uid uuid, reqs jsonb)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(bool_and(exists (select 1 from public.ashes_wquests w where w.user_id = uid and w.quest_id = r and w.state = 'done')), true)
  from jsonb_array_elements_text(coalesce(reqs, '[]'::jsonb)) r;
$$;

create or replace function public.ashes_wq_accept(p_quest text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters; d jsonb;
begin
  select * into ch from public.ashes_characters where user_id = uid;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  d := public.ashes_wq_catalog() -> p_quest;
  if d is null then raise exception 'Neznámý úkol.'; end if;
  if d ->> 'f' <> ch.faction then raise exception 'Tento úkol patří druhé straně.'; end if;
  if exists (select 1 from public.ashes_wquests where user_id = uid and quest_id = p_quest) then raise exception 'Úkol už máš.'; end if;
  if not public.ashes_wq_reqs_done(uid, d -> 'req') then raise exception 'Nejdřív dokonči předchozí úkoly.'; end if;
  insert into public.ashes_wquests (user_id, quest_id, state, progress)
  values (uid, p_quest,
    case when d ->> 'type' = 'talk' and d ->> 'target' = d ->> 'giver' then 'ready' else 'active' end,
    case when d ->> 'type' = 'talk' and d ->> 'target' = d ->> 'giver' then 1 else 0 end);
  return public.ashes_state();
end;
$$;

-- Událost ve světě (rozhovor, vatra, návštěva místa). Souboje řeší ashes_world_fight.
create or replace function public.ashes_wq_event(p_kind text, p_target text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); r record; d jsonb; tgt text := left(coalesce(p_target, ''), 40);
begin
  if p_kind not in ('talk', 'beacon', 'visit') then raise exception 'Neznámá událost.'; end if;
  if p_kind = 'beacon' and tgt not in ('b1', 'b2', 'b3') then raise exception 'Neznámá vatra.'; end if;
  for r in select * from public.ashes_wquests where user_id = uid and state = 'active' for update loop
    d := public.ashes_wq_catalog() -> r.quest_id;
    if d ->> 'type' <> p_kind then continue; end if;
    if p_kind = 'beacon' then
      if tgt = any (r.targets) then continue; end if;
      update public.ashes_wquests set targets = array_append(targets, tgt), progress = progress + 1,
        state = case when progress + 1 >= (d ->> 'count')::int then 'ready' else 'active' end, updated_at = now()
        where user_id = uid and quest_id = r.quest_id;
    elsif d ->> 'target' = tgt then
      update public.ashes_wquests set progress = (d ->> 'count')::int, state = 'ready', updated_at = now()
        where user_id = uid and quest_id = r.quest_id;
    end if;
  end loop;
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_wq_turnin(p_quest text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters; d jsonb; w public.ashes_wquests;
  xp int; gold int; ups int; item uuid; item_row jsonb;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  select * into w from public.ashes_wquests where user_id = uid and quest_id = p_quest for update;
  if not found or w.state <> 'ready' then raise exception 'Úkol ještě není splněný.'; end if;
  d := public.ashes_wq_catalog() -> p_quest;
  xp := round(public.ashes_xp_need(ch.level) * (d ->> 'xp')::numeric);
  gold := round((d ->> 'gold')::int * (1 + ch.level * 0.3));
  update public.ashes_wquests set state = 'done', updated_at = now() where user_id = uid and quest_id = p_quest;
  ups := public.ashes_grant(uid, xp, gold);
  update public.ashes_characters set chapter_progress = chapter_progress + 1 where user_id = uid;
  if (d ->> 'type') in ('kill', 'beacon') and public.ashes_bag_count(uid) < 12 then
    item := public.ashes_make_item(uid, ch.class, ch.level + ups, null, 0.1);
    select to_jsonb(i) into item_row from public.ashes_items i where i.id = item;
  end if;
  if p_quest in ('k8', 'l6') then
    perform public.ashes_log('quest', format('%s se postavil do řady po boku %s.', public.ashes_display_name(ch),
      case when ch.faction = 'legie' then 'Azkara' else 'Eryona' end));
  end if;
  return jsonb_build_object('quest', p_quest, 'xp', xp, 'gold', gold, 'levels', ups, 'item', item_row, 'state', public.ashes_state());
end;
$$;

-- Souboj s nepřítelem potkaným v krajině.
create or replace function public.ashes_world_fight(p_region text, p_enemy text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require(); ch public.ashes_characters; e jsonb; lvl int; lmin int; lmax int;
  fight jsonb; won boolean; xp int := 0; gold int := 0; ups int := 0; item uuid; item_row jsonb; look jsonb; r record; d jsonb;
  updated text[] := '{}';
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if ch.last_world_fight_at > now() - interval '3 seconds' and not public.ashes_is_admin() then raise exception 'Chvíli si oddychni.'; end if;
  select x into e from jsonb_array_elements(public.ashes_region_enemies() -> ch.faction -> p_region) x where x ->> 'id' = p_enemy limit 1;
  if e is null then raise exception 'Tady takový nepřítel není.'; end if;
  lmin := (e -> 'l' ->> 0)::int; lmax := (e -> 'l' ->> 1)::int;
  lvl := greatest(lmin, least(lmax, ch.level + (case when random() < 0.3 then 1 else 0 end) - (case when random() < 0.3 then 1 else 0 end)));
  if ch.faction = 'legie' then look := jsonb_build_object('kalidran', true, 'cloak', (array['#2c3e5a', '#7a1f16', '#3d4a2a'])[1 + floor(random() * 3)::int]);
  else look := jsonb_build_object('enemy', true, 'tint', (array['#7a1f1a', '#5b2a12', '#3a2f2a'])[1 + floor(random() * 3)::int]); end if;
  fight := public.ashes_simulate(public.ashes_fighter(uid), public.ashes_enemy(e ->> 'n', e ->> 'c', lvl, (0.8 + random() * 0.2)::numeric, look));
  won := (fight ->> 'winner')::int = 1;
  update public.ashes_characters set last_world_fight_at = now() where user_id = uid;
  if won then
    xp := round(public.ashes_xp_need(ch.level) / (9 + ch.level * 0.4) * least(1.5, greatest(0.3, lvl::numeric / ch.level)));
    gold := round((4 + lvl * 3) * (0.7 + random() * 0.6));
    ups := public.ashes_grant(uid, xp, gold);
    update public.ashes_characters set wins = wins + 1 where user_id = uid;
    perform public.ashes_wall_add((case when ch.faction = 'legie' then -1 else 1 end) * (10 + lvl * 2));
    if random() < 0.08 and public.ashes_bag_count(uid) < 12 then
      item := public.ashes_make_item(uid, ch.class, lvl);
      select to_jsonb(i) into item_row from public.ashes_items i where i.id = item;
    end if;
    for r in select * from public.ashes_wquests where user_id = uid and state = 'active' for update loop
      d := public.ashes_wq_catalog() -> r.quest_id;
      if d ->> 'type' = 'kill' and d ->> 'target' = p_enemy then
        update public.ashes_wquests set progress = progress + 1,
          state = case when progress + 1 >= (d ->> 'count')::int then 'ready' else 'active' end, updated_at = now()
          where user_id = uid and quest_id = r.quest_id;
        updated := array_append(updated, r.quest_id);
      end if;
    end loop;
  else
    update public.ashes_characters set losses = losses + 1 where user_id = uid;
  end if;
  return jsonb_build_object('fight', fight, 'won', won, 'xp', xp, 'gold', gold, 'levels', ups, 'item', item_row,
    'title', e ->> 'n', 'quests', to_jsonb(updated), 'state', public.ashes_state());
end;
$$;

-- Stav hry nově obsahuje i úkoly od NPC.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.ashes_state()'::regprocedure);
  d := replace(d, $r$    'bag_max', 12);$r$, $r$    'bag_max', 12,
    'wquests', coalesce((select jsonb_agg(to_jsonb(wq) - 'user_id' order by wq.created_at) from public.ashes_wquests wq where wq.user_id = uid), '[]'::jsonb));$r$);
  execute d;
end $do$;

revoke all on function public.ashes_wq_reqs_done(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.ashes_wq_accept(text) to authenticated;
grant execute on function public.ashes_wq_event(text, text) to authenticated;
grant execute on function public.ashes_wq_turnin(text) to authenticated;
grant execute on function public.ashes_world_fight(text, text) to authenticated;
revoke all on function public.ashes_wq_accept(text) from anon;
revoke all on function public.ashes_wq_event(text, text) from anon;
revoke all on function public.ashes_wq_turnin(text) from anon;
revoke all on function public.ashes_world_fight(text, text) from anon;

-- 1. akt = „Poslední štít“ (kapitoly 1–4). Kapitoly 5 a 6 jsou ukázkou 2. a 3. aktu.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.ashes_chapter(int)'::regprocedure);
  d := replace(d, $r$a jméno Eryon zůstává."}$r$, $r$a jméno Eryon zůstává. – Konec 1. aktu."}$r$);
  d := replace(d, $r$A moře… už čekalo. – Konec 1. aktu."}$r$, $r$A moře… už čekalo."}$r$);
  execute d;
  d := pg_get_functiondef('public.ashes_chapter_legie(int)'::regprocedure);
  d := replace(d, $r$„Takového nepřítele si cením.“"}$r$, $r$„Takového nepřítele si cením.“ – Konec 1. aktu."}$r$);
  d := replace(d, $r$zítra bude rudé. – Konec 1. aktu."}$r$, $r$zítra bude rudé."}$r$);
  execute d;
  d := pg_get_functiondef('public.ashes_fight_boss()'::regprocedure);
  d := replace(d, $r$'1. akt je dohrán. Další kapitoly se připravují.'$r$, $r$'Ukázka 2. a 3. aktu je dohrána. Další akty se připravují.'$r$);
  execute d;
end $do$;

-- Ashes of Eryon – dvě strany konfliktu
-- Obránci Kalidry (hrdina Eryon) a Legie Rudého slunce (hrdina Azkar, Syn Rudého slunce).
-- Hradby Kalidry jsou přetahovaná: vítězství obránců je zpevňují, vítězství Legie je boří.

alter table public.ashes_characters add column if not exists faction text not null default 'kalidra';
alter table public.ashes_characters drop constraint if exists ashes_characters_faction_check;
alter table public.ashes_characters add constraint ashes_characters_faction_check check (faction in ('kalidra', 'legie'));
alter table public.ashes_characters add column if not exists is_azkar boolean not null default false;
alter table public.ashes_world add column if not exists azkar_shout text;
alter table public.ashes_world add column if not exists azkar_shout_at timestamptz;

create or replace function public.ashes_display_name(ch public.ashes_characters)
returns text language sql immutable as $$
  select case when ch.is_eryon then 'Eryon' when ch.is_azkar then 'Azkar' else ch.name end;
$$;

-- Obránci: ve 4. kapitole stojí u brány sám Azkar.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.ashes_chapter(int)'::regprocedure);
  d := replace(d,
    $r$"boss":{"t":"Vojevůdce legie","s":"Před branou stojí Vojevůdce Rudého slunce. Eryon zvedá svůj štít po tvém boku: dokud máte sílu pozvednout meč, Kalidra nepadne.","e":"Vojevůdce Rudého slunce","c":"hoplit","win":"Vojevůdce padl před branou. Legie ustupuje do hor. Kámen si pamatuje, moře si pamatuje – a jméno Eryon zůstává."}$r$,
    $r$"boss":{"t":"Azkar u brány","s":"Před branou stojí sám Azkar, Syn Rudého slunce, vojevůdce Legie. Eryon zvedá svůj štít po tvém boku: dokud máte sílu pozvednout meč, Kalidra nepadne.","e":"Azkar, Syn Rudého slunce","c":"hoplit","look":"azkar","win":"Azkar ustoupil od brány – zraněný, ale živý. Legie se stahuje do hor. Kámen si pamatuje, moře si pamatuje – a jméno Eryon zůstává."}$r$);
  execute d;
end $do$;

-- Kapitoly Legie Rudého slunce (stejné písně, druhá strana příběhu).
create or replace function public.ashes_chapter_legie(ch int)
returns jsonb language sql immutable as $$
  select (case least(greatest(ch, 1), 6)
  when 1 then $j${
    "title":"Vylodění","song":"posledni-stit","need":4,
    "intro":"Černé lodě tě vysadily v zátoce za Bezejmenným břehem. Azkar, Syn Rudého slunce, ukázal mečem k světlům v dálce: „Tam je Kalidra. Najděte mi k ní cestu.“",
    "quests":[
      {"t":"Hlídka na útesech","s":"Kalidrská hlídka na útesech zapaluje signální oheň. Kdyby vzplál, celé pobřeží by vědělo, že jste tu.","e":"Strážný z útesů","c":"lucistnik"},
      {"t":"Vrakaři z břehu","s":"Vrakaři Bezejmenného břehu nepatří nikomu a okradou každého – i Legii.","e":"Vrakař","c":"lucistnik"},
      {"t":"Kněžka přílivu","s":"V mořské jeskyni se kněžka modlí za Kalidru. Říká se, že její modlitby slyší celý břeh.","e":"Kněžka přílivu","c":"vestec"},
      {"t":"Most u akvaduktu","s":"Pod rozpadlým akvaduktem drží kalidrští strážci jedinou cestu do vnitrozemí.","e":"Strážce akvaduktu","c":"hoplit"},
      {"t":"Pastevci ze strání","s":"Pastevci se do Kalidry nesmí dostat s varováním. Jejich praky jsou přesnější, než vypadají.","e":"Pastevec s prakem","c":"lucistnik"}
    ],
    "boss":{"t":"Kapitán pobřežní stráže","s":"Lykon, kapitán pobřežní stráže Kalidry, svolal své muže na pláž. Dokud stojí, Legie nepostoupí ani o krok.","e":"Lykon, kapitán stráže","c":"hoplit","win":"Pobřeží patří Legii. Na kopcích nad Kalidrou ale vzplály strážní ohně – město ví, že přicházíte."}
  }$j$
  when 2 then $j${
    "title":"Strážní ohně","song":"posledni-stit","need":4,
    "intro":"Když rudé slunce kleslo k moři, na kopcích vzplály strážní ohně. Azkar chce, aby do rána zhasly všechny.",
    "quests":[
      {"t":"Uhasit první oheň","s":"Nejbližší strážní oheň hlídá jen jeden muž. Ale ten muž nehodlá ustoupit.","e":"Strážce ohně","c":"hoplit"},
      {"t":"Posel do města","s":"Kalidrský posel běží s varováním. Nesmí doběhnout.","e":"Kalidrský posel","c":"lucistnik"},
      {"t":"Domobrana z údolí","s":"Sedláci z údolí vzali vidle a staré štíty. Myslí si, že vás zastaví.","e":"Domobranec","c":"hoplit"},
      {"t":"Kněz u ohně","s":"U posledního ohně zpívá kněz Kalidry. Dokud zpívá, oheň nehasne.","e":"Kněz Kalidry","c":"vestec"},
      {"t":"Zvědové na hřebeni","s":"Kalidrští zvědové sledují pohyb Legie z hřebene. Oslep je.","e":"Kalidrský zvěd","c":"lucistnik"}
    ],
    "boss":{"t":"Pán strážních ohňů","s":"Thessar, velitel strážních ohňů, drží poslední vatru na nejvyšším kopci. Zhasni ji a Kalidra oslepne.","e":"Thessar, pán ohňů","c":"vestec","win":"Ohně zhasly, ale jejich varování už doletělo. Za úsvitu se pohne tisíc kopí – a ty mezi nimi."}
  }$j$
  when 3 then $j${
    "title":"Tisíc kopí","song":"posledni-stit","need":4,
    "intro":"Pod hradbou stojí tisíc kopí. Jak temný les se blíží dál – a ty jsi jedním z nich.",
    "quests":[
      {"t":"Příkop před hradbami","s":"Obránci drží příkop před hradbami. Legie ho musí zasypat, než dorazí beran.","e":"Obránce příkopu","c":"hoplit"},
      {"t":"Lučištníci na ochozu","s":"Z ochozu na vás prší šípy. Někdo musí vylézt nahoru.","e":"Lučištník z hradeb","c":"lucistnik"},
      {"t":"Branka u studny","s":"Zrádce z Kalidry slíbil otevřít malou branku u studny. Stráž o tom ale ví.","e":"Stráž u branky","c":"hoplit"},
      {"t":"Výpad obránců","s":"Obránci vyrazili z brány, aby zapálili cedrový beran. Ubraň ho.","e":"Kalidrský výpadník","c":"hoplit"},
      {"t":"Píseň z hradeb","s":"Na hradbách zpívá kněz a obránci s ním. Píseň dodává Kalidře odvahu – umlč ji.","e":"Zpěvák z hradeb","c":"vestec"}
    ],
    "boss":{"t":"Velitel hradeb","s":"Damon, velitel hradeb Kalidry, sestoupil k bráně se svou gardou. Porazíš-li ho, hradby se otřesou.","e":"Damon, velitel hradeb","c":"hoplit","win":"Hradby se otřásly. Před branou ale stojí jediný muž s bronzovým štítem – Eryon."}
  }$j$
  when 4 then $j${
    "title":"Poslední štít","song":"posledni-stit","need":4,"ally":"azkar",
    "intro":"Sto mužů proti tisícům. Před branou Kalidry stojí Eryon a nehne se. Azkar si sundal přilbu: „Tohle je souboj, o kterém se bude zpívat.“",
    "quests":[
      {"t":"První řada","s":"Eryonovi druhové stojí v první řadě a neustupují. Prolom ji.","e":"Druh Eryonův","c":"hoplit"},
      {"t":"Sto proti tisícům","s":"Kalidrští veteráni padají jeden za druhým, ale každý si s sebou bere deset vašich.","e":"Kalidrský veterán","c":"hoplit"},
      {"t":"Žebříky na ochoz","s":"Vylez po žebříku na ochoz. Nahoře čekají obránci s kopími.","e":"Obránce ochozu","c":"lucistnik"},
      {"t":"Kletba na vrata","s":"Věštec Legie vyvolává oheň na dřevěná vrata. Kněz Kalidry ho chce zastavit.","e":"Kněz Kalidry","c":"vestec"},
      {"t":"Rohy nad krajinou","s":"Kalidrský trubač svolává posily z vesnic. Umlč jeho roh.","e":"Kalidrský trubač","c":"hoplit"}
    ],
    "boss":{"t":"Eryon, poslední štít","s":"Azkar stojí po tvém boku. Před branou Kalidry čeká Eryon se štítem plným jizev. Dokud on stojí, stojí Kalidra.","e":"Eryon, poslední štít","c":"hoplit","look":"eryon","win":"Eryon klesl na koleno, ale nepadl. Kalidra se nevzdala a Legie dostala rozkaz k ústupu do hor. Azkar se poprvé usmál: „Takového nepřítele si cením.“"}
  }$j$
  when 5 then $j${
    "title":"Ohně na horách","song":"ohen-kalidry","need":4,
    "intro":"V horách Legie líže rány. Azkar zapaluje ohně – jeden, deset, sto – aby Kalidra viděla, kolik vás je.",
    "quests":[
      {"t":"Oheň na hřebeni","s":"Kalidrský lovec se plíží zhasnout váš oheň na hřebeni.","e":"Lovec z hor","c":"lucistnik"},
      {"t":"Jezdci Kalidry","s":"Rohy volají muže zpět do Kalidry. Zastav jezdce, kteří je svolávají.","e":"Jezdec Kalidry","c":"lucistnik"},
      {"t":"Vesnice pod horou","s":"Vesnice pod horou zásobuje Kalidru chlebem. Její domobrana ji brání.","e":"Domobranec","c":"hoplit"},
      {"t":"Kovárny Kalidry","s":"Kováři v Kalidře znovu taví bronz. Jeden z nich vyšel do hor pro rudu.","e":"Kovář s kladivem","c":"hoplit"},
      {"t":"Vědma z údolí","s":"Vědma z údolí čte z popela, kudy půjdete. Nesmí to prozradit Eryonovi.","e":"Vědma z údolí","c":"vestec"}
    ],
    "boss":{"t":"Eryonův štítonoš","s":"Kalidra vyslala do hor své nejlepší muže. Vede je Ilias, Eryonův štítonoš.","e":"Ilias, Eryonův štítonoš","c":"hoplit","win":"Ilias padl. Ráno se brány Kalidry otevřely – celé město vyrazilo do pochodu proti vám."}
  }$j$
  else $j${
    "title":"Pochod k moři","song":"pochod-bronzu","need":4,"ally":"azkar",
    "intro":"Kalidra jde vstříc válce. Azkar vede Legii k moři, kde v zátoce čeká tisíc černých plachet.",
    "quests":[
      {"t":"Spálené vesnice","s":"Ve spálené vesnici na vás čekají ti, kterým jste vzali domov.","e":"Pomstychtivý vesničan","c":"hoplit"},
      {"t":"Hlídka u studny","s":"Kalidrská hlídka střeží studnu, kterou Legie potřebuje.","e":"Hlídka u studny","c":"lucistnik"},
      {"t":"Noční přepad","s":"Eryonovi zvědové se v noci plíží k táboru Legie. Azkar spí s mečem v ruce.","e":"Eryonův zvěd","c":"lucistnik"},
      {"t":"Průsmyk větrů","s":"Předvoj Kalidry obsadil průsmyk nad zátokou. Vítr nese sůl a dým.","e":"Předvoj Kalidry","c":"hoplit"},
      {"t":"Signál pro flotilu","s":"Věštec bronzu chce zahalit zátoku mlhou, aby flotila nenašla břeh.","e":"Věštec bronzu","c":"vestec"}
    ],
    "boss":{"t":"Předvoj bronzu","s":"Kalidrský předvoj drží průsmyk nad zátokou. Bez něj se flotila nedostane na břeh. Azkar tasí meč po tvém boku.","e":"Velitel předvoje Kalidry","c":"hoplit","win":"Průsmyk je volný. Tisíc černých plachet čeká v zátoce. Moře je černé… zítra bude rudé. – Konec 1. aktu."}
  }$j$ end)::jsonb;
$$;

create or replace function public.ashes_chapter_for(p_faction text, ch int)
returns jsonb language sql immutable set search_path = public as $$
  select case when p_faction = 'legie' then public.ashes_chapter_legie(ch) else public.ashes_chapter(ch) end;
$$;

-- Bojové hodnoty včetně strany a hrdiny.
create or replace function public.ashes_fighter(uid uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare ch public.ashes_characters; s record;
begin
  select * into ch from public.ashes_characters where user_id = uid;
  if not found then return null; end if;
  select coalesce(sum(sila), 0) sila, coalesce(sum(obratnost), 0) obratnost, coalesce(sum(intelekt), 0) intelekt,
         coalesce(sum(vydrz), 0) vydrz, coalesce(sum(stesti), 0) stesti, coalesce(sum(armor), 0) armor,
         max(wmin) filter (where slot = 'zbran') wmin, max(wmax) filter (where slot = 'zbran') wmax,
         coalesce(bool_or(slot = 'stit'), false) shield
    into s from public.ashes_items where user_id = uid and equipped;
  return jsonb_build_object(
    'id', ch.user_id,
    'name', public.ashes_display_name(ch),
    'class', ch.class, 'level', ch.level, 'faction', ch.faction,
    'sila', ch.sila + s.sila, 'obratnost', ch.obratnost + s.obratnost, 'intelekt', ch.intelekt + s.intelekt,
    'vydrz', ch.vydrz + s.vydrz, 'stesti', ch.stesti + s.stesti,
    'wmin', coalesce(s.wmin, 1), 'wmax', coalesce(s.wmax, 3), 'armor', s.armor, 'shield', s.shield,
    'appearance', ch.appearance, 'eryon', ch.is_eryon, 'azkar', ch.is_azkar, 'honor', ch.honor);
end;
$$;

create or replace function public.ashes_offer_quests(uid uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  ch public.ashes_characters; w public.ashes_world; chap jsonb; q jsonb; picks int[]; idx int;
  mins int; diff numeric; lvl int; xp int; gold int; n int; look jsonb;
begin
  select * into ch from public.ashes_characters where user_id = uid;
  select * into w from public.ashes_world where id = 1;
  delete from public.ashes_quests where user_id = uid and state in ('offered', 'done');
  chap := public.ashes_chapter_for(ch.faction, ch.chapter);
  n := jsonb_array_length(chap -> 'quests');
  picks := array(select g from generate_series(0, n - 1) g order by random() limit 3);
  foreach idx in array picks loop
    q := chap -> 'quests' -> idx;
    mins := w.quest_minutes_min + floor(random() * (w.quest_minutes_max - w.quest_minutes_min + 1))::int;
    diff := 0.8 + random() * 0.25;
    lvl := greatest(1, ch.level - (case when random() < 0.35 then 1 else 0 end));
    if ch.faction = 'legie' then
      look := jsonb_build_object('kalidran', true, 'cloak', (array['#2c3e5a', '#7a1f16', '#3d4a2a', '#5a4a2a'])[1 + floor(random() * 4)::int]);
    else
      look := jsonb_build_object('enemy', true, 'tint', (array['#7a1f1a', '#5b2a12', '#3a2f2a', '#4a1414'])[1 + floor(random() * 4)::int]);
    end if;
    xp := round(public.ashes_xp_need(ch.level) / (4.5 + ch.level * 0.25) * (0.8 + mins * 0.15) * diff);
    gold := round((10 + ch.level * 7) * (0.8 + mins * 0.15) * (0.7 + random() * 0.6));
    insert into public.ashes_quests (user_id, chapter, title, story, enemy, minutes, xp, gold, item_chance)
    values (uid, ch.chapter, q ->> 't', q ->> 's', public.ashes_enemy(q ->> 'e', q ->> 'c', lvl, diff, look), mins, xp, gold, 20 + floor(random() * 25)::int);
  end loop;
end;
$$;

do $do$
declare d text;
begin
  d := pg_get_functiondef('public.ashes_grant(uuid,int,int)'::regprocedure);
  d := replace(d, $r$case when ch.is_eryon then 'Eryon' else ch.name end$r$, $r$public.ashes_display_name(ch)$r$);
  execute d;
  d := pg_get_functiondef('public.ashes_finish_quest(boolean)'::regprocedure);
  d := replace(d, $r$wall := public.ashes_wall_add(40 + ch.level * 6);$r$,
    $r$wall := public.ashes_wall_add((case when ch.faction = 'legie' then -1 else 1 end) * (40 + ch.level * 6));$r$);
  execute d;
end $do$;

create or replace function public.ashes_state()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid; ch public.ashes_characters; w public.ashes_world; wall int; res jsonb;
begin
  if auth.uid() is null or not public.ashes_can_play() then
    return jsonb_build_object('allowed', false);
  end if;
  uid := auth.uid();
  wall := public.ashes_wall_add(0);
  select * into w from public.ashes_world where id = 1;
  select * into ch from public.ashes_characters where user_id = uid;
  res := jsonb_build_object(
    'allowed', true,
    'admin', public.ashes_is_admin(),
    'editor', public.has_role(uid, 'editor') or public.ashes_is_admin(),
    'now', now(),
    'world', jsonb_build_object('wall', wall, 'wall_max', 100000, 'open_to_all', w.open_to_all,
      'eryon_shout', w.eryon_shout, 'eryon_shout_at', w.eryon_shout_at,
      'azkar_shout', w.azkar_shout, 'azkar_shout_at', w.azkar_shout_at,
      'eryon_claimed', exists (select 1 from public.ashes_characters where is_eryon),
      'azkar_claimed', exists (select 1 from public.ashes_characters where is_azkar),
      'heroes', (select count(*) from public.ashes_characters),
      'kalidra', (select count(*) from public.ashes_characters where faction = 'kalidra'),
      'legie', (select count(*) from public.ashes_characters where faction = 'legie'),
      'arena_cooldown_s', w.arena_cooldown_s),
    'chronicle', coalesce((select jsonb_agg(x order by x.created_at desc) from
      (select created_at, kind, text from public.ashes_chronicle order by id desc limit 12) x), '[]'::jsonb));
  if ch.user_id is null then
    return res || jsonb_build_object('character', null);
  end if;

  if ch.courage_day <> current_date then
    update public.ashes_characters set courage = 100, courage_day = current_date where user_id = uid;
    ch.courage := 100;
  end if;
  update public.ashes_characters set last_seen = now() where user_id = uid;
  if not exists (select 1 from public.ashes_quests where user_id = uid and state in ('offered', 'active')) then
    perform public.ashes_offer_quests(uid);
  end if;

  return res || jsonb_build_object(
    'character', to_jsonb(ch) || jsonb_build_object('xp_need', public.ashes_xp_need(ch.level),
      'display_name', public.ashes_display_name(ch)),
    'fighter', public.ashes_fighter(uid),
    'hp', public.ashes_hp(public.ashes_fighter(uid)),
    'train_cost', jsonb_build_object('sila', public.ashes_train_cost(ch.sila), 'obratnost', public.ashes_train_cost(ch.obratnost),
      'intelekt', public.ashes_train_cost(ch.intelekt), 'vydrz', public.ashes_train_cost(ch.vydrz), 'stesti', public.ashes_train_cost(ch.stesti)),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.equipped desc, i.created_at) from public.ashes_items i where i.user_id = uid and not i.in_shop), '[]'::jsonb),
    'quests', coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.ashes_quests q where q.user_id = uid and q.state in ('offered', 'active')), '[]'::jsonb),
    'chapter', public.ashes_chapter_for(ch.faction, ch.chapter) - 'quests' || jsonb_build_object('n', least(ch.chapter, 7)),
    'bag_max', 12);
end;
$$;

drop function if exists public.ashes_create_character(text, text, jsonb);
create or replace function public.ashes_create_character(p_name text, p_class text, p_appearance jsonb, p_faction text default 'kalidra')
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); nm text := btrim(coalesce(p_name, '')); starter uuid;
begin
  if exists (select 1 from public.ashes_characters where user_id = uid) then raise exception 'Postavu už máš.'; end if;
  if nm !~ '^[[:alpha:]][[:alpha:][:digit:] _-]{2,19}$' then raise exception 'Jméno musí mít 3–20 znaků a začínat písmenem.'; end if;
  if lower(nm) in ('eryon', 'azkar') then raise exception 'Toto jméno patří legendě.'; end if;
  if exists (select 1 from public.ashes_characters where lower(name) = lower(nm)) then raise exception 'Toto jméno už nosí jiný hrdina.'; end if;
  if p_class not in ('hoplit', 'lucistnik', 'vestec') then raise exception 'Neznámé povolání.'; end if;
  if p_faction not in ('kalidra', 'legie') then raise exception 'Neznámá strana.'; end if;

  insert into public.ashes_characters (user_id, name, class, faction, appearance, sila, obratnost, intelekt, vydrz, stesti)
  values (uid, nm, p_class, p_faction, coalesce(p_appearance, '{}'::jsonb) - 'enemy' - 'kalidran',
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

create or replace function public.ashes_fight_boss()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require(); ch public.ashes_characters; chap jsonb; b jsonb; w public.ashes_world;
  fight jsonb; won boolean; ups int := 0; item uuid; item_row jsonb; mult numeric := 1; lvl int; ally text;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  select * into w from public.ashes_world where id = 1;
  if ch.chapter > 6 then raise exception '1. akt je dohrán. Další kapitoly se připravují.'; end if;
  chap := public.ashes_chapter_for(ch.faction, ch.chapter);
  if ch.chapter_progress < (chap ->> 'need')::int then raise exception 'Nejdřív splň výpravy této kapitoly.'; end if;
  if ch.boss_ready_at > now() and not public.ashes_is_admin() then raise exception 'Zraněný hrdina potřebuje chvíli odpočinku.'; end if;
  b := chap -> 'boss';
  lvl := greatest(ch.level, ch.chapter * 2 - 1);
  ally := coalesce(chap ->> 'ally', case when coalesce((chap ->> 'eryon')::boolean, false) then 'eryon' end);
  if ally is not null then mult := 1.25; end if;
  fight := public.ashes_simulate(public.ashes_fighter(uid),
    public.ashes_enemy(b ->> 'e', b ->> 'c', lvl, 1.0, jsonb_build_object(
      'enemy', ch.faction = 'kalidra', 'kalidran', ch.faction = 'legie', 'boss', true, 'hero', b ->> 'look',
      'tint', '#8a1c12')), mult);
  won := (fight ->> 'winner')::int = 1;
  update public.ashes_characters set boss_ready_at = now() + make_interval(secs => w.boss_cooldown_s) where user_id = uid;
  if won then
    ups := public.ashes_grant(uid, (public.ashes_xp_need(ch.level) * 0.6)::int, 60 + ch.level * 25);
    if public.ashes_bag_count(uid) < 12 then
      item := public.ashes_make_item(uid, ch.class, ch.level + ups, null, 0.2);
      select to_jsonb(i) into item_row from public.ashes_items i where i.id = item;
    end if;
    update public.ashes_characters set chapter = chapter + 1, chapter_progress = 0, wins = wins + 1 where user_id = uid;
    perform public.ashes_wall_add(case when ch.faction = 'legie' then -800 else 800 end);
    perform public.ashes_log('boss', format('%s (%s) porazil: %s.', public.ashes_display_name(ch),
      case when ch.faction = 'legie' then 'Legie' else 'Kalidra' end, b ->> 'e'));
    delete from public.ashes_quests where user_id = uid and state = 'offered';
    if not exists (select 1 from public.ashes_quests where user_id = uid and state = 'active') then
      perform public.ashes_offer_quests(uid);
    end if;
  else
    update public.ashes_characters set losses = losses + 1 where user_id = uid;
  end if;
  return jsonb_build_object('fight', fight, 'won', won, 'boss', b, 'levels', ups, 'item', item_row,
    'ally', ally, 'eryon_ally', ally = 'eryon', 'state', public.ashes_state());
end;
$$;

create or replace function public.ashes_arena_opponents()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); my int;
begin
  select honor into my from public.ashes_characters where user_id = uid;
  return coalesce((select jsonb_agg(public.ashes_fighter(x.user_id) order by (x.is_eryon or x.is_azkar) desc, abs(x.honor - my)) from (
    (select user_id, honor, is_eryon, is_azkar from public.ashes_characters
       where user_id <> uid and not is_eryon and not is_azkar order by abs(honor - my) limit 8)
    union all
    (select user_id, honor, is_eryon, is_azkar from public.ashes_characters
       where user_id <> uid and (is_eryon or is_azkar))
  ) x), '[]'::jsonb);
end;
$$;

create or replace function public.ashes_arena_fight(p_target uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require(); ch public.ashes_characters; foe public.ashes_characters; w public.ashes_world;
  fight jsonb; won boolean; delta int; v_gold int; rival boolean;
begin
  if p_target = uid then raise exception 'Sám se sebou bojovat nemůžeš.'; end if;
  select * into ch from public.ashes_characters where user_id = uid for update;
  select * into foe from public.ashes_characters where user_id = p_target;
  if not found then raise exception 'Soupeř nenalezen.'; end if;
  select * into w from public.ashes_world where id = 1;
  if ch.arena_ready_at > now() and not public.ashes_is_admin() then raise exception 'V aréně si ještě musíš odpočinout.'; end if;
  fight := public.ashes_simulate(public.ashes_fighter(uid), public.ashes_fighter(p_target));
  won := (fight ->> 'winner')::int = 1;
  rival := ch.faction <> foe.faction;
  delta := greatest(4, least(40, 20 + (foe.honor - ch.honor) / 10));
  if rival then delta := round(delta * 1.5); end if;
  v_gold := 5 + ch.level * 4;
  update public.ashes_characters set arena_ready_at = now() + make_interval(secs => w.arena_cooldown_s) where user_id = uid;
  if won then
    update public.ashes_characters set honor = honor + delta, gold = gold + v_gold, wins = wins + 1 where user_id = uid;
    update public.ashes_characters set honor = greatest(0, honor - delta / 2) where user_id = p_target;
    if rival then perform public.ashes_wall_add(case when ch.faction = 'legie' then -150 else 150 end); end if;
    if foe.is_eryon or foe.is_azkar then
      perform public.ashes_log('arena', format('%s porazil v aréně samotného %s!', public.ashes_display_name(ch),
        case when foe.is_eryon then 'Eryona' else 'Azkara' end));
    end if;
  else
    update public.ashes_characters set honor = greatest(0, honor - delta / 2), losses = losses + 1 where user_id = uid;
    update public.ashes_characters set honor = honor + delta / 2 where user_id = p_target;
  end if;
  return jsonb_build_object('fight', fight, 'won', won, 'honor', case when won then delta else -(delta / 2) end,
    'gold', case when won then v_gold else 0 end, 'rival', rival, 'state', public.ashes_state());
end;
$$;

drop function if exists public.ashes_hall_of_fame();
create or replace function public.ashes_hall_of_fame()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select public.ashes_display_name(c) as name, class, level, honor, chapter, faction,
      is_eryon as eryon, is_azkar as azkar
    from public.ashes_characters c where public.ashes_can_play() order by honor desc, level desc limit 20) x;
$$;

-- Převzetí hrdiny: Eryona jen správce (postava Kalidry), Azkara správce nebo editor (postava Legie).
drop function if exists public.ashes_claim_eryon(boolean);
drop function if exists public.ashes_eryon_say(text);

create or replace function public.ashes_claim_hero(p_on boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if ch.faction = 'kalidra' then
    if not public.ashes_is_admin() then raise exception 'Eryona může převzít jen správce.'; end if;
    if p_on then
      update public.ashes_characters set is_eryon = false where is_eryon and user_id <> uid;
      update public.ashes_characters set is_eryon = true where user_id = uid;
      perform public.ashes_log('eryon', 'Eryon kráčí mezi obránci Kalidry.');
    else
      update public.ashes_characters set is_eryon = false where user_id = uid;
    end if;
  else
    if not (public.ashes_is_admin() or public.has_role(uid, 'editor')) then raise exception 'Azkara může převzít jen správce nebo editor.'; end if;
    if p_on then
      update public.ashes_characters set is_azkar = false where is_azkar and user_id <> uid;
      update public.ashes_characters set is_azkar = true where user_id = uid;
      perform public.ashes_log('azkar', 'Azkar, Syn Rudého slunce, vede Legii osobně.');
    else
      update public.ashes_characters set is_azkar = false where user_id = uid;
    end if;
  end if;
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_hero_say(p_text text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters; msg text := btrim(coalesce(p_text, ''));
begin
  select * into ch from public.ashes_characters where user_id = uid;
  if not (coalesce(ch.is_eryon, false) or coalesce(ch.is_azkar, false)) then raise exception 'Promlouvat může jen Eryon nebo Azkar.'; end if;
  if length(msg) < 2 or length(msg) > 240 then raise exception 'Zpráva musí mít 2–240 znaků.'; end if;
  if ch.is_eryon then
    update public.ashes_world set eryon_shout = msg, eryon_shout_at = now() where id = 1;
    perform public.ashes_log('eryon', format('Eryon: „%s“', msg));
  else
    update public.ashes_world set azkar_shout = msg, azkar_shout_at = now() where id = 1;
    perform public.ashes_log('azkar', format('Azkar: „%s“', msg));
  end if;
  return public.ashes_state();
end;
$$;

revoke all on function public.ashes_display_name(public.ashes_characters) from public, anon, authenticated;
revoke all on function public.ashes_offer_quests(uuid) from public, anon, authenticated;
revoke all on function public.ashes_fighter(uuid) from public, anon, authenticated;
grant execute on function public.ashes_create_character(text, text, jsonb, text) to authenticated;
grant execute on function public.ashes_fight_boss() to authenticated;
grant execute on function public.ashes_arena_opponents() to authenticated;
grant execute on function public.ashes_arena_fight(uuid) to authenticated;
grant execute on function public.ashes_hall_of_fame() to authenticated;
grant execute on function public.ashes_claim_hero(boolean) to authenticated;
grant execute on function public.ashes_hero_say(text) to authenticated;
revoke all on function public.ashes_create_character(text, text, jsonb, text) from anon;
revoke all on function public.ashes_claim_hero(boolean) from anon;
revoke all on function public.ashes_hero_say(text) from anon;

-- Ashes of Eryon – 1. akt (hratelné alfa jádro)
-- Veškerý herní stav je autoritativní na serveru: klient smí jen volat RPC níže.
-- Tabulky mají RLS bez zápisových politik, takže přímý zápis z klienta není možný.

-- ---------------------------------------------------------------------------
-- Tabulky
-- ---------------------------------------------------------------------------
create table if not exists public.ashes_world (
  id int primary key default 1 check (id = 1),
  open_to_all boolean not null default false,
  wall_points int not null default 60000,
  wall_updated_at timestamptz not null default now(),
  eryon_shout text,
  eryon_shout_at timestamptz,
  quest_minutes_min int not null default 1,
  quest_minutes_max int not null default 3,
  arena_cooldown_s int not null default 180,
  boss_cooldown_s int not null default 120
);
insert into public.ashes_world (id) values (1) on conflict (id) do nothing;

create table if not exists public.ashes_characters (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  class text not null check (class in ('hoplit', 'lucistnik', 'vestec')),
  appearance jsonb not null default '{}'::jsonb,
  level int not null default 1,
  xp bigint not null default 0,
  gold bigint not null default 60,
  honor int not null default 100,
  sila int not null default 5,
  obratnost int not null default 5,
  intelekt int not null default 5,
  vydrz int not null default 8,
  stesti int not null default 5,
  chapter int not null default 1,
  chapter_progress int not null default 0,
  courage int not null default 100,
  courage_day date not null default current_date,
  arena_ready_at timestamptz not null default now(),
  boss_ready_at timestamptz not null default now(),
  shop_day date,
  wins int not null default 0,
  losses int not null default 0,
  is_eryon boolean not null default false,
  last_seen timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create unique index if not exists ashes_characters_name_key on public.ashes_characters (lower(name));
create index if not exists ashes_characters_honor_idx on public.ashes_characters (honor desc);

create table if not exists public.ashes_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  slot text not null check (slot in ('zbran', 'stit', 'helma', 'zbroj', 'rukavice', 'boty', 'amulet')),
  name text not null,
  rarity int not null default 0 check (rarity between 0 and 4),
  level int not null default 1,
  wmin int not null default 0,
  wmax int not null default 0,
  armor int not null default 0,
  sila int not null default 0,
  obratnost int not null default 0,
  intelekt int not null default 0,
  vydrz int not null default 0,
  stesti int not null default 0,
  price int not null default 1,
  equipped boolean not null default false,
  in_shop boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ashes_items_user_idx on public.ashes_items (user_id);

create table if not exists public.ashes_quests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  chapter int not null,
  title text not null,
  story text not null,
  enemy jsonb not null,
  minutes int not null,
  xp int not null,
  gold int not null,
  item_chance int not null default 25,
  state text not null default 'offered' check (state in ('offered', 'active', 'done')),
  started_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists ashes_quests_user_idx on public.ashes_quests (user_id, state);

create table if not exists public.ashes_chronicle (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  kind text not null,
  text text not null,
  user_id uuid references auth.users (id) on delete set null
);

alter table public.ashes_world enable row level security;
alter table public.ashes_characters enable row level security;
alter table public.ashes_items enable row level security;
alter table public.ashes_quests enable row level security;
alter table public.ashes_chronicle enable row level security;

drop policy if exists ashes_characters_own on public.ashes_characters;
create policy ashes_characters_own on public.ashes_characters for select to authenticated using (user_id = auth.uid());
drop policy if exists ashes_items_own on public.ashes_items;
create policy ashes_items_own on public.ashes_items for select to authenticated using (user_id = auth.uid());
drop policy if exists ashes_quests_own on public.ashes_quests;
create policy ashes_quests_own on public.ashes_quests for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Pomocné funkce
-- ---------------------------------------------------------------------------
create or replace function public.ashes_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and public.has_role(auth.uid(), 'admin');
$$;

create or replace function public.ashes_can_play()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'editor')
    or coalesce((select open_to_all from public.ashes_world where id = 1), false)
  );
$$;

create or replace function public.ashes_require()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ashes_can_play() then
    raise exception 'Ashes of Eryon se připravuje.' using errcode = '42501';
  end if;
  return auth.uid();
end;
$$;

create or replace function public.ashes_n(j jsonb, k text)
returns numeric language sql immutable as $$ select coalesce((j ->> k)::numeric, 0) $$;

create or replace function public.ashes_main(f jsonb)
returns numeric language sql immutable set search_path = public as $$
  select case f ->> 'class'
    when 'hoplit' then public.ashes_n(f, 'sila')
    when 'lucistnik' then public.ashes_n(f, 'obratnost')
    else public.ashes_n(f, 'intelekt') end;
$$;

create or replace function public.ashes_hp(f jsonb)
returns numeric language sql immutable set search_path = public as $$
  select greatest(10, public.ashes_n(f, 'vydrz') * (public.ashes_n(f, 'level') + 1)
    * case f ->> 'class' when 'hoplit' then 5 when 'lucistnik' then 4.5 else 4 end);
$$;

create or replace function public.ashes_xp_need(lvl int)
returns bigint language sql immutable as $$ select floor(300 * power(greatest(lvl, 1), 1.5))::bigint $$;

create or replace function public.ashes_train_cost(val int)
returns int language sql immutable as $$ select greatest(5, round(5 * power(greatest(val, 1), 1.35) / 4))::int $$;

-- Hradby Kalidry: společný cíl všech hráčů. Bez obránců se pomalu rozpadají.
create or replace function public.ashes_wall_add(delta int)
returns int language plpgsql security definer set search_path = public as $$
declare w public.ashes_world; cur int;
begin
  select * into w from public.ashes_world where id = 1 for update;
  cur := greatest(0, w.wall_points - floor(extract(epoch from now() - w.wall_updated_at) / 3600 * 300)::int);
  cur := least(100000, greatest(0, cur + delta));
  update public.ashes_world set wall_points = cur, wall_updated_at = now() where id = 1;
  return cur;
end;
$$;

create or replace function public.ashes_log(kind text, msg text)
returns void language sql security definer set search_path = public as $$
  insert into public.ashes_chronicle (kind, text, user_id) values (kind, msg, auth.uid());
$$;

-- ---------------------------------------------------------------------------
-- Souboj (tahový, počítá server)
-- ---------------------------------------------------------------------------
create or replace function public.ashes_simulate(a jsonb, b jsonb, a_mult numeric default 1)
returns jsonb language plpgsql volatile set search_path = public as $$
declare
  f jsonb[] := array[a, b];
  hp numeric[];
  maxhp numeric[];
  rounds jsonb := '[]'::jsonb;
  turn int; att int; def int; i int := 0;
  dmg numeric; red numeric; maxred numeric; critc numeric;
  crit boolean; evaded boolean; blocked boolean;
  wmin numeric; wmax numeric; winner int;
begin
  hp := array[public.ashes_hp(a), public.ashes_hp(b)];
  maxhp := hp;
  turn := case when public.ashes_n(a, 'obratnost') + random() * 10 >= public.ashes_n(b, 'obratnost') + random() * 10 then 1 else 2 end;
  while hp[1] > 0 and hp[2] > 0 and i < 80 loop
    i := i + 1; att := turn; def := 3 - turn;
    evaded := false; blocked := false; crit := false; dmg := 0;
    if f[def] ->> 'class' = 'lucistnik' and f[att] ->> 'class' <> 'vestec' and random() < 0.25 then
      evaded := true;
    elsif f[def] ->> 'class' = 'hoplit' and coalesce((f[def] ->> 'shield')::boolean, false)
          and f[att] ->> 'class' <> 'vestec' and random() < 0.25 then
      blocked := true;
    else
      wmin := greatest(1, public.ashes_n(f[att], 'wmin'));
      wmax := greatest(wmin, public.ashes_n(f[att], 'wmax'));
      dmg := (wmin + random() * (wmax - wmin)) * (1 + public.ashes_main(f[att]) / 10);
      if f[att] ->> 'class' <> 'vestec' then
        maxred := case f[def] ->> 'class' when 'hoplit' then 0.5 when 'lucistnik' then 0.25 else 0.1 end;
        red := least(maxred, public.ashes_n(f[def], 'armor') / greatest(1, public.ashes_n(f[att], 'level')) / 100);
        dmg := dmg * (1 - red);
      end if;
      critc := least(0.5, public.ashes_n(f[att], 'stesti') * 5 / greatest(1, public.ashes_n(f[def], 'level') * 2) / 100);
      if random() < critc then crit := true; dmg := dmg * 2; end if;
      if att = 1 then dmg := dmg * a_mult; end if;
      dmg := greatest(1, round(dmg));
      hp[def] := greatest(0, hp[def] - dmg);
    end if;
    rounds := rounds || jsonb_build_object('a', att, 'd', dmg, 'c', crit, 'e', evaded, 'b', blocked, 'h1', hp[1], 'h2', hp[2]);
    turn := def;
  end loop;
  winner := case
    when hp[2] <= 0 then 1
    when hp[1] <= 0 then 2
    when hp[1] / maxhp[1] >= hp[2] / maxhp[2] then 1
    else 2 end;
  return jsonb_build_object('winner', winner, 'hp1', maxhp[1], 'hp2', maxhp[2], 'f1', a, 'f2', b, 'rounds', rounds, 'bonus', a_mult);
end;
$$;

-- Bojové hodnoty postavy včetně nasazené výbavy.
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
    'name', case when ch.is_eryon then 'Eryon' else ch.name end,
    'class', ch.class, 'level', ch.level,
    'sila', ch.sila + s.sila, 'obratnost', ch.obratnost + s.obratnost, 'intelekt', ch.intelekt + s.intelekt,
    'vydrz', ch.vydrz + s.vydrz, 'stesti', ch.stesti + s.stesti,
    'wmin', coalesce(s.wmin, 1), 'wmax', coalesce(s.wmax, 3), 'armor', s.armor, 'shield', s.shield,
    'appearance', ch.appearance, 'eryon', ch.is_eryon, 'honor', ch.honor);
end;
$$;

-- Nepřítel podle úrovně a obtížnosti.
create or replace function public.ashes_enemy(nm text, cls text, lvl int, diff numeric, look jsonb default '{}'::jsonb)
returns jsonb language plpgsql volatile as $$
declare m int; w numeric;
begin
  lvl := greatest(1, lvl);
  m := round((7 + lvl * 3.4) * diff);
  w := case cls when 'vestec' then 1.3 when 'hoplit' then 1.0 else 1.1 end;
  return jsonb_build_object(
    'name', nm, 'class', cls, 'level', lvl,
    'sila', case cls when 'hoplit' then m else round(m * 0.4) end,
    'obratnost', case cls when 'lucistnik' then m else round(m * 0.4) end,
    'intelekt', case cls when 'vestec' then m else round(m * 0.4) end,
    'vydrz', round((6 + lvl * 3.1) * diff),
    'stesti', round((4 + lvl * 1.6) * diff),
    'wmin', round((1 + lvl * 1.5) * w * diff), 'wmax', round((3 + lvl * 2.3) * w * diff),
    'armor', round(lvl * 4 * diff), 'shield', cls = 'hoplit',
    'appearance', look, 'npc', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Předměty
-- ---------------------------------------------------------------------------
create or replace function public.ashes_make_item(uid uuid, cls text, lvl int, want_slot text default null, rarity_bonus numeric default 0, shop boolean default false)
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare
  slots text[] := array['zbran', 'stit', 'helma', 'zbroj', 'rukavice', 'boty', 'amulet'];
  sl text; r numeric; rar int; pw numeric; base text; gender text; mat text; adj text; nm text;
  wmn int := 0; wmx int := 0; arm int := 0;
  st jsonb := '{"sila":0,"obratnost":0,"intelekt":0,"vydrz":0,"stesti":0}'::jsonb;
  mainkey text; k text; n int; id uuid; bases jsonb;
begin
  sl := coalesce(want_slot, slots[1 + floor(random() * array_length(slots, 1))::int]);
  r := random() * (1 - least(greatest(rarity_bonus, 0), 0.5));
  rar := case when rarity_bonus < 0 then 0 when r < 0.005 then 4 when r < 0.04 then 3 when r < 0.15 then 2 when r < 0.40 then 1 else 0 end;
  lvl := greatest(1, lvl);
  pw := lvl * (1 + rar * 0.25);
  mainkey := case cls when 'hoplit' then 'sila' when 'lucistnik' then 'obratnost' else 'intelekt' end;

  bases := case sl
    when 'zbran' then case cls
      when 'hoplit' then '[["Kopí","n"],["Meč","m"],["Sekera","f"]]'
      when 'lucistnik' then '[["Luk","m"],["Dýka","f"],["Prak","m"]]'
      else '[["Hůl","f"],["Žezlo","n"],["Obětní nůž","m"]]' end
    when 'stit' then '[["Štít","m"],["Puklicový štít","m"],["Kulatý štít","m"]]'
    when 'helma' then '[["Přilba","f"],["Helma s hřebenem","f"],["Čelenka","f"]]'
    when 'zbroj' then '[["Kyrys","m"],["Zbroj","f"],["Šupinová košile","f"]]'
    when 'rukavice' then '[["Nátepníky","p"],["Chrániče paží","p"]]'
    when 'boty' then '[["Holeně","p"],["Sandály","p"]]'
    else '[["Amulet","m"],["Talisman","m"],["Náhrdelník","m"]]' end::jsonb;
  n := floor(random() * jsonb_array_length(bases))::int;
  base := bases -> n ->> 0; gender := bases -> n ->> 1;
  mat := case when lvl < 5 then 'Měděn' when lvl < 10 then 'Bronzov' when lvl < 17 then 'Zakalen' when lvl < 26 then 'Orichalkov' else 'Starokalidrsk' end;
  adj := mat || case gender when 'm' then 'ý' when 'f' then 'á' when 'n' then 'é' else 'é' end;
  if sl = 'amulet' then adj := case when lvl < 10 then 'Kostěný' when lvl < 20 then 'Jantarový' else 'Zlatý' end; end if;
  nm := adj || ' ' || lower(left(base, 1)) || substr(base, 2);
  nm := upper(left(nm, 1)) || substr(nm, 2);
  if rar = 3 then nm := nm || ' z Kalidry'; elsif rar = 4 then nm := nm || ' Eryonova rodu'; end if;

  if sl = 'zbran' then
    wmn := round((pw * 1.5 + 1) * case cls when 'vestec' then 1.35 when 'lucistnik' then 1.1 else 1 end);
    wmx := round((pw * 2.4 + 3) * case cls when 'vestec' then 1.35 when 'lucistnik' then 1.1 else 1 end);
  else
    arm := round(pw * case sl when 'zbroj' then 3 when 'stit' then 2.5 when 'helma' then 1.5 when 'amulet' then 0 else 1 end);
  end if;

  for i in 1..(1 + rar) loop
    k := case when random() < 0.45 then mainkey
      else (array['sila', 'obratnost', 'intelekt', 'vydrz', 'stesti'])[1 + floor(random() * 5)::int] end;
    if sl = 'amulet' and i = 1 then k := 'stesti'; end if;
    st := jsonb_set(st, array[k], to_jsonb((st ->> k)::int + greatest(1, round(pw * (0.6 + random() * 0.5)))::int));
  end loop;

  insert into public.ashes_items (user_id, slot, name, rarity, level, wmin, wmax, armor, sila, obratnost, intelekt, vydrz, stesti, price, in_shop)
  values (uid, sl, nm, rar, lvl, wmn, wmx, arm, (st ->> 'sila')::int, (st ->> 'obratnost')::int, (st ->> 'intelekt')::int,
          (st ->> 'vydrz')::int, (st ->> 'stesti')::int, greatest(5, round(pw * 14 * (1 + rar * 0.8)))::int, shop)
  returning ashes_items.id into id;
  return id;
end;
$$;

create or replace function public.ashes_bag_count(uid uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.ashes_items where user_id = uid and not equipped and not in_shop;
$$;

-- ---------------------------------------------------------------------------
-- Obsah 1. aktu (kapitoly podle písní „Poslední štít“, „Oheň Kalidry“ a „Pochod bronzu“)
-- ---------------------------------------------------------------------------
create or replace function public.ashes_chapter(ch int)
returns jsonb language sql immutable as $$
  select (case least(greatest(ch, 1), 6)
  when 1 then $j${
    "title":"Bezejmenný břeh","song":"posledni-stit","need":4,
    "intro":"Probouzíš se na Bezejmenném břehu. Moře tě vyplavilo mezi trosky a v dálce, za ruinami akvaduktu, hoří světla Kalidry.",
    "quests":[
      {"t":"Trosky v příboji","s":"Vlny vyplavily trosky lodi. Mezi nimi se hrabe vrakař, který nechce svědky.","e":"Vrakař","c":"lucistnik"},
      {"t":"Pašerácká stezka","s":"Útesy nad břehem protíná stezka ke Kalidře. Hlídá ji pašerák s krátkým lukem.","e":"Pašerák z útesů","c":"lucistnik"},
      {"t":"Šepot z jeskyně","s":"V mořské jeskyni někdo pálí obětní oheň a šeptá jméno, které neznáš.","e":"Kultista popela","c":"vestec"},
      {"t":"Psi z ruin","s":"Mezi zbořenými sloupy se toulá smečka. Její vůdce už ochutnal lidskou krev.","e":"Vůdce smečky","c":"hoplit"},
      {"t":"Mýto pod akvaduktem","s":"Pod rozpadlým obloukem akvaduktu vybírají lapkové mýto od každého, kdo jde ke Kalidře.","e":"Lapka od akvaduktu","c":"hoplit"}
    ],
    "boss":{"t":"Kapitán vrakařů","s":"„Kdo přežije moře, patří mně,“ směje se kapitán Dorkas, pán Bezejmenného břehu. Porazíš-li ho, cesta ke Kalidře je volná.","e":"Kapitán Dorkas","c":"hoplit","win":"Dorkas padl do příboje. Stezka ke Kalidře je volná a na kopcích nad městem se rozhořívají strážní ohně."}
  }$j$
  when 2 then $j${
    "title":"Strážní ohně","song":"posledni-stit","need":4,
    "intro":"Když rudé slunce kleslo k moři, na kopcích vzplály strážní ohně. Nepřítel přichází.",
    "quests":[
      {"t":"Zhasnutý oheň","s":"Jeden ze strážních ohňů na kopcích nehoří. Někdo ho uhasil dřív, než stihl varovat město.","e":"Zvěd Rudého slunce","c":"lucistnik"},
      {"t":"Posel bez koně","s":"Posel z hor leží v trní, zpráva v jeho ruce je od krve. Ten, kdo ho zranil, je stále blízko.","e":"Lovec poslů","c":"lucistnik"},
      {"t":"Dým nad údolím","s":"V údolí hoří stodoly. Žhář z hor chce, aby Kalidra hladověla dřív, než začne obléhání.","e":"Žhář z hor","c":"vestec"},
      {"t":"Hlídka v průsmyku","s":"Průsmykem se plíží předvoj legie. Zastav ho, než dojde k hradbám.","e":"Předvoj legie","c":"hoplit"},
      {"t":"Rohy v noci","s":"Někde v temnotě troubí nepřátelský roh a svolává další. Umlč ho.","e":"Trubač legie","c":"hoplit"}
    ],
    "boss":{"t":"Velitel zvědů","s":"Arhat, velitel zvědů Legie Rudého slunce, viděl hradby Kalidry a nese svému pánovi nákres bran.","e":"Arhat, velitel zvědů","c":"lucistnik","win":"Nákres bran shořel s Arhatovým pláštěm. Ale na obzoru se už zvedá prach – přichází tisíc kopí."}
  }$j$
  when 3 then $j${
    "title":"Tisíc kopí","song":"posledni-stit","need":4,
    "intro":"Pod hradbou stojí tisíc kopí. Jak temný les se blíží dál.",
    "quests":[
      {"t":"Temný les kopí","s":"První řady legie se zkoušejí přiblížit k příkopu. Odraz je dřív, než se zakopou.","e":"Kopiník první řady","c":"hoplit"},
      {"t":"Prakovníci na pahorku","s":"Z pahorku pod hradbami sviští kameny. Obránci na ochozu padají jeden za druhým.","e":"Prakovník legie","c":"lucistnik"},
      {"t":"Kněz Rudého slunce","s":"Kněz legie zpívá u ohně a jeho píseň plní nepřátele zuřivostí.","e":"Kněz Rudého slunce","c":"vestec"},
      {"t":"Obléhací beran","s":"Legie tlačí k bráně beran z cedrového dřeva. Strážci ho nesmí dotlačit.","e":"Strážce beranu","c":"hoplit"},
      {"t":"Zrádce u studny","s":"Někdo z města chce otrávit studnu na náměstí. Najdi ho dřív, než kalidrské děti napijí jed.","e":"Zrádce z Kalidry","c":"lucistnik"}
    ],
    "boss":{"t":"Praporečník legie","s":"Pod jeho korouhví se tisíc kopí pohne k bráně. Strhni ji a legie zaváhá.","e":"Praporečník Rudého slunce","c":"hoplit","win":"Korouhev Rudého slunce leží v prachu. Legie se stáhla – ale jen proto, aby udeřila celou silou na bránu."}
  }$j$
  when 4 then $j${
    "title":"Poslední štít","song":"posledni-stit","need":4,"eryon":true,
    "intro":"Sto mužů proti tisícům. Před branami svého města stojí jeden válečník pevně – Eryon. A ty stojíš vedle něj.",
    "quests":[
      {"t":"První řada klesla","s":"První řada obránců klesla k zemi. Druhá však vykročila dál – a ty v ní.","e":"Zuřivec legie","c":"hoplit"},
      {"t":"Sto proti tisícům","s":"Elitní kopiníci legie se derou k bráně. Za každého z nich jich přijde deset.","e":"Elitní kopiník","c":"hoplit"},
      {"t":"Za děti za hradbami","s":"Lučištníci šplhají po žebřících na ochoz. Za hradbami spí děti Kalidry.","e":"Lučištník na žebříku","c":"lucistnik"},
      {"t":"Bronz jako hrom","s":"Věštec legie vyvolává oheň na dřevěná vrata. Bronz musí zaznít dřív než jeho kletba.","e":"Věštec Rudého slunce","c":"vestec"},
      {"t":"Rohy nad krajinou","s":"Velitel útoku troubí do rohu a žene legii vpřed. Prach se zvedá výš.","e":"Velitel útoku","c":"hoplit"}
    ],
    "boss":{"t":"Vojevůdce legie","s":"Před branou stojí Vojevůdce Rudého slunce. Eryon zvedá svůj štít po tvém boku: dokud máte sílu pozvednout meč, Kalidra nepadne.","e":"Vojevůdce Rudého slunce","c":"hoplit","win":"Vojevůdce padl před branou. Legie ustupuje do hor. Kámen si pamatuje, moře si pamatuje – a jméno Eryon zůstává."}
  }$j$
  when 5 then $j${
    "title":"Oheň Kalidry","song":"ohen-kalidry","need":4,
    "intro":"Ráno přišlo v barvě popela. Kalidra hoří, však ještě žije. Kalidra krvácí, však ještě stojí.",
    "quests":[
      {"t":"Voda pro raněné","s":"Matky nesou vodu raněným, ale u kašny se o ni perou marodéři.","e":"Marodér","c":"hoplit"},
      {"t":"Pece kovářů","s":"Kováři znovu rozžhavují pece, aby mohli tavit bronz. Někdo jim ho ale krade.","e":"Zloděj bronzu","c":"lucistnik"},
      {"t":"Poslové k vesnicím","s":"Rohy volají muže zpět. Doprovoď posly k vesnicím – jezdci legie číhají na cestách.","e":"Jezdec legie","c":"lucistnik"},
      {"t":"Jména v prachu","s":"Mezi padlými se plíží lupič a bere jim bronz i jména. Pamatuj jména, co zůstala v prachu.","e":"Lupič padlých","c":"hoplit"},
      {"t":"Ohně na horách","s":"Na horách svítí další ohně. Jeden, deset, stovky. Zjisti, kdo je zapaluje.","e":"Strážce horského ohně","c":"vestec"}
    ],
    "boss":{"t":"Pán horských ohňů","s":"Jeden oheň… deset ohňů… sto ohňů. Na horách čeká předvoj války a jeho pán. Eryon ukazuje k horám.","e":"Pán horských ohňů","c":"vestec","win":"Pán horských ohňů padl, ale ohně na horách hoří dál. Tam přichází válka. A my jí půjdeme naproti."}
  }$j$
  else $j${
    "title":"Pochod bronzu","song":"pochod-bronzu","need":4,"eryon":true,
    "intro":"Za úsvitu brány zaskřípěly. Kalidra už nečeká v hradbách – Eryon jde v čele vojska a rudý plášť mu v prachu vlaje.",
    "quests":[
      {"t":"Spálené vesnice","s":"Míjíte spálené vesnice. V jedné z nich se ještě skrývá oddíl legie a čeká na opozdilce.","e":"Plenitel vesnic","c":"hoplit"},
      {"t":"Studny plné popela","s":"Někdo zasypává studny popelem, aby vojsko Kalidry žíznilo dřív, než dojde k horám.","e":"Travič studní","c":"vestec"},
      {"t":"Chléb a voda","s":"Staré matky na prazích podávají vojákům chléb a vodu. Nájezdníci legie je za to chtějí potrestat.","e":"Nájezdník legie","c":"lucistnik"},
      {"t":"Tváře v plamenech","s":"Celý tábor spí, jen Eryon sedí u ohně. Ze tmy se k němu plíží vrah poslaný legií.","e":"Noční vrah","c":"lucistnik"},
      {"t":"Průsmyk větrů","s":"Třetí den stojíte v průsmyku. Vítr nese sůl a dým – a hlídka legie vám zatarasila cestu.","e":"Strážce průsmyku","c":"hoplit"}
    ],
    "boss":{"t":"Černá flotila","s":"Pod průsmykem leží pobřeží plné lodí černých jak stín. Předvoj flotily vystoupil na břeh. Eryon zvedá ruku k nebi – ať zítra pozná, jak zní bronz Kalidry.","e":"Kapitán černé flotily","c":"hoplit","win":"Předvoj černé flotily padl na pobřeží. Došli jsme k moři. A moře… už čekalo. – Konec 1. aktu."}
  }$j$ end)::jsonb;
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
  chap := public.ashes_chapter(ch.chapter);
  n := jsonb_array_length(chap -> 'quests');
  picks := array(select g from generate_series(0, n - 1) g order by random() limit 3);
  foreach idx in array picks loop
    q := chap -> 'quests' -> idx;
    mins := w.quest_minutes_min + floor(random() * (w.quest_minutes_max - w.quest_minutes_min + 1))::int;
    diff := 0.8 + random() * 0.25;
    lvl := greatest(1, ch.level - (case when random() < 0.35 then 1 else 0 end));
    look := jsonb_build_object('enemy', true, 'tint', (array['#7a1f1a', '#5b2a12', '#3a2f2a', '#4a1414'])[1 + floor(random() * 4)::int]);
    xp := round(public.ashes_xp_need(ch.level) / (4.5 + ch.level * 0.25) * (0.8 + mins * 0.15) * diff);
    gold := round((10 + ch.level * 7) * (0.8 + mins * 0.15) * (0.7 + random() * 0.6));
    insert into public.ashes_quests (user_id, chapter, title, story, enemy, minutes, xp, gold, item_chance)
    values (uid, ch.chapter, q ->> 't', q ->> 's', public.ashes_enemy(q ->> 'e', q ->> 'c', lvl, diff, look), mins, xp, gold, 20 + floor(random() * 25)::int);
  end loop;
end;
$$;

-- Přidá zkušenosti a vyřeší postup úrovní. Vrací počet nových úrovní.
create or replace function public.ashes_grant(uid uuid, add_xp int, add_gold int)
returns int language plpgsql volatile security definer set search_path = public as $$
declare ch public.ashes_characters; ups int := 0;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  ch.xp := ch.xp + add_xp;
  ch.gold := ch.gold + add_gold;
  while ch.xp >= public.ashes_xp_need(ch.level) loop
    ch.xp := ch.xp - public.ashes_xp_need(ch.level);
    ch.level := ch.level + 1;
    ups := ups + 1;
    -- Každá úroveň přidá trochu přirozené síly, zbytek se trénuje za zlato.
    ch.vydrz := ch.vydrz + 2;
    if ch.class = 'hoplit' then ch.sila := ch.sila + 2;
    elsif ch.class = 'lucistnik' then ch.obratnost := ch.obratnost + 2;
    else ch.intelekt := ch.intelekt + 2; end if;
    if ch.level % 5 = 0 then
      perform public.ashes_log('level', format('%s dosáhl %s. úrovně.', case when ch.is_eryon then 'Eryon' else ch.name end, ch.level));
    end if;
  end loop;
  update public.ashes_characters set xp = ch.xp, gold = ch.gold, level = ch.level, vydrz = ch.vydrz,
    sila = ch.sila, obratnost = ch.obratnost, intelekt = ch.intelekt where user_id = uid;
  return ups;
end;
$$;

-- ---------------------------------------------------------------------------
-- Veřejné RPC pro klienta
-- ---------------------------------------------------------------------------
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
    'now', now(),
    'world', jsonb_build_object('wall', wall, 'wall_max', 100000, 'open_to_all', w.open_to_all,
      'eryon_shout', w.eryon_shout, 'eryon_shout_at', w.eryon_shout_at,
      'eryon_claimed', exists (select 1 from public.ashes_characters where is_eryon),
      'heroes', (select count(*) from public.ashes_characters),
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
      'display_name', case when ch.is_eryon then 'Eryon' else ch.name end),
    'fighter', public.ashes_fighter(uid),
    'hp', public.ashes_hp(public.ashes_fighter(uid)),
    'train_cost', jsonb_build_object('sila', public.ashes_train_cost(ch.sila), 'obratnost', public.ashes_train_cost(ch.obratnost),
      'intelekt', public.ashes_train_cost(ch.intelekt), 'vydrz', public.ashes_train_cost(ch.vydrz), 'stesti', public.ashes_train_cost(ch.stesti)),
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.equipped desc, i.created_at) from public.ashes_items i where i.user_id = uid and not i.in_shop), '[]'::jsonb),
    'quests', coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at) from public.ashes_quests q where q.user_id = uid and q.state in ('offered', 'active')), '[]'::jsonb),
    'chapter', public.ashes_chapter(ch.chapter) - 'quests' || jsonb_build_object('n', least(ch.chapter, 7)),
    'bag_max', 12);
end;
$$;

create or replace function public.ashes_create_character(p_name text, p_class text, p_appearance jsonb)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); nm text := btrim(coalesce(p_name, '')); starter uuid;
begin
  if exists (select 1 from public.ashes_characters where user_id = uid) then raise exception 'Postavu už máš.'; end if;
  if nm !~ '^[[:alpha:]][[:alpha:][:digit:] _-]{2,19}$' then raise exception 'Jméno musí mít 3–20 znaků a začínat písmenem.'; end if;
  if lower(nm) = 'eryon' then raise exception 'Jméno Eryon patří legendě.'; end if;
  if exists (select 1 from public.ashes_characters where lower(name) = lower(nm)) then raise exception 'Toto jméno už nosí jiný hrdina.'; end if;
  if p_class not in ('hoplit', 'lucistnik', 'vestec') then raise exception 'Neznámé povolání.'; end if;

  insert into public.ashes_characters (user_id, name, class, appearance, sila, obratnost, intelekt, vydrz, stesti)
  values (uid, nm, p_class, coalesce(p_appearance, '{}'::jsonb) - 'enemy',
    case p_class when 'hoplit' then 10 else 5 end,
    case p_class when 'lucistnik' then 10 else 5 end,
    case p_class when 'vestec' then 10 else 5 end,
    case p_class when 'hoplit' then 10 else 8 end, 5);
  -- Startovní výbava: zbraň a (pro hoplíta) štít. Výsledek do proměnné – volatilní funkce ve WHERE by se volala pro každý řádek.
  starter := public.ashes_make_item(uid, p_class, 1, 'zbran', -1);
  update public.ashes_items set equipped = true where id = starter;
  if p_class = 'hoplit' then
    starter := public.ashes_make_item(uid, p_class, 1, 'stit', -1);
    update public.ashes_items set equipped = true where id = starter;
  end if;
  perform public.ashes_log('hero', format('Na Bezejmenném břehu se probudil nový hrdina: %s.', nm));
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_start_quest(p_quest uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); q public.ashes_quests; ch public.ashes_characters; cost int;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if exists (select 1 from public.ashes_quests where user_id = uid and state = 'active') then raise exception 'Už jsi na výpravě.'; end if;
  select * into q from public.ashes_quests where id = p_quest and user_id = uid and state = 'offered';
  if not found then raise exception 'Výprava už není k dispozici.'; end if;
  cost := 8 + q.minutes * 2;
  if not public.ashes_is_admin() then
    if ch.courage < cost then raise exception 'Došla ti odvaha. Zítra ráno se vrátí.'; end if;
    update public.ashes_characters set courage = courage - cost where user_id = uid;
  end if;
  update public.ashes_quests set state = 'active', started_at = now(), ends_at = now() + make_interval(mins => q.minutes) where id = q.id;
  delete from public.ashes_quests where user_id = uid and state = 'offered';
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_finish_quest(p_skip boolean default false)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require(); q public.ashes_quests; ch public.ashes_characters;
  fight jsonb; won boolean; ups int := 0; item uuid; item_row jsonb; wall int;
begin
  select * into q from public.ashes_quests where user_id = uid and state = 'active' for update;
  if not found then raise exception 'Nejsi na výpravě.'; end if;
  if q.ends_at > now() and not (p_skip and public.ashes_is_admin()) then raise exception 'Výprava ještě neskončila.'; end if;
  select * into ch from public.ashes_characters where user_id = uid;
  fight := public.ashes_simulate(public.ashes_fighter(uid), q.enemy);
  won := (fight ->> 'winner')::int = 1;
  update public.ashes_quests set state = 'done' where id = q.id;
  if won then
    ups := public.ashes_grant(uid, q.xp, q.gold);
    if q.chapter = ch.chapter then
      update public.ashes_characters set chapter_progress = chapter_progress + 1 where user_id = uid;
    end if;
    if random() * 100 < q.item_chance and public.ashes_bag_count(uid) < 12 then
      item := public.ashes_make_item(uid, ch.class, ch.level + ups);
      select to_jsonb(i) into item_row from public.ashes_items i where i.id = item;
    end if;
    wall := public.ashes_wall_add(40 + ch.level * 6);
    update public.ashes_characters set wins = wins + 1 where user_id = uid;
  else
    -- Prohra: polovina zkušeností, žádné zlato ani kořist.
    ups := public.ashes_grant(uid, q.xp / 4, 0);
    update public.ashes_characters set losses = losses + 1 where user_id = uid;
  end if;
  perform public.ashes_offer_quests(uid);
  return jsonb_build_object('fight', fight, 'won', won, 'xp', case when won then q.xp else q.xp / 4 end,
    'gold', case when won then q.gold else 0 end, 'levels', ups, 'item', item_row, 'title', q.title,
    'state', public.ashes_state());
end;
$$;

create or replace function public.ashes_fight_boss()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require(); ch public.ashes_characters; chap jsonb; b jsonb; w public.ashes_world;
  fight jsonb; won boolean; ups int := 0; item uuid; item_row jsonb; mult numeric := 1; lvl int;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  select * into w from public.ashes_world where id = 1;
  if ch.chapter > 6 then raise exception '1. akt je dohrán. Další kapitoly se připravují.'; end if;
  chap := public.ashes_chapter(ch.chapter);
  if ch.chapter_progress < (chap ->> 'need')::int then raise exception 'Nejdřív splň výpravy této kapitoly.'; end if;
  if ch.boss_ready_at > now() and not public.ashes_is_admin() then raise exception 'Zraněný hrdina potřebuje chvíli odpočinku.'; end if;
  b := chap -> 'boss';
  lvl := greatest(ch.level, ch.chapter * 2 - 1);
  if coalesce((chap ->> 'eryon')::boolean, false) then mult := 1.25; end if;
  fight := public.ashes_simulate(public.ashes_fighter(uid),
    public.ashes_enemy(b ->> 'e', b ->> 'c', lvl, 1.0, jsonb_build_object('enemy', true, 'boss', true, 'tint', '#8a1c12')), mult);
  won := (fight ->> 'winner')::int = 1;
  update public.ashes_characters set boss_ready_at = now() + make_interval(secs => w.boss_cooldown_s) where user_id = uid;
  if won then
    ups := public.ashes_grant(uid, (public.ashes_xp_need(ch.level) * 0.6)::int, 60 + ch.level * 25);
    if public.ashes_bag_count(uid) < 12 then
      item := public.ashes_make_item(uid, ch.class, ch.level + ups, null, 0.2);
      select to_jsonb(i) into item_row from public.ashes_items i where i.id = item;
    end if;
    update public.ashes_characters set chapter = chapter + 1, chapter_progress = 0, wins = wins + 1 where user_id = uid;
    perform public.ashes_wall_add(800);
    perform public.ashes_log('boss', format('%s porazil: %s.', case when ch.is_eryon then 'Eryon' else ch.name end, b ->> 'e'));
    delete from public.ashes_quests where user_id = uid and state = 'offered';
    if not exists (select 1 from public.ashes_quests where user_id = uid and state = 'active') then
      perform public.ashes_offer_quests(uid);
    end if;
  else
    update public.ashes_characters set losses = losses + 1 where user_id = uid;
  end if;
  return jsonb_build_object('fight', fight, 'won', won, 'boss', b, 'levels', ups, 'item', item_row, 'eryon_ally', mult > 1,
    'state', public.ashes_state());
end;
$$;

create or replace function public.ashes_train(p_stat text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters; val int; cost int;
begin
  if p_stat not in ('sila', 'obratnost', 'intelekt', 'vydrz', 'stesti') then raise exception 'Neznámá vlastnost.'; end if;
  select * into ch from public.ashes_characters where user_id = uid for update;
  val := (to_jsonb(ch) ->> p_stat)::int;
  cost := public.ashes_train_cost(val);
  if ch.gold < cost then raise exception 'Nemáš dost zlata.'; end if;
  execute format('update public.ashes_characters set %I = %I + 1, gold = gold - $1 where user_id = $2', p_stat, p_stat) using cost, uid;
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_equip(p_item uuid, p_on boolean default true)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); it public.ashes_items; ch public.ashes_characters;
begin
  select * into it from public.ashes_items where id = p_item and user_id = uid and not in_shop for update;
  if not found then raise exception 'Předmět nenalezen.'; end if;
  select * into ch from public.ashes_characters where user_id = uid;
  if p_on then
    if it.level > ch.level + 2 then raise exception 'Na tento předmět ještě nemáš úroveň.'; end if;
    update public.ashes_items set equipped = false where user_id = uid and equipped and slot = it.slot;
    update public.ashes_items set equipped = true where id = it.id;
  else
    if public.ashes_bag_count(uid) >= 12 then raise exception 'Batoh je plný.'; end if;
    update public.ashes_items set equipped = false where id = it.id;
  end if;
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_sell(p_item uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); it public.ashes_items;
begin
  select * into it from public.ashes_items where id = p_item and user_id = uid and not in_shop for update;
  if not found then raise exception 'Předmět nenalezen.'; end if;
  if it.equipped then raise exception 'Nasazený předmět nelze prodat.'; end if;
  delete from public.ashes_items where id = it.id;
  update public.ashes_characters set gold = gold + greatest(1, it.price / 4) where user_id = uid;
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_shop()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  if not found then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if ch.shop_day is distinct from current_date or not exists (select 1 from public.ashes_items where user_id = uid and in_shop) then
    delete from public.ashes_items where user_id = uid and in_shop;
    for i in 1..6 loop
      perform public.ashes_make_item(uid, ch.class, ch.level + floor(random() * 2)::int, null, 0, true);
    end loop;
    update public.ashes_characters set shop_day = current_date where user_id = uid;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(i) order by i.slot) from public.ashes_items i where i.user_id = uid and i.in_shop), '[]'::jsonb);
end;
$$;

create or replace function public.ashes_buy(p_item uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); it public.ashes_items; ch public.ashes_characters;
begin
  select * into ch from public.ashes_characters where user_id = uid for update;
  select * into it from public.ashes_items where id = p_item and user_id = uid and in_shop for update;
  if not found then raise exception 'Zboží už kovář prodal.'; end if;
  if ch.gold < it.price then raise exception 'Nemáš dost zlata.'; end if;
  if public.ashes_bag_count(uid) >= 12 then raise exception 'Batoh je plný.'; end if;
  update public.ashes_items set in_shop = false where id = it.id;
  update public.ashes_characters set gold = gold - it.price where user_id = uid;
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_arena_opponents()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); my int;
begin
  select honor into my from public.ashes_characters where user_id = uid;
  return coalesce((select jsonb_agg(public.ashes_fighter(x.user_id) order by x.is_eryon desc, abs(x.honor - my)) from (
    (select user_id, honor, is_eryon from public.ashes_characters where user_id <> uid and not is_eryon order by abs(honor - my) limit 6)
    union all
    (select user_id, honor, is_eryon from public.ashes_characters where user_id <> uid and is_eryon limit 1)
  ) x), '[]'::jsonb);
end;
$$;

create or replace function public.ashes_arena_fight(p_target uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require(); ch public.ashes_characters; foe public.ashes_characters; w public.ashes_world;
  fight jsonb; won boolean; delta int; v_gold int;
begin
  if p_target = uid then raise exception 'Sám se sebou bojovat nemůžeš.'; end if;
  select * into ch from public.ashes_characters where user_id = uid for update;
  select * into foe from public.ashes_characters where user_id = p_target;
  if not found then raise exception 'Soupeř nenalezen.'; end if;
  select * into w from public.ashes_world where id = 1;
  if ch.arena_ready_at > now() and not public.ashes_is_admin() then raise exception 'V aréně si ještě musíš odpočinout.'; end if;
  fight := public.ashes_simulate(public.ashes_fighter(uid), public.ashes_fighter(p_target));
  won := (fight ->> 'winner')::int = 1;
  delta := greatest(4, least(40, 20 + (foe.honor - ch.honor) / 10));
  v_gold := 5 + ch.level * 4;
  update public.ashes_characters set arena_ready_at = now() + make_interval(secs => w.arena_cooldown_s) where user_id = uid;
  if won then
    update public.ashes_characters set honor = honor + delta, gold = gold + v_gold, wins = wins + 1 where user_id = uid;
    update public.ashes_characters set honor = greatest(0, honor - delta / 2) where user_id = p_target;
    if foe.is_eryon then
      perform public.ashes_log('arena', format('%s porazil v aréně samotného Eryona!', ch.name));
    end if;
  else
    update public.ashes_characters set honor = greatest(0, honor - delta / 2), losses = losses + 1 where user_id = uid;
    update public.ashes_characters set honor = honor + delta / 2 where user_id = p_target;
  end if;
  return jsonb_build_object('fight', fight, 'won', won, 'honor', case when won then delta else -(delta / 2) end,
    'gold', case when won then v_gold else 0 end, 'state', public.ashes_state());
end;
$$;

create or replace function public.ashes_hall_of_fame()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x), '[]'::jsonb) from (
    select case when is_eryon then 'Eryon' else name end as name, class, level, honor, chapter, is_eryon as eryon
    from public.ashes_characters where public.ashes_can_play() order by honor desc, level desc limit 20) x;
$$;

-- Eryon: správce může svou postavu proměnit v Eryona a promlouvat ke všem hráčům.
create or replace function public.ashes_claim_eryon(p_on boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require();
begin
  if not public.ashes_is_admin() then raise exception 'Eryona může převzít jen správce.'; end if;
  if not exists (select 1 from public.ashes_characters where user_id = uid) then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if p_on then
    update public.ashes_characters set is_eryon = false where is_eryon and user_id <> uid;
    update public.ashes_characters set is_eryon = true where user_id = uid;
    perform public.ashes_log('eryon', 'Eryon kráčí mezi obránci Kalidry.');
  else
    update public.ashes_characters set is_eryon = false where user_id = uid;
  end if;
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_eryon_say(p_text text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); msg text := btrim(coalesce(p_text, ''));
begin
  if not exists (select 1 from public.ashes_characters where user_id = uid and is_eryon) then raise exception 'Promlouvat může jen Eryon.'; end if;
  if length(msg) < 2 or length(msg) > 240 then raise exception 'Zpráva musí mít 2–240 znaků.'; end if;
  update public.ashes_world set eryon_shout = msg, eryon_shout_at = now() where id = 1;
  perform public.ashes_log('eryon', format('Eryon: „%s“', msg));
  return public.ashes_state();
end;
$$;

create or replace function public.ashes_admin_world(p_open boolean)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.ashes_is_admin() then raise exception 'Jen pro správce.'; end if;
  update public.ashes_world set open_to_all = p_open where id = 1;
  return public.ashes_state();
end;
$$;

-- Interní funkce nesmí volat klient přímo.
revoke all on function public.ashes_simulate(jsonb, jsonb, numeric) from public, anon, authenticated;
revoke all on function public.ashes_fighter(uuid) from public, anon, authenticated;
revoke all on function public.ashes_enemy(text, text, int, numeric, jsonb) from public, anon, authenticated;
revoke all on function public.ashes_make_item(uuid, text, int, text, numeric, boolean) from public, anon, authenticated;
revoke all on function public.ashes_offer_quests(uuid) from public, anon, authenticated;
revoke all on function public.ashes_grant(uuid, int, int) from public, anon, authenticated;
revoke all on function public.ashes_wall_add(int) from public, anon, authenticated;
revoke all on function public.ashes_log(text, text) from public, anon, authenticated;
revoke all on function public.ashes_bag_count(uuid) from public, anon, authenticated;

revoke all on function public.ashes_state() from public, anon;
grant execute on function public.ashes_state() to authenticated;
grant execute on function public.ashes_can_play() to authenticated;
grant execute on function public.ashes_create_character(text, text, jsonb) to authenticated;
grant execute on function public.ashes_start_quest(uuid) to authenticated;
grant execute on function public.ashes_finish_quest(boolean) to authenticated;
grant execute on function public.ashes_fight_boss() to authenticated;
grant execute on function public.ashes_train(text) to authenticated;
grant execute on function public.ashes_equip(uuid, boolean) to authenticated;
grant execute on function public.ashes_sell(uuid) to authenticated;
grant execute on function public.ashes_shop() to authenticated;
grant execute on function public.ashes_buy(uuid) to authenticated;
grant execute on function public.ashes_arena_opponents() to authenticated;
grant execute on function public.ashes_arena_fight(uuid) to authenticated;
grant execute on function public.ashes_hall_of_fame() to authenticated;
grant execute on function public.ashes_claim_eryon(boolean) to authenticated;
grant execute on function public.ashes_eryon_say(text) to authenticated;
grant execute on function public.ashes_admin_world(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Hudba alba „Eryon“ – soukromý bucket, jen pro hráče
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ashes-music', 'ashes-music', false, 15728640, array['audio/mpeg'])
on conflict (id) do nothing;

drop policy if exists ashes_music_players_read on storage.objects;
create policy ashes_music_players_read on storage.objects for select to authenticated
  using (bucket_id = 'ashes-music' and public.ashes_can_play());
drop policy if exists ashes_music_admin_write on storage.objects;
create policy ashes_music_admin_write on storage.objects for insert to authenticated
  with check (bucket_id = 'ashes-music' and public.has_role(auth.uid(), 'admin'));
drop policy if exists ashes_music_admin_update on storage.objects;
create policy ashes_music_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'ashes-music' and public.has_role(auth.uid(), 'admin'));
drop policy if exists ashes_music_admin_delete on storage.objects;
create policy ashes_music_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ashes-music' and public.has_role(auth.uid(), 'admin'));

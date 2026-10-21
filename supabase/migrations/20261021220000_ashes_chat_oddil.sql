-- Ashes of Eryon: chat a oddíly (klany).
-- Vše jde jen přes funkce (security definer): kontrola přístupu (ashes_require),
-- omezení počtu zpráv, čištění textu. Tabulky nejsou přímo čitelné ani zapisovatelné.

-- ------------------------------------------------------------------ oddíly
create table if not exists public.ashes_oddil (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null,
  motto text not null default '',
  faction text not null,
  leader uuid not null,
  created_at timestamptz not null default now()
);
create unique index if not exists ashes_oddil_name_key on public.ashes_oddil (lower(name));
create unique index if not exists ashes_oddil_tag_key on public.ashes_oddil (lower(tag));

create table if not exists public.ashes_oddil_members (
  user_id uuid primary key,
  oddil_id uuid not null references public.ashes_oddil(id) on delete cascade,
  role text not null default 'clen' check (role in ('velitel', 'setnik', 'clen')),
  joined_at timestamptz not null default now()
);
create index if not exists ashes_oddil_members_oddil on public.ashes_oddil_members (oddil_id);

create table if not exists public.ashes_oddil_invites (
  oddil_id uuid not null references public.ashes_oddil(id) on delete cascade,
  user_id uuid not null,
  invited_by uuid not null,
  created_at timestamptz not null default now(),
  primary key (oddil_id, user_id)
);

-- ------------------------------------------------------------------ chat
create table if not exists public.ashes_chat (
  id bigserial primary key,
  channel text not null,
  user_id uuid not null,
  name text not null,
  tag text not null default '',
  text text not null,
  created_at timestamptz not null default now()
);
create index if not exists ashes_chat_channel_id on public.ashes_chat (channel, id desc);

alter table public.ashes_oddil enable row level security;
alter table public.ashes_oddil_members enable row level security;
alter table public.ashes_oddil_invites enable row level security;
alter table public.ashes_chat enable row level security;
revoke all on public.ashes_oddil, public.ashes_oddil_members, public.ashes_oddil_invites, public.ashes_chat from anon, authenticated;

-- ------------------------------------------------------------------ pomocné
create or replace function public.ashes_clean_text(p text, p_max int)
returns text language sql immutable as $$
  select left(btrim(regexp_replace(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', ' ', 'g'), '\s+', ' ', 'g')), p_max)
$$;

create or replace function public.ashes_my_oddil(p_uid uuid)
returns table (oddil_id uuid, role text, tag text, faction text)
language sql stable security definer set search_path = public as $$
  select m.oddil_id, m.role, o.tag, o.faction
  from ashes_oddil_members m join ashes_oddil o on o.id = m.oddil_id
  where m.user_id = p_uid
$$;
revoke all on function public.ashes_my_oddil(uuid) from public, anon, authenticated;

-- ------------------------------------------------------------------ chat: odeslání a čtení
create or replace function public.ashes_chat_send(p_channel text, p_text text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require();
  ch ashes_characters;
  my record;
  msg text := public.ashes_clean_text(p_text, 200);
  recent int;
  rec ashes_chat;
begin
  select * into ch from ashes_characters where user_id = uid;
  if ch is null then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if length(msg) = 0 then raise exception 'Prázdná zpráva.'; end if;
  select * into my from public.ashes_my_oddil(uid);
  if p_channel = 'world:' || coalesce(ch.faction, 'kalidra') then
    null;
  elsif my.oddil_id is not null and p_channel = 'oddil:' || my.oddil_id then
    null;
  else
    raise exception 'Do tohoto kanálu nemůžeš psát.';
  end if;
  -- nejvýš 1 zpráva za 1,5 s a 12 za minutu
  if exists (select 1 from ashes_chat where user_id = uid and created_at > now() - interval '1.5 seconds') then
    raise exception 'Píšeš moc rychle.';
  end if;
  select count(*) into recent from ashes_chat where user_id = uid and created_at > now() - interval '1 minute';
  if recent >= 12 then raise exception 'Píšeš moc rychle – chvíli počkej.'; end if;
  insert into ashes_chat (channel, user_id, name, tag, text)
  values (p_channel, uid, ch.name, coalesce(my.tag, ''), msg)
  returning * into rec;
  return jsonb_build_object('id', rec.id, 'channel', rec.channel, 'name', rec.name, 'tag', rec.tag, 'text', rec.text, 'at', rec.created_at);
end $$;

create or replace function public.ashes_chat_recent(p_after bigint default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require();
  ch ashes_characters;
  my record;
  chans text[];
begin
  select * into ch from ashes_characters where user_id = uid;
  if ch is null then return '[]'::jsonb; end if;
  select * into my from public.ashes_my_oddil(uid);
  chans := array['world:' || coalesce(ch.faction, 'kalidra')];
  if my.oddil_id is not null then chans := chans || ('oddil:' || my.oddil_id); end if;
  return coalesce((
    select jsonb_agg(x order by x.id)
    from (
      select c.id, c.channel, c.name, c.tag, c.text, c.created_at as at, (c.user_id = uid) as mine
      from ashes_chat c
      where c.channel = any(chans) and c.id > coalesce(p_after, 0) and c.created_at > now() - interval '2 days'
      order by c.id desc
      limit 60
    ) x
  ), '[]'::jsonb);
end $$;

-- ------------------------------------------------------------------ oddíly
create or replace function public.ashes_oddil_info()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require();
  my record;
  o ashes_oddil;
begin
  select * into my from public.ashes_my_oddil(uid);
  if my.oddil_id is null then
    return jsonb_build_object('oddil', null, 'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', o2.id, 'name', o2.name, 'tag', o2.tag, 'motto', o2.motto,
        'members', (select count(*) from ashes_oddil_members m where m.oddil_id = o2.id)))
      from ashes_oddil_invites i join ashes_oddil o2 on o2.id = i.oddil_id where i.user_id = uid), '[]'::jsonb));
  end if;
  select * into o from ashes_oddil where id = my.oddil_id;
  return jsonb_build_object(
    'oddil', jsonb_build_object('id', o.id, 'name', o.name, 'tag', o.tag, 'motto', o.motto, 'faction', o.faction, 'role', my.role,
      'members', (select jsonb_agg(jsonb_build_object('user_id', m.user_id, 'name', c.name, 'class', c.class, 'level', c.level, 'role', m.role,
          'online', c.last_seen > now() - interval '5 minutes', 'me', m.user_id = uid)
        order by case m.role when 'velitel' then 0 when 'setnik' then 1 else 2 end, c.level desc)
        from ashes_oddil_members m join ashes_characters c on c.user_id = m.user_id where m.oddil_id = o.id)),
    'invites', '[]'::jsonb);
end $$;

create or replace function public.ashes_oddil_create(p_name text, p_tag text, p_motto text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require();
  ch ashes_characters;
  nm text := public.ashes_clean_text(p_name, 24);
  tg text := upper(public.ashes_clean_text(p_tag, 5));
  new_id uuid;
begin
  select * into ch from ashes_characters where user_id = uid;
  if ch is null then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  if exists (select 1 from ashes_oddil_members where user_id = uid) then raise exception 'Už jsi v oddílu.'; end if;
  if ch.level < 2 then raise exception 'Oddíl můžeš založit od 2. úrovně.'; end if;
  if ch.gold < 50 then raise exception 'Založení oddílu stojí 50 zlata.'; end if;
  if length(nm) < 3 then raise exception 'Název oddílu musí mít aspoň 3 znaky.'; end if;
  if tg !~ '^[A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ0-9]{2,5}$' then raise exception 'Zkratka má 2–5 písmen nebo číslic.'; end if;
  if exists (select 1 from ashes_oddil where lower(name) = lower(nm)) then raise exception 'Oddíl s tímto názvem už existuje.'; end if;
  if exists (select 1 from ashes_oddil where lower(tag) = lower(tg)) then raise exception 'Tato zkratka je obsazená.'; end if;
  update ashes_characters set gold = gold - 50 where user_id = uid;
  insert into ashes_oddil (name, tag, motto, faction, leader) values (nm, tg, public.ashes_clean_text(p_motto, 80), coalesce(ch.faction, 'kalidra'), uid) returning id into new_id;
  insert into ashes_oddil_members (user_id, oddil_id, role) values (uid, new_id, 'velitel');
  delete from ashes_oddil_invites where user_id = uid;
  return public.ashes_oddil_info();
end $$;

create or replace function public.ashes_oddil_invite(p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require();
  my record;
  target ashes_characters;
begin
  select * into my from public.ashes_my_oddil(uid);
  if my.oddil_id is null or my.role not in ('velitel', 'setnik') then raise exception 'Zvát mohou jen velitel a setníci.'; end if;
  select * into target from ashes_characters where lower(name) = lower(public.ashes_clean_text(p_name, 40)) limit 1;
  if target is null then raise exception 'Hráč s tímto jménem neexistuje.'; end if;
  if coalesce(target.faction, 'kalidra') <> my.faction then raise exception 'Hráč patří k jiné frakci.'; end if;
  if exists (select 1 from ashes_oddil_members where user_id = target.user_id) then raise exception 'Hráč už je v oddílu.'; end if;
  if (select count(*) from ashes_oddil_members where oddil_id = my.oddil_id) >= 50 then raise exception 'Oddíl je plný (50 členů).'; end if;
  insert into ashes_oddil_invites (oddil_id, user_id, invited_by) values (my.oddil_id, target.user_id, uid) on conflict do nothing;
  return public.ashes_oddil_info();
end $$;

create or replace function public.ashes_oddil_answer(p_oddil uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.ashes_require();
begin
  if not exists (select 1 from ashes_oddil_invites where oddil_id = p_oddil and user_id = uid) then raise exception 'Pozvánka už neplatí.'; end if;
  if p_accept then
    if exists (select 1 from ashes_oddil_members where user_id = uid) then raise exception 'Už jsi v oddílu.'; end if;
    insert into ashes_oddil_members (user_id, oddil_id, role) values (uid, p_oddil, 'clen');
    delete from ashes_oddil_invites where user_id = uid;
  else
    delete from ashes_oddil_invites where oddil_id = p_oddil and user_id = uid;
  end if;
  return public.ashes_oddil_info();
end $$;

create or replace function public.ashes_oddil_leave()
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require();
  my record;
  heir uuid;
begin
  select * into my from public.ashes_my_oddil(uid);
  if my.oddil_id is null then return public.ashes_oddil_info(); end if;
  delete from ashes_oddil_members where user_id = uid;
  if my.role = 'velitel' then
    select user_id into heir from ashes_oddil_members where oddil_id = my.oddil_id
      order by case role when 'setnik' then 0 else 1 end, joined_at limit 1;
    if heir is null then
      delete from ashes_oddil where id = my.oddil_id; -- poslední člen: oddíl zaniká
    else
      update ashes_oddil_members set role = 'velitel' where user_id = heir;
      update ashes_oddil set leader = heir where id = my.oddil_id;
    end if;
  end if;
  return public.ashes_oddil_info();
end $$;

create or replace function public.ashes_oddil_member(p_user uuid, p_action text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  uid uuid := public.ashes_require();
  my record;
  t ashes_oddil_members;
begin
  select * into my from public.ashes_my_oddil(uid);
  select * into t from ashes_oddil_members where user_id = p_user;
  if my.oddil_id is null or t is null or t.oddil_id <> my.oddil_id or p_user = uid then raise exception 'Neplatná akce.'; end if;
  if p_action = 'kick' then
    if my.role = 'clen' or (my.role = 'setnik' and t.role <> 'clen') then raise exception 'Na to nemáš hodnost.'; end if;
    delete from ashes_oddil_members where user_id = p_user;
  elsif p_action = 'promote' then
    if my.role <> 'velitel' then raise exception 'Povyšovat může jen velitel.'; end if;
    update ashes_oddil_members set role = 'setnik' where user_id = p_user;
  elsif p_action = 'demote' then
    if my.role <> 'velitel' then raise exception 'Degradovat může jen velitel.'; end if;
    update ashes_oddil_members set role = 'clen' where user_id = p_user;
  elsif p_action = 'leader' then
    if my.role <> 'velitel' then raise exception 'Velení předává jen velitel.'; end if;
    update ashes_oddil_members set role = 'velitel' where user_id = p_user;
    update ashes_oddil_members set role = 'setnik' where user_id = uid;
    update ashes_oddil set leader = p_user where id = my.oddil_id;
  else
    raise exception 'Neznámá akce.';
  end if;
  return public.ashes_oddil_info();
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'ashes_chat_send(text, text)', 'ashes_chat_recent(bigint)', 'ashes_oddil_info()', 'ashes_oddil_create(text, text, text)',
    'ashes_oddil_invite(text)', 'ashes_oddil_answer(uuid, boolean)', 'ashes_oddil_leave()', 'ashes_oddil_member(uuid, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;

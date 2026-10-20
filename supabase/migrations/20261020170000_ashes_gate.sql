-- Ashes of Eryon: brána do hry a ochrana.
-- Hrát smí jen admin, editor nebo hráč s povolením (ashes_access), dokud není svět otevřen všem.
-- Každé volání herního RPC prochází ashes_require(): kontrola přístupu + omezení počtu požadavků.
-- Realtime kanály hry jsou soukromé (jen hráči s přístupem, jen kanál vlastní strany).

create table if not exists public.ashes_access (
  user_id uuid primary key references auth.users (id) on delete cascade,
  granted_by uuid references auth.users (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.ashes_access enable row level security;
drop policy if exists ashes_access_own on public.ashes_access;
create policy ashes_access_own on public.ashes_access for select to authenticated using (user_id = auth.uid());

create or replace function public.ashes_can_play()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'editor')
    or exists (select 1 from public.ashes_access a where a.user_id = auth.uid())
    or coalesce((select open_to_all from public.ashes_world where id = 1), false)
  );
$$;

-- omezení počtu požadavků na hráče (proti botům a spamu)
create table if not exists public.ashes_rate (
  user_id uuid primary key references auth.users (id) on delete cascade,
  win_start timestamptz not null default now(),
  calls int not null default 0
);
alter table public.ashes_rate enable row level security;

create or replace function public.ashes_require()
returns uuid language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := auth.uid(); r public.ashes_rate;
begin
  if uid is null or not public.ashes_can_play() then
    raise exception 'Ashes of Eryon se připravuje.' using errcode = '42501';
  end if;
  insert into public.ashes_rate as t (user_id, win_start, calls) values (uid, now(), 1)
  on conflict (user_id) do update set
    calls = case when t.win_start < now() - interval '60 seconds' then 1 else t.calls + 1 end,
    win_start = case when t.win_start < now() - interval '60 seconds' then now() else t.win_start end
  returning * into r;
  if r.calls > 150 then
    raise exception 'Příliš mnoho požadavků. Zpomal a zkus to za chvíli.' using errcode = '54000';
  end if;
  return uid;
end;
$$;
alter function public.ashes_arena_opponents() volatile;
alter function public.ashes_hall_of_fame() volatile;
alter function public.ashes_characters_list() volatile;

-- výzva Eryona / Azkara: bez odkazů (ochrana proti podvodným odkazům)
create or replace function public.ashes_hero_say(p_text text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); ch public.ashes_characters; msg text := btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]', ' ', 'g'));
begin
  select * into ch from public.ashes_characters where user_id = uid;
  if not (coalesce(ch.is_eryon, false) or coalesce(ch.is_azkar, false)) then raise exception 'Promlouvat může jen Eryon nebo Azkar.'; end if;
  if length(msg) < 2 or length(msg) > 240 then raise exception 'Zpráva musí mít 2–240 znaků.'; end if;
  if msg ~* '(https?://|www\.|discord\.(gg|com)|t\.me/|[a-z0-9-]+\.(com|cz|sk|net|org|gg|io|ru|xyz|app|link|ly|me)\b)' then
    raise exception 'Odkazy do výzvy nepatří.';
  end if;
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

-- správa přístupu (jen admin)
create or replace function public.ashes_admin_access_list()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.ashes_is_admin() then raise exception 'Jen pro správce.'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('user_id', a.user_id, 'email', u.email,
      'name', coalesce(p.display_name, p.username), 'note', a.note, 'created_at', a.created_at) order by a.created_at desc)
    from public.ashes_access a join auth.users u on u.id = a.user_id
    left join public.profiles p on p.user_id = a.user_id), '[]'::jsonb);
end;
$$;

create or replace function public.ashes_admin_access_grant(p_who text, p_note text default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare q text := lower(btrim(coalesce(p_who, ''))); target uuid; n int;
begin
  if not public.ashes_is_admin() then raise exception 'Jen pro správce.'; end if;
  if length(q) < 2 then raise exception 'Zadej e-mail nebo přezdívku.'; end if;
  select u.id into target from auth.users u where lower(u.email) = q;
  if target is null then
    select count(*) into n from public.profiles p where lower(p.username) = q or lower(p.display_name) = q;
    if n > 1 then raise exception 'Přezdívku má víc lidí – zadej e-mail.'; end if;
    select p.user_id into target from public.profiles p where lower(p.username) = q or lower(p.display_name) = q;
  end if;
  if target is null then raise exception 'Uživatel nenalezen.'; end if;
  insert into public.ashes_access (user_id, granted_by, note) values (target, auth.uid(), nullif(btrim(coalesce(p_note, '')), ''))
  on conflict (user_id) do update set note = coalesce(excluded.note, public.ashes_access.note);
  return public.ashes_admin_access_list();
end;
$$;

create or replace function public.ashes_admin_access_revoke(p_user uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.ashes_is_admin() then raise exception 'Jen pro správce.'; end if;
  delete from public.ashes_access where user_id = p_user;
  return public.ashes_admin_access_list();
end;
$$;

grant execute on function public.ashes_admin_access_list() to authenticated;
grant execute on function public.ashes_admin_access_grant(text, text) to authenticated;
grant execute on function public.ashes_admin_access_revoke(uuid) to authenticated;
revoke all on function public.ashes_admin_access_list() from anon;
revoke all on function public.ashes_admin_access_grant(text, text) from anon;
revoke all on function public.ashes_admin_access_revoke(uuid) from anon;

-- soukromé realtime kanály hry: jen hráči s přístupem a jen kanál vlastní strany
drop policy if exists ashes_rt_read on realtime.messages;
drop policy if exists ashes_rt_write on realtime.messages;
create policy ashes_rt_read on realtime.messages for select to authenticated using (
  realtime.topic() like 'ashes:%' and public.ashes_can_play()
  and realtime.topic() = 'ashes:world:' || coalesce((select c.faction from public.ashes_characters c where c.user_id = auth.uid()), 'kalidra')
);
create policy ashes_rt_write on realtime.messages for insert to authenticated with check (
  realtime.topic() like 'ashes:%' and public.ashes_can_play()
  and realtime.topic() = 'ashes:world:' || coalesce((select c.faction from public.ashes_characters c where c.user_id = auth.uid()), 'kalidra')
);

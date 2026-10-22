-- Běh na stadionu: časovka kolem otočných sloupů (mét) na pláni. Čas měří server
-- (start → cíl), odměna nejvýš 3× denně, osobní rekord a tabulka nejrychlejších.
create table if not exists public.ashes_races (
  user_id uuid primary key references auth.users(id) on delete cascade,
  started_at timestamptz,
  best_ms int,
  day date,
  runs_today int not null default 0
);
alter table public.ashes_races enable row level security;
-- přístup jen přes funkce níže

create or replace function public.ashes_race_top()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(t order by t.best_ms), '[]'::jsonb) from (
    select public.ashes_display_name(c) as name, c.faction, r.best_ms
    from ashes_races r join ashes_characters c on c.user_id = r.user_id
    where r.best_ms is not null order by r.best_ms limit 5) t;
$$;

create or replace function public.ashes_race_start()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); r ashes_races;
begin
  if not exists (select 1 from ashes_characters where user_id = uid) then raise exception 'Nejdřív si vytvoř postavu.'; end if;
  insert into ashes_races (user_id, started_at) values (uid, now())
    on conflict (user_id) do update set started_at = now();
  select * into r from ashes_races where user_id = uid;
  return jsonb_build_object('best_ms', r.best_ms,
    'runs_left', greatest(0, 3 - case when r.day = current_date then r.runs_today else 0 end),
    'top', public.ashes_race_top());
end $$;

create or replace function public.ashes_race_finish()
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public.ashes_require(); r ashes_races; ch ashes_characters; ms int; record boolean := false;
  runs int; gold int := 0; xp int := 0; ups int := 0;
begin
  select * into r from ashes_races where user_id = uid for update;
  if not found or r.started_at is null then raise exception 'Závod neběží – začni u startovního sloupu.'; end if;
  ms := (extract(epoch from (now() - r.started_at)) * 1000)::int;
  update ashes_races set started_at = null where user_id = uid;
  if ms < 15000 then raise exception 'Tak rychle nedoběhne ani Hermés – závod se nepočítá.'; end if;
  if ms > 300000 then raise exception 'Závod trval příliš dlouho – zkus to znovu.'; end if;
  select * into ch from ashes_characters where user_id = uid for update;
  runs := case when r.day = current_date then r.runs_today else 0 end;
  record := r.best_ms is null or ms < r.best_ms;
  if runs < 3 then
    gold := 10 + ch.level * 4;
    xp := greatest(1, round(public.ashes_xp_need(ch.level) * 0.05));
    if record then gold := round(gold * 1.5); xp := round(xp * 1.5); end if;
    ups := public.ashes_grant(uid, xp, gold);
  end if;
  update ashes_races set day = current_date, runs_today = runs + 1,
    best_ms = case when record then ms else best_ms end where user_id = uid;
  if record and ms = (select min(best_ms) from ashes_races) then
    perform public.ashes_log('race', format('%s zaběhl nejrychlejší kolo stadionu: %s s.', public.ashes_display_name(ch), round(ms / 1000.0, 1)));
  end if;
  return jsonb_build_object('ms', ms, 'record', record, 'best_ms', least(coalesce(r.best_ms, ms), ms),
    'gold', gold, 'xp', xp, 'levels', ups, 'runs_left', greatest(0, 3 - runs - 1),
    'top', public.ashes_race_top(), 'state', public.ashes_state());
end $$;

revoke all on function public.ashes_race_start(), public.ashes_race_finish(), public.ashes_race_top() from public, anon;
grant execute on function public.ashes_race_start(), public.ashes_race_finish() to authenticated;

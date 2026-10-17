-- StudioVoxario web registration anti-abuse guard
-- Server-side protection for disposable email signups and coordinated registration bursts.
-- High-confidence abusive accounts are banned immediately and disposable-mail accounts
-- are queued for delayed deletion. Security actions are reported to site admins through
-- the existing direct-message system by a non-login Voxario Security system actor.

create table if not exists public.security_blocked_email_domains (
  domain text primary key,
  reason text not null default 'Disposable or temporary email provider',
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.security_blocked_email_domains enable row level security;

drop policy if exists "Admins can read blocked email domains" on public.security_blocked_email_domains;
create policy "Admins can read blocked email domains"
  on public.security_blocked_email_domains
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

insert into public.security_blocked_email_domains(domain, reason) values
  ('guerrillamail.com', 'Disposable email provider'),
  ('guerrillamailblock.com', 'Disposable email provider'),
  ('sharklasers.com', 'Disposable email provider'),
  ('grr.la', 'Disposable email provider'),
  ('mailinator.com', 'Disposable email provider'),
  ('tempmail.com', 'Disposable email provider'),
  ('10minutemail.com', 'Disposable email provider'),
  ('yopmail.com', 'Disposable email provider'),
  ('maildrop.cc', 'Disposable email provider'),
  ('discard.email', 'Disposable email provider'),
  ('fakeinbox.com', 'Disposable email provider'),
  ('getnada.com', 'Disposable email provider')
on conflict (domain) do update
set reason = excluded.reason, enabled = true;

create table if not exists public.abuse_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  source text not null default 'registration',
  risk_score integer not null check (risk_score between 0 and 200),
  severity text not null check (severity in ('low','medium','high','critical')),
  reasons jsonb not null default '[]'::jsonb,
  action text not null,
  subject_snapshot jsonb not null default '{}'::jsonb,
  delete_after timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists abuse_events_user_idx on public.abuse_events(user_id, created_at desc);
create index if not exists abuse_events_delete_idx on public.abuse_events(delete_after) where delete_after is not null;

alter table public.abuse_events enable row level security;

drop policy if exists "Admins can read abuse events" on public.abuse_events;
create policy "Admins can read abuse events"
  on public.abuse_events
  for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

create or replace function public.security_html_escape(_value text)
returns text
language sql
immutable
set search_path = public
as $$
  select replace(replace(replace(replace(replace(coalesce(_value, ''), '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;');
$$;

-- Create a system DM actor that cannot log in. Existing auth trigger creates its profile.
do $$
declare
  _security_id uuid;
begin
  select id into _security_id
  from auth.users
  where lower(email) = 'security@studiovoxario.invalid'
  limit 1;

  if _security_id is null then
    _security_id := gen_random_uuid();
    insert into auth.users (
      id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      is_sso_user, is_anonymous, banned_until
    ) values (
      _security_id,
      'authenticated',
      'authenticated',
      'security@studiovoxario.invalid',
      null,
      now(),
      '{"provider":"system","providers":["system"],"system_actor":true}'::jsonb,
      '{"display_name":"Voxario Security","username":"voxario-security"}'::jsonb,
      now(), now(), false, false, '2099-12-31 23:59:59+00'
    );
  end if;

  update public.profiles
  set display_name = 'Voxario Security',
      username = 'voxario-security',
      bio = 'Automatická bezpečnostní služba StudioVoxario.',
      updated_at = now()
  where user_id = _security_id;
end $$;

create or replace function public.security_system_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select id
  from auth.users
  where lower(email) = 'security@studiovoxario.invalid'
  limit 1;
$$;

revoke all on function public.security_system_user_id() from public;

create or replace function public.security_send_admin_dm(_content text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _system_id uuid := public.security_system_user_id();
  _admin_id uuid;
  _a uuid;
  _b uuid;
  _conversation_id uuid;
begin
  if _system_id is null then
    return;
  end if;

  for _admin_id in
    select distinct ur.user_id
    from public.user_roles ur
    where ur.role::text = 'admin'
      and ur.user_id <> _system_id
  loop
    _a := least(_system_id, _admin_id);
    _b := greatest(_system_id, _admin_id);

    insert into public.conversations(user_a, user_b, created_at, updated_at)
    values (_a, _b, now(), now())
    on conflict (user_a, user_b)
    do update set updated_at = excluded.updated_at
    returning id into _conversation_id;

    insert into public.messages(conversation_id, sender_id, content, created_at)
    values (_conversation_id, _system_id, _content, now());
  end loop;
end;
$$;

revoke all on function public.security_send_admin_dm(text) from public;

create or replace function public.security_evaluate_user(_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _u auth.users%rowtype;
  _domain text;
  _local text;
  _display text;
  _username text;
  _masked_email text;
  _score integer := 0;
  _same_domain integer := 0;
  _recent_total integer := 0;
  _same_local integer := 0;
  _same_display integer := 0;
  _is_disposable boolean := false;
  _severity text := 'low';
  _action text := 'allow';
  _delete_after timestamptz := null;
  _reasons text[] := array[]::text[];
  _event_id uuid;
  _profile record;
begin
  select * into _u from auth.users where id = _user_id;
  if not found then return 0; end if;

  if coalesce((_u.raw_app_meta_data->>'system_actor')::boolean, false)
     or lower(coalesce(_u.email, '')) = 'security@studiovoxario.invalid' then
    return 0;
  end if;

  if exists (
    select 1 from public.abuse_events
    where user_id = _user_id and source = 'registration'
  ) then
    select risk_score into _score
    from public.abuse_events
    where user_id = _user_id and source = 'registration'
    order by created_at desc limit 1;
    return coalesce(_score, 0);
  end if;

  _domain := lower(split_part(coalesce(_u.email, ''), '@', 2));
  _local := lower(split_part(coalesce(_u.email, ''), '@', 1));
  _display := lower(btrim(coalesce(_u.raw_user_meta_data->>'display_name', _u.raw_user_meta_data->>'full_name', '')));

  select p.username, p.display_name into _profile
  from public.profiles p where p.user_id = _user_id limit 1;
  _username := coalesce(_profile.username, _u.raw_user_meta_data->>'username', _local, 'unknown');

  if length(_local) > 2 then
    _masked_email := left(_local, 2) || '***@' || _domain;
  else
    _masked_email := '***@' || _domain;
  end if;

  select exists(
    select 1 from public.security_blocked_email_domains d
    where d.domain = _domain and d.enabled
  ) into _is_disposable;

  if _is_disposable then
    _score := _score + 100;
    _reasons := array_append(_reasons, 'Disposable/temporary email domain: ' || _domain);
  end if;

  select count(*) into _same_domain
  from auth.users u
  where u.id <> _user_id
    and u.created_at >= coalesce(_u.created_at, now()) - interval '10 minutes'
    and u.created_at <= coalesce(_u.created_at, now()) + interval '1 minute'
    and lower(split_part(coalesce(u.email, ''), '@', 2)) = _domain
    and coalesce((u.raw_app_meta_data->>'system_actor')::boolean, false) = false;

  if _same_domain >= 4 then
    _score := _score + 35;
    _reasons := array_append(_reasons, 'Registration burst: ' || (_same_domain + 1)::text || ' accounts from the same email domain in ~10 minutes');
  end if;

  select count(*) into _recent_total
  from auth.users u
  where u.id <> _user_id
    and u.created_at >= coalesce(_u.created_at, now()) - interval '10 minutes'
    and u.created_at <= coalesce(_u.created_at, now()) + interval '1 minute'
    and coalesce((u.raw_app_meta_data->>'system_actor')::boolean, false) = false;

  if _recent_total >= 9 then
    _score := _score + 20;
    _reasons := array_append(_reasons, 'Unusually high registration rate: ' || (_recent_total + 1)::text || ' accounts in ~10 minutes');
  end if;

  if _local <> '' then
    select count(*) into _same_local
    from auth.users u
    where u.id <> _user_id
      and u.created_at >= coalesce(_u.created_at, now()) - interval '24 hours'
      and lower(split_part(coalesce(u.email, ''), '@', 1)) = _local;
    if _same_local >= 2 then
      _score := _score + 25;
      _reasons := array_append(_reasons, 'Repeated email local-part across multiple accounts');
    end if;
  end if;

  if _display <> '' then
    select count(*) into _same_display
    from public.profiles p
    where p.user_id <> _user_id
      and p.created_at >= coalesce(_u.created_at, now()) - interval '24 hours'
      and lower(btrim(coalesce(p.display_name, ''))) = _display;
    if _same_display >= 2 then
      _score := _score + 20;
      _reasons := array_append(_reasons, 'Repeated display name across recent accounts');
    end if;
  end if;

  if _score >= 100 then
    _severity := 'critical';
  elsif _score >= 80 then
    _severity := 'high';
  elsif _score >= 50 then
    _severity := 'medium';
  else
    _severity := 'low';
  end if;

  if _score < 50 then
    return _score;
  end if;

  if _score >= 80 then
    if _is_disposable then
      _action := 'banned_pending_delete';
      _delete_after := now() + interval '24 hours';
    else
      _action := 'banned_review';
    end if;

    update auth.users
    set banned_until = '2099-12-31 23:59:59+00', updated_at = now()
    where id = _user_id;

    insert into public.user_restrictions(
      user_id, can_post_forum, can_comment, can_message, can_upload,
      muted_until, banned_until, reason, created_at, updated_at, updated_by
    ) values (
      _user_id, false, false, false, false,
      '2099-12-31 23:59:59+00', '2099-12-31 23:59:59+00',
      'Voxario Security anti-abuse score ' || _score::text,
      now(), now(), null
    )
    on conflict (user_id) do update set
      can_post_forum = false,
      can_comment = false,
      can_message = false,
      can_upload = false,
      muted_until = excluded.muted_until,
      banned_until = excluded.banned_until,
      reason = excluded.reason,
      updated_at = now();

    insert into public.user_roles(user_id, role)
    values (_user_id, 'banned')
    on conflict (user_id, role) do nothing;
  else
    _action := 'review';
  end if;

  insert into public.abuse_events(
    user_id, source, risk_score, severity, reasons, action, subject_snapshot, delete_after
  ) values (
    _user_id,
    'registration',
    least(_score, 200),
    _severity,
    to_jsonb(_reasons),
    _action,
    jsonb_build_object(
      'user_id', _user_id,
      'username', _username,
      'display_name', coalesce(_profile.display_name, _u.raw_user_meta_data->>'display_name', ''),
      'email_masked', _masked_email,
      'email_domain', _domain,
      'created_at', _u.created_at
    ),
    _delete_after
  ) returning id into _event_id;

  insert into public.moderation_log(user_id, source, action, reason, original, result, created_at)
  values (
    _user_id,
    'registration_abuse',
    case when _score >= 80 then 'blocked' else 'flagged' end,
    array_to_string(_reasons, '; '),
    jsonb_build_object('username', _username, 'email', _masked_email, 'score', _score)::text,
    jsonb_build_object('severity', _severity, 'action', _action, 'delete_after', _delete_after)::text,
    now()
  );

  perform public.security_send_admin_dm(
    '<p><strong>Voxario Security — registrace vyhodnocena jako ' || upper(public.security_html_escape(_severity)) || '</strong></p>' ||
    '<p><strong>Uživatel:</strong> ' || public.security_html_escape(coalesce(_profile.display_name, _username, 'Neznámý')) ||
    ' (@' || public.security_html_escape(_username) || ')</p>' ||
    '<p><strong>User ID:</strong> ' || _user_id::text || '<br>' ||
    '<strong>E-mail:</strong> ' || public.security_html_escape(_masked_email) || '<br>' ||
    '<strong>Rizikové skóre:</strong> ' || _score::text || '/200<br>' ||
    '<strong>Akce:</strong> ' || public.security_html_escape(_action) || '</p>' ||
    '<p><strong>Důvody:</strong> ' || public.security_html_escape(array_to_string(_reasons, ' • ')) || '</p>' ||
    case when _delete_after is not null
      then '<p>Účet je okamžitě zablokovaný a bude automaticky odstraněn po 24hodinové bezpečnostní karanténě, pokud ban mezitím ručně nezrušíš.</p>'
      else '<p>Událost byla zaznamenána pro kontrolu. Automatické smazání není naplánované.</p>' end
  );

  return _score;
end;
$$;

revoke all on function public.security_evaluate_user(uuid) from public;

create or replace function public.security_on_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.security_evaluate_user(new.id);
  return new;
end;
$$;

drop trigger if exists zz_security_evaluate_new_user on auth.users;
create trigger zz_security_evaluate_new_user
after insert on auth.users
for each row execute function public.security_on_auth_user_created();

create or replace function public.security_purge_abusive_users()
returns integer
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _event record;
  _deleted integer := 0;
begin
  for _event in
    select e.id, e.user_id, e.subject_snapshot
    from public.abuse_events e
    where e.action = 'banned_pending_delete'
      and e.delete_after is not null
      and e.delete_after <= now()
      and e.user_id is not null
  loop
    -- Never auto-delete privileged accounts and respect a manual unban.
    if exists (
      select 1 from public.user_roles ur
      where ur.user_id = _event.user_id and ur.role::text in ('admin','editor')
    ) then
      update public.abuse_events set action = 'protected_account' where id = _event.id;
      continue;
    end if;

    if not exists (
      select 1 from public.user_roles ur
      where ur.user_id = _event.user_id and ur.role::text = 'banned'
    ) or not exists (
      select 1 from public.user_restrictions r
      where r.user_id = _event.user_id and r.banned_until > now()
    ) then
      update public.abuse_events set action = 'manual_review_kept' where id = _event.id;
      continue;
    end if;

    perform public.security_send_admin_dm(
      '<p><strong>Voxario Security — účet automaticky odstraněn</strong></p>' ||
      '<p>Po 24hodinové karanténě byl smazán účet označený jako vysoce pravděpodobný registrační spam.</p>' ||
      '<p><strong>Snapshot:</strong> ' || public.security_html_escape(_event.subject_snapshot::text) || '</p>'
    );

    update public.abuse_events
    set action = 'deleted', deleted_at = now(), delete_after = null
    where id = _event.id;

    delete from auth.users where id = _event.user_id;
    _deleted := _deleted + 1;
  end loop;

  return _deleted;
end;
$$;

revoke all on function public.security_purge_abusive_users() from public;

-- Run cleanup hourly. Recreate the named job idempotently.
do $$
declare
  _jobid bigint;
begin
  select jobid into _jobid from cron.job where jobname = 'voxario-security-purge' limit 1;
  if _jobid is not null then
    perform cron.unschedule(_jobid);
  end if;
  perform cron.schedule('voxario-security-purge', '17 * * * *', 'select public.security_purge_abusive_users();');
end $$;

-- Backfill only recent, high-confidence disposable-email registrations so current spam
-- is contained without touching older users or accounts based on weak heuristics.
do $$
declare
  _id uuid;
begin
  for _id in
    select u.id
    from auth.users u
    join public.security_blocked_email_domains d
      on d.domain = lower(split_part(coalesce(u.email, ''), '@', 2)) and d.enabled
    where u.created_at >= now() - interval '48 hours'
      and lower(coalesce(u.email, '')) <> 'security@studiovoxario.invalid'
  loop
    perform public.security_evaluate_user(_id);
  end loop;
end $$;

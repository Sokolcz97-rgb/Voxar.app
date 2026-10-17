-- StudioVoxario registration firewall hardening.
-- Prevents known disposable/temporary email registrations before the auth user is created,
-- including rotating subdomains, and adds conservative burst rate limits.

insert into public.security_blocked_email_domains(domain, reason) values
  ('harakirimail.com', 'Disposable email provider observed in abusive registrations'),
  ('temp-mail.org', 'Disposable email provider observed in abusive registrations'),
  ('imagesthere.com', 'Disposable email infrastructure with rotating subdomains'),
  ('prominentghost.com', 'Disposable email infrastructure with rotating subdomains')
on conflict (domain) do update
set reason = excluded.reason, enabled = true;

create or replace function public.security_registration_firewall()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  _domain text;
  _same_domain integer := 0;
  _recent_total integer := 0;
begin
  -- Internal security actor is never treated as a public signup.
  if coalesce((new.raw_app_meta_data->>'system_actor')::boolean, false)
     or lower(coalesce(new.email, '')) = 'security@studiovoxario.invalid' then
    return new;
  end if;

  _domain := lower(split_part(coalesce(new.email, ''), '@', 2));
  if _domain = '' then
    return new;
  end if;

  -- Match both an exact blocked domain and any rotating subdomain of a blocked root.
  if exists (
    select 1
    from public.security_blocked_email_domains d
    where d.enabled
      and (_domain = d.domain or _domain like '%.' || d.domain)
  ) then
    raise exception 'Registration rejected by anti-abuse policy'
      using errcode = 'P0001';
  end if;

  -- Conservative same-domain burst protection. Normal isolated signups are unaffected.
  select count(*) into _same_domain
  from auth.users u
  where u.created_at >= now() - interval '10 minutes'
    and lower(split_part(coalesce(u.email, ''), '@', 2)) = _domain
    and lower(coalesce(u.email, '')) <> 'security@studiovoxario.invalid'
    and coalesce((u.raw_app_meta_data->>'system_actor')::boolean, false) = false;

  if _same_domain >= 7 then
    raise exception 'Registration temporarily rate limited'
      using errcode = 'P0001';
  end if;

  -- High emergency threshold to stop a registration flood without affecting ordinary traffic.
  select count(*) into _recent_total
  from auth.users u
  where u.created_at >= now() - interval '10 minutes'
    and lower(coalesce(u.email, '')) <> 'security@studiovoxario.invalid'
    and coalesce((u.raw_app_meta_data->>'system_actor')::boolean, false) = false;

  if _recent_total >= 30 then
    raise exception 'Registration temporarily rate limited'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

revoke all on function public.security_registration_firewall() from public;

drop trigger if exists aa_security_registration_firewall on auth.users;
create trigger aa_security_registration_firewall
before insert on auth.users
for each row execute function public.security_registration_firewall();

comment on function public.security_registration_firewall() is
  'Server-side signup firewall: rejects blocked disposable domains/subdomains and conservative registration bursts before account creation.';

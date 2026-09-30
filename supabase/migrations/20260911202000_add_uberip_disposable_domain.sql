insert into public.security_blocked_email_domains(domain, reason)
values ('uberip.com', 'Disposable email provider (mail.tm infrastructure)')
on conflict (domain) do update set reason = excluded.reason, enabled = true;

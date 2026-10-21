-- Hlášení pádů Unity verze: hra po dalším spuštění pošle konec logu z minulého běhu.
create table if not exists public.ashes_crash_reports (
  id bigserial primary key,
  user_id uuid not null default auth.uid(),
  version text,
  gpu text,
  log text,
  created_at timestamptz not null default now()
);
alter table public.ashes_crash_reports enable row level security;
revoke all on public.ashes_crash_reports from anon, authenticated;

create or replace function public.ashes_report_crash(p_version text, p_gpu text, p_log text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return false; end if;
  -- nejvýš 10 hlášení za den na hráče
  if (select count(*) from ashes_crash_reports where user_id = auth.uid() and created_at > now() - interval '1 day') >= 10 then
    return false;
  end if;
  insert into ashes_crash_reports (user_id, version, gpu, log)
  values (auth.uid(), left(coalesce(p_version, ''), 40), left(coalesce(p_gpu, ''), 200), left(coalesce(p_log, ''), 30000));
  return true;
end $$;
revoke all on function public.ashes_report_crash(text, text, text) from public, anon;
grant execute on function public.ashes_report_crash(text, text, text) to authenticated;

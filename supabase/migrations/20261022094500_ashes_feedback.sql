-- Hlášení chyb a zpětná vazba přímo ze hry (F1) pro uzavřený test.
create table if not exists public.ashes_feedback (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  character_name text,
  kind text not null default 'bug' check (kind in ('bug', 'idea', 'other')),
  text text not null,
  context jsonb not null default '{}'::jsonb,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.ashes_feedback enable row level security;
drop policy if exists ashes_feedback_staff on public.ashes_feedback;
create policy ashes_feedback_staff on public.ashes_feedback for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'editor'::app_role));

create or replace function public.ashes_feedback_send(p_kind text, p_text text, p_context jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); nm text; t text := btrim(coalesce(p_text, '')); admin_id uuid;
begin
  if uid is null then raise exception 'Přihlas se.'; end if;
  if char_length(t) < 5 then raise exception 'Napiš prosím aspoň pár slov.'; end if;
  if (select count(*) from ashes_feedback where user_id = uid and created_at > now() - interval '10 minutes') >= 10 then
    raise exception 'Díky! Teď toho bylo hodně najednou – zkus to za chvíli.';
  end if;
  select name into nm from ashes_characters where user_id = uid;
  insert into ashes_feedback (user_id, character_name, kind, text, context)
  values (uid, nm, case when p_kind in ('bug', 'idea', 'other') then p_kind else 'other' end, left(t, 4000),
          coalesce(p_context, '{}'::jsonb) - 'token');
  for admin_id in select distinct ur.user_id from user_roles ur where ur.role::text = 'admin' loop
    insert into vox_notifications (user_id, type, title, body, data)
    values (admin_id, 'ashes_feedback', case when p_kind = 'idea' then 'Ashes: nový nápad' else 'Ashes: hlášení chyby' end,
            coalesce(nm, 'Hráč') || ': ' || left(t, 200), jsonb_build_object('url', '/admin/games'));
  end loop;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.ashes_feedback_send(text, text, jsonb) from public, anon;
grant execute on function public.ashes_feedback_send(text, text, jsonb) to authenticated;

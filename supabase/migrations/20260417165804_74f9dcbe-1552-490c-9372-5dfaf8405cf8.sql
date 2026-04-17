create type public.ticket_status as enum ('open','in_progress','resolved','closed');
create type public.ticket_priority as enum ('low','medium','high','urgent');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  description text not null,
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'medium',
  category text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_tickets_user on public.tickets(user_id, created_at desc);
create index idx_tickets_status on public.tickets(status);
create index idx_tickets_assigned on public.tickets(assigned_to);

alter table public.tickets enable row level security;

create policy "Users view own tickets, staff view all"
  on public.tickets for select
  using (
    auth.uid() = user_id
    or public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'editor')
  );

create policy "Authenticated users create own tickets"
  on public.tickets for insert
  with check (auth.uid() = user_id);

create policy "Owner edits subject/desc, staff edits everything"
  on public.tickets for update
  using (
    auth.uid() = user_id
    or public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'editor')
  );

create policy "Admins delete tickets"
  on public.tickets for delete
  using (public.has_role(auth.uid(),'admin'));

create trigger update_tickets_updated_at
  before update on public.tickets
  for each row execute function public.update_updated_at_column();

-- Replies
create table public.ticket_replies (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.tickets(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  is_internal boolean not null default false,
  created_at timestamptz not null default now()
);

create index idx_treplies_ticket on public.ticket_replies(ticket_id, created_at);

alter table public.ticket_replies enable row level security;

-- Owner sees non-internal replies of own tickets, staff sees all
create policy "View ticket replies"
  on public.ticket_replies for select
  using (
    (
      not is_internal
      and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
    )
    or public.has_role(auth.uid(),'admin')
    or public.has_role(auth.uid(),'editor')
  );

-- Owner can reply (non-internal). Staff can reply with anything.
create policy "Insert ticket replies"
  on public.ticket_replies for insert
  with check (
    auth.uid() = user_id
    and (
      (
        is_internal = false
        and exists (select 1 from public.tickets t where t.id = ticket_id and t.user_id = auth.uid())
      )
      or public.has_role(auth.uid(),'admin')
      or public.has_role(auth.uid(),'editor')
    )
  );

create policy "Author updates own reply"
  on public.ticket_replies for update
  using (auth.uid() = user_id);

create policy "Admin deletes replies"
  on public.ticket_replies for delete
  using (public.has_role(auth.uid(),'admin'));

-- Bump ticket updated_at on new reply
create or replace function public.bump_ticket_on_reply()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.tickets set updated_at = now() where id = new.ticket_id;
  return new;
end;
$$;

create trigger on_reply_bump_ticket
  after insert on public.ticket_replies
  for each row execute function public.bump_ticket_on_reply();

-- Realtime
alter publication supabase_realtime add table public.ticket_replies;
alter publication supabase_realtime add table public.tickets;
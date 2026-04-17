-- Conversations: store with user_a < user_b for uniqueness
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversations_user_order check (user_a < user_b),
  unique (user_a, user_b)
);

create index idx_conv_user_a on public.conversations(user_a);
create index idx_conv_user_b on public.conversations(user_b);

alter table public.conversations enable row level security;

create policy "Participants view conversation"
  on public.conversations for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "Participants create conversation"
  on public.conversations for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

create trigger update_conv_updated_at
  before update on public.conversations
  for each row execute function public.update_updated_at_column();

-- Messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_conv on public.messages(conversation_id, created_at);

alter table public.messages enable row level security;

create policy "Participants view messages"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (c.user_a = auth.uid() or c.user_b = auth.uid())
  ));

create policy "Participants insert messages"
  on public.messages for insert
  with check (
    auth.uid() = sender_id
    and exists (
      select 1 from public.conversations c
      where c.id = conversation_id
        and (c.user_a = auth.uid() or c.user_b = auth.uid())
    )
  );

create policy "Sender can update own message"
  on public.messages for update
  using (auth.uid() = sender_id);

-- Helper to get or create conversation between two users
create or replace function public.get_or_create_conversation(_other_user uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  _me uuid := auth.uid();
  _a uuid;
  _b uuid;
  _id uuid;
begin
  if _me is null then
    raise exception 'Not authenticated';
  end if;
  if _other_user = _me then
    raise exception 'Cannot DM yourself';
  end if;

  if _me < _other_user then
    _a := _me; _b := _other_user;
  else
    _a := _other_user; _b := _me;
  end if;

  select id into _id from public.conversations where user_a = _a and user_b = _b;
  if _id is null then
    insert into public.conversations (user_a, user_b) values (_a, _b) returning id into _id;
  end if;
  return _id;
end;
$$;

-- Bump conversation updated_at when message inserted
create or replace function public.bump_conversation_on_message()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update public.conversations set updated_at = now() where id = new.conversation_id;
  return new;
end;
$$;

create trigger on_message_bump_conv
  after insert on public.messages
  for each row execute function public.bump_conversation_on_message();

-- Enable realtime on messages
alter publication supabase_realtime add table public.messages;
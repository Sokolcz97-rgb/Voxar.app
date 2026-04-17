-- Categories
create table public.forum_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  position int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.forum_categories enable row level security;

create policy "Categories viewable by everyone"
  on public.forum_categories for select using (true);
create policy "Editors can insert categories"
  on public.forum_categories for insert
  with check (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create policy "Editors can update categories"
  on public.forum_categories for update
  using (public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create policy "Admins can delete categories"
  on public.forum_categories for delete
  using (public.has_role(auth.uid(),'admin'));

-- Threads
create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.forum_categories(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text not null,
  is_pinned boolean not null default false,
  is_locked boolean not null default false,
  views int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_threads_category on public.forum_threads(category_id);
create index idx_threads_created on public.forum_threads(created_at desc);

alter table public.forum_threads enable row level security;

create policy "Threads viewable by everyone"
  on public.forum_threads for select using (true);
create policy "Authenticated users create threads"
  on public.forum_threads for insert
  with check (auth.uid() = user_id);
create policy "Owner or moderator update threads"
  on public.forum_threads for update
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create policy "Owner or admin delete threads"
  on public.forum_threads for delete
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create trigger update_threads_updated_at
  before update on public.forum_threads
  for each row execute function public.update_updated_at_column();

-- Posts
create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_posts_thread on public.forum_posts(thread_id, created_at);

alter table public.forum_posts enable row level security;

create policy "Posts viewable by everyone"
  on public.forum_posts for select using (true);
create policy "Authenticated users create posts"
  on public.forum_posts for insert
  with check (auth.uid() = user_id);
create policy "Owner or moderator update posts"
  on public.forum_posts for update
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin') or public.has_role(auth.uid(),'editor'));
create policy "Owner or admin delete posts"
  on public.forum_posts for delete
  using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));

create trigger update_posts_updated_at
  before update on public.forum_posts
  for each row execute function public.update_updated_at_column();

-- Seed default categories
insert into public.forum_categories (name, slug, description, position) values
  ('Obecné', 'obecne', 'Obecná diskuze o čemkoliv herním', 1),
  ('Hry & Recenze', 'hry-recenze', 'Sdílej dojmy z her, recenze a tipy', 2),
  ('Streamy & Videa', 'streamy', 'Promo svého obsahu, sledovaná videa', 3),
  ('Off-topic', 'off-topic', 'Cokoliv mimo herní svět', 4);
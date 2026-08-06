-- PhotoWall Social migration (Phase 2 enhancement)
-- Run AFTER auth-migration.sql

-- Profiles (extends auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  friend_code text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_friend_code_idx on profiles (friend_code);

-- Friendships (symmetric pair: user_a < user_b)
create table if not exists friendships (
  id uuid primary key default gen_random_uuid(),
  user_a uuid not null references auth.users(id) on delete cascade,
  user_b uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index if not exists friendships_user_a_idx on friendships (user_a);
create index if not exists friendships_user_b_idx on friendships (user_b);

-- Link social actions to auth users
alter table wall_likes add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table wall_comments add column if not exists user_id uuid references auth.users(id) on delete set null;
alter table wall_guestbook add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists wall_likes_user_id_idx on wall_likes (user_id);
create index if not exists wall_comments_user_id_idx on wall_comments (user_id);

-- RLS
alter table profiles enable row level security;
alter table friendships enable row level security;

create policy "profiles_select_public" on profiles for select using (true);
create policy "profiles_insert_own" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

create policy "friendships_select_own"
  on friendships for select
  using (auth.uid() = user_a or auth.uid() = user_b);

create policy "friendships_insert_own"
  on friendships for insert
  with check (auth.uid() = user_a or auth.uid() = user_b);

create policy "friendships_delete_own"
  on friendships for delete
  using (auth.uid() = user_a or auth.uid() = user_b);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  code text;
begin
  code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  insert into public.profiles (id, display_name, avatar_url, friend_code)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    code
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

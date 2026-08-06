-- PhotoWall Supabase schema
-- Run in Supabase SQL Editor

create table if not exists walls (
  id uuid primary key default gen_random_uuid(),
  theme_id text not null default 'white',
  canvas_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table walls enable row level security;

-- Anyone can read public walls
create policy "walls_select_public"
  on walls for select
  using (true);

-- Anyone can insert (MVP — tighten with auth later)
create policy "walls_insert_public"
  on walls for insert
  with check (true);

-- Anyone can update (MVP — tighten with auth later)
create policy "walls_update_public"
  on walls for update
  using (true);

create index if not exists walls_updated_at_idx on walls (updated_at desc);

-- Social features (Phase 2)

create table if not exists wall_likes (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  visitor_id text not null,
  created_at timestamptz not null default now(),
  unique (wall_id, visitor_id)
);

create table if not exists wall_comments (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  author_name text not null default '익명',
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists wall_guestbook (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  author_name text not null default '익명',
  created_at timestamptz not null default now()
);

create table if not exists wall_invites (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table wall_likes enable row level security;
alter table wall_comments enable row level security;
alter table wall_guestbook enable row level security;
alter table wall_invites enable row level security;

create policy "wall_likes_select_public" on wall_likes for select using (true);
create policy "wall_likes_insert_public" on wall_likes for insert with check (true);
create policy "wall_likes_delete_public" on wall_likes for delete using (true);

create policy "wall_comments_select_public" on wall_comments for select using (true);
create policy "wall_comments_insert_public" on wall_comments for insert with check (true);

create policy "wall_guestbook_select_public" on wall_guestbook for select using (true);
create policy "wall_guestbook_insert_public" on wall_guestbook for insert with check (true);

create policy "wall_invites_select_public" on wall_invites for select using (true);
create policy "wall_invites_insert_public" on wall_invites for insert with check (true);

create index if not exists wall_likes_wall_id_idx on wall_likes (wall_id);
create index if not exists wall_comments_wall_id_idx on wall_comments (wall_id);
create index if not exists wall_guestbook_wall_id_idx on wall_guestbook (wall_id);
create index if not exists wall_invites_code_idx on wall_invites (code);

-- Auth: supabase/auth-migration.sql 실행 (owner_id + RLS)

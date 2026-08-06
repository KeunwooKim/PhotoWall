-- Shared wall activity notices (home inbox)
-- Schedule on successful shared-wall save; visible after 3 minutes of quiet.
-- Run in Supabase SQL Editor after shared-walls-migration.sql

create table if not exists public.wall_activity_notices (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references public.walls(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  wall_title text not null default '공동 벽',
  actor_name text not null default '친구',
  actor_avatar_url text,
  visible_at timestamptz not null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (wall_id, actor_id, recipient_id)
);

create index if not exists wall_activity_notices_recipient_visible_idx
  on public.wall_activity_notices (recipient_id, visible_at desc)
  where dismissed_at is null;

alter table public.wall_activity_notices enable row level security;

drop policy if exists "wall_activity_notices_select_recipient" on public.wall_activity_notices;
create policy "wall_activity_notices_select_recipient"
  on public.wall_activity_notices for select
  using (recipient_id = auth.uid());

drop policy if exists "wall_activity_notices_insert_actor" on public.wall_activity_notices;
create policy "wall_activity_notices_insert_actor"
  on public.wall_activity_notices for insert
  with check (
    actor_id = auth.uid()
    and recipient_id <> auth.uid()
    and public.is_wall_member(wall_id, auth.uid())
    and public.is_wall_member(wall_id, recipient_id)
  );

drop policy if exists "wall_activity_notices_update_actor" on public.wall_activity_notices;
create policy "wall_activity_notices_update_actor"
  on public.wall_activity_notices for update
  using (
    actor_id = auth.uid()
    and public.is_wall_member(wall_id, auth.uid())
  )
  with check (
    actor_id = auth.uid()
    and recipient_id <> auth.uid()
  );

drop policy if exists "wall_activity_notices_update_recipient" on public.wall_activity_notices;
create policy "wall_activity_notices_update_recipient"
  on public.wall_activity_notices for update
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- PhotoWall Shared Walls migration (Phase 2.5)
-- Run AFTER social-migration.sql

alter table walls add column if not exists title text;
alter table walls add column if not exists is_shared boolean not null default false;

create table if not exists wall_members (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  unique (wall_id, user_id)
);

create index if not exists wall_members_wall_id_idx on wall_members (wall_id);
create index if not exists wall_members_user_id_idx on wall_members (user_id);

alter table wall_members enable row level security;

create or replace function public.is_wall_member(wid uuid, uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists(
    select 1 from wall_members where wall_id = wid and user_id = uid
  );
$$;

create policy "wall_members_select"
  on wall_members for select
  using (public.is_wall_member(wall_id, auth.uid()));

create policy "wall_members_insert_owner"
  on wall_members for insert
  with check (
    (
      role = 'owner'
      and user_id = auth.uid()
      and exists (
        select 1 from walls w
        where w.id = wall_members.wall_id
          and w.owner_id = auth.uid()
      )
    )
    or (
      role = 'editor'
      and exists (
        select 1 from wall_members wm
        where wm.wall_id = wall_members.wall_id
          and wm.user_id = auth.uid()
          and wm.role = 'owner'
      )
    )
  );

create policy "wall_members_delete_owner"
  on wall_members for delete
  using (
    exists (
      select 1 from wall_members wm
      where wm.wall_id = wall_members.wall_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

-- Allow shared wall editors to update canvas
drop policy if exists "walls_update" on walls;

create policy "walls_update"
  on walls for update
  using (
    owner_id is null
    or owner_id = auth.uid()
    or exists (
      select 1 from wall_members wm
      where wm.wall_id = walls.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'editor')
    )
  );

create policy "walls_delete_owner"
  on walls for delete
  using (owner_id = auth.uid());

-- Atomic create RPC
create or replace function public.create_shared_wall(p_title text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  wid uuid;
  final_title text := coalesce(nullif(trim(p_title), ''), '우리 인생네컷');
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into walls (owner_id, title, is_shared, theme_id, canvas_json)
  values (uid, final_title, true, 'white', '{"version":"6.0.0","objects":[]}'::jsonb)
  returning id into wid;

  insert into wall_members (wall_id, user_id, role)
  values (wid, uid, 'owner');

  return json_build_object(
    'id', wid,
    'title', final_title,
    'theme_id', 'white',
    'updated_at', now()
  );
end;
$$;

grant execute on function public.create_shared_wall(text) to authenticated;

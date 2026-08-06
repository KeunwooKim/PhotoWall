-- PhotoWall Shared Walls fix
-- Run if 공동 벽 만들기 fails (RLS / migration issues)

-- Atomic create via RPC (bypasses RLS chicken-and-egg)
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

-- Simpler member insert policies
drop policy if exists "wall_members_insert_owner" on wall_members;

create policy "wall_members_insert_bootstrap"
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

-- Owner can delete their shared walls (rollback / cleanup)
drop policy if exists "walls_delete_owner" on walls;

create policy "walls_delete_owner"
  on walls for delete
  using (owner_id = auth.uid());

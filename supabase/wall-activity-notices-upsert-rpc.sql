-- Fix wall_activity_notices upsert under RLS (actor cannot SELECT recipient rows).
-- Call from scheduleWallActivityNotices via RPC instead of client upsert.

create or replace function public.upsert_wall_activity_notices(p_rows jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    return;
  end if;

  insert into public.wall_activity_notices as n (
    wall_id, actor_id, recipient_id, wall_title, actor_name, actor_avatar_url,
    visible_at, dismissed_at, updated_at
  )
  select
    (row->>'wall_id')::uuid,
    (row->>'actor_id')::uuid,
    (row->>'recipient_id')::uuid,
    coalesce(nullif(row->>'wall_title', ''), '공동 벽'),
    coalesce(nullif(row->>'actor_name', ''), '친구'),
    nullif(row->>'actor_avatar_url', ''),
    (row->>'visible_at')::timestamptz,
    null,
    coalesce((row->>'updated_at')::timestamptz, now())
  from jsonb_array_elements(p_rows) as row
  on conflict (wall_id, actor_id, recipient_id) do update set
    wall_title = excluded.wall_title,
    actor_name = excluded.actor_name,
    actor_avatar_url = excluded.actor_avatar_url,
    visible_at = excluded.visible_at,
    dismissed_at = null,
    updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.upsert_wall_activity_notices(jsonb) from public;
grant execute on function public.upsert_wall_activity_notices(jsonb) to authenticated, service_role;

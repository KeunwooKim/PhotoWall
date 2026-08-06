-- Account storage usage for wall-photos (path prefix = auth user id)
create or replace function public.get_user_wall_photo_bytes(p_user_id uuid)
returns bigint
language sql
stable
security definer
set search_path = storage, public
as $$
  select coalesce(sum((metadata->>'size')::bigint), 0)::bigint
  from storage.objects
  where bucket_id = 'wall-photos'
    and name like p_user_id::text || '/%';
$$;

revoke all on function public.get_user_wall_photo_bytes(uuid) from public;
grant execute on function public.get_user_wall_photo_bytes(uuid) to authenticated, service_role;

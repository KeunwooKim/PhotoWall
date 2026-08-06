-- PhotoWall Admin RLS — service role 없이도 관리자 JWT로 벽·문의 관리
-- Run AFTER admin-inquiries-migration.sql
-- Then register admins (replace UUID):
--   insert into app_admins (user_id) values ('614f4dcf-6a87-496d-8b1c-728367b220de');

create table if not exists app_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table app_admins enable row level security;

-- Only service role / SQL editor can read app_admins list
create policy "app_admins_service_only"
  on app_admins for select
  using (false);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from app_admins where user_id = auth.uid()
  );
$$;

revoke all on function public.is_app_admin() from public;
grant execute on function public.is_app_admin() to authenticated;

create policy "walls_update_admin"
  on walls for update
  using (public.is_app_admin());

create policy "walls_delete_admin"
  on walls for delete
  using (public.is_app_admin());

create policy "wall_comments_delete_admin"
  on wall_comments for delete
  using (public.is_app_admin());

create policy "wall_likes_delete_admin"
  on wall_likes for delete
  using (public.is_app_admin());

create policy "wall_guestbook_delete_admin"
  on wall_guestbook for delete
  using (public.is_app_admin());

create policy "inquiries_select_admin"
  on inquiries for select
  using (public.is_app_admin());

create policy "inquiries_update_admin"
  on inquiries for update
  using (public.is_app_admin());

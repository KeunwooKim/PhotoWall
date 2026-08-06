-- PhotoWall: social SELECT hardening + disable comments
-- Supabase SQL Editor에서 이 파일 전체를 실행하세요 (검증 쿼리 아님)
-- idempotent — 여러 번 실행해도 안전

-- 1) Helper
create or replace function public.can_read_wall(p_wall_id uuid)
returns boolean
language sql
stable
set search_path = public
as $$
  select exists (
    select 1 from public.walls w where w.id = p_wall_id
  );
$$;

grant execute on function public.can_read_wall(uuid) to anon, authenticated;

-- 2) wall_invites — 공개 SELECT 제거, 소유자만 + 코드 단건 RPC
drop policy if exists "wall_invites_select_public" on public.wall_invites;
drop policy if exists "wall_invites_select_owner" on public.wall_invites;

create policy "wall_invites_select_owner"
  on public.wall_invites for select
  using (
    exists (
      select 1 from public.walls w
      where w.id = wall_invites.wall_id
        and w.owner_id = auth.uid()
    )
  );

create or replace function public.get_wall_invite_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := upper(trim(coalesce(p_code, '')));
  inv public.wall_invites%rowtype;
begin
  if length(normalized) < 6 or length(normalized) > 16 then
    return null;
  end if;

  select * into inv
  from public.wall_invites
  where code = normalized;

  if not found then
    return null;
  end if;

  return json_build_object(
    'id', inv.id,
    'wall_id', inv.wall_id,
    'code', inv.code,
    'created_at', inv.created_at
  );
end;
$$;

revoke all on function public.get_wall_invite_by_code(text) from public;
grant execute on function public.get_wall_invite_by_code(text) to anon, authenticated;

-- 3) wall_likes
drop policy if exists "wall_likes_select_public" on public.wall_likes;
drop policy if exists "wall_likes_select_accessible" on public.wall_likes;

create policy "wall_likes_select_accessible"
  on public.wall_likes for select
  using (public.can_read_wall(wall_id));

-- 4) wall_guestbook
drop policy if exists "wall_guestbook_select_public" on public.wall_guestbook;
drop policy if exists "wall_guestbook_select_accessible" on public.wall_guestbook;

create policy "wall_guestbook_select_accessible"
  on public.wall_guestbook for select
  using (public.can_read_wall(wall_id));

-- 5) wall_comments — 기능 종료: INSERT 제거, SELECT는 관리자만
drop policy if exists "wall_comments_select_public" on public.wall_comments;
drop policy if exists "wall_comments_select_accessible" on public.wall_comments;
drop policy if exists "wall_comments_select_admin" on public.wall_comments;
drop policy if exists "wall_comments_insert_public" on public.wall_comments;
drop policy if exists "wall_comments_insert_auth" on public.wall_comments;

create policy "wall_comments_select_admin"
  on public.wall_comments for select
  using (public.is_app_admin());

-- 6) feature flag (실패해도 정책은 이미 적용됨 — 별도 트랜잭션처럼 안전하게)
do $$
begin
  update public.feature_flags
  set enabled = false, updated_at = now()
  where key = 'comments';
exception
  when others then
    raise notice 'feature_flags update skipped: %', sqlerrm;
end $$;

-- 7) is_app_admin anon 권한 정리 (실패해도 무시)
do $$
begin
  revoke execute on function public.is_app_admin() from anon;
  revoke execute on function public.is_app_admin() from public;
  grant execute on function public.is_app_admin() to authenticated;
exception
  when others then
    raise notice 'is_app_admin grant tweak skipped: %', sqlerrm;
end $$;

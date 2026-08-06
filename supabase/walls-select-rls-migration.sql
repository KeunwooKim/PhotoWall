-- PhotoWall walls SELECT RLS (보안 2차)
-- Run AFTER security-hardening-migration.sql, shared-walls-migration.sql, privacy-invites-migration.sql
--
-- 앱 checkWallAccess()와 동일한 규칙으로 anon 직접 조회를 제한합니다.

drop policy if exists "walls_select_public" on walls;

create policy "walls_select"
  on walls for select
  using (
    coalesce(is_hidden, false) = false
    and (
      owner_id is null
      or owner_id = auth.uid()
      or public.is_wall_member(id, auth.uid())
      or (
        is_shared = false
        and auth.uid() is not null
        and owner_id is not null
        and exists (
          select 1 from profiles p
          where p.id = walls.owner_id
            and p.allow_wall_visits = true
        )
        and exists (
          select 1 from friendships f
          where f.user_a = least(auth.uid(), owner_id)
            and f.user_b = greatest(auth.uid(), owner_id)
        )
      )
    )
  );

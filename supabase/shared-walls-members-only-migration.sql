-- 공동 벽 멤버 전용 열람 (shared-walls-migration.sql, walls-select-rls-migration.sql 이후)
-- is_shared=true 만으로 anon 열람되던 정책 제거 — 멤버·소유자만 SELECT

drop policy if exists "walls_select" on walls;

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

-- RLS로 행이 숨겨져도 앱에서 멤버 여부·거절 사유를 판별 (캔버스는 반환하지 않음)
create or replace function public.get_wall_access_meta(p_wall_id uuid, p_user_id uuid default null)
returns jsonb
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (
      select jsonb_build_object(
        'exists', true,
        'is_shared', w.is_shared,
        'owner_id', w.owner_id,
        'is_member', (
          p_user_id is not null
          and (
            w.owner_id = p_user_id
            or exists (
              select 1 from wall_members wm
              where wm.wall_id = w.id and wm.user_id = p_user_id
            )
          )
        )
      )
      from walls w
      where w.id = p_wall_id
        and coalesce(w.is_hidden, false) = false
    ),
    jsonb_build_object('exists', false)
  );
$$;

grant execute on function public.get_wall_access_meta(uuid, uuid) to anon, authenticated;

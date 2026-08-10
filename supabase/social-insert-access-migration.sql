-- PhotoWall: tighten wall_likes / wall_guestbook INSERT to require wall read access
-- Idempotent. Run in Supabase SQL Editor after walls-select-rls / shared-walls-members-only.

-- Align INSERT with walls SELECT (hidden walls blocked; owner/member/friend+visits).

drop policy if exists "wall_likes_insert_auth" on public.wall_likes;

create policy "wall_likes_insert_auth"
  on public.wall_likes for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.walls w
      where w.id = wall_likes.wall_id
        and coalesce(w.is_hidden, false) = false
        and (
          w.owner_id is null
          or w.owner_id = auth.uid()
          or public.is_wall_member(w.id, auth.uid())
          or (
            w.is_shared = false
            and w.owner_id is not null
            and exists (
              select 1 from public.profiles p
              where p.id = w.owner_id
                and p.allow_wall_visits = true
            )
            and exists (
              select 1 from public.friendships f
              where f.user_a = least(auth.uid(), w.owner_id)
                and f.user_b = greatest(auth.uid(), w.owner_id)
            )
          )
        )
    )
  );

drop policy if exists "wall_guestbook_insert_auth" on public.wall_guestbook;

create policy "wall_guestbook_insert_auth"
  on public.wall_guestbook for insert
  with check (
    auth.uid() is not null
    and user_id = auth.uid()
    and exists (
      select 1 from public.walls w
      where w.id = wall_guestbook.wall_id
        and coalesce(w.is_hidden, false) = false
        and (
          w.owner_id is null
          or w.owner_id = auth.uid()
          or public.is_wall_member(w.id, auth.uid())
          or (
            w.is_shared = false
            and w.owner_id is not null
            and exists (
              select 1 from public.profiles p
              where p.id = w.owner_id
                and p.allow_wall_visits = true
            )
            and exists (
              select 1 from public.friendships f
              where f.user_a = least(auth.uid(), w.owner_id)
                and f.user_b = greatest(auth.uid(), w.owner_id)
            )
          )
        )
    )
  );

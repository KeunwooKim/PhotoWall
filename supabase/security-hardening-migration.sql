-- PhotoWall security hardening
-- Run in Supabase SQL Editor AFTER privacy-invites-migration.sql
--
-- Before running: claim orphaned walls (owner_id is null) via claim-walls.sql
-- Or
--   update walls set owner_id = '<your-user-uuid>' where owner_id is null and id = '<wall-uuid>';

-- ── Walls: remove anonymous insert/update ──────────────────────────────────

drop policy if exists "walls_insert" on walls;
drop policy if exists "walls_update" on walls;

create policy "walls_insert"
  on walls for insert
  with check (auth.uid() is not null and owner_id = auth.uid());

create policy "walls_update"
  on walls for update
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from wall_members wm
      where wm.wall_id = walls.id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'editor')
    )
  );

-- ── Likes: authenticated users only ────────────────────────────────────────

drop policy if exists "wall_likes_insert_public" on wall_likes;
drop policy if exists "wall_likes_delete_public" on wall_likes;

create policy "wall_likes_insert_auth"
  on wall_likes for insert
  with check (auth.uid() is not null and user_id = auth.uid());

create policy "wall_likes_delete_own"
  on wall_likes for delete
  using (auth.uid() = user_id);

create unique index if not exists wall_likes_wall_user_unique
  on wall_likes (wall_id, user_id)
  where user_id is not null;

-- ── Comments: authenticated users only ─────────────────────────────────────

drop policy if exists "wall_comments_insert_public" on wall_comments;

create policy "wall_comments_insert_auth"
  on wall_comments for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- ── Guestbook log: authenticated users only ────────────────────────────────

drop policy if exists "wall_guestbook_insert_public" on wall_guestbook;

create policy "wall_guestbook_insert_auth"
  on wall_guestbook for insert
  with check (auth.uid() is not null and user_id = auth.uid());

-- ── Invites: wall owner only ───────────────────────────────────────────────

drop policy if exists "wall_invites_insert_public" on wall_invites;

create policy "wall_invites_insert_owner"
  on wall_invites for insert
  with check (
    auth.uid() is not null
    and exists (
      select 1 from walls w
      where w.id = wall_invites.wall_id
        and w.owner_id = auth.uid()
    )
  );

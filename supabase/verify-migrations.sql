-- PhotoWall migration verification (Dashboard SQL Editor)
-- 결과만 확인 — 변경 없음

-- 1) walls RLS 정책
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename = 'walls'
order by policyname;

-- 기대: walls_select 있음, walls_select_public 없음

-- 2) storage policies
select tablename, policyname, cmd
from pg_policies
where schemaname = 'storage'
  and tablename = 'objects'
  and policyname like 'wall_photos%'
order by policyname;

-- 기대: wall_photos_owner_read 있음, wall_photos_public_read 없음

-- 3) admin tables
select exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'inquiries') as inquiries_table,
       exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'walls' and column_name = 'is_hidden') as walls_is_hidden,
       exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'app_admins') as app_admins_table,
       exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'announcements') as announcements_table,
       exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'feature_flags') as feature_flags_table,
       (select count(*)::int from app_admins) as app_admins_count,
       (select count(*)::int from feature_flags) as feature_flags_count;

-- 4) storage bucket
select id, public from storage.buckets where id = 'wall-photos';

-- 기대: public = false

-- 5) social SELECT + comments disabled (social-select-hardening-migration.sql)
select tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
  and tablename in ('wall_invites', 'wall_comments', 'wall_likes', 'wall_guestbook')
order by tablename, cmd, policyname;

-- 기대 SELECT:
--   wall_invites: wall_invites_select_owner (public 없음)
--   wall_likes: wall_likes_select_accessible
--   wall_guestbook: wall_guestbook_select_accessible
--   wall_comments: wall_comments_select_admin 만 (insert_auth / select_public 없음)
-- 기대 INSERT on wall_comments: 정책 없음

select exists (
  select 1 from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'get_wall_invite_by_code'
) as has_get_wall_invite_by_code;

select key, enabled from feature_flags where key = 'comments';
-- 기대: enabled = false (행이 없어도 OK — 앱에서 키 제거됨)

-- 6) wall preview path (walls-preview-path-migration.sql)
select exists (
  select 1 from information_schema.columns
  where table_schema = 'public' and table_name = 'walls' and column_name = 'preview_path'
) as has_preview_path;

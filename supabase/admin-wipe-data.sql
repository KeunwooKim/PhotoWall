-- PhotoWall: wipe all user-generated data, KEEP accounts (auth.users, profiles, friendships, app_admins)
-- Run in Supabase SQL Editor. IRREVERSIBLE.
--
-- Keeps: auth.users, profiles, friendships, app_admins
-- Deletes: walls, social, invites, inquiries
-- Does NOT delete: Storage files in wall-photos (Supabase Dashboard → Storage if needed)

begin;

delete from wall_likes;
delete from wall_comments;
delete from wall_guestbook;
delete from wall_invites;

-- 공동벽 테이블 (privacy-invites / shared-walls 마이그레이션 실행 후)
delete from wall_member_invites;
delete from wall_members;

delete from inquiries;
delete from walls;

commit;

-- 확인 (선택):
-- select count(*) as walls from walls;
-- select count(*) as users from profiles;

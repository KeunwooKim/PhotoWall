-- PhotoWall Storage security (2차 — private bucket)
-- Run in Supabase SQL Editor AFTER storage-migration.sql
--
-- ⚠️ 이 SQL을 실행하기 전에 앱 코드(storage path + signed URL API)가 배포되어 있어야
--    기존 벽 사진이 보입니다. 로컬에서 먼저 테스트 후 실행하세요.

update storage.buckets
set public = false
where id = 'wall-photos';

drop policy if exists "wall_photos_public_read" on storage.objects;

-- 본인 폴더 read (service role 없을 때 업로더가 자기 사진만 미리보기)
create policy "wall_photos_owner_read"
  on storage.objects for select
  using (
    bucket_id = 'wall-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- upload/delete policies는 storage-migration.sql 그대로 유지

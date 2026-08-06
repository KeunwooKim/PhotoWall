-- PhotoWall Storage migration
-- Run in Supabase SQL Editor AFTER auth-migration.sql

insert into storage.buckets (id, name, public)
values ('wall-photos', 'wall-photos', true)
on conflict (id) do update set public = true;

create policy "wall_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'wall-photos');

create policy "wall_photos_auth_upload"
  on storage.objects for insert
  with check (
    bucket_id = 'wall-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "wall_photos_auth_delete"
  on storage.objects for delete
  using (
    bucket_id = 'wall-photos'
    and auth.uid() is not null
    and (storage.foldername(name))[1] = auth.uid()::text
  );

alter table public.house_banners
  add column if not exists image_url text;

alter table public.house_banners
  alter column message set default '';

-- allow empty message for image banners
-- (message is still NOT NULL; default '' is fine)

update public.house_banners
set active = false
where (image_url is null or image_url = '')
  and title = 'PhotoWall 플러스';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'house-banners',
  'house-banners',
  true,
  5242880,
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- public read
drop policy if exists "house_banners_storage_public_read" on storage.objects;
create policy "house_banners_storage_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'house-banners');

-- admin write via is_app_admin (service role bypasses anyway)
drop policy if exists "house_banners_storage_admin_insert" on storage.objects;
drop policy if exists "house_banners_storage_admin_update" on storage.objects;
drop policy if exists "house_banners_storage_admin_delete" on storage.objects;

create policy "house_banners_storage_admin_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'house-banners' and public.is_app_admin());

create policy "house_banners_storage_admin_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'house-banners' and public.is_app_admin())
  with check (bucket_id = 'house-banners' and public.is_app_admin());

create policy "house_banners_storage_admin_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'house-banners' and public.is_app_admin());

-- sticker-packs-migration.sql
-- Free UGC sticker packs: create → pending review → publish → install to library

create table if not exists public.sticker_packs (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  slug text not null,
  name text not null,
  description text not null default '',
  emoji text,
  status text not null default 'draft'
    check (status in ('draft', 'pending', 'published', 'rejected', 'taken_down')),
  reject_reason text,
  cover_path text,
  sticker_count integer not null default 0,
  download_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  unique (creator_id, slug)
);

create index if not exists sticker_packs_status_published_idx
  on public.sticker_packs (status, published_at desc nulls last)
  where status = 'published';

create index if not exists sticker_packs_creator_idx
  on public.sticker_packs (creator_id, updated_at desc);

create index if not exists sticker_packs_pending_idx
  on public.sticker_packs (status, created_at asc)
  where status = 'pending';

create table if not exists public.sticker_pack_items (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.sticker_packs (id) on delete cascade,
  sort_order integer not null default 0,
  name text not null default '',
  storage_path text not null,
  width integer not null default 120,
  height integer not null default 120,
  created_at timestamptz not null default now()
);

create index if not exists sticker_pack_items_pack_idx
  on public.sticker_pack_items (pack_id, sort_order);

create table if not exists public.sticker_pack_installs (
  user_id uuid not null references public.profiles (id) on delete cascade,
  pack_id uuid not null references public.sticker_packs (id) on delete cascade,
  installed_at timestamptz not null default now(),
  primary key (user_id, pack_id)
);

create index if not exists sticker_pack_installs_user_idx
  on public.sticker_pack_installs (user_id, installed_at desc);

alter table public.sticker_packs enable row level security;
alter table public.sticker_pack_items enable row level security;
alter table public.sticker_pack_installs enable row level security;

-- packs: public read published; creators manage own drafts/rejected; admin all
drop policy if exists "sticker_packs_public_read_published" on public.sticker_packs;
create policy "sticker_packs_public_read_published"
  on public.sticker_packs for select
  to anon, authenticated
  using (status = 'published');

drop policy if exists "sticker_packs_owner_select" on public.sticker_packs;
create policy "sticker_packs_owner_select"
  on public.sticker_packs for select
  to authenticated
  using (creator_id = auth.uid() or public.is_app_admin());

drop policy if exists "sticker_packs_owner_insert" on public.sticker_packs;
create policy "sticker_packs_owner_insert"
  on public.sticker_packs for insert
  to authenticated
  with check (creator_id = auth.uid());

drop policy if exists "sticker_packs_owner_update" on public.sticker_packs;
create policy "sticker_packs_owner_update"
  on public.sticker_packs for update
  to authenticated
  using (creator_id = auth.uid() or public.is_app_admin())
  with check (creator_id = auth.uid() or public.is_app_admin());

drop policy if exists "sticker_packs_owner_delete" on public.sticker_packs;
create policy "sticker_packs_owner_delete"
  on public.sticker_packs for delete
  to authenticated
  using (
    (creator_id = auth.uid() and status in ('draft', 'rejected'))
    or public.is_app_admin()
  );

-- items: public read for published packs (no is_app_admin — anon lacks EXECUTE);
-- owner/admin read separately for drafts.
drop policy if exists "sticker_pack_items_select" on public.sticker_pack_items;
drop policy if exists "sticker_pack_items_public_select" on public.sticker_pack_items;
create policy "sticker_pack_items_public_select"
  on public.sticker_pack_items for select
  to anon, authenticated
  using (
    exists (
      select 1 from public.sticker_packs p
      where p.id = pack_id and p.status = 'published'
    )
  );

drop policy if exists "sticker_pack_items_owner_select" on public.sticker_pack_items;
create policy "sticker_pack_items_owner_select"
  on public.sticker_pack_items for select
  to authenticated
  using (
    exists (
      select 1 from public.sticker_packs p
      where p.id = pack_id
        and (p.creator_id = auth.uid() or public.is_app_admin())
    )
  );

drop policy if exists "sticker_pack_items_insert" on public.sticker_pack_items;
create policy "sticker_pack_items_insert"
  on public.sticker_pack_items for insert
  to authenticated
  with check (
    exists (
      select 1 from public.sticker_packs p
      where p.id = pack_id
        and p.creator_id = auth.uid()
        and p.status in ('draft', 'rejected')
    )
    or public.is_app_admin()
  );

drop policy if exists "sticker_pack_items_update" on public.sticker_pack_items;
create policy "sticker_pack_items_update"
  on public.sticker_pack_items for update
  to authenticated
  using (
    exists (
      select 1 from public.sticker_packs p
      where p.id = pack_id
        and p.creator_id = auth.uid()
        and p.status in ('draft', 'rejected')
    )
    or public.is_app_admin()
  )
  with check (
    exists (
      select 1 from public.sticker_packs p
      where p.id = pack_id
        and p.creator_id = auth.uid()
        and p.status in ('draft', 'rejected')
    )
    or public.is_app_admin()
  );

drop policy if exists "sticker_pack_items_delete" on public.sticker_pack_items;
create policy "sticker_pack_items_delete"
  on public.sticker_pack_items for delete
  to authenticated
  using (
    exists (
      select 1 from public.sticker_packs p
      where p.id = pack_id
        and p.creator_id = auth.uid()
        and p.status in ('draft', 'rejected')
    )
    or public.is_app_admin()
  );

-- installs: own rows only
drop policy if exists "sticker_pack_installs_select" on public.sticker_pack_installs;
create policy "sticker_pack_installs_select"
  on public.sticker_pack_installs for select
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

drop policy if exists "sticker_pack_installs_insert" on public.sticker_pack_installs;
create policy "sticker_pack_installs_insert"
  on public.sticker_pack_installs for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sticker_packs p
      where p.id = pack_id and p.status = 'published'
    )
  );

drop policy if exists "sticker_pack_installs_delete" on public.sticker_pack_installs;
create policy "sticker_pack_installs_delete"
  on public.sticker_pack_installs for delete
  to authenticated
  using (user_id = auth.uid() or public.is_app_admin());

-- storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'sticker-assets',
  'sticker-assets',
  true,
  524288,
  array['image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "sticker_assets_public_read" on storage.objects;
create policy "sticker_assets_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'sticker-assets');

drop policy if exists "sticker_assets_owner_insert" on storage.objects;
create policy "sticker_assets_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'sticker-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "sticker_assets_owner_update" on storage.objects;
create policy "sticker_assets_owner_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'sticker-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_app_admin()
    )
  )
  with check (
    bucket_id = 'sticker-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_app_admin()
    )
  );

drop policy if exists "sticker_assets_owner_delete" on storage.objects;
create policy "sticker_assets_owner_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'sticker-assets'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_app_admin()
    )
  );

-- event_posts: campaign-style event board posts
create table if not exists public.event_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  image_url text,
  href text,
  cta_label text not null default '자세히',
  active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists event_posts_active_idx
  on public.event_posts (active, sort_order, created_at desc);

alter table public.event_posts enable row level security;

drop policy if exists "event_posts_public_read" on public.event_posts;
create policy "event_posts_public_read"
  on public.event_posts for select
  to anon, authenticated
  using (active = true);

drop policy if exists "event_posts_admin_select" on public.event_posts;
create policy "event_posts_admin_select"
  on public.event_posts for select
  to authenticated
  using (is_app_admin());

drop policy if exists "event_posts_admin_insert" on public.event_posts;
create policy "event_posts_admin_insert"
  on public.event_posts for insert
  to authenticated
  with check (is_app_admin());

drop policy if exists "event_posts_admin_update" on public.event_posts;
create policy "event_posts_admin_update"
  on public.event_posts for update
  to authenticated
  using (is_app_admin())
  with check (is_app_admin());

drop policy if exists "event_posts_admin_delete" on public.event_posts;
create policy "event_posts_admin_delete"
  on public.event_posts for delete
  to authenticated
  using (is_app_admin());

-- Public storage bucket for event cover images (reuse pattern of house-banners)
insert into storage.buckets (id, name, public)
values ('event-posts', 'event-posts', true)
on conflict (id) do update set public = true;

drop policy if exists "event_posts_storage_public_read" on storage.objects;
create policy "event_posts_storage_public_read"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'event-posts');

drop policy if exists "event_posts_storage_admin_write" on storage.objects;
create policy "event_posts_storage_admin_write"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'event-posts' and is_app_admin());

drop policy if exists "event_posts_storage_admin_update" on storage.objects;
create policy "event_posts_storage_admin_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'event-posts' and is_app_admin())
  with check (bucket_id = 'event-posts' and is_app_admin());

drop policy if exists "event_posts_storage_admin_delete" on storage.objects;
create policy "event_posts_storage_admin_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'event-posts' and is_app_admin());

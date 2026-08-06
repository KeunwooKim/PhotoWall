-- house-banners-migration.sql
create table if not exists public.house_banners (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  message text not null,
  href text,
  cta_label text not null default '자세히',
  placement text not null default 'all'
    check (placement in ('all', 'home', 'settings', 'walls')),
  audience text not null default 'free'
    check (audience in ('free', 'all')),
  active boolean not null default true,
  sort_order integer not null default 0,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists house_banners_active_idx
  on public.house_banners (active, sort_order, created_at desc);

alter table public.house_banners enable row level security;

drop policy if exists "house_banners_public_read" on public.house_banners;
create policy "house_banners_public_read"
  on public.house_banners
  for select
  to anon, authenticated
  using (active = true);

-- mirror announcements: service role bypasses RLS for admin writes

insert into public.house_banners (title, message, href, cta_label, placement, audience, active, sort_order)
select
  'PhotoWall 플러스',
  '저장 공간·공동 벽 한도를 늘려보세요',
  '/upgrade',
  '알아보기',
  'all',
  'free',
  true,
  0
where not exists (select 1 from public.house_banners limit 1);

drop policy if exists "house_banners_admin_select" on public.house_banners;
drop policy if exists "house_banners_admin_insert" on public.house_banners;
drop policy if exists "house_banners_admin_update" on public.house_banners;
drop policy if exists "house_banners_admin_delete" on public.house_banners;

create policy "house_banners_admin_select"
  on public.house_banners for select to authenticated
  using (public.is_app_admin());

create policy "house_banners_admin_insert"
  on public.house_banners for insert to authenticated
  with check (public.is_app_admin());

create policy "house_banners_admin_update"
  on public.house_banners for update to authenticated
  using (public.is_app_admin())
  with check (public.is_app_admin());

create policy "house_banners_admin_delete"
  on public.house_banners for delete to authenticated
  using (public.is_app_admin());

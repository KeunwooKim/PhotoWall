-- PhotoWall Admin 2단계 — 공지 배너 + 기능 플래그
-- Run AFTER admin-rls-migration.sql

create table if not exists announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  message text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  target text not null default 'all' check (target in ('all', 'home', 'editor')),
  active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists feature_flags (
  key text primary key,
  enabled boolean not null default true,  
  label text not null default '',
  description text not null default '',
  updated_at timestamptz not null default now()
);

insert into feature_flags (key, enabled, label, description) values
  ('shared_walls', true, '공동 벽', '공동 벽 생성·편집·실시간 협업'),
  ('guestbook', true, '방명록', '공개 벽 방명록 사진'),
  ('comments', true, '댓글', '공개 벽 응원 댓글'),
  ('likes', true, '좋아요', '공개 벽 응원하기'),
  ('qr_import', true, 'QR 가져오기', '/import 부스 QR 네컷 가져오기')
on conflict (key) do nothing;

alter table announcements enable row level security;
alter table feature_flags enable row level security;

-- 공개: 활성 공지만 조회 (기간은 API에서 추가 필터)
create policy "announcements_public_select"
  on announcements for select
  using (active = true);

create policy "announcements_admin_select"
  on announcements for select
  using (public.is_app_admin());

create policy "announcements_admin_insert"
  on announcements for insert
  with check (public.is_app_admin());

create policy "announcements_admin_update"
  on announcements for update
  using (public.is_app_admin());

create policy "announcements_admin_delete"
  on announcements for delete
  using (public.is_app_admin());

create policy "feature_flags_public_select"
  on feature_flags for select
  using (true);

create policy "feature_flags_admin_update"
  on feature_flags for update
  using (public.is_app_admin());

-- Ops hardening: inquiry replies, inbox notices, QR import events, business pipeline
-- Run once in Supabase SQL Editor after admin-inquiries-migration.sql

-- ── Inquiry reply + business pipeline ──
alter table public.inquiries
  add column if not exists admin_reply text;

alter table public.inquiries
  add column if not exists admin_replied_at timestamptz;

alter table public.inquiries
  add column if not exists business_stage text;

alter table public.inquiries
  drop constraint if exists inquiries_business_stage_check;

alter table public.inquiries
  add constraint inquiries_business_stage_check
  check (
    business_stage is null
    or business_stage in ('lead', 'meeting', 'contract', 'closed')
  );

comment on column public.inquiries.admin_reply is 'User-visible reply from ops (shown in-app)';
comment on column public.inquiries.business_stage is 'lead|meeting|contract|closed for category=business';

-- ── In-app inbox (inquiry replies etc.) ──
create table if not exists public.user_inbox_notices (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null default 'inquiry_reply',
  title text not null,
  body text not null,
  inquiry_id uuid references public.inquiries (id) on delete set null,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists user_inbox_notices_recipient_idx
  on public.user_inbox_notices (recipient_id, created_at desc)
  where dismissed_at is null;

alter table public.user_inbox_notices enable row level security;

drop policy if exists "inbox_select_own" on public.user_inbox_notices;
create policy "inbox_select_own"
  on public.user_inbox_notices for select
  using (auth.uid() = recipient_id);

drop policy if exists "inbox_update_own" on public.user_inbox_notices;
create policy "inbox_update_own"
  on public.user_inbox_notices for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- inserts via service role / admin client only (no insert policy for users)

-- ── QR / booth import monitoring ──
create table if not exists public.import_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users (id) on delete set null,
  ok boolean not null,
  error_code text,
  source_host text,
  created_at timestamptz not null default now()
);

create index if not exists import_events_created_idx
  on public.import_events (created_at desc);

create index if not exists import_events_ok_created_idx
  on public.import_events (ok, created_at desc);

alter table public.import_events enable row level security;
-- no user policies — service role / admin only

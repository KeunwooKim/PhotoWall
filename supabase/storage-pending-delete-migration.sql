-- Pending Storage GC: paths removed from walls wait 24h before delete
-- Run after ops-hardening-migration.sql

create table if not exists public.storage_pending_delete (
  path text primary key,
  wall_id uuid references public.walls (id) on delete set null,
  enqueued_at timestamptz not null default now(),
  delete_after timestamptz not null,
  reason text
);

create index if not exists storage_pending_delete_due_idx
  on public.storage_pending_delete (delete_after);

alter table public.storage_pending_delete enable row level security;
-- service role / admin only — no user policies

comment on table public.storage_pending_delete is
  'wall-photos paths unreferenced after save; purged after delete_after if still unused';

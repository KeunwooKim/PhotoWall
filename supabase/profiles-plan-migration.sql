-- User billing plan for wall quotas (UI label: 플러스)
-- free | premium
alter table public.profiles
  add column if not exists plan text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_plan_check;

alter table public.profiles
  add constraint profiles_plan_check check (plan in ('free', 'premium'));

alter table public.profiles
  add column if not exists plan_updated_at timestamptz;

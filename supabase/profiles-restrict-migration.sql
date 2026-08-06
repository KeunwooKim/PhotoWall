-- Account restrict: login OK, social actions blocked
alter table public.profiles
  add column if not exists restricted_at timestamptz;

alter table public.profiles
  add column if not exists restrict_reason text;

-- PhotoWall Admin migration — inquiries + wall moderation
-- Run in Supabase SQL Editor AFTER security-hardening-migration.sql

alter table walls add column if not exists is_hidden boolean not null default false;

create index if not exists walls_is_hidden_idx on walls (is_hidden) where is_hidden = true;

create table if not exists inquiries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  email text,
  category text not null check (category in ('general', 'bug', 'feature', 'abuse', 'business')),
  subject text not null,
  body text not null,
  related_wall_id uuid references walls(id) on delete set null,
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists inquiries_status_created_idx on inquiries (status, created_at desc);
create index if not exists inquiries_user_id_idx on inquiries (user_id);

alter table inquiries enable row level security;

-- Logged-in users can submit inquiries (user_id must match)
create policy "inquiries_insert_auth"
  on inquiries for insert
  to authenticated
  with check (auth.uid() = user_id);

-- No select/update for regular users — admin uses service role API

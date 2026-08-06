-- PhotoWall Auth migration
-- Run in Supabase SQL Editor AFTER schema.sql

alter table walls add column if not exists owner_id uuid references auth.users(id);

create index if not exists walls_owner_id_idx on walls (owner_id);

-- Replace open MVP policies with owner-aware policies
drop policy if exists "walls_insert_public" on walls;
drop policy if exists "walls_update_public" on walls;

create policy "walls_insert"
  on walls for insert
  with check (
    (auth.uid() is not null and owner_id = auth.uid())
    or (auth.uid() is null and owner_id is null)
  );

create policy "walls_update"
  on walls for update
  using (
    owner_id is null
    or owner_id = auth.uid()
  );

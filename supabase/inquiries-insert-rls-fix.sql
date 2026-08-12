-- Fix: authenticated inquiry submit failed with RLS 42501 on insert().select().
-- INSERT policy alone is not enough — PostgREST RETURNING needs a SELECT policy.
-- Run in Supabase SQL Editor (or docker exec supabase-db psql).

drop policy if exists "inquiries_insert_auth" on public.inquiries;

create policy "inquiries_insert_auth"
  on public.inquiries for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "inquiries_select_own" on public.inquiries;

-- Allow users to read their own rows (needed for insert().select() RETURNING).
create policy "inquiries_select_own"
  on public.inquiries for select
  to authenticated
  using (auth.uid() = user_id);

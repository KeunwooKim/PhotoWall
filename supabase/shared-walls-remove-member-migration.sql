-- Allow non-owner members to leave a shared wall themselves.
-- Owner can already remove members via wall_members_delete_owner.

drop policy if exists "wall_members_delete_self" on wall_members;

create policy "wall_members_delete_self"
  on wall_members for delete
  using (
    user_id = auth.uid()
    and role <> 'owner'
  );

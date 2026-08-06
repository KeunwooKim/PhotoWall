-- Privacy + shared wall invite acceptance
-- Run AFTER shared-walls-migration.sql

alter table profiles add column if not exists allow_wall_visits boolean not null default false;

create table if not exists wall_member_invites (
  id uuid primary key default gen_random_uuid(),
  wall_id uuid not null references walls(id) on delete cascade,
  invitee_id uuid not null references auth.users(id) on delete cascade,
  inviter_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  unique (wall_id, invitee_id)
);

create index if not exists wall_member_invites_invitee_idx on wall_member_invites (invitee_id);
create index if not exists wall_member_invites_wall_id_idx on wall_member_invites (wall_id);

alter table wall_member_invites enable row level security;

create policy "wall_member_invites_select_involved"
  on wall_member_invites for select
  using (auth.uid() = invitee_id or auth.uid() = inviter_id);

create policy "wall_member_invites_insert_owner"
  on wall_member_invites for insert
  with check (
    auth.uid() = inviter_id
    and exists (
      select 1 from wall_members wm
      where wm.wall_id = wall_member_invites.wall_id
        and wm.user_id = auth.uid()
        and wm.role = 'owner'
    )
  );

create policy "wall_member_invites_update_invitee"
  on wall_member_invites for update
  using (auth.uid() = invitee_id);

-- 초대 수락 시 멤버 추가 (RLS 우회)
create or replace function public.accept_wall_member_invite(p_invite_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inv wall_member_invites%rowtype;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into inv
  from wall_member_invites
  where id = p_invite_id
    and invitee_id = uid
    and status = 'pending'
  for update;

  if not found then
    raise exception 'Invite not found';
  end if;

  insert into wall_members (wall_id, user_id, role)
  values (inv.wall_id, uid, 'editor')
  on conflict (wall_id, user_id) do nothing;

  update wall_member_invites
  set status = 'accepted'
  where id = p_invite_id;

  return json_build_object('wallId', inv.wall_id);
end;
$$;

grant execute on function public.accept_wall_member_invite(uuid) to authenticated;

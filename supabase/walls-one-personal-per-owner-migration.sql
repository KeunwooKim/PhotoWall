-- Deduplicate personal walls (one per owner) then enforce uniqueness.
-- Keep the most recently updated personal wall; delete older duplicates.

with ranked as (
  select
    id,
    owner_id,
    row_number() over (
      partition by owner_id
      order by updated_at desc nulls last, created_at desc nulls last
    ) as rn
  from walls
  where is_shared = false
    and owner_id is not null
)
delete from walls w
using ranked r
where w.id = r.id
  and r.rn > 1;

create unique index if not exists walls_one_personal_per_owner_idx
  on walls (owner_id)
  where is_shared = false and owner_id is not null;

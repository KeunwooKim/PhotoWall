-- Optional index for abuse queue filtering
create index if not exists inquiries_category_status_idx
  on public.inquiries (category, status);

-- PhotoWall: wall preview snapshot path for fast read-only viewing
-- Run in Supabase SQL Editor

alter table public.walls
  add column if not exists preview_path text;

comment on column public.walls.preview_path is
  'Storage path in wall-photos bucket, e.g. {userId}/previews/{wallId}.jpg';

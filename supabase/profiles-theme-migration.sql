-- UI theme preferences synced with the user account
-- theme_mode: light | dark | system
-- color_palette: mono | blush | mist | sage | lilac | butter

alter table public.profiles
  add column if not exists theme_mode text not null default 'system';

alter table public.profiles
  drop constraint if exists profiles_theme_mode_check;

alter table public.profiles
  add constraint profiles_theme_mode_check
  check (theme_mode in ('light', 'dark', 'system'));

alter table public.profiles
  add column if not exists color_palette text not null default 'mono';

alter table public.profiles
  drop constraint if exists profiles_color_palette_check;

alter table public.profiles
  add constraint profiles_color_palette_check
  check (color_palette in ('mono', 'blush', 'mist', 'sage', 'lilac', 'butter'));

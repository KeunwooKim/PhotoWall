-- Store when the user accepted terms / privacy (for audit & compliance).

alter table profiles
  add column if not exists legal_consented_at timestamptz;

alter table profiles
  add column if not exists legal_version text;

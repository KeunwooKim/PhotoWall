-- Ad toggles for admin /admin/banners
-- Run in Supabase SQL Editor

insert into feature_flags (key, enabled, label, description) values
  ('house_banners', true, '이미지 광고 배너', '관리자에서 등록한 배너 이미지 (홈·설정·벽 목록)'),
  ('adsense', true, 'Google AdSense', 'AdSense 슬롯 노출 (환경 변수에 client ID·슬롯 ID 필요)')
on conflict (key) do update set
  label = excluded.label,
  description = excluded.description,
  enabled = excluded.enabled;

#!/usr/bin/env bash
# PhotoWall → Vercel 프로덕션 배포
# 사용법: ./scripts/vercel-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERCEL="npx vercel@latest"

echo "→ Vercel 로그인 확인..."
if ! $VERCEL whoami >/dev/null 2>&1; then
  echo "Vercel에 로그인이 필요합니다. 브라우저 안내를 따라주세요."
  $VERCEL login
fi

if [[ ! -f .env.local ]]; then
  echo "오류: .env.local 이 없습니다. .env.example 을 참고해 Supabase 키를 설정하세요."
  exit 1
fi

# shellcheck disable=SC1091
set -a
source .env.local
set +a

for key in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY; do
  val="${!key:-}"
  if [[ -z "$val" ]]; then
    echo "오류: .env.local 에 $key 가 없습니다."
    exit 1
  fi
  echo "→ Vercel env: $key"
  printf '%s' "$val" | $VERCEL env add "$key" production --force 2>/dev/null || \
    printf '%s' "$val" | $VERCEL env add "$key" production
  printf '%s' "$val" | $VERCEL env add "$key" preview --force 2>/dev/null || \
    printf '%s' "$val" | $VERCEL env add "$key" preview
done

echo "→ 프로덕션 배포..."
$VERCEL deploy --prod --yes

echo ""
echo "배포 완료 후 Supabase Dashboard → Authentication → URL Configuration:"
echo "  Site URL: https://YOUR-APP.vercel.app"
echo "  Redirect URLs: https://YOUR-APP.vercel.app/auth/callback"

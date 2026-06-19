#!/usr/bin/env bash
# GitHub 레포 생성 후 로컬 코드 push
# 사용법: ./scripts/github-connect.sh [git-remote-url]
#
# 예시 (SSH):
#   ./scripts/github-connect.sh git@github.com:KeunwooKim/PhotoWall.git
# 예시 (HTTPS):
#   ./scripts/github-connect.sh https://github.com/KeunwooKim/PhotoWall.git
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REMOTE_URL="${1:-}"

if [[ -z "$REMOTE_URL" ]]; then
  echo "GitHub 레포 URL을 입력하세요."
  echo "예: git@github.com:YOUR_USER/PhotoWall.git"
  read -r -p "> " REMOTE_URL
fi

if [[ -z "$REMOTE_URL" ]]; then
  echo "오류: remote URL이 필요합니다."
  exit 1
fi

if git remote get-url origin >/dev/null 2>&1; then
  CURRENT="$(git remote get-url origin)"
  if [[ "$CURRENT" == "$REMOTE_URL" ]]; then
    echo "→ origin 이미 연결됨: $CURRENT"
  else
    echo "→ origin 변경: $CURRENT → $REMOTE_URL"
    git remote set-url origin "$REMOTE_URL"
  fi
else
  echo "→ origin 추가: $REMOTE_URL"
  git remote add origin "$REMOTE_URL"
fi

echo "→ main 브랜치 push..."
git push -u origin main

echo ""
echo "완료! GitHub: ${REMOTE_URL%.git}"
echo ""
echo "Vercel Git 연동 (push마다 자동 배포):"
echo "  1. https://vercel.com/keunwoos-projects/photowall/settings/git"
echo "  2. Connect Git Repository → 방금 push한 레포 선택"
echo "  3. Production Branch: main"

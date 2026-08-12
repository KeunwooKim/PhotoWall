#!/usr/bin/env bash
# Pull latest main (or REF) and run the safe PM2 production deploy.
# Run on the photowall.kr Ubuntu host (not from Cursor Cloud — no SSH from there).
#
#   cd /path/to/PhotoWall
#   bash scripts/pull-and-deploy.sh
#   REF=7f465b3 bash scripts/pull-and-deploy.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

REF="${REF:-main}"

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf '[deploy] ERROR: missing command: %s\n' "$1" >&2
    exit 1
  }
}

need_cmd git
need_cmd npm

printf '[deploy] fetching %s…\n' "$REF"
git fetch origin "$REF"

if git show-ref --verify --quiet "refs/remotes/origin/$REF"; then
  git checkout --force "$REF"
  git reset --hard "origin/$REF"
elif git cat-file -e "${REF}^{commit}" 2>/dev/null; then
  git checkout --force --detach "$REF"
else
  printf '[deploy] ERROR: unknown ref: %s\n' "$REF" >&2
  exit 1
fi

printf '[deploy] HEAD=%s\n' "$(git rev-parse --short HEAD)"
npm ci
npm run deploy:prod

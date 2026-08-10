#!/usr/bin/env bash
# Safe production start/reload for PhotoWall.
# - Builds first and refuses to restart without a valid BUILD_ID
# - Keeps the previous PM2 process until the new build is verified
# - Health-checks after reload; fails loudly if unhealthy
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-3000}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:${PORT}/api/health}"
MAX_HEALTH_ATTEMPTS="${MAX_HEALTH_ATTEMPTS:-30}"

log() { printf '[deploy] %s\n' "$*"; }
die() { printf '[deploy] ERROR: %s\n' "$*" >&2; exit 1; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing command: $1"
}

need_cmd npm
need_cmd pm2
need_cmd curl

if [[ ! -f .env.local ]]; then
  die ".env.local not found"
fi

# Soft env presence check (do not print values)
required_vars=(
  NEXT_PUBLIC_SUPABASE_URL
  NEXT_PUBLIC_SUPABASE_ANON_KEY
  SUPABASE_SERVICE_ROLE_KEY
)
# shellcheck disable=SC1091
set -a
# Prefer exporting only what Next/pm2 need; values stay in process env for checks
source .env.local
set +a

for key in "${required_vars[@]}"; do
  if [[ -z "${!key:-}" ]]; then
    die "missing required env: $key"
  fi
done

WAS_ONLINE=0
if pm2 describe photowall >/dev/null 2>&1; then
  status="$(pm2 jlist 2>/dev/null | node -e '
    let d=""; process.stdin.on("data",c=>d+=c); process.stdin.on("end",()=>{
      try {
        const list=JSON.parse(d);
        const app=list.find(p=>p.name==="photowall");
        process.stdout.write(app && app.pm2_env && app.pm2_env.status==="online" ? "online" : "other");
      } catch { process.stdout.write("other"); }
    });
  ' || true)"
  if [[ "$status" == "online" ]]; then
    WAS_ONLINE=1
    log "current photowall is online — will only reload after a good build"
  else
    log "photowall exists but is not online (status=$status)"
  fi
else
  log "photowall is not managed by pm2 yet"
fi

log "building…"
if ! npm run build; then
  die "build failed — leaving previous process untouched"
fi

[[ -f .next/BUILD_ID ]] || die "build finished but .next/BUILD_ID is missing"
BUILD_ID="$(tr -d '\n' < .next/BUILD_ID)"
[[ -n "$BUILD_ID" ]] || die "BUILD_ID is empty"
log "build ok (BUILD_ID=$BUILD_ID)"

log "starting/reloading pm2…"
if pm2 describe photowall >/dev/null 2>&1; then
  pm2 startOrReload ecosystem.config.cjs --update-env
else
  pm2 start ecosystem.config.cjs
fi
pm2 save

log "waiting for health at $HEALTH_URL …"
ok=0
for ((i=1; i<=MAX_HEALTH_ATTEMPTS; i++)); do
  code="$(curl -sS -o /tmp/photowall-health.json -w '%{http_code}' --max-time 3 "$HEALTH_URL" || true)"
  if [[ "$code" == "200" ]] && grep -q '"ok":true' /tmp/photowall-health.json 2>/dev/null; then
    ok=1
    break
  fi
  sleep 1
done

if [[ "$ok" -ne 1 ]]; then
  log "health check failed"
  pm2 status photowall || true
  pm2 logs photowall --err --lines 40 --nostream || true
  if [[ "$WAS_ONLINE" -eq 1 ]]; then
    die "new process unhealthy — inspect logs; previous build may already be replaced"
  fi
  die "service unhealthy after start"
fi

log "healthy: $(tr -d '\n' < /tmp/photowall-health.json)"
pm2 status photowall
log "done"

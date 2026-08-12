# PhotoWall

네컷사진을 자유 배치하는 디지털 포토월 (Next.js + Konva + Supabase).

## 로컬 실행

```bash
cp .env.example .env.local   # 값 채우기
npm install
npm run dev                  # http://localhost:3000
```

필수 env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`  
관리자/signed URL: `ADMIN_USER_IDS`, `SUPABASE_SERVICE_ROLE_KEY`  
자세한 목록은 `.env.example` 참고.

## 배포 전 게이트 (점검 규칙)

```bash
npm run audit:gate
# = build + typecheck + lint + verify:wall-omni + verify:supabase
```

개별:

| 명령 | 용도 |
|---|---|
| `npm run typecheck` | TypeScript strict |
| `npm run lint` | ESLint (`src` + configs, `.next` 제외) |
| `npm run verify:wall-omni` | 벽 확장/축소 수학 smoke |
| `npm run verify:wall-realtime` | 공동벽 Presence + live 2-session sync |
| `npm run verify:supabase` | RLS·Storage·admin 마이그레이션 확인 |
| `npm run build` | 프로덕션 빌드 |

## Supabase SQL

`supabase/*.sql` — Dashboard SQL Editor에서 **순서대로** 1회 실행.  
순서는 `.env.example` 주석 또는 `PROJECT.md` 참고.  
검증: `npm run verify:supabase`

## PM2 (프로덕션 서버)

프로덕션: `https://photowall.kr` (Cloudflare → 개인 Ubuntu + PM2). Cursor Cloud에는 서버 SSH가 없습니다.

### 서버에서 배포

```bash
cd /path/to/PhotoWall          # 실제 앱 경로
bash scripts/pull-and-deploy.sh
# 또는: git pull && npm ci && npm run deploy:prod
```

배포 확인:

```bash
curl -sS https://photowall.kr/api/health
# 기대: rateLimit 가 "ok" 또는 "degraded" (더 이상 "upstash" 문자열 아님)
```

### GitHub Actions (원클릭)

워크플로: **Deploy PM2** (`workflow_dispatch`).  
Repo → Settings → Secrets and variables → Actions 에 다음을 넣은 뒤 Actions 탭에서 Run:

| Secret | 예 |
|---|---|
| `DEPLOY_HOST` | 서버 IP 또는 SSH 호스트 |
| `DEPLOY_USER` | SSH 사용자 |
| `DEPLOY_SSH_KEY` | deploy용 private key (전체 PEM) |
| `DEPLOY_PATH` | 서버의 PhotoWall 절대 경로 |

로컬 PM2:

```bash
pm2 start ecosystem.config.cjs
pm2 restart photowall
```

### 운영 체크리스트 (배포 전)

| 항목 | env / 확인 |
|---|---|
| Supabase | `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_SERVICE_ROLE_KEY` |
| Admin | `ADMIN_USER_IDS` (+ `app_admins` SQL) |
| Rate limit | **필수** `UPSTASH_REDIS_REST_URL` / `TOKEN` (`/api/health` → `rateLimit`) |
| Discord | `DISCORD_WEBHOOK_URL` |
| Sentry | `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` |
| Cron | `CRON_SECRET` + 주간 Storage sweeper |
| SQL | `supabase/ops-hardening-migration.sql` 포함 순서 실행 |
| Health | `GET https://photowall.kr/api/health` |

PM2 주간 고아 파일 정리 예:

```bash
# crontab
0 4 * * 1 curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://photowall.kr/api/cron/storage-orphans
0 * * * * curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://photowall.kr/api/cron/storage-pending-delete
```

벽에서 사진을 지우고 저장하면 24시간 유예 큐(`storage_pending_delete`)에 들어가며, 위 시간별 cron(또는 `/admin/operations`)이 실제 Storage 삭제를 처리합니다.

## 문서

- `PROJECT.md` — 기획·로드맵·ERD·QA 체크리스트

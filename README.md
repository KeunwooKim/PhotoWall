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
| `npm run verify:supabase` | RLS·Storage·admin 마이그레이션 확인 |
| `npm run build` | 프로덕션 빌드 |

## Supabase SQL

`supabase/*.sql` — Dashboard SQL Editor에서 **순서대로** 1회 실행.  
순서는 `.env.example` 주석 또는 `PROJECT.md` 참고.  
검증: `npm run verify:supabase`

## PM2 (이 서버)

```bash
pm2 start ecosystem.config.cjs
pm2 restart photowall
```

프로덕션: `https://photowall.kr`

## 문서

- `PROJECT.md` — 기획·로드맵·ERD·QA 체크리스트

# PhotoWall AI-code audit pass

**일시:** 2026-08-12  
**기준:** 생성형 코더(Cursor 등)로 쌓인 코드의 업계 점검 체크리스트  
(권한/RLS·시크릿·공급망·주입·프로덕션 게이트)  
**베이스라인:** [`AUDIT_REPORT.md`](AUDIT_REPORT.md) (2026-08-08)  
**브랜치:** `cursor/ai-code-audit-e872`  
**결제:** 제외 (문의→관리자 부여만)

---

## 1. 요약

| 등급 | 개수 | 비고 |
|------|------|------|
| **P0** | 0 | — |
| **P1** | 2 → **패치됨** | signed-photos IDOR, guestbook MIME/size |
| **P2** | 다수 → **대부분 패치** | CSP·magic-byte·DNS rebinding만 후순위 |
| **회귀 OK** | 3 | 이전 AUDIT P1 중 SSRF / origin / likes·guestbook INSERT RLS |

전체 평가: 기본 운영 보안(private storage, RLS, rate limit, cron fail-closed)은 양호.  
AI 코드에서 가장 흔한 **인가 구멍**이 signed-photos에 남아 있었고 이번 패스에서 막음.

---

## 2. Phase 0 — 이전 P1 회귀

| 이슈 (AUDIT 2026-08-08) | 상태 | 근거 |
|-------------------------|------|------|
| S-P1-1 부스 SSRF | **패치됨** | `fetchWithTimeout` + `redirect: "manual"` + hop/`imageUrlToDataUrl` allowlist |
| S-P1-2 signed-photos 협업자 prefix | **재오픈 → 이번 패치** | `collaboratorIds?.has(ownerId)` 잔존 → 제거 |
| S-P1-3 `x-forwarded-host` origin | **패치됨** | `getSiteOrigin`은 `NEXT_PUBLIC_SITE_URL` 우선, forwarded-host 미사용 |
| S-P1-4 likes/guestbook INSERT RLS | **패치됨** | `supabase/social-insert-access-migration.sql` |
| S-P2-1 auth `next` 살균 | **패치됨** | `sanitizeAuthNextPath` |

**검증:** `npm run typecheck` 통과 · 프로덕션 `POST …/signed-photos` 무인증 → 403 · `GET /api/health` ok

---

## 3. Phase 1 — 접근제어 / RLS / IDOR

| 표면 | 결과 |
|------|------|
| Admin APIs (25) | OK — 전부 `requireAdminRoute` / `isAdminUser` |
| walls / shared-walls | OK — access + quota |
| signed-photos | **P1 패치** — `onWall ∪ 본인 live upload`만 서명 |
| guestbook | OK access; 업로드 검증은 Phase 3 |
| likes GET | OK `checkWallAccess` |
| likes POST | **보강** — API에도 `checkWallAccess` 추가 (RLS 이중화) |
| friends / invites | OK (제한 계정 쓰기 차단) |
| service role | OK — 서버 env만, `NEXT_PUBLIC_` 없음 |
| wall-photos private | OK (마이그레이션 적용 전제) |

---

## 4. Phase 2 — 시크릿 · 공급망 · 설정

| 항목 | 결과 |
|------|------|
| 소스 하드코딩 시크릿 | **0건** (`.env*` gitignore, `.env.example`만) |
| `npm audit --audit-level=high` | **0 vulnerabilities** |
| 의존성 실존 (slopsquat) | OK — lockfile과 일치하는 일반 패키지만 |
| Cron `===` vs timingSafeEqual | **P2 수용/후순위** |
| Admin API rate limit 부재 | **P2 후순위** |
| CSP unsafe-inline/eval | **P2 수용** (Next/Sentry) |
| `/api/health` 정보 | **P2** — backend 종류 노출 (`upstash`) |

---

## 5. Phase 3 — 입력 · 업로드 · XSS

| 항목 | 결과 |
|------|------|
| wall photo upload MIME/size | OK (빈 MIME은 size만 — P2) |
| guestbook 업로드 | **P1 패치** — MIME 필수 + 플랜 한도 + **4MB** 캡 |
| sticker/banner 경로 | OK — UUID 기반, 사용자 path 없음 |
| XSS (제목/방명록) | OK — React text; `dangerouslySetInnerHTML`는 ThemeScript만 |
| 부스 SSRF | 코어 패치됨; DNS rebinding/IPv6 잔여 **P2** |

---

## 6. Phase 4 — 쿼터 · 플랜 · 법무

| 항목 | 결과 |
|------|------|
| `checkSceneQuota` personal + shared save | OK |
| `getUserPlan` 만료 → free | OK |
| LEGAL_VERSION `2026-07-25` 단일 소스 | OK |
| Free 한도 느슨함 | **제품 이슈** — 별도 PR `#6` (`cursor/tighten-free-quotas-e872`)에서 강화 중. 본 감사 브랜치는 main 기준 |

main `WALL_QUOTAS.free`: 200 objects / 500MB / 6MB scene / 12MB photo / shared 1.

---

## 7. Phase 5 — CI 게이트

| 변경 | 파일 |
|------|------|
| CI에 `npm audit --audit-level=high` 추가 | `.github/workflows/audit-gate.yml` |
| `npm run audit:deps` + `audit:gate`에 포함 | `package.json` |

권장(미적용): 인가·storage·auth·RLS SQL PR은 사람 리뷰 필수 라벨.

---

## 8. 이번 패스에서 수정한 코드

1. [`src/app/api/walls/[id]/signed-photos/route.ts`](src/app/api/walls/[id]/signed-photos/route.ts) — 협업자 prefix 임의 서명 제거  
2. [`src/app/api/walls/[id]/guestbook/route.ts`](src/app/api/walls/[id]/guestbook/route.ts) — MIME/크기 검증  
3. [`src/app/api/walls/[id]/likes/route.ts`](src/app/api/walls/[id]/likes/route.ts) — POST `checkWallAccess`  
4. CI / `audit:deps`

---

## 9. P2 백로그 (수정 보류)

1. ~~Cron Bearer `timingSafeEqual`~~ → **패치** (`src/lib/auth/timing-safe.ts`)
2. ~~Admin API rate limit~~ → **패치** (`requireAdminRoute` 120/min)
3. CSP nonce / unsafe-* 축소 → **수용** (Next/Sentry)
4. ~~Health 응답에서 rateLimit 백엔드 이름 축소~~ → **패치** (`ok`/`degraded`)
5. ~~wall-access fallback `is_hidden` 필터~~ → **패치**
6. ~~빈 MIME 업로드~~ → **패치** (`checkPhotoUpload` 거부). magic-byte는 후순위
7. ~~부스 private IP / IPv6 / link-local~~ → **패치**. DNS rebinding은 후순위
8. ~~verify 스크립트 signed-photos 403 오탐~~ → **이미 OK** (401/403을 정상으로 집계)

### P2 follow-up (2026-08-12 후속)
위 1–2, 4–7 반영. CSP·magic-byte·DNS rebinding만 남음.

---

## 10. 범위 밖

- Toss/Stripe 결제·웹훅
- 앱 내 LLM 프롬프트 인젝션 (해당 기능 없음)
- Playwright E2E 신설

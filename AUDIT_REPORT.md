# PhotoWall 전체 점검 리포트 (결제 제외)

**일시:** 2026-08-08  
**범위:** 보안 + 기능 (Toss/PG/결제 연동 제외, 플러스 수동 부여·쿼터 포함)  
**환경:** 코드 정적 분석 + `verify:*` + 프로덕션 읽기 스모크 (`photowall.kr`)  
**산출:** 이슈 리포트만 (코드 수정은 후속)

---

## 1. 요약

| 등급 | 개수 | 의미 |
|------|------|------|
| **P0** | 0 | 즉시 악용 가능한 치명 결함 (이번 패스에서 확정된 것 없음) |
| **P1** | 4 | 우선 수정 권장 |
| **P2** | 10 | 방어 심화·운영·문서·품질 |
| **통과/양호** | — | 마이그레이션·private storage·health·realtime/omni verify·typecheck |

**전체 평가:** 스토리지 private + RLS + Upstash rate limit + cron fail-closed 등 기본 운영 보안은 양호. 결제 전 단계에서 **부스 import SSRF 잔여**, **signed-photos 과도 서명**, **리다이렉트 origin 신뢰**를 먼저 막는 것이 좋음.

---

## 2. Phase 0 — 준비 결과

### 배포·빌드
- 브랜치: `main` (`d14940d`)
- pm2 `photowall`: online (재시작 15회)
- `.next` BUILD_ID: `2026-08-08 07:44` — 최근 관리자/플랜 UI 빌드와 일치

### 마이그레이션 (`scripts/verify-supabase-migrations.mjs`)
- **18 통과** (plan / plan_expires_at / wall-photos private / app_admins / inquiries / pending-delete / import_events 등)
- **1 실패:** `signed-photos` 프로덕션 프로브 HTTP 403 — **무인증 POST는 Forbidden이 정상** (보안상 양호). verify 스크립트가 인증 없는 호출을 “실패”로 집계하는 **검증 스크립트 오탐**
- **1 확인 필요:** Dashboard에서 policy 이름 수동 확인 (스크립트 안내)

### Env 인벤토리 (값 미노출)
| 키 | 상태 |
|----|------|
| Supabase URL/anon/service role | SET |
| ADMIN_USER_IDS + app_admins 일치 | OK |
| ADMIN_EMAILS | MISSING (코드는 지원, 문서화 약함) |
| Upstash Redis | SET → health `rateLimit: upstash` |
| CRON_SECRET | SET |
| Discord webhook | SET |
| Sentry DSN | SET |
| DISCORD_NOTIFY_ERRORS / Plausible | MISSING (선택) |

### 프로덕션 스모크
- `GET /api/health` → `ok`, supabase ok, upstash
- `/`, `/news`, `/upgrade`, `/capture`, `/import`, `/about`, `/legal/terms`, `/api/board`, `/api/announcements`, `/api/feature-flags`, `/api/banners` → 200
- feature flags: `shared_walls/guestbook/likes/qr_import=true`, `comments=false`
- `storage_pending_delete`: 10건 (만료 due=0 — grace 정상 대기)
- `import_events`: 0 (실부스 E2E 미실행 또는 미적재)
- premium rows: 1, restricted: 0, hidden walls: 0

---

## 3. 보안 이슈 (Phase 1)

### P1

#### S-P1-1. 부스 QR import — HTML 추출 이미지 URL SSRF
- **시나리오:** 허용 도메인 HTML에 `http(s)://내부망/...` 이미지 링크를 넣으면 서버가 후속 fetch
- **재현(코드):** [`src/lib/booth-import/fetch-booth-images.ts`](src/lib/booth-import/fetch-booth-images.ts) — 페이지 URL만 `isAllowedBoothUrl`, `imageUrlToDataUrl`은 미검증; `redirect: "follow"`
- **영향:** SSRF / 내부 스캔·데이터 유출 시도 (인증 사용자 + rate limit으로 완화)
- **권장:** 모든 outbound fetch 전·리다이렉트 후 `isAllowedBoothUrl` + private IP 거부; `redirect: "manual"` 권장

#### S-P1-2. signed-photos — 협업자 prefix 전체 서명
- **시나리오:** 공유벽 편집자가 협업자 `userId/...` 임의 경로를 알면 서비스롤로 signed URL 발급
- **재현(코드):** [`src/app/api/walls/[id]/signed-photos/route.ts`](src/app/api/walls/[id]/signed-photos/route.ts) L75–81 `collaboratorIds?.has(ownerId)`
- **영향:** 경로 UUID 추측은 어렵지만, 유출·추측 시 타 벽 사진 IDOR
- **권장:** `onWall` ∪ 본인 live upload ∪ 단기 allowlist만 허용

#### S-P1-3. 로그인 콜백 origin — `x-forwarded-host` 신뢰
- **시나리오:** 프록시가 클라이언트 Host를 그대로 넘기면 `getSiteOrigin`이 악성 호스트로 리다이렉트
- **재현(코드):** [`src/lib/auth/get-site-origin.ts`](src/lib/auth/get-site-origin.ts), [`src/app/auth/callback/route.ts`](src/app/auth/callback/route.ts)
- **영향:** 배포/프록시 설정에 의존 (Vercel 등에서 완화될 수 있음). 커스텀 reverse proxy 시 위험
- **권장:** `NEXT_PUBLIC_SITE_URL` 고정 또는 allowlist. forwarded-host 무시/검증

#### S-P1-4. likes/guestbook INSERT RLS가 벽 접근 규칙과 불일치
- **시나리오:** 인증 클라이언트가 PostgREST로 임의 `wall_id`에 like/guestbook insert (API 경로는 access 체크함)
- **재현(코드):** `supabase/security-hardening-migration.sql` INSERT 정책 vs API `checkWallAccess`
- **영향:** 스팸 메타데이터 (이미지 bytes는 guestbook 컬럼에 없고 캔버스 쪽)
- **권장:** INSERT `with check`를 walls_select / can_edit 수준으로 정렬

### P2

#### S-P2-1. auth callback `next` 미살균
- [`auth/callback/route.ts`](src/app/auth/callback/route.ts) — `sanitizeWallReturnPath`와 달리 경로 검증 없음
- origin 고정 시 외부 오픈리다이렉트는 제한적 → **S-P1-3과 결합 시 상승**
- **권장:** `^/` 상대경로만, `//`·scheme 거부

#### S-P2-2. CSRF 잔여 (파괴 API)
- wipe/account delete는 `X-Confirm-*`만 — 토큰 아님. SameSite=Lax + custom header preflight로 실무 위험은 낮음
- **권장:** Origin/Referer allowlist 추가

#### S-P2-3. `can_read_wall` exists-only (방어 심화)
- 함수 자체는 invoker rights라 walls RLS가 중첩됨 → **단독 P0 아님**
- SECURITY DEFINER화·walls SELECT 완화 시 위험 → access 미러링으로 hardening

#### S-P2-4. 제한 계정 우회 공백
- `restrictedResponse` 있는 곳: walls save, shared create/save, friends POST, invites create, guestbook, likes, preview, booth-import
- **누락 예:** `DELETE /api/friends/[id]`, shared invitations GET/수락 경로(초대장 API)
- **권장:** 제한 시 소셜 쓰기·초대 수락 일괄 차단

#### S-P2-5. Admin API rate limit 부재
- wipe/stats/users 등 관리자 라우트에 rate limit 거의 없음 (세션 탈취 시 남용)

#### S-P2-6. CSP `unsafe-inline` / `unsafe-eval`
- [`next.config.ts`](next.config.ts) — XSS 시 영향 증폭 (Next/Sentry 제약으로 당장 제거 어려움)

#### S-P2-7. Cron secret timing-safe 비교 미사용
- 문자열 `===` — 엔트로피 충분한 secret이면 실질 위험 낮음. `crypto.timingSafeEqual` 권장

#### S-P2-8. verify 스크립트 signed-photos 오탐
- 무인증 403을 fail로 표기 — 스크립트 수정 필요

#### S-P2-9. ADMIN_EMAILS 미문서화
- `.env.example`에 없음 — 운영 혼선

#### S-P2-10. `/api/health` 정보 공개
- rateLimit backend 노출 — 의도적일 수 있으나 정찰에 유용 (수용 가능 / 최소화 선택)

### 검토 후 기각·완화
| 항목 | 결론 |
|------|------|
| Permissions-Policy `camera=()` vs `/capture` | capture는 `getUserMedia`가 아니라 `<input capture>` — 치명 아님 |
| CSRF로 즉시 계정 삭제 | SameSite+커스텀 헤더로 실무 위험 낮음 |
| Private storage | verify 통과, 공개 URL HEAD 차단 확인 |

---

## 4. 기능·품질 (Phase 2)

### 자동 verify
| 검사 | 결과 |
|------|------|
| `tsc --noEmit` | PASS |
| `npm run lint` | 0 errors / 29 warnings (unused vars, hooks deps) |
| `verify:wall-omni` | PASS (8/8) |
| `verify:wall-realtime` | PASS (presence + patch/full/clear) |

### 기능 관찰 (코드 + 스모크, 브라우저 수동 E2E는 제한적)

| 영역 | 상태 | 메모 |
|------|------|------|
| Auth / legal / upgrade 문의 | 코드·라우트 OK | `/upgrade`는 결제 없이 inquiry |
| 개인벽 리스 | 구현됨 | Realtime 불가 시 OCC 폴백 — 멀티탭 실기기 QA 필요 |
| 공유벽 realtime | verify 스크립트 OK | 실 2브라우저 UI는 수동 |
| 쿼터 | `wall-quotas.ts` free 200/6MB/12MB/500MB, plus 500/16MB/30MB/5GB | |
| 문서 드리프트 | **P2-F-1** | PROJECT.md는 여전히 free 160·4MB·max 2400×4000 등 **구버전** (`wall-bounds`는 2217×1700) |
| QR import | API·allowlist 존재 | `import_events=0` — 실부스 E2E 미검증 (기존 open item) |
| GC | pending 10, due 0 | orphan cron 로직은 운영 주기 확인 권장 |
| 관리자 플랜 기간제 | UI+API+컬럼 OK | 빌드 반영됨 |
| 신고 숨기고 완료 | UI 구현됨 | 수동 클릭 QA 권장 |
| Board/news/events | 라우트 200 | event_posts count=0 — 콘텐츠 비어 있을 수 있음 |
| 하우스 광고 / 플래그 | flags API OK | |

### 기능 P2
- **F-P2-1** PROJECT.md 쿼터·벽 최대 크기·realtime 서술 vs 코드 불일치  
- **F-P2-2** 유닛/E2E 테스트 스위트 없음 — 회귀는 verify 스크립트+수동에 의존  
- **F-P2-3** QR 실부스 E2E 미완  
- **F-P2-4** lint warnings 29건 — 동작 영향은 제한적, 정리 권장  

---

## 5. Safari / 모바일 (Phase 2.5)

**이번 점검:** 실기기 매트릭스는 서버 환경에서 미실행. **코드·설계 리뷰** 결과:

| 항목 | 평가 |
|------|------|
| `konva-device.ts` pixelRatio=1, iOS edge 2400, dprCap 1.5 | 의도적 Jetsam 완화 |
| `WALL_MAX_*` 2217×1700 | iPhone 안정성 튜닝과 일치 |
| presence store로 Stage 전체 리렌더 회피 | 문서/주석과 일치 |
| `usePersonalWallLease` | 신규 경로 — **실기기 2탭/2기기 QA 필수** |
| capture input | 모바일 파일/카메라 입력 경로 |

**미완 (수동 백로그):** iPhone Safari 대형 공유벽+presence, Android Chrome 동일, Desktop 2탭 리스.  
→ 리포트에 **QA-OPEN-1**로 남김.

---

## 6. Phase 3 — 교차·회귀

| 검사 | 결과 |
|------|------|
| feature flags 전부 on (comments off) | API 확인 |
| 숨긴 벽 / 제한 유저 | DB상 0 — 시나리오 데이터로 수동 재검 필요 |
| health / typecheck / omni / realtime | PASS |
| signed-photos 무인증 | 403 Forbidden (기대) |

Flag off 시 UI/API 차단은 코드 경로상 `feature-flags` 참조 — **플래그 토글 수동 확인**은 운영 화면에서 권장 (파괴적 아님).

---

## 7. 제품 한계 (버그 아님)

- 결제 미연동 (`/upgrade` = 문의)
- Soft lock only (hard lock 없음)
- Shared undo는 로컬만
- SVG 타입 미렌더 (기존 문서)
- RBAC/2FA 없음 (단일 admin allowlist)
- E2E 자동화 없음

---

## 8. 권장 수정 백로그 (우선순위)

### Sprint A (보안 P1)
1. Booth import URL 재검증 + redirect 정책 (S-P1-1)  
2. signed-photos 경로 필터 축소 (S-P1-2)  
3. `getSiteOrigin` / callback `next` 살균 (S-P1-3 + S-P2-1)  
4. likes/guestbook INSERT RLS 정렬 (S-P1-4)

### Sprint B (보안·운영 P2)
5. 제한 계정 누락 API 보강 (S-P2-4)  
6. 파괴 API Origin 검사 (S-P2-2)  
7. verify 스크립트 signed-photos 기대값 수정 (S-P2-8)  
8. `.env.example`에 ADMIN_EMAILS 등 문서화 (S-P2-9)

### Sprint C (품질)
9. PROJECT.md 쿼터/bounds/realtime 동기화 (F-P2-1)  
10. lint warning 정리 (F-P2-4)  
11. 실기기 Safari·리스·QR 부스 E2E (QA-OPEN-1, F-P2-3)

---

## 9. 검증 명령 재실행용

```bash
node scripts/verify-supabase-migrations.mjs
npm run verify:wall-omni
npm run verify:wall-realtime
npx tsc --noEmit
curl -sS https://photowall.kr/api/health
```

---

*이 리포트는 계획서 Phase 0–4 실행 결과입니다.*

---

## 10. 보안 패치 적용 (2026-08-08)

| ID | 상태 | 변경 |
|----|------|------|
| S-P1-1 | 적용 | booth fetch manual redirect + image URL allowlist |
| S-P1-2 | 적용 | signed-photos safe path shape + onWall/own/collaborator |
| S-P1-3 / S-P2-1 | 적용 | `NEXT_PUBLIC_SITE_URL` origin, `sanitizeAuthNextPath` |
| S-P1-4 | 적용 | `social-insert-access-migration.sql` (DB applied) |
| S-P2-2 | 적용 | wipe/account Origin 검사 |
| S-P2-4 | 적용 | friends DELETE + invite accept restrict |
| S-P2-8/9 | 적용 | verify 스크립트 + `.env.example` |

검증: `tsc` · build · pm2 restart · health ok · migration verify 0 fail · wall-omni/realtime PASS

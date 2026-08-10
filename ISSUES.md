<!--
=============================================================================
[AI INTERACTION PROTOCOL - DO NOT EDIT OR REMOVE THIS HEADER]

# AI 트러블슈팅 및 이슈 관리 지침 (AI Directives)

이 파일은 개발 중 발생하는 문제를 빠르게 기록하고, AI가 이를 자동 정리 및 해결하는 문서이다.
AI는 사용자가 [# 1. 빠른 문제 메모] 섹션에 간단한 메모나 에러를 작성하면 아래 규칙에 따라 동작해야 한다.

## AI 행동 수칙 (Workflow)
1. **문제 파악 및 정형화 (Reorganize):**
   - 사용자가 작성한 간단한 메모, 에러 로그, 증상을 바탕으로 문제의 핵심과 영향 범위를 파악한다.
   - 부족한 맥락(파일명, 함수명 등)은 프로젝트 코드를 분석하여 보완한다.
2. **해결 및 수정 (Solve):**
   - 원인을 파악하여 구체적인 해결 방법이나 코드 수정안을 제시하고 적용한다.
3. **결과 문서화 (Document):**
   - 해결이 완료되거나 명확한 원인이 파악되면, [# 1. 빠른 문제 메모]의 내용을 지우거나 이동시킨 뒤,
     [# 2. 이슈 및 해결 기록] 섹션에 정형화된 양식으로 깔끔하게 다시 정리해 기록한다.

## 포맷팅 및 언어 규칙
- 상태 태그: `[OPEN]`(진행중), `[RESOLVED]`(해결완료), `[HOLD]`(보류/확인필요)
- 한국어로 명확하고 간결하게 작성하며, 코드가 개입되는 경우 정확한 파일 경로를 포함한다.
=============================================================================
-->

# 1. 빠른 문제 메모 (User Quick Note)
> **사용자 지침:** 문제 증상, 에러 메시지, 궁금한 점을 간편하게 적어두세요. AI가 파악 후 정리 및 해결합니다.

*(비어 있음 — 새 메모를 여기에 추가하세요)*

---

# 2. 이슈 및 해결 기록 (AI Structured Log)
> **AI 지침:** 사용자의 메모를 해결한 뒤 아래 형식으로 정리하여 기록하세요.

### [ISSUE-001] 뒤집기 후 선택 테두리가 개체와 어긋남
- **상태:** `[RESOLVED]`
- **관련 파일:** `src/components/wall/pixi/pixi-wall-engine.ts`
- **문제 내용:**
  - 좌우/상하 뒤집기 후 선택 박스·핸들이 개체 반대편에 그려짐
- **원인 분석:**
  - Pixi 커스텀 transformer가 `Math.abs(scale)`로 크기만 맞추고, 음수 scale 시 콘텐츠가 origin 반대쪽에 있는데 박스는 `(0,0)` 기준으로 그림
- **해결 내용:**
  - 음수 scale일 때 박스 offset `(ox, oy)` 적용, 핸들/회전 중심도 시각 중심에 맞춤
  - 스케일 조작 시 부호(sign) 유지해 뒤집기가 풀리지 않도록 수정

### [ISSUE-002] 벽 크기 고정 시 개체 이동마다 토스트
- **상태:** `[RESOLVED]`
- **관련 파일:** `src/lib/wall-scene/wall-drag-expand.ts`
- **문제 내용:**
  - 벽 크기 고정 상태에서 아무 개체나 옮겨도 “벽 크기가 고정되어 있어요” 토스트가 반복됨
- **원인 분석:**
  - 드래그 중 shrink-to-fit도 `allowWallSizeChange()`를 타서 잠금 토스트가 발생
- **해결 내용:**
  - shrink-only 제안은 토스트 없이 무시, grow가 필요할 때만 잠금 토스트

### [ISSUE-003] 격자 보기 / 격자 맞춤 / 전체 선택 체감 상실
- **상태:** `[RESOLVED]`
- **관련 파일:**
  - `src/components/wall/pixi/usePixiWallGrid.ts`
  - `src/components/wall/pixi/PixiWallStage.tsx`
  - `src/components/wall/pixi/pixi-wall-engine.ts`
- **문제 내용:**
  - 격자 보기·맞춤·전체 선택이 안 되는 것처럼 동작
- **원인 분석:**
  - 스토어/사이드바 핸들러는 정상. Pixi가 `showGrid`를 그리지 않아 격자 보기가 안 보임
  - 격자 맞춤(snap)은 드래그 시 동작했으나 격자 미표시로 체감이 약함
  - 전체 선택은 스토어에 반영되나 Pixi가 `ids[0]`만 테두리 표시
- **해결 내용:**
  - Pixi world에 격자 오버레이 추가 (`usePixiWallGrid`)
  - 다중 선택 아웃라인 + primary = 마지막 선택 id (전체 선택/시프트 선택 시각화)

### [ISSUE-004] Shift 다중 선택 시 테두리·크기 조절 없음
- **상태:** `[RESOLVED]`
- **관련 파일:** `src/components/wall/pixi/pixi-wall-engine.ts`
- **문제 내용:**
  - Shift로 여러 개 선택해도 시각적 테두리가 없고 크기 조절이 안 됨
- **원인 분석:**
  - `setSelectedIds`가 `ids[0]`만 transformer에 연결 (단일 선택 UI)
- **해결 내용:**
  - 선택 전부 모두 아웃라인 표시, 마지막(primary)에 스케일/회전 핸들
  - 핸들 조작 시 선택 전체 peer를 공통 중심으로 일괄 스케일·회전

### [ISSUE-005] 메인·관리자 벽 미리보기가 갱신되지 않음
- **상태:** `[RESOLVED]`
- **관련 파일:**
  - `src/components/home/CorkWallPreview.tsx`
  - `src/components/home/HomePage.tsx`
  - `src/components/home/HomeDesktop.tsx`
  - `src/app/api/admin/walls/[id]/route.ts`
  - `src/app/admin/walls/page.tsx`
- **문제 내용:**
  - 편집 후 홈 메인 미리보기·관리자 유저 벽 미리보기가 옛 이미지로 남거나 안 보임
- **원인 분석:**
  - 전체 벽 JPEG 캡처/업로드(Pixi extract·SPA 이탈 레이스)에 의존해 실패가 잦음
- **해결 내용:**
  - JPEG 미리보기 대신 **벽 canvas의 최근 사진 signed URL 콜라주**로 대체
  - 홈: `extractRecentWallPhotoPaths` → `CorkWallPreview photos={...}`
  - 관리자: 상세 API가 `photoUrls` 반환, 그리드로 표시
  - (공유/내보내기용 캡처 업로드 경로는 유지 가능)

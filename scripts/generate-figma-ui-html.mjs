#!/usr/bin/env node
/**
 * Generates static HTML mockups per route under public/figma-ui/
 * Run: node scripts/generate-figma-ui-html.mjs
 */
import { writeFileSync, mkdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "figma-ui");
mkdirSync(ROOT, { recursive: true });

const SHARED_CSS = readFileSync(join(ROOT, "shared.css"), "utf8");

function page(title, route, body, extra = "") {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PhotoWall — ${title}</title>
  <style>
${SHARED_CSS}
  </style>
</head>
<body>
  <div class="figma-meta"><strong>${title}</strong><span>Route: ${route}</span></div>
  <div class="page-wrap">${body}${extra}</div>
</body>
</html>`;
}

function mobile(label, inner) {
  return `<div><div class="frame-label">${label}</div><div class="device device-mobile flex-col">${inner}</div></div>`;
}

function desktop(label, inner) {
  return `<div><div class="frame-label">${label}</div><div class="device device-desktop flex-col">${inner}</div></div>`;
}

function header(left, right = "") {
  return `<header class="app-header"><div class="app-header-left">${left}</div><div class="gap-2 flex-row">${right}</div></header>`;
}

function bottomNav(active = "home") {
  const items = [
    ["home", "홈", "home.html"],
    ["walls", "벽", "walls.html"],
    ["stickers", "스티커", "stickers.html"],
    ["settings", "설정", "settings.html"],
  ];
  return `<nav class="bottom-nav">${items
    .map(
      ([id, label, href]) =>
        `<a href="${href}" class="${id === active ? "active" : ""}">${label}</a>`,
    )
    .join("")}</nav>`;
}

function wallCanvas(extra = "") {
  return `<div class="wall-canvas flex-1">${`
    <div class="wall-photo" style="left:32px;top:48px;width:110px;height:85px;transform:rotate(-5deg)"></div>
    <div class="wall-photo" style="left:160px;top:90px;width:95px;height:120px;transform:rotate(4deg)"></div>
    <div class="wall-photo" style="left:80px;top:200px;width:130px;height:95px"></div>
    ${extra}`}</div>`;
}

function editorHeader() {
  return header(
    `<button class="btn btn-ghost btn-sm">≡</button><span class="text-xs text-muted">내 벽</span>`,
    `<button class="btn btn-ghost btn-sm">공유</button><button class="btn btn-primary btn-sm">저장</button>`,
  );
}

function toolDock() {
  return `<div class="toolbar-dock"><span>↖</span><span>✋</span><span class="on">▢</span><span>🖊</span><span>T</span><span>+</span></div>`;
}

const PAGES = {};

// ── Index ──
PAGES["index.html"] = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>PhotoWall UI — All Pages</title>
  <style>
${SHARED_CSS}
    .how-to { max-width: 960px; margin: 0 auto 24px; padding: 16px 20px; background: #fff; border-radius: 12px; border: 1px solid var(--border); font-size: 13px; line-height: 1.6; }
    .how-to h2 { font-size: 15px; margin-bottom: 8px; }
    .how-to ol { margin-left: 18px; }
    .how-to li { margin-bottom: 6px; }
    .how-to code { background: var(--surface); padding: 2px 6px; border-radius: 4px; font-size: 12px; }
  </style>
</head>
<body>
  <div class="index-grid">
    <h1>PhotoWall — 페이지별 Figma UI</h1>
    <p>각 HTML 파일은 CSS가 <strong>인라인</strong>되어 있어 Figma 플러그인에 붙여넣기 가능합니다.</p>

    <div class="how-to">
      <h2>Figma에 붙여넣기 (무료 · Yolbridge 권장)</h2>
      <ol>
        <li>Figma Community에서 <strong>Yolbridge — HTML to Figma</strong> 플러그인 설치 (완전 무료)</li>
        <li>아래 목록에서 페이지 HTML 파일을 에디터로 열기</li>
        <li><code>Ctrl+A</code> → <code>Ctrl+C</code> 전체 복사</li>
        <li>Figma에서 Yolbridge 실행 → <strong>Paste HTML</strong> 칸에 붙여넣기 → Import</li>
      </ol>
      <p style="margin-top:12px;color:var(--muted)">또는 .html 파일을 Yolbridge 창에 <strong>드래그 앤 드롭</strong>해도 됩니다.<br>
      대안: <a href="https://coderender.app" target="_blank" rel="noopener">CodeRender</a> (월 10회 무료) — HTML 붙여넣기 → Convert → Figma에 Ctrl+V</p>
    </div>

    <ul>
      <li><a href="home-promo.html">Promo Landing<small>/ (비로그인)</small></a></li>
      <li><a href="home.html">Home<small>/ (로그인)</small></a></li>
      <li><a href="about.html">About<small>/about</small></a></li>
      <li><a href="profile.html">Profile<small>/profile</small></a></li>
      <li><a href="settings.html">Settings<small>/settings</small></a></li>
      <li><a href="walls.html">Walls Hub<small>/walls</small></a></li>
      <li><a href="upgrade.html">Upgrade<small>/upgrade</small></a></li>
      <li><a href="news.html">News<small>/news</small></a></li>
      <li><a href="capture.html">Capture / Scan<small>/capture</small></a></li>
      <li><a href="import.html">QR Import<small>/import</small></a></li>
      <li><a href="wall-edit.html">Wall Editor<small>/wall/edit</small></a></li>
      <li><a href="wall-edit-share.html">Editor · Share panel<small>/wall/edit</small></a></li>
      <li><a href="wall-edit-instagram-pick.html">Editor · Instagram pick<small>/wall/edit</small></a></li>
      <li><a href="wall-edit-instagram-adjust.html">Editor · Instagram adjust<small>/wall/edit</small></a></li>
      <li><a href="wall-view.html">Wall Viewer<small>/wall/[id]</small></a></li>
      <li><a href="wall-share.html">Wall Share decode<small>/wall/share</small></a></li>
      <li><a href="shared-wall.html">Shared Wall Editor<small>/shared/[id]</small></a></li>
      <li><a href="invite.html">Invite<small>/invite/[code]</small></a></li>
      <li><a href="stickers.html">Sticker Store<small>/stickers</small></a></li>
      <li><a href="stickers-mine.html">My Stickers<small>/stickers/mine</small></a></li>
      <li><a href="stickers-create.html">Create Sticker Pack<small>/stickers/create</small></a></li>
      <li><a href="sticker-detail.html">Sticker Pack Detail<small>/stickers/[id]</small></a></li>
      <li><a href="legal-privacy.html">Privacy<small>/legal/privacy</small></a></li>
      <li><a href="legal-terms.html">Terms<small>/legal/terms</small></a></li>
      <li><a href="admin.html">Admin Dashboard<small>/admin</small></a></li>
      <li><a href="admin-walls.html">Admin Walls<small>/admin/walls</small></a></li>
      <li><a href="admin-users.html">Admin Users<small>/admin/users</small></a></li>
      <li><a href="admin-user-detail.html">Admin User Detail<small>/admin/users/[id]</small></a></li>
      <li><a href="admin-announcements.html">Admin Announcements<small>/admin/announcements</small></a></li>
      <li><a href="admin-banners.html">Admin Banners<small>/admin/banners</small></a></li>
      <li><a href="admin-events.html">Admin Events<small>/admin/events</small></a></li>
      <li><a href="admin-inquiries.html">Admin Inquiries<small>/admin/inquiries</small></a></li>
      <li><a href="admin-operations.html">Admin Operations<small>/admin/operations</small></a></li>
      <li><a href="admin-plans.html">Admin Plans<small>/admin/plans</small></a></li>
      <li><a href="admin-sticker-packs.html">Admin Sticker Packs<small>/admin/sticker-packs</small></a></li>
    </ul>
  </div>
</body>
</html>`;

PAGES["home-promo.html"] = page(
  "Promo Landing",
  "/",
  mobile(
    "Mobile 390",
    `<div class="promo-hero flex-1">
      <p class="text-sm text-muted" style="margin-bottom:8px">PhotoWall</p>
      <h1 class="promo-title">나만의<br>디지털 포토월</h1>
      <p class="text-sm text-muted">네컷·스티커·펜으로 벽을 꾸미고 친구와 공유하세요</p>
      <button class="promo-cta">Google로 시작하기</button>
      <div style="height:200px;margin:24px 0;background:var(--surface);border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px">Hero collage</div>
    </div>
    <div class="feature-grid">
      <div class="feature-card" style="background:rgba(255,91,141,0.06)"><h3>📌 자유롭게 붙이고 꾸미기</h3><p>사진·스티커·테이프를 비뚤어지게</p></div>
      <div class="feature-card" style="background:rgba(184,224,210,0.15)"><h3>⚡ 로그인 없이 체험</h3><p>바로 꾸미고 나중에 저장</p></div>
    </div>`,
  ),
);

PAGES["home.html"] = page(
  "Home (logged in)",
  "/",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">PhotoWall</span>`, `<button class="btn btn-ghost btn-sm">알림</button><button class="btn btn-ghost btn-sm">프로필</button>`)}
    <div class="p-4 flex-col gap-3 flex-1">
      <div style="height:140px;background:var(--surface);border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted)">Cork wall preview</div>
      <div class="card"><p class="font-semibold text-sm">내 벽 꾸미기</p><p class="text-xs text-muted" style="margin:4px 0 12px">사진·스티커·펜</p><a href="wall-edit.html" class="btn btn-primary">편집하기</a></div>
      <div class="card"><p class="font-semibold text-sm">공동 벽</p><p class="text-xs text-muted">여름 추억 · 3명</p></div>
      <div class="card"><p class="font-semibold text-sm">친구</p><p class="text-xs text-muted">5명 · 초대 대기 1</p></div>
    </div>
    ${bottomNav("home")}`,
  ) +
    desktop(
      "Desktop 1280",
      `${header(`<span class="font-semibold text-lg">PhotoWall</span>`, `<button class="btn btn-ghost">알림</button><button class="btn btn-primary">내 벽 편집</button>`)}
      <div style="display:grid;grid-template-columns:1fr 320px;flex:1;min-height:600px">
        <div class="p-4" style="background:var(--surface)">Desktop home grid · friends · shared walls</div>
        <div class="p-4 border-left" style="border-left:1px solid var(--border)">Sidebar notifications</div>
      </div>`,
    ),
);

PAGES["about.html"] = page(
  "About",
  "/about",
  mobile(
    "Mobile 390",
    `${header(`<a href="home-promo.html" class="btn btn-ghost btn-sm">← 홈</a>`, `<button class="btn btn-ghost btn-sm">로그인</button>`)}
    <div class="promo-hero"><h1 class="promo-title" style="font-size:26px">PhotoWall 소개</h1><p class="text-sm text-muted">디지털 포토월 · 네컷 · 공동 벽</p></div>
    <div class="feature-grid flex-1">${["자유 배치", "공동 벽", "방명록", "인스타 공유"].map((t) => `<div class="feature-card"><h3>${t}</h3><p class="text-xs text-muted">기능 설명</p></div>`).join("")}</div>`,
  ),
);

PAGES["profile.html"] = page(
  "Profile",
  "/profile",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">프로필</span>`, `<a href="settings.html" class="btn btn-ghost btn-sm">설정</a>`)}
    <div class="p-4 flex-col gap-3 flex-1">
      <div style="display:flex;gap:12px;align-items:center"><div class="avatar"></div><div><p class="font-semibold">김포토</p><p class="text-xs text-muted">friend code · ABC123</p></div></div>
      <div class="card">
        <p class="font-semibold text-sm">내 벽</p>
        <p class="text-xs text-muted" style="margin:4px 0">Free · 클라우드 저장됨</p>
        <div class="gap-2 flex-row" style="margin-top:12px"><a href="wall-edit.html" class="btn btn-primary btn-sm">편집</a><a href="wall-view.html" class="btn btn-outline btn-sm">보기</a></div>
      </div>
      <div class="card list-item"><span>친구</span><span class="text-muted" style="margin-left:auto">5</span></div>
      <div class="card list-item"><span>공동 벽</span><span class="text-muted" style="margin-left:auto">2</span></div>
      <button class="btn btn-outline btn-block text-muted">로그아웃</button>
    </div>`,
  ),
);

PAGES["settings.html"] = page(
  "Settings",
  "/settings",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">설정</span>`, `<button class="btn btn-ghost btn-sm">로그인</button>`)}
    <div class="p-4 flex-col gap-3 flex-1">
      <div class="card"><p class="text-xs text-muted" style="margin-bottom:8px">테마</p><div class="gap-2 flex-row"><span class="chip chip-on">라이트</span><span class="chip chip-off">다크</span><span class="chip chip-off">시스템</span></div></div>
      <div class="card"><p class="text-xs text-muted" style="margin-bottom:8px">색상 팔레트</p><div class="gap-2 flex-row"><span class="chip chip-on">Mono</span><span class="chip chip-off">Blush</span><span class="chip chip-off">Mist</span></div></div>
      <div class="card list-item"><span>벽 방문 허용</span><span style="margin-left:auto;width:40px;height:24px;background:var(--foreground);border-radius:999px"></span></div>
      <a href="upgrade.html" class="card list-item">플랜 · Free → Plus</a>
      <div class="card"><p class="font-semibold text-sm" style="margin-bottom:8px">문의하기</p><input class="input" placeholder="내용을 입력하세요" /><button class="btn btn-primary btn-block" style="margin-top:8px">보내기</button></div>
      <button class="btn btn-outline btn-block" style="color:#dc2626">계정 삭제</button>
    </div>
    ${bottomNav("settings")}`,
  ),
);

PAGES["walls.html"] = page(
  "Walls Hub",
  "/walls",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">벽</span>`, `<button class="btn btn-primary btn-sm">+ 공동 벽</button>`)}
    <div class="p-4 flex-col gap-3 flex-1">
      <p class="text-xs text-muted">내 벽 · 공동 벽 · 친구 벽</p>
      <div class="card"><p class="font-semibold">내 벽</p><p class="text-xs text-muted">방금 편집함</p></div>
      <div class="card"><p class="font-semibold">여름 추억</p><p class="text-xs text-muted">공동 · 3명 · 실시간</p></div>
      <div class="card"><p class="font-semibold">친구 @minji</p><p class="text-xs text-muted">방문 가능</p></div>
    </div>
    ${bottomNav("walls")}`,
  ),
);

PAGES["upgrade.html"] = page(
  "Upgrade",
  "/upgrade",
  mobile(
    "Mobile 390",
    `${header(`<a href="settings.html" class="btn btn-ghost btn-sm">←</a>`, ``)}
    <div class="p-4 flex-col gap-3 flex-1" style="text-align:center;padding-top:32px">
      <p class="font-bold text-lg">PhotoWall Plus</p>
      <p class="text-sm text-muted">더 많은 사진 · 스티커 · 공동 벽</p>
      <div class="card" style="text-align:left;margin-top:16px"><p class="font-semibold">Free</p><p class="text-xs text-muted">현재 플랜</p></div>
      <div class="card" style="border:2px solid var(--foreground);text-align:left"><p class="font-semibold">Plus</p><p class="text-xs text-muted">월 ₩4,900 · 사진 200장</p><button class="btn btn-primary btn-block" style="margin-top:12px">업그레이드</button></div>
    </div>`,
  ),
);

PAGES["news.html"] = page(
  "News",
  "/news",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">소식</span>`, `<a href="home.html" class="btn btn-ghost btn-sm">홈</a>`)}
    <div class="p-4 flex-col gap-3 flex-1">
      <div class="card"><p class="badge" style="margin-bottom:6px">업데이트</p><p class="font-semibold text-sm">인스타 영역 내보내기</p><p class="text-xs text-muted">2026.08.11</p></div>
      <div class="card"><p class="font-semibold text-sm">여름 스티커 팩 출시</p><p class="text-xs text-muted">2026.07.01</p></div>
    </div>`,
  ),
);

PAGES["capture.html"] = page(
  "Capture / Scan",
  "/capture",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">네컷 스캔</span>`, `<button class="btn btn-ghost btn-sm">닫기</button>`)}
    <div class="flex-1 flex-col" style="background:#111;color:white;align-items:center;justify-content:center;display:flex;padding:24px">
      <div style="width:280px;height:380px;border:2px dashed rgba(255,255,255,0.4);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:13px;text-align:center">카메라 뷰파인더<br><br>네컷 프레임 맞추기</div>
      <button class="btn btn-primary" style="margin-top:24px;border-radius:999px;width:64px;height:64px">●</button>
    </div>`,
  ),
);

PAGES["import.html"] = page(
  "QR Import",
  "/import",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">QR 가져오기</span>`, ``)}
    <div class="p-4 flex-col gap-3 flex-1" style="text-align:center;padding-top:40px">
      <div style="width:240px;height:240px;background:var(--surface);margin:0 auto;border-radius:16px;display:flex;align-items:center;justify-content:center;color:var(--muted)">QR scanner</div>
      <p class="text-sm text-muted">부스 QR을 스캔하면 사진이 벽에 붙어요</p>
      <a href="wall-edit.html" class="btn btn-primary">편집 화면으로</a>
    </div>`,
  ),
);

PAGES["wall-edit.html"] = page(
  "Wall Editor",
  "/wall/edit",
  mobile(
    "Mobile 390",
    `<div style="position:relative;flex:1;display:flex;flex-direction:column;min-height:844px">
    ${editorHeader()}
    ${wallCanvas(`<div style="position:absolute;left:155px;top:85px;width:100px;height:125px;border:2px solid #3b82f6;border-radius:4px"></div>`)}
    ${toolDock()}
    </div>`,
  ) +
    desktop(
      "Desktop 1280",
      `<div class="flex-row flex-1" style="min-height:800px">
      <div style="width:56px;background:var(--surface);border-right:1px solid var(--border);padding:8px">Tool rail</div>
      <div style="width:260px;border-right:1px solid var(--border);padding:12px"><p class="text-xs font-semibold">에셋</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px">${Array(6).fill('<div style="aspect-ratio:1;background:var(--surface);border-radius:8px"></div>').join("")}</div></div>
      <div class="flex-col flex-1">${editorHeader()}${wallCanvas()}</div>
      <div style="width:280px;border-left:1px solid var(--border);padding:12px"><p class="text-xs font-semibold">속성</p><p class="text-xs text-muted" style="margin-top:8px">선택된 객체</p></div>
    </div>`,
    ),
);

PAGES["wall-edit-share.html"] = page(
  "Editor · Share",
  "/wall/edit → 공유 탭",
  mobile(
    "Mobile 390",
    `<div style="position:relative;min-height:844px;display:flex;flex-direction:column">
    ${editorHeader()}
    ${wallCanvas()}
    <div class="drawer-scrim"></div>
    <div class="drawer-side">
      <p class="font-semibold p-3" style="border-bottom:1px solid var(--border)">공유</p>
      <div class="list-item">🔗 공유 링크 복사</div>
      <div class="list-item">📷 인스타로 저장</div>
      <div class="list-item">⬇ 이미지로 저장</div>
      <p class="text-xs text-muted p-3">← 메뉴로</p>
    </div>
    </div>`,
  ),
);

PAGES["wall-edit-instagram-pick.html"] = page(
  "Editor · Instagram pick",
  "/wall/edit → 인스타 export",
  mobile(
    "Mobile 390",
    `<div style="position:relative;min-height:844px;display:flex;flex-direction:column">
    ${editorHeader()}
    ${wallCanvas(`<div style="position:absolute;inset:0;background:rgba(0,0,0,0.35)"></div><div style="position:absolute;left:50px;top:120px;width:200px;height:200px;border:2px dashed white"></div>`)}
    <p style="position:absolute;top:56px;left:50%;transform:translateX(-50%);background:rgba(10,10,10,0.85);color:white;padding:8px 16px;border-radius:999px;font-size:12px;white-space:nowrap">자랑하고 싶은 구역을 드래그해서 선택하세요</p>
    <div class="float-toolbar">
      <p class="text-xs text-muted" style="text-align:center;margin-bottom:8px">인스타 내보내기 · 영역 선택</p>
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:8px"><span class="chip chip-on">1:1</span><span class="chip chip-off">4:5</span><span class="chip chip-off">9:16</span></div>
      <div style="display:flex;justify-content:center;gap:8px"><button class="btn btn-ghost btn-sm">자동 추천</button><button class="btn btn-ghost btn-sm">취소</button><button class="btn btn-primary btn-sm" style="opacity:0.5">저장 / 공유</button></div>
    </div>
    </div>`,
  ),
);

PAGES["wall-edit-instagram-adjust.html"] = page(
  "Editor · Instagram adjust",
  "/wall/edit → 인스타 export",
  mobile(
    "Mobile 390",
    `<div style="position:relative;min-height:844px;display:flex;flex-direction:column">
    ${editorHeader()}
    ${wallCanvas()}
    <div style="position:absolute;inset:0;background:rgba(0,0,0,0.45);pointer-events:none"></div>
    <div style="position:absolute;left:45px;top:180px;width:300px;height:375px;border:2px solid white;box-shadow:0 0 0 9999px rgba(0,0,0,0.45)"></div>
    <div class="float-toolbar">
      <p class="text-xs text-muted" style="text-align:center;margin-bottom:8px">인스타 내보내기 · 크롭 조정</p>
      <div style="display:flex;justify-content:center;gap:6px;margin-bottom:8px"><span class="chip chip-off">1:1</span><span class="chip chip-on">4:5</span><span class="chip chip-off">9:16</span></div>
      <div style="display:flex;justify-content:center;gap:8px"><button class="btn btn-ghost btn-sm">자동 추천</button><button class="btn btn-ghost btn-sm">취소</button><button class="btn btn-primary btn-sm">저장 / 공유</button></div>
    </div>
    </div>`,
  ),
);

PAGES["wall-view.html"] = page(
  "Wall Viewer",
  "/wall/[id]",
  mobile(
    "Mobile 390",
    `<div style="position:relative;min-height:844px;display:flex;flex-direction:column">
    ${wallCanvas()}
    <div style="position:absolute;top:12px;left:16px;right:16px;display:flex;justify-content:space-between">
      <button class="btn-pill">나도 꾸미기</button>
      <div class="gap-2 flex-row"><button class="btn-pill">♥ 12</button><button class="btn-pill">⋯</button></div>
    </div>
    </div>`,
  ),
);

PAGES["wall-share.html"] = page(
  "Wall Share",
  "/wall/share",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">공유 벽</span>`, ``)}
    ${wallCanvas()}
    <div class="p-4"><p class="text-sm text-muted">링크로 공유된 벽을 불러오는 중…</p></div>`,
  ),
);

function adminPage(title, route, navActive, mainContent) {
  return page(
    title,
    route,
    desktop(
      "Desktop 1280",
      `${header(`<span class="font-semibold">Admin</span>`, `<span class="text-xs text-muted">admin@photowall</span>`)}
      <div class="admin-layout">
        <nav class="admin-nav">
          <a href="admin.html" class="${navActive === "dashboard" ? "on" : ""}">대시보드</a>
          <a href="admin-walls.html" class="${navActive === "walls" ? "on" : ""}">벽</a>
          <a href="admin-users.html" class="${navActive === "users" ? "on" : ""}">사용자</a>
          <a href="admin-announcements.html" class="${navActive === "announcements" ? "on" : ""}">공지</a>
          <a href="admin-banners.html" class="${navActive === "banners" ? "on" : ""}">배너</a>
          <a href="admin-events.html" class="${navActive === "events" ? "on" : ""}">이벤트</a>
          <a href="admin-inquiries.html" class="${navActive === "inquiries" ? "on" : ""}">문의</a>
          <a href="admin-operations.html" class="${navActive === "operations" ? "on" : ""}">운영</a>
          <a href="admin-plans.html" class="${navActive === "plans" ? "on" : ""}">플랜</a>
          <a href="admin-sticker-packs.html" class="${navActive === "stickers" ? "on" : ""}">스티커 검수</a>
        </nav>
        <main class="admin-main">${mainContent}</main>
      </div>`,
    ),
  );
}

PAGES["shared-wall.html"] = page(
  "Shared Wall Editor",
  "/shared/[id]",
  mobile(
    "Mobile 390",
    `<div style="position:relative;min-height:844px;display:flex;flex-direction:column">
    ${header(`<button class="btn btn-ghost btn-sm">≡</button><span class="text-xs">여름 추억 <span style="color:#059669">실시간</span></span>`, `<button class="btn btn-ghost btn-sm">공유</button>`)}
    ${wallCanvas()}
    ${toolDock()}
    </div>`,
  ),
);

PAGES["invite.html"] = page(
  "Invite",
  "/invite/[code]",
  mobile(
    "Mobile 390",
    `<div class="p-4 flex-col gap-3 flex-1" style="padding-top:80px;text-align:center">
    <p class="font-bold text-lg">공동 벽 초대</p>
    <p class="text-sm text-muted">@kim 님이 「여름 추억」 벽에 초대했어요</p>
    <div class="card" style="margin-top:24px"><p class="font-semibold">여름 추억</p><p class="text-xs text-muted">멤버 3명</p></div>
    <button class="btn btn-primary btn-block" style="margin-top:16px">수락하고 참여</button>
    <button class="btn btn-ghost btn-block">거절</button>
    </div>`,
  ),
);

PAGES["stickers.html"] = page(
  "Sticker Store",
  "/stickers",
  mobile(
    "Mobile 390",
    `${header(`<span class="font-semibold">스티커</span>`, `<a href="stickers-mine.html" class="btn btn-ghost btn-sm">내 스티커</a>`)}
    <div class="sticker-hero"><p class="font-bold">스티커 스토어</p><p class="text-xs text-muted">공식 · 커뮤니티 팩</p></div>
    <div class="filter-row"><span class="chip chip-on">전체</span><span class="chip chip-off">공식</span><span class="chip chip-off">커뮤니티</span><span class="chip chip-off">인기</span></div>
    <div class="sticker-grid flex-1">
      <a href="sticker-detail.html" class="sticker-pack"><div class="sticker-pack-cover" style="background:linear-gradient(135deg,#fecdd3,#fda4af)"></div><div class="sticker-pack-body">Summer</div></a>
      <a href="sticker-detail.html" class="sticker-pack"><div class="sticker-pack-cover" style="background:linear-gradient(135deg,#bbf7d0,#86efac)"></div><div class="sticker-pack-body">Basic</div></a>
      <div class="sticker-pack"><div class="sticker-pack-cover" style="background:linear-gradient(135deg,#ddd6fe,#c4b5fd)"></div><div class="sticker-pack-body">Cafe</div></div>
      <div class="sticker-pack"><div class="sticker-pack-cover" style="background:linear-gradient(135deg,#fde68a,#fcd34d)"></div><div class="sticker-pack-body">Party</div></div>
    </div>
    ${bottomNav("stickers")}`,
  ),
);

PAGES["stickers-mine.html"] = page(
  "My Stickers",
  "/stickers/mine",
  mobile(
    "Mobile 390",
    `${header(`<a href="stickers.html" class="btn btn-ghost btn-sm">←</a><span class="font-semibold">내 스티커</span>`, `<a href="stickers-create.html" class="btn btn-primary btn-sm">만들기</a>`)}
    <div class="p-4 flex-col gap-3 flex-1">
      <div class="card"><p class="font-semibold text-sm">내가 만든 팩</p><p class="text-xs text-muted">검수 중 · 12개</p></div>
      <div class="card"><p class="font-semibold text-sm">설치한 팩</p><p class="text-xs text-muted">Summer, Basic, Cafe</p></div>
    </div>`,
  ),
);

PAGES["stickers-create.html"] = page(
  "Create Sticker Pack",
  "/stickers/create",
  mobile(
    "Mobile 390",
    `${header(`<a href="stickers-mine.html" class="btn btn-ghost btn-sm">←</a>`, `<button class="btn btn-primary btn-sm">제출</button>`)}
    <div class="p-4 flex-col gap-3 flex-1">
      <label class="text-xs text-muted">팩 이름</label><input class="input" value="My Pack" />
      <label class="text-xs text-muted">설명</label><input class="input" placeholder="설명" />
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px">${Array(8).fill('<div style="aspect-ratio:1;background:var(--surface);border-radius:8px;border:1px dashed var(--border)"></div>').join("")}</div>
      <button class="btn btn-outline btn-block">+ 스티커 추가</button>
    </div>`,
  ),
);

PAGES["sticker-detail.html"] = page(
  "Sticker Pack Detail",
  "/stickers/[id]",
  mobile(
    "Mobile 390",
    `${header(`<a href="stickers.html" class="btn btn-ghost btn-sm">←</a>`, `<button class="btn btn-primary btn-sm">설치</button>`)}
    <div class="sticker-pack-cover" style="height:160px;background:linear-gradient(135deg,#fecdd3,#fda4af)"></div>
    <div class="p-4 flex-col gap-2 flex-1">
      <p class="font-bold text-lg">Summer</p><p class="text-sm text-muted">공식 · 24 stickers · 1.2k downloads</p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px">${Array(12).fill('<div style="aspect-ratio:1;background:var(--surface);border-radius:8px"></div>').join("")}</div>
    </div>`,
  ),
);

PAGES["legal-privacy.html"] = page(
  "Privacy Policy",
  "/legal/privacy",
  mobile(
    "Mobile 390",
    `${header(`<a href="home-promo.html" class="btn btn-ghost btn-sm">←</a>`, ``)}
    <article class="legal-body flex-1">
      <h1>개인정보 처리방침</h1>
      <h2>1. 수집 항목</h2><p>Google 로그인 정보, 프로필, 업로드 사진 등</p>
      <h2>2. 이용 목적</h2><p>서비스 제공, 콘텐츠 공유, 고객 지원</p>
      <h2>3. 보관 기간</h2><p>회원 탈퇴 시까지</p>
    </article>`,
  ),
);

PAGES["legal-terms.html"] = page(
  "Terms of Service",
  "/legal/terms",
  mobile(
    "Mobile 390",
    `${header(`<a href="home-promo.html" class="btn btn-ghost btn-sm">←</a>`, ``)}
    <article class="legal-body flex-1">
      <h1>이용약관</h1>
      <h2>제1조 목적</h2><p>PhotoWall 서비스 이용에 관한 조건</p>
      <h2>제2조 정의</h2><p>회원, 콘텐츠, 포토월 등</p>
    </article>`,
  ),
);

PAGES["admin.html"] = adminPage(
  "Dashboard",
  "/admin",
  "dashboard",
  `<h2 class="font-semibold" style="margin-bottom:16px">대시보드</h2>
  <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
    <div class="card"><p class="text-xs text-muted">사용자</p><p class="font-bold text-lg">1,240</p></div>
    <div class="card"><p class="text-xs text-muted">벽</p><p class="font-bold text-lg">3,891</p></div>
    <div class="card"><p class="text-xs text-muted">오늘 가입</p><p class="font-bold text-lg">18</p></div>
    <div class="card"><p class="text-xs text-muted">문의</p><p class="font-bold text-lg">3</p></div>
  </div>`,
);

PAGES["admin-walls.html"] = adminPage(
  "Walls",
  "/admin/walls",
  "walls",
  `<h2 class="font-semibold" style="margin-bottom:16px">벽 관리</h2>
  <input class="input" placeholder="벽 ID 검색" style="max-width:320px;margin-bottom:16px" />
  <div class="card" style="margin-bottom:8px;display:flex;justify-content:space-between"><span>wall-abc123</span><button class="btn btn-ghost btn-sm">숨김</button></div>
  <div class="card" style="display:flex;justify-content:space-between"><span>wall-def456</span><button class="btn btn-ghost btn-sm">삭제</button></div>`,
);

PAGES["admin-users.html"] = adminPage(
  "Users",
  "/admin/users",
  "users",
  `<h2 class="font-semibold" style="margin-bottom:16px">사용자</h2>
  <div class="card" style="margin-bottom:8px"><a href="admin-user-detail.html">김포토 · kim@example.com</a></div>
  <div class="card">이민지 · minji@example.com</div>`,
);

PAGES["admin-user-detail.html"] = adminPage(
  "User Detail",
  "/admin/users/[id]",
  "users",
  `<a href="admin-users.html" class="text-xs text-muted">← 사용자 목록</a>
  <h2 class="font-semibold" style="margin:12px 0">김포토</h2>
  <div class="card" style="margin-bottom:12px"><p class="text-xs text-muted">플랜</p><p>Free</p></div>
  <div class="card" style="margin-bottom:12px"><p class="text-xs text-muted">벽 · 사진</p><p>1 · 42</p></div>
  <button class="btn btn-outline btn-sm" style="color:#dc2626">계정 제한</button>`,
);

PAGES["admin-announcements.html"] = adminPage(
  "Announcements",
  "/admin/announcements",
  "announcements",
  `<h2 class="font-semibold" style="margin-bottom:16px">공지</h2><button class="btn btn-primary btn-sm" style="margin-bottom:16px">+ 새 공지</button><div class="card">인스타 내보내기 출시</div>`,
);

PAGES["admin-banners.html"] = adminPage(
  "Banners",
  "/admin/banners",
  "banners",
  `<h2 class="font-semibold" style="margin-bottom:16px">배너</h2><div class="card" style="height:80px;background:var(--surface)">Hero banner preview</div>`,
);

PAGES["admin-events.html"] = adminPage(
  "Events",
  "/admin/events",
  "events",
  `<h2 class="font-semibold" style="margin-bottom:16px">이벤트</h2><div class="card">여름 이벤트 · 진행 중</div>`,
);

PAGES["admin-inquiries.html"] = adminPage(
  "Inquiries",
  "/admin/inquiries",
  "inquiries",
  `<h2 class="font-semibold" style="margin-bottom:16px">문의</h2><div class="card"><p class="font-semibold text-sm">로그인 문제</p><p class="text-xs text-muted">미답변</p></div>`,
);

PAGES["admin-operations.html"] = adminPage(
  "Operations",
  "/admin/operations",
  "operations",
  `<h2 class="font-semibold" style="margin-bottom:16px">운영</h2><div class="card"><p>Storage orphan cleanup</p><button class="btn btn-primary btn-sm" style="margin-top:8px">실행</button></div>`,
);

PAGES["admin-plans.html"] = adminPage(
  "Plans",
  "/admin/plans",
  "plans",
  `<h2 class="font-semibold" style="margin-bottom:16px">플랜</h2><div class="card">Free · Plus quota settings</div>`,
);

PAGES["admin-sticker-packs.html"] = adminPage(
  "Sticker Packs Review",
  "/admin/sticker-packs",
  "stickers",
  `<h2 class="font-semibold" style="margin-bottom:16px">스티커 검수</h2><div class="card"><p class="font-semibold">Community Pack #42</p><button class="btn btn-primary btn-sm" style="margin-top:8px">승인</button></div>`,
);

for (const [name, html] of Object.entries(PAGES)) {
  writeFileSync(join(ROOT, name), html, "utf8");
  console.log("wrote", name);
}

console.log(`\nDone: ${Object.keys(PAGES).length} files → public/figma-ui/`);

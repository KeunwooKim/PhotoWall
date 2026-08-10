"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { authFetch } from "@/lib/auth/api-fetch";
import { useUgcStickerLibrary } from "@/hooks/useUgcStickerLibrary";
import { getFirstPartyStorePacks } from "@/lib/stickers/first-party-store";
import StickerStoreNav from "@/components/stickers/StickerStoreNav";

type UgcStorePack = {
  id: string;
  name: string;
  description: string;
  sticker_count: number;
  download_count: number;
  coverUrl: string | null;
  published_at?: string | null;
};

type StoreCard = {
  id: string;
  kind: "official" | "ugc";
  name: string;
  description: string;
  sticker_count: number;
  download_count: number;
  coverUrl: string | null;
  previewSrcs?: string[];
  published_at?: string | null;
  href: string;
};

type FilterKey = "all" | "official" | "community" | "new" | "popular" | "installed";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "official", label: "공식 무료" },
  { key: "community", label: "커뮤니티" },
  { key: "new", label: "신규" },
  { key: "popular", label: "인기" },
  { key: "installed", label: "보유 중" },
];

function isNewPack(pack: StoreCard): boolean {
  if (pack.kind === "official") return false;
  if (!pack.published_at) return false;
  const t = Date.parse(pack.published_at);
  if (Number.isNaN(t)) return false;
  return Date.now() - t < 14 * 24 * 60 * 60 * 1000;
}

export default function StickersStorePage() {
  const { user, isLoading: authLoading } = useAuth();
  const { refresh } = useUgcStickerLibrary();
  const [ugcPacks, setUgcPacks] = useState<UgcStorePack[]>([]);
  const [installedIds, setInstalledIds] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [sort, setSort] = useState<"newest" | "popular">("newest");
  const [filter, setFilter] = useState<FilterKey>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const officialPacks = useMemo(() => getFirstPartyStorePacks(), []);

  const showToast = useCallback((msg: string) => setToast(msg), []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    const handle = window.setTimeout(() => setQ(qDraft.trim()), 280);
    return () => window.clearTimeout(handle);
  }, [qDraft]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ sort, limit: "48" });
      if (q) params.set("q", q);
      const res = await authFetch(`/api/sticker-packs/store?${params}`);
      if (!res.ok) throw new Error("스토어를 불러오지 못했어요");
      const data = (await res.json()) as {
        packs: UgcStorePack[];
        installedIds: string[];
      };
      setUgcPacks(data.packs ?? []);
      setInstalledIds(new Set(data.installedIds ?? []));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "오류");
    } finally {
      setLoading(false);
    }
  }, [q, sort, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const allCards: StoreCard[] = useMemo(() => {
    const official: StoreCard[] = officialPacks.map((p) => ({
      ...p,
      href: `/stickers/${p.id}`,
    }));
    const community: StoreCard[] = ugcPacks.map((p) => ({
      id: p.id,
      kind: "ugc" as const,
      name: p.name,
      description: p.description,
      sticker_count: p.sticker_count,
      download_count: p.download_count,
      coverUrl: p.coverUrl,
      published_at: p.published_at,
      href: `/stickers/${p.id}`,
    }));
    return [...official, ...community];
  }, [officialPacks, ugcPacks]);

  const visiblePacks = useMemo(() => {
    const needle = q.toLowerCase();
    let list = allCards;
    if (needle) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle),
      );
    }
    if (filter === "official") list = list.filter((p) => p.kind === "official");
    else if (filter === "community") list = list.filter((p) => p.kind === "ugc");
    else if (filter === "installed") {
      list = list.filter((p) => p.kind === "official" || installedIds.has(p.id));
    } else if (filter === "new") list = list.filter((p) => isNewPack(p));
    else if (filter === "popular") {
      list = [...list].sort((a, b) => {
        if (a.kind !== b.kind) return a.kind === "official" ? -1 : 1;
        return b.download_count - a.download_count;
      });
    }
    return list;
  }, [allCards, filter, installedIds, q]);

  const installedCommunity = useMemo(
    () => ugcPacks.filter((p) => installedIds.has(p.id)),
    [ugcPacks, installedIds],
  );

  const toggleInstall = async (pack: StoreCard, installed: boolean) => {
    if (pack.kind === "official") {
      showToast("공식 팩은 기본으로 제공돼요");
      return;
    }
    if (!user) {
      showToast("로그인 후 설치할 수 있어요");
      return;
    }
    setBusyId(pack.id);
    try {
      const res = await authFetch(`/api/sticker-packs/${pack.id}/install`, {
        method: installed ? "DELETE" : "POST",
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "처리에 실패했어요");
      }
      setInstalledIds((prev) => {
        const next = new Set(prev);
        if (installed) next.delete(pack.id);
        else next.add(pack.id);
        return next;
      });
      await refresh();
      showToast(installed ? "라이브러리에서 제거했어요" : `${pack.name} 설치했어요`);
      if (!installed) setDrawerOpen(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "오류");
    } finally {
      setBusyId(null);
    }
  };

  const applyFilter = (key: FilterKey) => {
    setFilter(key);
    if (key === "popular") setSort("popular");
    if (key === "new" || key === "all" || key === "official" || key === "community") {
      setSort("newest");
    }
  };

  const libraryCount = officialPacks.length + installedIds.size;

  return (
    <div className="sticker-store-root">
      <StickerStoreNav
        crumb="스티커 스토어"
        showSearch
        searchValue={qDraft}
        onSearchChange={setQDraft}
        libraryCount={libraryCount}
        onOpenLibrary={() => setDrawerOpen(true)}
      />

      <div className="ss-layout">
        <aside className="ss-sidebar">
          <div className="ss-sidebar-sec">
            <span className="ss-sidebar-label">둘러보기</span>
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`ss-sidebar-link${filter === f.key ? " active" : ""}`}
                onClick={() => applyFilter(f.key)}
              >
                {f.label}
                {f.key === "all" && (
                  <span className="ss-sidebar-count">{allCards.length}</span>
                )}
                {f.key === "official" && (
                  <span className="ss-sidebar-count">{officialPacks.length}</span>
                )}
                {f.key === "installed" && (
                  <span className="ss-sidebar-count">{libraryCount}</span>
                )}
              </button>
            ))}
          </div>
          <hr className="ss-sidebar-divider" />
          <div className="ss-sidebar-sec">
            <span className="ss-sidebar-label">크리에이터</span>
            <Link href="/stickers/create" className="ss-sidebar-link">
              팩 만들기
            </Link>
            <Link href="/stickers/mine" className="ss-sidebar-link">
              내 제출함
            </Link>
          </div>
          <hr className="ss-sidebar-divider" />
          <p className="ss-sidebar-note">
            공식 팩은 기본 제공되고, 커뮤니티 팩은 설치하면 벽 에디터 피커에 추가돼요. 모두
            무료입니다.
          </p>
        </aside>

        <main className="ss-main">
          <div className="ss-mobile-filters">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                className={`ss-chip${filter === f.key ? " active" : ""}`}
                onClick={() => applyFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
            <Link href="/stickers/create" className="ss-chip">
              만들기
            </Link>
          </div>

          <div className="ss-banners">
            <Link href="/stickers/create" className="ss-banner-main">
              <div className="ss-banner-glow" />
              <div className="ss-banner-main-content">
                <span className="ss-banner-eyebrow">Community UGC</span>
                <div className="ss-banner-title">
                  나만의 스티커팩
                  <br />
                  만들어서 공유하기
                </div>
                <span className="ss-banner-cta">지금 만들기</span>
              </div>
            </Link>
            <div className="ss-banner-subs">
              <button
                type="button"
                className="ss-banner-sub pink"
                onClick={() => applyFilter("official")}
              >
                <span className="ss-banner-sub-label">공식</span>
                <div className="ss-banner-sub-title">
                  기본 무료 팩
                  <br />
                  <span style={{ fontSize: 13, color: "var(--ss-muted)" }}>
                    {officialPacks.length}종 바로 사용
                  </span>
                </div>
              </button>
              <button
                type="button"
                className="ss-banner-sub dark"
                onClick={() => applyFilter("community")}
              >
                <span className="ss-banner-sub-label">커뮤니티</span>
                <div className="ss-banner-sub-title">
                  유저 제작 팩
                  <br />
                  <span style={{ fontSize: 13, color: "rgba(250,247,242,0.5)" }}>
                    설치 후 사용
                  </span>
                </div>
              </button>
            </div>
          </div>

          <div className="ss-filter-row">
            <div className="ss-filter-tabs">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className={`ss-filter-tab${filter === f.key ? " active" : ""}`}
                  onClick={() => applyFilter(f.key)}
                >
                  {f.label}
                  {f.key === "all" && <span className="cnt">{allCards.length}</span>}
                  {f.key === "official" && (
                    <span className="cnt">{officialPacks.length}</span>
                  )}
                </button>
              ))}
            </div>
            <select
              className="ss-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "popular")}
            >
              <option value="newest">최신순</option>
              <option value="popular">인기순</option>
            </select>
          </div>

          <section className="ss-grid-section">
            <div className="ss-sec-hd">
              <h2>
                {filter === "official"
                  ? "공식 무료 팩"
                  : filter === "community"
                    ? "커뮤니티 팩"
                    : filter === "installed"
                      ? "내 라이브러리"
                      : filter === "popular"
                        ? "인기 스티커"
                        : filter === "new"
                          ? "신규 스티커"
                          : "전체 스티커"}
              </h2>
              <span>{visiblePacks.length}개</span>
            </div>

            {authLoading || loading ? (
              <p className="ss-loading">불러오는 중…</p>
            ) : visiblePacks.length === 0 ? (
              <div className="ss-empty">
                <h3>표시할 팩이 없어요</h3>
                <p>커뮤니티 팩을 만들어 스토어에 올려보세요.</p>
                <div className="ss-empty-actions">
                  <Link href="/stickers/create" className="ss-banner-cta">
                    팩 만들기
                  </Link>
                </div>
              </div>
            ) : (
              <div className="ss-grid">
                {visiblePacks.map((pack, index) => {
                  const installed =
                    pack.kind === "official" ? true : installedIds.has(pack.id);
                  const badge =
                    pack.kind === "official"
                      ? { className: "ss-badge-free", text: "공식" }
                      : isNewPack(pack)
                        ? { className: "ss-badge-new", text: "신규" }
                        : pack.download_count >= 5
                          ? { className: "ss-badge-hot", text: "인기" }
                          : { className: "ss-badge-free", text: "무료" };

                  return (
                    <article
                      key={`${pack.kind}-${pack.id}`}
                      className="ss-card"
                      style={{ animationDelay: `${(index % 8) * 40}ms` }}
                    >
                      <div className="ss-card-preview">
                        <span className={`ss-card-badge ${badge.className}`}>
                          {badge.text}
                        </span>
                        {pack.coverUrl ? (
                          <img src={pack.coverUrl} alt="" />
                        ) : (
                          <span className="ss-card-preview-emoji">PACK</span>
                        )}
                      </div>
                      <div className="ss-card-body">
                        <Link href={pack.href} className="ss-card-name">
                          {pack.name}
                        </Link>
                        <p className="ss-card-desc">{pack.description}</p>
                        <p className="ss-card-meta">
                          {pack.sticker_count}종
                          {pack.kind === "ugc" ? ` · 설치 ${pack.download_count}` : " · 기본 제공"}
                        </p>
                        <div className="ss-card-bottom">
                          <div className="ss-card-price">무료</div>
                          {pack.kind === "official" ? (
                            <span className="ss-status published">기본</span>
                          ) : (
                            <button
                              type="button"
                              className={`ss-add-btn${installed ? " installed" : ""}`}
                              disabled={busyId === pack.id}
                              aria-label={installed ? "설치 해제" : "라이브러리에 추가"}
                              onClick={() => void toggleInstall(pack, installed)}
                            >
                              {busyId === pack.id ? "…" : installed ? "✓" : "+"}
                            </button>
                          )}
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>
      </div>

      <div
        className={`ss-overlay${drawerOpen ? " open" : ""}`}
        onClick={() => setDrawerOpen(false)}
        aria-hidden={!drawerOpen}
      />
      <aside className={`ss-drawer${drawerOpen ? " open" : ""}`} aria-hidden={!drawerOpen}>
        <div className="ss-drawer-header">
          <h2>내 라이브러리</h2>
          <button
            type="button"
            className="ss-drawer-close"
            onClick={() => setDrawerOpen(false)}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
        <div className="ss-drawer-body">
          <p className="ss-list-meta" style={{ marginBottom: 8 }}>
            공식 팩 {officialPacks.length}개 · 커뮤니티 {installedCommunity.length}개
          </p>
          {officialPacks.map((pack) => (
            <div key={`o-${pack.id}`} className="ss-drawer-item">
              <div className="ss-drawer-thumb">
                {pack.coverUrl ? <img src={pack.coverUrl} alt="" /> : pack.name.slice(0, 1)}
              </div>
              <div className="ss-drawer-info">
                <Link href={`/stickers/${pack.id}`} className="ss-drawer-name">
                  {pack.name}
                </Link>
                <span className="ss-drawer-meta">공식 · {pack.sticker_count}종</span>
              </div>
              <span className="ss-status published">기본</span>
            </div>
          ))}
          {installedCommunity.map((pack) => (
            <div key={pack.id} className="ss-drawer-item">
              <div className="ss-drawer-thumb">
                {pack.coverUrl ? <img src={pack.coverUrl} alt="" /> : pack.name.slice(0, 1)}
              </div>
              <div className="ss-drawer-info">
                <Link href={`/stickers/${pack.id}`} className="ss-drawer-name">
                  {pack.name}
                </Link>
                <span className="ss-drawer-meta">{pack.sticker_count}종 · 커뮤니티</span>
              </div>
              <button
                type="button"
                className="ss-drawer-remove"
                disabled={busyId === pack.id}
                onClick={() =>
                  void toggleInstall(
                    {
                      id: pack.id,
                      kind: "ugc",
                      name: pack.name,
                      description: pack.description,
                      sticker_count: pack.sticker_count,
                      download_count: pack.download_count,
                      coverUrl: pack.coverUrl,
                      href: `/stickers/${pack.id}`,
                    },
                    true,
                  )
                }
              >
                해제
              </button>
            </div>
          ))}
        </div>
        <div className="ss-drawer-footer">
          <Link
            href="/wall/edit"
            className="ss-drawer-cta"
            onClick={() => setDrawerOpen(false)}
          >
            벽 에디터에서 쓰기
          </Link>
        </div>
      </aside>

      <div className={`ss-toast${toast ? " show" : ""}`} role="status">
        {toast ? toast : null}
      </div>
    </div>
  );
}

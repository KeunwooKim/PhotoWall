"use client";

import Link from "next/link";

type Props = {
  crumb: string;
  showSearch?: boolean;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  libraryCount?: number;
  onOpenLibrary?: () => void;
};

export default function StickerStoreNav({
  crumb,
  showSearch = false,
  searchValue = "",
  onSearchChange,
  libraryCount,
  onOpenLibrary,
}: Props) {
  return (
    <nav className="ss-nav">
      <div className="ss-crumb">
        <span>›</span>
        <Link href="/stickers" className="ss-crumb-cur" style={{ textDecoration: "none" }}>
          스티커 스토어
        </Link>
        {crumb !== "스티커 스토어" && (
          <>
            <span>›</span>
            <span className="ss-crumb-cur">{crumb}</span>
          </>
        )}
      </div>
      {showSearch && (
        <div className="ss-search">
          <input
            value={searchValue}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder="스티커, 팩 이름 검색…"
            aria-label="스티커 검색"
          />
        </div>
      )}
      <div className="ss-nav-spacer" />
      <div className="ss-nav-actions">
        <Link href="/stickers/create" className="ss-nav-link">
          팩 만들기
        </Link>
        <Link href="/stickers/mine" className="ss-nav-link">
          내 제출함
        </Link>
        {typeof libraryCount === "number" && onOpenLibrary && (
          <button type="button" className="ss-lib-btn" onClick={onOpenLibrary}>
            내 팩
            <span className="ss-lib-count">{libraryCount}</span>
          </button>
        )}
        {!onOpenLibrary && (
          <Link href="/stickers" className="ss-lib-btn">
            스토어
          </Link>
        )}
      </div>
    </nav>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HomeIcon, MenuIcon } from "@/components/wall/EditorToolDock";

type Panel = "menu" | "settings";

interface EditorMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  wallTitle?: string | null;
  /** When set, wall settings can rename the title. */
  onRenameTitle?: (title: string) => Promise<void> | void;
  onInvite?: () => void;
  isInviting?: boolean;
  inviteLabel?: string;
  onShare?: () => void;
  isSharing?: boolean;
  onExport?: () => void;
  isExporting?: boolean;
  onSave?: () => void;
  onOpenAssets?: () => void;
  onBringOntoWall?: () => void;
  homeHref?: string;
}

export default function EditorMenuDrawer({
  isOpen,
  onClose,
  wallTitle,
  onRenameTitle,
  onInvite,
  isInviting = false,
  inviteLabel = "초대하기",
  onShare,
  isSharing = false,
  onExport,
  isExporting = false,
  onSave,
  onOpenAssets,
  onBringOntoWall,
  homeHref = "/",
}: EditorMenuDrawerProps) {
  const [panel, setPanel] = useState<Panel>("menu");
  const [draftTitle, setDraftTitle] = useState(wallTitle ?? "");
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setPanel("menu");
    setDraftTitle(wallTitle ?? "");
    setTitleError(null);
  }, [isOpen, wallTitle]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const runAndClose = (fn?: () => void) => {
    onClose();
    fn?.();
  };

  const saveTitle = async () => {
    if (!onRenameTitle) return;
    const next = draftTitle.trim();
    if (!next) {
      setTitleError("이름을 입력해 주세요");
      return;
    }
    setIsSavingTitle(true);
    setTitleError(null);
    try {
      await onRenameTitle(next);
      setPanel("menu");
    } catch (error) {
      setTitleError(error instanceof Error ? error.message : "이름 저장에 실패했어요");
    } finally {
      setIsSavingTitle(false);
    }
  };

  const itemClass =
    "flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium text-foreground transition hover:bg-foreground/5";

  return (
    <div className="fixed inset-0 z-[60] flex" role="dialog" aria-modal="true" aria-label="메뉴">
      <button
        type="button"
        className="absolute inset-0 bg-black/35"
        aria-label="메뉴 닫기"
        onClick={onClose}
      />
      <aside className="relative flex h-full w-[min(20rem,88vw)] flex-col bg-surface shadow-xl">
        <div
          className="flex items-center justify-between border-b border-foreground/10 px-4 py-3"
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <div className="flex items-center gap-2 text-foreground">
            <MenuIcon />
            <span className="text-sm font-semibold">
              {panel === "settings" ? "벽 설정" : "메뉴"}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="닫기"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path
                d="M3.5 3.5l7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          {panel === "menu" ? (
            <div className="space-y-1">
              <Link href={homeHref} className={itemClass} onClick={onClose}>
                <HomeIcon />
                홈으로
              </Link>

              {onInvite && (
                <button
                  type="button"
                  className={itemClass}
                  disabled={isInviting}
                  onClick={() => runAndClose(() => onInvite())}
                >
                  <InviteIcon />
                  {isInviting ? "초대 중…" : inviteLabel}
                </button>
              )}

              <button type="button" className={itemClass} onClick={() => setPanel("settings")}>
                <SettingsIcon />
                벽 설정
              </button>

              <div className="my-2 border-t border-foreground/8" />

              {onShare && (
                <button
                  type="button"
                  className={itemClass}
                  disabled={isSharing}
                  onClick={() => runAndClose(() => onShare())}
                >
                  <ShareIcon />
                  {isSharing ? "공유 중…" : "공유 링크 복사"}
                </button>
              )}

              {onExport && (
                <button
                  type="button"
                  className={itemClass}
                  disabled={isExporting}
                  onClick={() => runAndClose(() => onExport())}
                >
                  <ExportIcon />
                  {isExporting ? "저장 중…" : "이미지로 저장"}
                </button>
              )}

              {onSave && (
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => runAndClose(() => onSave())}
                >
                  <SaveIcon />
                  저장
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <button
                type="button"
                className="text-xs font-medium text-muted transition hover:text-foreground"
                onClick={() => setPanel("menu")}
              >
                ← 메뉴로
              </button>

              {onRenameTitle ? (
                <div className="space-y-2">
                  <label className="block text-[11px] font-medium text-muted" htmlFor="wall-title">
                    벽 이름
                  </label>
                  <input
                    id="wall-title"
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    maxLength={40}
                    className="w-full rounded-xl border border-foreground/10 bg-surface px-3 py-2.5 text-sm text-foreground outline-none ring-foreground focus:ring-2"
                    placeholder="벽 이름"
                  />
                  {titleError && <p className="text-xs text-red-600 dark:text-red-400">{titleError}</p>}
                  <button
                    type="button"
                    disabled={isSavingTitle}
                    onClick={() => void saveTitle()}
                    className="w-full rounded-xl bg-foreground px-3 py-2.5 text-sm font-medium text-background transition hover:bg-foreground/90 disabled:opacity-40"
                  >
                    {isSavingTitle ? "저장 중…" : "이름 저장"}
                  </button>
                </div>
              ) : (
                <p className="rounded-xl bg-foreground/[0.04] px-3 py-3 text-sm text-muted">
                  {wallTitle?.trim() || "내 벽"}
                </p>
              )}

              {onOpenAssets && (
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => {
                    onClose();
                    onOpenAssets();
                  }}
                >
                  <AssetsIcon />
                  에셋 열기
                </button>
              )}

              {onBringOntoWall && (
                <button
                  type="button"
                  className={itemClass}
                  onClick={() => runAndClose(() => onBringOntoWall())}
                >
                  <BringIcon />
                  벽으로 가져오기
                </button>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function InviteIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M16 11V7a4 4 0 10-8 0v4M5 11h14v9H5v-9z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M12 14v3M10.5 15.5h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="18" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="6" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="18" cy="19" r="2.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8.3 10.8l7.4-4.2M8.3 13.2l7.4 4.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 3v10M8 7l4-4 4 4M5 14v5a1 1 0 001 1h12a1 1 0 001-1v-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h11l3 3v13H5V4zM8 4v5h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M8 18h8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function AssetsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="3" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
      <rect x="14" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function BringIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="4" y="4" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 8v8M8 12h8"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

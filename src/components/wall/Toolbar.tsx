"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { WallThemeId } from "@/types/wall";
import type { EditorMode } from "./WallCanvas";
import { WALL_THEMES } from "@/lib/wall-themes";
import { TAPE_COLORS } from "@/lib/wall-scene/tape-colors";
import StickerPicker from "./StickerPicker";

interface ToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  themeId: WallThemeId;
  mode: EditorMode;
  drawColor: string;
  drawWidth: number;
  drawColors: string[];
  drawWidths: number[];
  hasSelection: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onThemeChange: (id: WallThemeId) => void;
  onPhotoUpload: (file: File) => void;
  onAddTape: (color: string) => void;
  onAddSticker: (stickerId: string) => void;
  onShare: () => void;
  onExport: () => void;
  onInvite: () => void;
  isSharing?: boolean;
  isExporting?: boolean;
  isInviting?: boolean;
  onModeChange: (mode: EditorMode) => void;
  onDrawColorChange: (color: string) => void;
  onDrawWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onDelete: () => void;
  onSave: () => void;
  onClear: () => void;
}

export default function Toolbar({
  isOpen,
  onClose,
  themeId,
  mode,
  drawColor,
  drawWidth,
  drawColors,
  drawWidths,
  hasSelection,
  canUndo,
  canRedo,
  onThemeChange,
  onPhotoUpload,
  onAddTape,
  onAddSticker,
  onShare,
  onExport,
  onInvite,
  isSharing,
  isExporting,
  isInviting,
  onModeChange,
  onDrawColorChange,
  onDrawWidthChange,
  onUndo,
  onRedo,
  onBringForward,
  onSendBackward,
  onDelete,
  onSave,
  onClear,
}: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />

      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="꾸미기 메뉴"
        className={`fixed left-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between border-b border-foreground/8 px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">꾸미기</h2>
            <p className="mt-0.5 text-xs text-muted">사진을 끌어다 놓거나 올려보세요</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-muted transition hover:bg-foreground/5 hover:text-foreground"
            aria-label="메뉴 닫기"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-5 py-5">
          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">사진</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = e.target.files;
                if (files) {
                  [...files].forEach((file) => onPhotoUpload(file));
                }
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 active:scale-[0.98]"
            >
              네컷 사진 올리기
            </button>
            <Link
              href="/import"
              onClick={onClose}
              className="block w-full rounded-xl border border-foreground/15 bg-surface px-4 py-3 text-center text-sm font-medium transition hover:bg-foreground/5 active:scale-[0.98]"
            >
              QR로 네컷 가져오기
            </Link>
            <p className="text-[11px] text-muted">캔버스에 사진을 끌어다 놓을 수도 있어요</p>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">벽지</h3>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
              {WALL_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onThemeChange(theme.id)}
                  className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-xs transition active:scale-[0.98] ${
                    themeId === theme.id
                      ? "border-foreground bg-foreground/4 font-medium"
                      : "border-foreground/8 hover:border-foreground/20"
                  }`}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded-md ring-1 ring-black/10"
                    style={{ background: theme.preview }}
                  />
                  {theme.name}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">마스킹 테이프</h3>
            <div className="flex flex-wrap gap-2">
              {TAPE_COLORS.map((tape) => (
                <button
                  key={tape.id}
                  type="button"
                  title={tape.label}
                  onClick={() => onAddTape(tape.color)}
                  className="h-9 w-16 rounded-md opacity-80 ring-1 ring-black/10 transition hover:scale-105 hover:opacity-100 active:scale-95"
                  style={{ background: tape.color }}
                />
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">스티커</h3>
            <StickerPicker onSelect={onAddSticker} />
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">공유</h3>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={onShare}
                disabled={isSharing}
                className="rounded-xl border border-foreground/10 px-3 py-2.5 text-xs font-medium transition hover:border-foreground/20 active:scale-[0.98] disabled:opacity-50"
              >
                {isSharing ? "생성 중..." : "링크 공유"}
              </button>
              <button
                type="button"
                onClick={onExport}
                disabled={isExporting}
                className="rounded-xl border border-foreground/10 px-3 py-2.5 text-xs font-medium transition hover:border-foreground/20 active:scale-[0.98] disabled:opacity-50"
              >
                {isExporting ? "저장 중..." : "이미지 저장"}
              </button>
            </div>
            <button
              type="button"
              onClick={onInvite}
              disabled={isInviting}
              className="w-full rounded-xl border border-foreground/10 px-3 py-2.5 text-xs font-medium transition hover:border-foreground/20 active:scale-[0.98] disabled:opacity-50"
            >
              {isInviting ? "생성 중..." : "친구 초대 링크"}
            </button>
            <p className="text-[11px] text-muted">인스타 스토리용 이미지로 저장할 수 있어요</p>
          </section>

          <section className="space-y-3">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted">도구</h3>
            <div className="flex gap-2">
              <ToolButton active={mode === "select"} onClick={() => onModeChange("select")}>
                선택
              </ToolButton>
              <ToolButton active={mode === "draw"} onClick={() => onModeChange("draw")}>
                펜
              </ToolButton>
              <ToolButton onClick={onUndo} disabled={!canUndo}>
                ↩
              </ToolButton>
              <ToolButton onClick={onRedo} disabled={!canRedo}>
                ↪
              </ToolButton>
            </div>

            {mode === "draw" && (
              <div className="space-y-2 rounded-xl bg-foreground/3 p-3">
                <p className="text-[11px] text-muted">펜 색상</p>
                <div className="flex flex-wrap gap-2">
                  {drawColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => onDrawColorChange(color)}
                      className={`h-8 w-8 rounded-full ring-2 transition active:scale-95 ${
                        drawColor === color ? "ring-foreground" : "ring-transparent"
                      }`}
                      style={{ background: color }}
                      aria-label={`펜 색상 ${color}`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted">펜 굵기</p>
                <div className="flex gap-2">
                  {drawWidths.map((width) => (
                    <button
                      key={width}
                      type="button"
                      onClick={() => onDrawWidthChange(width)}
                      className={`flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-medium transition active:scale-95 ${
                        drawWidth === width
                          ? "bg-foreground text-background"
                          : "bg-foreground/6 text-foreground hover:bg-foreground/10"
                      }`}
                    >
                      {width}px
                    </button>
                  ))}
                </div>
              </div>
            )}

            {hasSelection && mode === "select" && (
              <div className="flex flex-wrap gap-2">
                <ToolButton onClick={onBringForward}>앞으로</ToolButton>
                <ToolButton onClick={onSendBackward}>뒤로</ToolButton>
                <ToolButton onClick={onDelete} variant="danger">
                  삭제
                </ToolButton>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-2 border-t border-foreground/8 px-5 py-4">
          <button
            type="button"
            onClick={onSave}
            className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 active:scale-[0.98]"
          >
            저장하기
          </button>
          <button
            type="button"
            onClick={onClear}
            className="w-full rounded-xl border border-foreground/10 px-4 py-2.5 text-sm text-muted transition hover:border-foreground/20 hover:text-foreground active:scale-[0.98]"
          >
            전체 지우기
          </button>
        </div>
      </aside>
    </>
  );
}

function ToolButton({
  children,
  onClick,
  active,
  disabled,
  variant = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: "default" | "danger";
}) {
  const base = "rounded-lg px-3 py-2 text-xs font-medium transition active:scale-95";
  const styles =
    disabled
      ? `${base} cursor-not-allowed opacity-40 bg-foreground/4 text-muted`
      : variant === "danger"
        ? `${base} text-red-500 hover:bg-red-50`
        : active
          ? `${base} bg-foreground/8 text-foreground`
          : `${base} bg-foreground/4 text-foreground hover:bg-foreground/8`;

  return (
    <button type="button" onClick={onClick} disabled={disabled} className={styles}>
      {children}
    </button>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M4 4l8 8M12 4l-8 8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

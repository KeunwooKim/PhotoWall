"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { WallThemeId } from "@/types/wall";
import type { EditorMode } from "./editor-types";
import { WALL_THEMES } from "@/lib/wall-themes";
import { PEN_STYLES, type PenStyleId } from "@/lib/wall-scene/pen";
import StickerPicker from "./StickerPicker";
import PenStrokeWidthControl from "./PenStrokeWidthControl";

interface ToolbarProps {
  isOpen: boolean;
  onClose: () => void;
  themeId: WallThemeId;
  mode: EditorMode;
  drawColor: string;
  drawColors: string[];
  highlighterMaxLength: number;
  highlighterLengthPresets: readonly number[];
  penStyleId: PenStyleId;
  penStrokeWidth: number;
  hasSelection: boolean;
  selectionCount?: number;
  canUndo: boolean;
  canRedo: boolean;
  onThemeChange: (id: WallThemeId) => void;
  onPhotoUpload: (file: File) => void;
  onAddSticker: (stickerId: string) => void;
  onShare: () => void;
  onExport: () => void;
  onInvite: () => void;
  isSharing?: boolean;
  isExporting?: boolean;
  isInviting?: boolean;
  onModeChange: (mode: EditorMode) => void;
  onDrawColorChange: (color: string) => void;
  onHighlighterMaxLengthChange: (length: number) => void;
  onPenStyleIdChange: (id: PenStyleId) => void;
  onPenStrokeWidthChange: (width: number) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSelectAll: () => void;
  onBringForward: () => void;
  onSendBackward: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onAlignLeft: () => void;
  onAlignCenterH: () => void;
  onAlignRight: () => void;
  onAlignTop: () => void;
  onAlignMiddle: () => void;
  onAlignBottom: () => void;
  onCenterOnWall: () => void;
  onDistributeHorizontal: () => void;
  onDistributeVertical: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  onDuplicate: () => void;
  onGroup: () => void;
  onUngroup: () => void;
  onToggleGrid: () => void;
  onToggleSnapToGrid: () => void;
  canGroupSelection: boolean;
  canUngroupSelection: boolean;
  showGrid: boolean;
  snapToGrid: boolean;
  canAlignSelection: boolean;
  canDistributeSelection: boolean;
  onDelete: () => void;
  onSave: () => void;
  onClear: () => void;
  /** Shared walls auto-save — hide manual save CTA */
  autoSaveOnly?: boolean;
}

export default function Toolbar({
  isOpen,
  onClose,
  themeId,
  mode,
  drawColor,
  drawColors,
  highlighterMaxLength,
  highlighterLengthPresets,
  penStyleId,
  penStrokeWidth,
  hasSelection,
  selectionCount = 0,
  canUndo,
  canRedo,
  onThemeChange,
  onPhotoUpload,
  onAddSticker,
  onShare,
  onExport,
  onInvite,
  isSharing,
  isExporting,
  isInviting,
  onModeChange,
  onDrawColorChange,
  onHighlighterMaxLengthChange,
  onPenStyleIdChange,
  onPenStrokeWidthChange,
  onUndo,
  onRedo,
  onSelectAll,
  onBringForward,
  onSendBackward,
  onBringToFront,
  onSendToBack,
  onAlignLeft,
  onAlignCenterH,
  onAlignRight,
  onAlignTop,
  onAlignMiddle,
  onAlignBottom,
  onCenterOnWall,
  onDistributeHorizontal,
  onDistributeVertical,
  onFlipHorizontal,
  onFlipVertical,
  onDuplicate,
  onGroup,
  onUngroup,
  onToggleGrid,
  onToggleSnapToGrid,
  canGroupSelection,
  canUngroupSelection,
  showGrid,
  snapToGrid,
  canAlignSelection,
  canDistributeSelection,
  onDelete,
  onSave,
  onClear,
  autoSaveOnly = false,
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
            <p className="mt-0.5 text-xs text-muted">사진·테이프·스티커·벽지를 추가해요</p>
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
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">추가</p>

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
                    title={theme.description}
                  />
                  {theme.name}
                </button>
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

          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">도구</p>

          <section className="space-y-3">
            {mode === "pen" && (
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
                <p className="text-[11px] text-muted">펜 종류</p>
                <div className="grid grid-cols-2 gap-2">
                  {PEN_STYLES.map((style) => (
                    <button
                      key={style.id}
                      type="button"
                      onClick={() => onPenStyleIdChange(style.id)}
                      className={`rounded-lg px-2.5 py-2 text-left transition active:scale-95 ${
                        penStyleId === style.id
                          ? "bg-foreground text-background"
                          : "bg-foreground/6 text-foreground hover:bg-foreground/10"
                      }`}
                    >
                      <span className="block text-xs font-medium">{style.label}</span>
                      <span
                        className={`mt-0.5 block text-[10px] ${
                          penStyleId === style.id ? "text-background/70" : "text-muted"
                        }`}
                      >
                        {style.hint}
                      </span>
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-muted">크기 (px)</p>
                <PenStrokeWidthControl
                  styleId={penStyleId}
                  value={penStrokeWidth}
                  onChange={onPenStrokeWidthChange}
                />
                <p className="text-[11px] leading-relaxed text-muted">
                  하단 독에서 펜을 켠 뒤, 벽에서 드래그해 자유롭게 그려요.
                </p>
              </div>
            )}

            {mode === "tape" && (
              <div className="space-y-2 rounded-xl bg-foreground/3 p-3">
                <p className="text-[11px] text-muted">마스킹 테이프 색상</p>
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
                      aria-label={`테이프 색상 ${color}`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-muted">최대 길이</p>
                <div className="flex gap-2">
                  {highlighterLengthPresets.map((length) => (
                    <button
                      key={length}
                      type="button"
                      onClick={() => onHighlighterMaxLengthChange(length)}
                      className={`flex h-9 flex-1 items-center justify-center rounded-lg text-xs font-medium transition active:scale-95 ${
                        highlighterMaxLength === length
                          ? "bg-foreground text-background"
                          : "bg-foreground/6 text-foreground hover:bg-foreground/10"
                      }`}
                    >
                      {length < 100 ? "짧게" : length < 200 ? "보통" : "길게"}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] leading-relaxed text-muted">
                  하단 독에서 테이프를 켠 뒤, 벽에서 드래그해 직선으로 붙여요.
                </p>
              </div>
            )}

            {mode === "text" && (
              <div className="space-y-2 rounded-xl bg-foreground/3 p-3">
                <p className="text-[11px] leading-relaxed text-muted">
                  벽을 탭하면 텍스트 상자가 생겨요. 선택 후 하단에서 글꼴·크기·색을 바꾸고, 모서리로
                  기울일 수 있어요.
                </p>
              </div>
            )}

            {mode === "select" && !hasSelection && (
              <div className="space-y-3">
                <p className="text-[11px] text-muted">
                  선택·펜·테이프·텍스트·실행취소는 하단 도구 바에서 바로 쓸 수 있어요. 물체를 길게
                  누르면 더 많은 편집 메뉴가 열려요.
                </p>
                <div className="flex flex-wrap gap-2">
                  <ToolButton onClick={onSelectAll}>전체 선택</ToolButton>
                  <ToolButton onClick={onToggleGrid} active={showGrid}>
                    격자 {showGrid ? "숨기기" : "보기"}
                  </ToolButton>
                  <ToolButton
                    onClick={onToggleSnapToGrid}
                    active={snapToGrid}
                    disabled={!showGrid && !snapToGrid}
                  >
                    격자 맞춤
                  </ToolButton>
                </div>
              </div>
            )}

            {hasSelection && mode === "select" && (
              <div className="space-y-3">
                {selectionCount > 1 && (
                  <p className="text-[11px] text-muted">{selectionCount}개 선택됨</p>
                )}

                <div className="space-y-2">
                  <p className="text-[11px] text-muted">정렬</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    <AlignButton
                      label="왼쪽"
                      onClick={onAlignLeft}
                      disabled={!canAlignSelection}
                    />
                    <AlignButton
                      label="가로 중앙"
                      onClick={onAlignCenterH}
                      disabled={!canAlignSelection}
                    />
                    <AlignButton
                      label="오른쪽"
                      onClick={onAlignRight}
                      disabled={!canAlignSelection}
                    />
                    <AlignButton
                      label="위"
                      onClick={onAlignTop}
                      disabled={!canAlignSelection}
                    />
                    <AlignButton
                      label="세로 중앙"
                      onClick={onAlignMiddle}
                      disabled={!canAlignSelection}
                    />
                    <AlignButton
                      label="아래"
                      onClick={onAlignBottom}
                      disabled={!canAlignSelection}
                    />
                  </div>
                  <ToolButton onClick={onCenterOnWall}>벽 가운데</ToolButton>
                  <div className="grid grid-cols-2 gap-1.5">
                    <AlignButton
                      label="가로 균등"
                      onClick={onDistributeHorizontal}
                      disabled={!canDistributeSelection}
                    />
                    <AlignButton
                      label="세로 균등"
                      onClick={onDistributeVertical}
                      disabled={!canDistributeSelection}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] text-muted">뒤집기</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <AlignButton label="좌우" onClick={onFlipHorizontal} />
                    <AlignButton label="상하" onClick={onFlipVertical} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <ToolButton onClick={onSelectAll}>전체 선택</ToolButton>
                  <ToolButton onClick={onGroup} disabled={!canGroupSelection}>
                    그룹
                  </ToolButton>
                  <ToolButton onClick={onUngroup} disabled={!canUngroupSelection}>
                    그룹 해제
                  </ToolButton>
                  <ToolButton onClick={onDuplicate}>복제</ToolButton>
                  <ToolButton onClick={onBringToFront}>맨 앞으로</ToolButton>
                  <ToolButton onClick={onBringForward}>앞으로</ToolButton>
                  <ToolButton onClick={onSendBackward}>뒤로</ToolButton>
                  <ToolButton onClick={onSendToBack}>맨 뒤로</ToolButton>
                  <ToolButton onClick={onDelete} variant="danger">
                    삭제
                  </ToolButton>
                  <ToolButton onClick={onToggleGrid} active={showGrid}>
                    격자 {showGrid ? "숨기기" : "보기"}
                  </ToolButton>
                  <ToolButton onClick={onToggleSnapToGrid} active={snapToGrid}>
                    격자 맞춤
                  </ToolButton>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="space-y-2 border-t border-foreground/8 px-5 py-4">
          {autoSaveOnly ? (
            <p className="rounded-xl bg-foreground/4 px-4 py-3 text-center text-xs text-muted">
              변경 사항은 자동으로 저장돼요
            </p>
          ) : (
            <button
              type="button"
              onClick={onSave}
              className="w-full rounded-xl bg-foreground px-4 py-3 text-sm font-medium text-background transition hover:opacity-90 active:scale-[0.98]"
            >
              저장하기
            </button>
          )}
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

function AlignButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg px-2 py-2 text-[11px] font-medium transition active:scale-95 ${
        disabled
          ? "cursor-not-allowed bg-foreground/4 text-muted opacity-40"
          : "bg-foreground/4 text-foreground hover:bg-foreground/8"
      }`}
    >
      {label}
    </button>
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

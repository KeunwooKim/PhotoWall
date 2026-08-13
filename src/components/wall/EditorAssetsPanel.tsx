"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { WallThemeId } from "@/types/wall";
import { WALL_THEMES } from "@/lib/wall-themes";
import { hrefWithWallReturn } from "@/lib/wall-return-path";
import StickerPicker from "./StickerPicker";
import PhotoDecorPickers from "./PhotoDecorPickers";

interface EditorAssetsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  themeId: WallThemeId;
  onThemeChange: (id: WallThemeId) => void;
  onPhotoUpload: (file: File) => void;
  onAddSticker: (stickerId: string) => void;
  selectedPhotoId?: string | null;
  activeFrameId?: string | null;
  onApplyFrame?: (frameId: string) => void;
  fourCutLayout?: "stack4" | "grid2x2" | null;
  activeFourCutSkinId?: string | null;
  onApplyFourCutSkin?: (skinId: string | null) => void;
  /** Where QR / scan should return (personal edit or shared editor). */
  returnTo?: string;
  /** docked = desktop column beside tool rail; drawer = mobile slide-over */
  variant?: "docked" | "drawer";
}

/** Assets only: photos, wallpaper, stickers (split out from 꾸미기 sheet). */
export default function EditorAssetsPanel({
  isOpen,
  onClose,
  themeId,
  onThemeChange,
  onPhotoUpload,
  onAddSticker,
  selectedPhotoId = null,
  activeFrameId = null,
  onApplyFrame,
  fourCutLayout = null,
  activeFourCutSkinId = null,
  onApplyFourCutSkin,
  returnTo = "/wall/edit",
  variant = "docked",
}: EditorAssetsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importHref = hrefWithWallReturn("/import", returnTo);
  const captureHref = hrefWithWallReturn("/capture", returnTo);

  useEffect(() => {
    if (!isOpen || variant !== "drawer") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, variant]);

  const body = (
    <>
      <div className="flex items-center justify-between border-b border-foreground/10 px-3 py-2.5">
        <div>
          <p className="text-[11px] font-semibold tracking-wide text-muted">에셋</p>
          <p className="text-[10px] text-muted">사진 · 스캔 · 벽지 · 스티커 · 프레임</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-foreground/5 hover:text-foreground"
          aria-label="에셋 닫기"
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

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-3">
        <section className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted">사진</h3>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = e.target.files;
              if (files) [...files].forEach((file) => onPhotoUpload(file));
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full rounded-xl bg-foreground px-3 py-2.5 text-xs font-medium text-background transition active:scale-[0.98]"
          >
            사진 올리기
          </button>
          <Link
            href={importHref}
            onClick={onClose}
            className="block w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2.5 text-center text-xs font-medium text-foreground transition hover:bg-foreground/5"
          >
            QR로 네컷 가져오기
          </Link>
          <Link
            href={captureHref}
            onClick={onClose}
            className="block w-full rounded-xl border border-foreground/10 bg-foreground/[0.04] px-3 py-2.5 text-center text-xs font-medium text-foreground transition hover:bg-foreground/5"
          >
            AI 스캔
          </Link>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted">벽지</h3>
          <div className="grid max-h-44 grid-cols-1 gap-1.5 overflow-y-auto pr-0.5">
            {WALL_THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => onThemeChange(theme.id)}
                className={`flex items-center gap-2 rounded-xl border px-2.5 py-2 text-left text-xs transition ${
                  themeId === theme.id
                    ? "border-foreground bg-foreground/5 font-medium text-foreground"
                    : "border-foreground/10 text-foreground/90 hover:border-foreground/20"
                }`}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-md ring-1 ring-foreground/10"
                  style={{ background: theme.preview }}
                />
                {theme.name}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-[11px] font-medium text-muted">스티커</h3>
          <StickerPicker onSelect={onAddSticker} />
        </section>

        {onApplyFrame && (
          <PhotoDecorPickers
            onApplyFrame={onApplyFrame}
            activeFrameId={selectedPhotoId ? activeFrameId : null}
            fourCutLayout={selectedPhotoId ? fourCutLayout : null}
            activeSkinId={selectedPhotoId ? activeFourCutSkinId : null}
            onApplyFourCutSkin={onApplyFourCutSkin}
          />
        )}
      </div>
    </>
  );

  if (variant === "docked") {
    if (!isOpen) return null;
    return (
      <aside className="flex w-64 shrink-0 flex-col border-r border-foreground/10 bg-surface text-foreground">
        {body}
      </aside>
    );
  }

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/20 transition-opacity duration-300 md:hidden ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={onClose}
        aria-hidden={!isOpen}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="에셋"
        className={`fixed left-0 top-0 z-50 flex h-full w-80 max-w-[85vw] flex-col bg-surface text-foreground shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingBottom: "env(safe-area-inset-bottom)",
        }}
      >
        {body}
      </aside>
    </>
  );
}

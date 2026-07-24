"use client";

import type { EditorMode } from "./editor-types";

interface EditorToolDockProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onPhotoUpload: (file: File) => void;
  onOpenDecorate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const dockBtn =
  "flex h-11 min-w-11 items-center justify-center rounded-full px-3 text-xs font-medium transition active:scale-95";
const dockBtnIdle = `${dockBtn} text-neutral-600 hover:bg-black/5`;
const dockBtnActive = `${dockBtn} bg-neutral-900 text-white`;

/** Persistent bottom tools — select / pen / photo / decorate + undo. */
export default function EditorToolDock({
  mode,
  onModeChange,
  onPhotoUpload,
  onOpenDecorate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: EditorToolDockProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex justify-center px-3"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-white/95 p-1.5 shadow-lg ring-1 ring-black/8 backdrop-blur-sm">
        <button
          type="button"
          onClick={() => onModeChange("select")}
          className={mode === "select" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "select"}
        >
          선택
        </button>
        <button
          type="button"
          onClick={() => onModeChange("draw")}
          className={mode === "draw" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "draw"}
        >
          펜
        </button>

        <label className={`${dockBtnIdle} cursor-pointer`}>
          사진
          <input
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
        </label>

        <button type="button" onClick={onOpenDecorate} className={dockBtnIdle}>
          꾸미기
        </button>

        <span className="mx-0.5 h-5 w-px bg-black/10" aria-hidden />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`${dockBtnIdle} disabled:opacity-30`}
          aria-label="실행 취소"
        >
          ↩
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`${dockBtnIdle} disabled:opacity-30`}
          aria-label="다시 실행"
        >
          ↪
        </button>
      </div>
    </div>
  );
}

export function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path
        d="M3 5h12M3 9h12M3 13h8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function HomeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 01-1 1h-5v-6H10v6H5a1 1 0 01-1-1v-9.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M15 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

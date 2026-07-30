"use client";

import Link from "next/link";
import type { EditorMode } from "./editor-types";

interface EditorToolRailProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onPhotoUpload: (file: File) => void;
  onToggleAssets: () => void;
  assetsOpen?: boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

const railBtn =
  "flex h-10 w-10 flex-col items-center justify-center rounded-lg text-[10px] font-medium transition active:scale-95";
const idle = `${railBtn} text-neutral-600 hover:bg-neutral-100`;
const active = `${railBtn} bg-neutral-900 text-white`;

function IconSelect({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 4l7.5 16 1.8-6.7L20 11.5 4 4z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconPen({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 20l4.2-1.1L19 8.1a2.1 2.1 0 00-3-3L5.3 15.8 4 20z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTape({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="9" width="18" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

function IconText({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M5 6h14M12 6v12M9 18h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconPhoto({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path d="M3 16l5-4 4 3 3-2 6 4" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

function IconScan({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M7 4H5a1 1 0 00-1 1v2M17 4h2a1 1 0 011 1v2M7 20H5a1 1 0 01-1-1v-2M17 20h2a1 1 0 001-1v-2M4 12h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function IconAssets({ className }: { className?: string }) {
  return (
    <svg className={className} width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M12 12l8-4M12 12v8M12 12L4 8" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

/** Figma-style left tool rail (desktop). */
export default function EditorToolRail({
  mode,
  onModeChange,
  onPhotoUpload,
  onToggleAssets,
  assetsOpen = false,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: EditorToolRailProps) {
  return (
    <aside className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-neutral-200 bg-white py-2 text-neutral-800">
      <button
        type="button"
        onClick={() => onModeChange("select")}
        className={mode === "select" ? active : idle}
        aria-pressed={mode === "select"}
        title="선택"
      >
        <IconSelect />
        <span className="mt-0.5">선택</span>
      </button>

      <label className={`${idle} cursor-pointer`} title="사진">
        <IconPhoto />
        <span className="mt-0.5">사진</span>
        <input
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
      </label>

      <Link href="/capture" className={idle} title="AI 스캔" aria-label="AI 스캔">
        <IconScan />
        <span className="mt-0.5">스캔</span>
      </Link>

      <button
        type="button"
        onClick={() => onModeChange(mode === "pen" ? "select" : "pen")}
        className={mode === "pen" ? active : idle}
        aria-pressed={mode === "pen"}
        title="펜"
      >
        <IconPen />
        <span className="mt-0.5">펜</span>
      </button>

      <button
        type="button"
        onClick={() => onModeChange(mode === "tape" ? "select" : "tape")}
        className={mode === "tape" ? active : idle}
        aria-pressed={mode === "tape"}
        title="테이프"
      >
        <IconTape />
        <span className="mt-0.5">테이프</span>
      </button>

      <button
        type="button"
        onClick={() => onModeChange(mode === "text" ? "select" : "text")}
        className={mode === "text" ? active : idle}
        aria-pressed={mode === "text"}
        title="텍스트"
      >
        <IconText />
        <span className="mt-0.5">글자</span>
      </button>

      <button
        type="button"
        onClick={onToggleAssets}
        className={assetsOpen ? active : idle}
        aria-pressed={assetsOpen}
        title="에셋"
      >
        <IconAssets />
        <span className="mt-0.5">에셋</span>
      </button>

      <div className="my-1 h-px w-8 bg-neutral-200" aria-hidden />

      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        className={`${idle} disabled:opacity-30`}
        aria-label="실행 취소"
        title="실행 취소"
      >
        <span className="text-sm">↩</span>
      </button>
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        className={`${idle} disabled:opacity-30`}
        aria-label="다시 실행"
        title="다시 실행"
      >
        <span className="text-sm">↪</span>
      </button>
    </aside>
  );
}

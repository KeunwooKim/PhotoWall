"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { EditorMode } from "./editor-types";
import {
  DEFAULT_PEN_STYLE_ID,
  PEN_COLORS,
  PEN_STYLES,
  type PenStyleId,
} from "@/lib/wall-scene/pen";
import { TAPE_COLORS } from "@/lib/wall-scene/tape-colors";
import { HIGHLIGHTER_LENGTH_PRESETS } from "@/lib/wall-scene/highlighter";
import PenStrokeWidthControl from "./PenStrokeWidthControl";

interface EditorToolDockProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onPhotoUpload: (file: File) => void;
  onOpenDecorate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  penColor?: string;
  penStyleId?: PenStyleId;
  penStrokeWidth?: number;
  tapeColor?: string;
  tapeMaxLength?: number;
  onPenColorChange?: (color: string) => void;
  onPenStyleIdChange?: (id: PenStyleId) => void;
  onPenStrokeWidthChange?: (width: number) => void;
  onTapeColorChange?: (color: string) => void;
  onTapeMaxLengthChange?: (length: number) => void;
}

const dockBtn =
  "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-medium transition active:scale-95 sm:px-3 sm:text-xs";
const dockBtnIdle = `${dockBtn} text-neutral-600 hover:bg-black/5`;
const dockBtnActive = `${dockBtn} bg-neutral-900 text-white`;
const dockBtnScan = `${dockBtn} border border-foreground/20 bg-foreground/5 text-neutral-800 hover:bg-foreground/10`;

/**
 * Bottom tools. Pen/tape: first tap enters mode + opens settings;
 * second tap collapses settings so the canvas is free to draw;
 * third tap reopens settings. Use 선택 to leave the tool.
 */
export default function EditorToolDock({
  mode,
  onModeChange,
  onPhotoUpload,
  onOpenDecorate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  penColor = PEN_COLORS[0],
  penStyleId = DEFAULT_PEN_STYLE_ID,
  penStrokeWidth = PEN_STYLES[1].strokeWidth,
  tapeColor = TAPE_COLORS[0].color,
  tapeMaxLength = HIGHLIGHTER_LENGTH_PRESETS[1],
  onPenColorChange,
  onPenStyleIdChange,
  onPenStrokeWidthChange,
  onTapeColorChange,
  onTapeMaxLengthChange,
}: EditorToolDockProps) {
  const [settingsOpen, setSettingsOpen] = useState(true);

  useEffect(() => {
    if (mode === "pen" || mode === "tape") {
      setSettingsOpen(true);
    }
  }, [mode]);

  const handlePenClick = () => {
    if (mode !== "pen") {
      onModeChange("pen");
      setSettingsOpen(true);
      return;
    }
    setSettingsOpen((open) => !open);
  };

  const handleTapeClick = () => {
    if (mode !== "tape") {
      onModeChange("tape");
      setSettingsOpen(true);
      return;
    }
    setSettingsOpen((open) => !open);
  };

  const showPenPicker = mode === "pen" && settingsOpen;
  const showTapePicker = mode === "tape" && settingsOpen;

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-30 flex flex-col items-center gap-2 px-2"
      style={{ bottom: "max(1rem, env(safe-area-inset-bottom))" }}
    >
      {showPenPicker && (
        <div className="pointer-events-auto w-full max-w-md space-y-2.5 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/8 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted">펜 종류</p>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="rounded-full bg-foreground/6 px-2.5 py-1 text-[10px] font-medium text-muted transition hover:bg-foreground/10"
            >
              접기
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {PEN_STYLES.map((style) => (
              <button
                key={style.id}
                type="button"
                onClick={() => onPenStyleIdChange?.(style.id)}
                className={`rounded-xl px-2.5 py-2 text-left transition ${
                  penStyleId === style.id
                    ? "bg-foreground text-background"
                    : "bg-foreground/6 hover:bg-foreground/10"
                }`}
              >
                <span className="block text-[11px] font-medium">{style.label}</span>
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
          <p className="text-[11px] font-medium text-muted">크기</p>
          <PenStrokeWidthControl
            styleId={penStyleId}
            value={penStrokeWidth}
            onChange={(width) => onPenStrokeWidthChange?.(width)}
            compact
          />
          <p className="text-[11px] font-medium text-muted">색상</p>
          <div className="flex flex-wrap gap-2">
            {PEN_COLORS.map((color) => (
              <button
                key={color}
                type="button"
                onClick={() => onPenColorChange?.(color)}
                className={`h-8 w-8 rounded-full ring-2 transition ${
                  penColor === color ? "ring-foreground scale-110" : "ring-transparent"
                }`}
                style={{ background: color }}
                aria-label={`펜 색 ${color}`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted">펜을 다시 누르면 설정을 접고 그릴 수 있어요</p>
        </div>
      )}

      {showTapePicker && (
        <div className="pointer-events-auto w-full max-w-md space-y-2.5 rounded-2xl bg-white/95 p-3 shadow-lg ring-1 ring-black/8 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted">테이프 길이</p>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="rounded-full bg-foreground/6 px-2.5 py-1 text-[10px] font-medium text-muted transition hover:bg-foreground/10"
            >
              접기
            </button>
          </div>
          <div className="flex gap-1.5">
            {HIGHLIGHTER_LENGTH_PRESETS.map((length) => (
              <button
                key={length}
                type="button"
                onClick={() => onTapeMaxLengthChange?.(length)}
                className={`flex h-9 flex-1 items-center justify-center rounded-full text-[11px] font-medium transition ${
                  tapeMaxLength === length
                    ? "bg-foreground text-background"
                    : "bg-foreground/6 hover:bg-foreground/10"
                }`}
              >
                {length < 100 ? "짧게" : length < 200 ? "보통" : "길게"}
              </button>
            ))}
          </div>
          <p className="text-[11px] font-medium text-muted">색상</p>
          <div className="flex flex-wrap gap-2">
            {TAPE_COLORS.map((tape) => (
              <button
                key={tape.id}
                type="button"
                title={tape.label}
                onClick={() => onTapeColorChange?.(tape.color)}
                className={`h-8 w-10 rounded-md ring-2 transition ${
                  tapeColor === tape.color ? "ring-foreground scale-105" : "ring-black/10"
                }`}
                style={{ background: tape.color }}
                aria-label={`테이프 ${tape.label}`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted">테이프를 다시 누르면 설정을 접을 수 있어요</p>
        </div>
      )}

      {mode === "pen" && !settingsOpen && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-muted shadow-md ring-1 ring-black/8 backdrop-blur-sm"
        >
          펜 설정
        </button>
      )}

      {mode === "tape" && !settingsOpen && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="pointer-events-auto rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-medium text-muted shadow-md ring-1 ring-black/8 backdrop-blur-sm"
        >
          테이프 설정
        </button>
      )}

      <div className="pointer-events-auto relative max-w-[100vw]">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-full bg-white/95 p-1.5 shadow-lg ring-1 ring-black/8 backdrop-blur-sm sm:gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onModeChange("select")}
          className={mode === "select" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "select"}
        >
          선택
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

        <Link href="/capture" className={dockBtnScan} aria-label="AI 스캔">
          스캔
        </Link>

        <button
          type="button"
          onClick={handlePenClick}
          className={mode === "pen" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "pen"}
        >
          펜
        </button>
        <button
          type="button"
          onClick={handleTapeClick}
          className={mode === "tape" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "tape"}
        >
          테이프
        </button>
        <button
          type="button"
          onClick={() => onModeChange(mode === "text" ? "select" : "text")}
          className={mode === "text" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "text"}
        >
          텍스트
        </button>

        <button type="button" onClick={onOpenDecorate} className={dockBtnIdle}>
          꾸미기
        </button>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-black/10" aria-hidden />

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
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-full bg-gradient-to-l from-white/95 to-transparent sm:hidden"
          aria-hidden
        />
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

"use client";

import { useEffect, useState } from "react";
import type { EditorMode } from "./editor-types";
import {
  DEFAULT_PEN_STYLE_ID,
  PEN_COLORS,
  PEN_STYLES,
  type PenStyleId,
} from "@/lib/wall-scene/pen";
import PenStrokeWidthControl from "./PenStrokeWidthControl";
import TapeStrokeWidthControl from "./TapeStrokeWidthControl";
import TapeOpacityControl from "./TapeOpacityControl";
import TapeStyleControls from "./TapeStyleControls";
import {
  DEFAULT_TAPE_END_STYLE,
  getTapePreset,
  type TapeEndStyle,
  type TapePreset,
} from "@/lib/wall-scene/tape-style";

interface EditorToolDockProps {
  mode: EditorMode;
  onModeChange: (mode: EditorMode) => void;
  onOpenDecorate: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  penColor?: string;
  penStyleId?: PenStyleId;
  penStrokeWidth?: number;
  tapePresetId?: string;
  tapeEndStyle?: TapeEndStyle;
  tapeStrokeWidth?: number;
  tapeOpacity?: number;
  onPenColorChange?: (color: string) => void;
  onPenStyleIdChange?: (id: PenStyleId) => void;
  onPenStrokeWidthChange?: (width: number) => void;
  onTapePresetChange?: (preset: TapePreset) => void;
  onTapeEndStyleChange?: (style: TapeEndStyle) => void;
  onTapeStrokeWidthChange?: (width: number) => void;
  onTapeOpacityChange?: (opacity: number) => void;
}

const dockBtn =
  "flex h-11 min-w-11 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-medium transition active:scale-95 sm:px-3 sm:text-xs";
const dockBtnIdle = `${dockBtn} text-muted hover:bg-foreground/5`;
const dockBtnActive = `${dockBtn} bg-foreground text-background`;
const panelShell =
  "pointer-events-auto w-full max-w-md space-y-2.5 rounded-2xl bg-surface p-3 text-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm";
const panelLabel = "text-[11px] font-medium text-muted";
const idleChip = "bg-foreground/10 text-foreground hover:bg-foreground/15";
const activeChip = "bg-foreground text-background";

/**
 * Bottom tools. Pen/tape: first tap enters mode + opens settings;
 * second tap collapses settings so the canvas is free to draw;
 * third tap reopens settings. Use 선택 to leave the tool.
 */
export default function EditorToolDock({
  mode,
  onModeChange,
  onOpenDecorate,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  penColor = PEN_COLORS[0],
  penStyleId = DEFAULT_PEN_STYLE_ID,
  penStrokeWidth = PEN_STYLES[1].strokeWidth,
  tapePresetId = getTapePreset(undefined).id,
  tapeEndStyle = DEFAULT_TAPE_END_STYLE,
  tapeStrokeWidth = 16,
  tapeOpacity = 0.42,
  onPenColorChange,
  onPenStyleIdChange,
  onPenStrokeWidthChange,
  onTapePresetChange,
  onTapeEndStyleChange,
  onTapeStrokeWidthChange,
  onTapeOpacityChange,
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
        <div className={panelShell}>
          <div className="flex items-center justify-between gap-2">
            <p className={panelLabel}>펜 종류</p>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="rounded-full bg-foreground/10 px-2.5 py-1 text-[10px] font-medium text-muted transition hover:bg-foreground/15"
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
                  penStyleId === style.id ? activeChip : idleChip
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
          <p className={panelLabel}>크기</p>
          <PenStrokeWidthControl
            styleId={penStyleId}
            value={penStrokeWidth}
            onChange={(width) => onPenStrokeWidthChange?.(width)}
            compact
          />
          <p className={panelLabel}>색상</p>
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
        <div className={panelShell}>
          <div className="flex items-center justify-between gap-2">
            <p className={panelLabel}>테이프 두께</p>
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="rounded-full bg-foreground/10 px-2.5 py-1 text-[10px] font-medium text-muted transition hover:bg-foreground/15"
            >
              접기
            </button>
          </div>
          <TapeStrokeWidthControl
            value={tapeStrokeWidth}
            onChange={(width) => onTapeStrokeWidthChange?.(width)}
            compact
          />
          <p className={panelLabel}>진하기</p>
          <TapeOpacityControl
            value={tapeOpacity}
            onChange={(opacity) => onTapeOpacityChange?.(opacity)}
            compact
          />
          <p className="text-[10px] text-muted">길이는 드래그를 멈춘 지점까지예요</p>
          <TapeStyleControls
            tapePresetId={tapePresetId}
            tapeEndStyle={tapeEndStyle}
            onTapePresetChange={(preset) => onTapePresetChange?.(preset)}
            onTapeEndStyleChange={(style) => onTapeEndStyleChange?.(style)}
            compact
          />
          <p className="text-[10px] text-muted">테이프를 다시 누르면 설정을 접을 수 있어요</p>
        </div>
      )}

      {mode === "pen" && !settingsOpen && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="pointer-events-auto rounded-full bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground/90 shadow-md ring-1 ring-foreground/10 backdrop-blur-sm"
        >
          펜 설정
        </button>
      )}

      {mode === "tape" && !settingsOpen && (
        <button
          type="button"
          onClick={() => setSettingsOpen(true)}
          className="pointer-events-auto rounded-full bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground/90 shadow-md ring-1 ring-foreground/10 backdrop-blur-sm"
        >
          테이프 설정
        </button>
      )}

      <div className="pointer-events-auto relative max-w-[100vw]">
        <div className="flex items-center gap-0.5 overflow-x-auto rounded-full bg-surface/95 p-1.5 shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm sm:gap-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() => onModeChange("select")}
          className={mode === "select" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "select"}
          aria-label="선택"
          title="선택 (V)"
        >
          <SelectCursorIcon />
        </button>
        <button
          type="button"
          onClick={() => onModeChange("hand")}
          className={mode === "hand" ? dockBtnActive : dockBtnIdle}
          aria-pressed={mode === "hand"}
          aria-label="이동"
          title="이동 (H)"
        >
          <HandIcon />
        </button>

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
          에셋
        </button>

        <span className="mx-0.5 h-5 w-px shrink-0 bg-foreground/10" aria-hidden />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={`${dockBtnIdle} disabled:opacity-30`}
          aria-label="실행 취소"
        >
          <UndoIcon />
        </button>
        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={`${dockBtnIdle} disabled:opacity-30`}
          aria-label="다시 실행"
        >
          <RedoIcon />
        </button>
        </div>
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-6 rounded-r-full bg-gradient-to-l from-surface/95 to-transparent sm:hidden"
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

/** Figma-style cursor / select tool. */
export function SelectCursorIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 4l7.5 16 1.8-6.7L20 11.5 4 4z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Figma-style hand / pan tool. */
export function HandIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 11V6.5a1.5 1.5 0 013 0V11M11 10.5V5.5a1.5 1.5 0 013 0V11M14 10V7.5a1.5 1.5 0 013 0V14c0 3.5-2 5.5-5.5 5.5S6 17.5 6 14v-3.5a1.5 1.5 0 013 0V11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Curved undo arrow — shared with desktop tool rail. */
export function UndoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M9 14L4 9l5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 9h9a6 6 0 010 12h-2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Curved redo arrow — shared with desktop tool rail. */
export function RedoIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M15 14l5-5-5-5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 9h-9a6 6 0 000 12h2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
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

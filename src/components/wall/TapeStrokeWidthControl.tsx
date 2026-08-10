"use client";

import {
  TAPE_STROKE_WIDTH_MAX,
  TAPE_STROKE_WIDTH_MIN,
  TAPE_STROKE_WIDTH_STEP,
  clampTapeStrokeWidth,
} from "@/lib/wall-scene/highlighter";

interface TapeStrokeWidthControlProps {
  value: number;
  onChange: (width: number) => void;
  compact?: boolean;
}

/** Slider + numeric input for masking-tape thickness. */
export default function TapeStrokeWidthControl({
  value,
  onChange,
  compact = false,
}: TapeStrokeWidthControlProps) {
  const applyWidth = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    onChange(clampTapeStrokeWidth(raw));
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "pt-0.5"}`}>
      <input
        type="range"
        min={TAPE_STROKE_WIDTH_MIN}
        max={TAPE_STROKE_WIDTH_MAX}
        step={TAPE_STROKE_WIDTH_STEP}
        value={value}
        onChange={(e) => applyWidth(Number(e.target.value))}
        className="min-w-0 flex-1 accent-neutral-900"
        aria-label="테이프 두께"
      />
      <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
        <input
          type="number"
          min={TAPE_STROKE_WIDTH_MIN}
          max={TAPE_STROKE_WIDTH_MAX}
          step={TAPE_STROKE_WIDTH_STEP}
          value={value}
          onChange={(e) => applyWidth(Number(e.target.value))}
          className="w-14 rounded-lg border border-foreground/10 bg-surface px-1.5 py-1 text-center text-[12px] font-medium tabular-nums text-foreground outline-none focus:border-foreground/30"
          aria-label="테이프 두께 숫자"
        />
        <span>px</span>
      </label>
    </div>
  );
}

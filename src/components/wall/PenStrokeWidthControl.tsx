"use client";

import {
  PEN_WIDTH_RANGE_BY_STYLE,
  clampPenStrokeWidth,
  type PenStyleId,
} from "@/lib/wall-scene/pen";

interface PenStrokeWidthControlProps {
  styleId: PenStyleId;
  value: number;
  onChange: (width: number) => void;
  /** Compact layout for the bottom dock */
  compact?: boolean;
}

/** Slider + numeric input for per-brush stroke width. */
export default function PenStrokeWidthControl({
  styleId,
  value,
  onChange,
  compact = false,
}: PenStrokeWidthControlProps) {
  const range = PEN_WIDTH_RANGE_BY_STYLE[styleId];

  const applyWidth = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    onChange(clampPenStrokeWidth(styleId, raw));
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "pt-0.5"}`}>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={range.step}
        value={value}
        onChange={(e) => applyWidth(Number(e.target.value))}
        className="min-w-0 flex-1 accent-neutral-900"
        aria-label="펜 크기"
      />
      <label className="flex shrink-0 items-center gap-1 text-[11px] text-neutral-500">
        <input
          type="number"
          min={range.min}
          max={range.max}
          step={range.step}
          value={value}
          onChange={(e) => applyWidth(Number(e.target.value))}
          className="w-14 rounded-lg border border-neutral-200 bg-white px-1.5 py-1 text-center text-[12px] font-medium tabular-nums text-neutral-900 outline-none focus:border-neutral-400"
          aria-label="펜 크기 숫자"
        />
        <span>px</span>
      </label>
    </div>
  );
}

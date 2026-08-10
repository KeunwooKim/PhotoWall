"use client";

import {
  TAPE_OPACITY_MAX,
  TAPE_OPACITY_MIN,
  TAPE_OPACITY_STEP,
  clampTapeOpacity,
} from "@/lib/wall-scene/highlighter";

interface TapeOpacityControlProps {
  value: number;
  onChange: (opacity: number) => void;
  compact?: boolean;
}

/** Slider for masking-tape fill intensity (진하기). */
export default function TapeOpacityControl({
  value,
  onChange,
  compact = false,
}: TapeOpacityControlProps) {
  const percent = Math.round(clampTapeOpacity(value) * 100);

  const apply = (raw: number) => {
    if (!Number.isFinite(raw)) return;
    // Accept 0–1 or 0–100 from number input.
    const normalized = raw > 1 ? raw / 100 : raw;
    onChange(clampTapeOpacity(normalized));
  };

  return (
    <div className={`flex items-center gap-2 ${compact ? "" : "pt-0.5"}`}>
      <input
        type="range"
        min={TAPE_OPACITY_MIN}
        max={TAPE_OPACITY_MAX}
        step={TAPE_OPACITY_STEP}
        value={clampTapeOpacity(value)}
        onChange={(e) => apply(Number(e.target.value))}
        className="min-w-0 flex-1 accent-neutral-900"
        aria-label="테이프 진하기"
      />
      <label className="flex shrink-0 items-center gap-1 text-[11px] text-muted">
        <input
          type="number"
          min={Math.round(TAPE_OPACITY_MIN * 100)}
          max={Math.round(TAPE_OPACITY_MAX * 100)}
          step={1}
          value={percent}
          onChange={(e) => apply(Number(e.target.value))}
          className="w-14 rounded-lg border border-foreground/10 bg-surface px-1.5 py-1 text-center text-[12px] font-medium tabular-nums text-foreground outline-none focus:border-foreground/30"
          aria-label="테이프 진하기 퍼센트"
        />
        <span>%</span>
      </label>
    </div>
  );
}

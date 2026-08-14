"use client";

import {
  CROP_ASPECT_PRESETS,
  type CropAspectPresetId,
} from "@/lib/wall-scene/photo-crop";

interface PhotoCropToolbarProps {
  aspectPreset: CropAspectPresetId;
  onAspectChange: (preset: CropAspectPresetId) => void;
  onApply: () => void;
  onCancel: () => void;
  onReset?: () => void;
  canReset?: boolean;
  showRecoveryHint?: boolean;
  slotMode?: boolean;
  slotIndex?: number;
  onSlotIndexChange?: (index: number) => void;
}

const idleBtn =
  "rounded-xl bg-foreground/10 px-4 py-2 text-xs font-medium text-foreground transition hover:bg-foreground/15";
const primaryBtn =
  "rounded-xl bg-foreground px-4 py-2 text-xs font-medium text-background transition active:scale-[0.98]";

export default function PhotoCropToolbar({
  aspectPreset,
  onAspectChange,
  onApply,
  onCancel,
  onReset,
  canReset = false,
  showRecoveryHint = false,
  slotMode = false,
  slotIndex = 0,
  onSlotIndexChange,
}: PhotoCropToolbarProps) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-2 px-3"
      style={{ bottom: "max(5.5rem, calc(env(safe-area-inset-bottom) + 4.5rem))" }}
    >
      <div className="pointer-events-auto flex w-full max-w-lg flex-wrap items-center justify-center gap-2 rounded-2xl bg-surface p-3 text-foreground shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm">
        <p className="w-full text-center text-[11px] font-medium text-muted">
          {slotMode ? "칸 자르기" : "사진 자르기"}
        </p>
        {showRecoveryHint && !slotMode && (
          <p className="w-full text-center text-[10px] leading-snug text-muted">
            흐린 영역까지 크롭을 넓히면 잘린 부분을 복구할 수 있어요
          </p>
        )}
        {slotMode ? (
          <div className="flex flex-wrap justify-center gap-1.5">
            {[0, 1, 2, 3].map((index) => (
              <button
                key={index}
                type="button"
                onClick={() => onSlotIndexChange?.(index)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                  slotIndex === index
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground hover:bg-foreground/15"
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-1.5">
            {CROP_ASPECT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onAspectChange(preset.id)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition ${
                  aspectPreset === preset.id
                    ? "bg-foreground text-background"
                    : "bg-foreground/10 text-foreground hover:bg-foreground/15"
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        )}
        <div className="flex w-full flex-wrap justify-center gap-2 pt-1">
          {canReset && onReset && (
            <button type="button" onClick={onReset} className={idleBtn}>
              원본
            </button>
          )}
          <button type="button" onClick={onCancel} className={idleBtn}>
            취소
          </button>
          <button type="button" onClick={onApply} className={primaryBtn}>
            적용
          </button>
        </div>
      </div>
    </div>
  );
}

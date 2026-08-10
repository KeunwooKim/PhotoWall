"use client";

import {
  TAPE_END_STYLES,
  TAPE_PATTERN_PRESETS,
  TAPE_SOLID_PRESETS,
  tapePresetSwatchStyle,
  type TapeEndStyle,
  type TapePreset,
} from "@/lib/wall-scene/tape-style";

const idleChip = "bg-foreground/10 text-foreground hover:bg-foreground/15";
const activeChip = "bg-foreground text-background";

interface TapeStyleControlsProps {
  tapePresetId: string;
  tapeEndStyle: TapeEndStyle;
  onTapePresetChange: (preset: TapePreset) => void;
  onTapeEndStyleChange: (style: TapeEndStyle) => void;
  compact?: boolean;
}

export default function TapeStyleControls({
  tapePresetId,
  tapeEndStyle,
  onTapePresetChange,
  onTapeEndStyleChange,
  compact = false,
}: TapeStyleControlsProps) {
  const labelClass = compact
    ? "text-[11px] font-medium text-muted"
    : "text-[11px] font-medium text-muted";

  return (
    <div className="space-y-2.5">
      <p className={labelClass}>끝 모양</p>
      <div className="flex gap-1.5">
        {TAPE_END_STYLES.map((style) => (
          <button
            key={style.id}
            type="button"
            onClick={() => onTapeEndStyleChange(style.id)}
            className={`flex h-9 flex-1 items-center justify-center rounded-full text-[11px] font-medium transition ${
              tapeEndStyle === style.id ? activeChip : idleChip
            }`}
          >
            {style.label}
          </button>
        ))}
      </div>

      <p className={labelClass}>단색</p>
      <div className="flex flex-wrap gap-2">
        {TAPE_SOLID_PRESETS.map((tape) => (
          <button
            key={tape.id}
            type="button"
            title={tape.label}
            onClick={() => onTapePresetChange(tape)}
            className={`h-8 w-10 rounded-md ring-2 transition ${
              tapePresetId === tape.id ? "ring-foreground scale-105" : "ring-foreground/10"
            }`}
            style={tapePresetSwatchStyle(tape)}
            aria-label={`테이프 ${tape.label}`}
          />
        ))}
      </div>

      <p className={labelClass}>패턴</p>
      <div className="flex flex-wrap gap-2">
        {TAPE_PATTERN_PRESETS.map((tape) => (
          <button
            key={tape.id}
            type="button"
            title={tape.label}
            onClick={() => onTapePresetChange(tape)}
            className={`h-8 w-10 rounded-md ring-2 transition ${
              tapePresetId === tape.id ? "ring-foreground scale-105" : "ring-foreground/10"
            }`}
            style={tapePresetSwatchStyle(tape)}
            aria-label={`테이프 ${tape.label}`}
          />
        ))}
      </div>
    </div>
  );
}

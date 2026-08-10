/** Masking-tape end caps, patterns, and color presets. */

export type TapeEndStyle = "round" | "square" | "pinking";
export type TapePatternId = "solid" | "stripe" | "dot" | "grid" | "diagonal";

export interface TapeEndStyleOption {
  id: TapeEndStyle;
  label: string;
}

export interface TapePreset {
  id: string;
  label: string;
  color: string;
  pattern: TapePatternId;
  /** Pattern accent (stripes / dots / grid lines). */
  accent?: string;
  opacity?: number;
}

export const TAPE_END_STYLES: readonly TapeEndStyleOption[] = [
  { id: "round", label: "둥근 끝" },
  { id: "square", label: "사각 끝" },
  { id: "pinking", label: "핑킹" },
] as const;

export const DEFAULT_TAPE_END_STYLE: TapeEndStyle = "round";
export const DEFAULT_TAPE_PATTERN: TapePatternId = "solid";

/** Solid translucent washi-like colors (legacy palette). */
export const TAPE_SOLID_PRESETS: readonly TapePreset[] = [
  { id: "pink", label: "핑크", color: "#f9a8c9", pattern: "solid" },
  { id: "coral", label: "코랄", color: "#fda4af", pattern: "solid" },
  { id: "peach", label: "피치", color: "#fdba74", pattern: "solid" },
  { id: "yellow", label: "옐로", color: "#fde68a", pattern: "solid" },
  { id: "mint", label: "민트", color: "#a8e6cf", pattern: "solid" },
  { id: "sky", label: "스카이", color: "#7dd3fc", pattern: "solid" },
  { id: "lavender", label: "라벤더", color: "#c4b5fd", pattern: "solid" },
  { id: "lilac", label: "라일락", color: "#e9d5ff", pattern: "solid" },
  { id: "cream", label: "크림", color: "#fef3c7", pattern: "solid" },
  { id: "white", label: "화이트", color: "#f5f5f4", pattern: "solid" },
] as const;

/** Patterned washi tapes. */
export const TAPE_PATTERN_PRESETS: readonly TapePreset[] = [
  {
    id: "stripe-coral",
    label: "코랄 줄무늬",
    color: "#fda4af",
    pattern: "stripe",
    accent: "#fff5f6",
    opacity: 0.62,
  },
  {
    id: "stripe-mint",
    label: "민트 줄무늬",
    color: "#6ee7b7",
    pattern: "stripe",
    accent: "#ecfdf5",
    opacity: 0.62,
  },
  {
    id: "dot-pink",
    label: "핑크 도트",
    color: "#f9a8c9",
    pattern: "dot",
    accent: "#ffffff",
    opacity: 0.64,
  },
  {
    id: "dot-sky",
    label: "스카이 도트",
    color: "#7dd3fc",
    pattern: "dot",
    accent: "#f0f9ff",
    opacity: 0.64,
  },
  {
    id: "grid-cream",
    label: "크림 격자",
    color: "#fef3c7",
    pattern: "grid",
    accent: "#d6b56a",
    opacity: 0.6,
  },
  {
    id: "diagonal-lavender",
    label: "라벤더 사선",
    color: "#c4b5fd",
    pattern: "diagonal",
    accent: "#f5f3ff",
    opacity: 0.62,
  },
  {
    id: "diagonal-peach",
    label: "피치 사선",
    color: "#fdba74",
    pattern: "diagonal",
    accent: "#fff7ed",
    opacity: 0.62,
  },
  {
    id: "stripe-yellow",
    label: "옐로 줄무늬",
    color: "#fde68a",
    pattern: "stripe",
    accent: "#fffbeb",
    opacity: 0.62,
  },
] as const;

export const TAPE_PRESETS: readonly TapePreset[] = [
  ...TAPE_SOLID_PRESETS,
  ...TAPE_PATTERN_PRESETS,
];

/** @deprecated Prefer TAPE_PRESETS / TAPE_SOLID_PRESETS */
export const TAPE_COLORS = TAPE_SOLID_PRESETS.map((p) => ({
  id: p.id,
  color: p.color,
  label: p.label,
}));

export function getTapePreset(id: string | undefined | null): TapePreset {
  return TAPE_PRESETS.find((p) => p.id === id) ?? TAPE_PRESETS[0];
}

export function findTapePresetByColor(color: string): TapePreset | undefined {
  return TAPE_PRESETS.find((p) => p.color === color && p.pattern === "solid");
}

export function isTapeEndStyle(value: unknown): value is TapeEndStyle {
  return value === "round" || value === "square" || value === "pinking";
}

export function isTapePatternId(value: unknown): value is TapePatternId {
  return (
    value === "solid" ||
    value === "stripe" ||
    value === "dot" ||
    value === "grid" ||
    value === "diagonal"
  );
}

export function clampTapeEndStyle(value: unknown): TapeEndStyle {
  return isTapeEndStyle(value) ? value : DEFAULT_TAPE_END_STYLE;
}

export function clampTapePattern(value: unknown): TapePatternId {
  return isTapePatternId(value) ? value : DEFAULT_TAPE_PATTERN;
}

/** CSS background for preset swatches in the tool UI. */
export function tapePresetSwatchStyle(
  preset: TapePreset,
): Record<string, string> {
  const accent = preset.accent ?? "#ffffff";
  switch (preset.pattern) {
    case "stripe":
      return {
        backgroundColor: preset.color,
        backgroundImage: `repeating-linear-gradient(90deg, ${accent} 0 3px, transparent 3px 9px)`,
      };
    case "dot":
      return {
        backgroundColor: preset.color,
        backgroundImage: `radial-gradient(circle at 30% 35%, ${accent} 1.6px, transparent 1.8px), radial-gradient(circle at 70% 65%, ${accent} 1.6px, transparent 1.8px)`,
        backgroundSize: "10px 10px",
      };
    case "grid":
      return {
        backgroundColor: preset.color,
        backgroundImage: `linear-gradient(${accent} 1px, transparent 1px), linear-gradient(90deg, ${accent} 1px, transparent 1px)`,
        backgroundSize: "8px 8px",
      };
    case "diagonal":
      return {
        backgroundColor: preset.color,
        backgroundImage: `repeating-linear-gradient(-45deg, ${accent} 0 2px, transparent 2px 8px)`,
      };
    default:
      return { background: preset.color };
  }
}

/** Freehand pen palette + visually distinct styles */

export const PEN_COLORS = [
  "#171717",
  "#525252",
  "#dc2626",
  "#ea580c",
  "#ca8a04",
  "#16a34a",
  "#0891b2",
  "#2563eb",
  "#9333ea",
  "#db2777",
] as const;

export type PenStyleId = "fine" | "ink" | "marker" | "brush";

export interface PenStyleDef {
  id: PenStyleId;
  label: string;
  /** Preview swatch hint under the label */
  hint: string;
  strokeWidth: number;
  opacity: number;
  tension: number;
  lineCap: "butt" | "round" | "square";
  lineJoin: "miter" | "round" | "bevel";
  /** Soft edge for brush / marker */
  shadowBlur?: number;
  shadowOpacity?: number;
}

export const PEN_STYLES: readonly PenStyleDef[] = [
  {
    id: "fine",
    label: "볼펜",
    hint: "가늘고 또렷",
    strokeWidth: 1.75,
    opacity: 1,
    tension: 0,
    lineCap: "round",
    lineJoin: "round",
  },
  {
    id: "ink",
    label: "만년필",
    hint: "부드러운 잉크",
    strokeWidth: 3.5,
    opacity: 0.9,
    tension: 0.4,
    lineCap: "round",
    lineJoin: "round",
  },
  {
    id: "marker",
    label: "마카",
    hint: "넓고 반투명",
    strokeWidth: 16,
    opacity: 0.45,
    tension: 0.15,
    lineCap: "square",
    lineJoin: "bevel",
  },
  {
    id: "brush",
    label: "붓펜",
    hint: "두껍고 번짐",
    strokeWidth: 20,
    opacity: 0.78,
    tension: 0.55,
    lineCap: "round",
    lineJoin: "round",
    shadowBlur: 6,
    shadowOpacity: 0.35,
  },
] as const;

export const DEFAULT_PEN_STYLE_ID: PenStyleId = "ink";

/** Absolute stroke width (wall px) remembered per brush. */
export type PenWidthByStyle = Record<PenStyleId, number>;

export interface PenWidthRange {
  min: number;
  max: number;
  step: number;
}

/** Numeric size limits per brush — finer pens get smaller steps. */
export const PEN_WIDTH_RANGE_BY_STYLE: Record<PenStyleId, PenWidthRange> = {
  fine: { min: 0.5, max: 8, step: 0.25 },
  ink: { min: 1, max: 14, step: 0.25 },
  marker: { min: 4, max: 40, step: 0.5 },
  brush: { min: 4, max: 48, step: 0.5 },
};

export function createDefaultPenWidthByStyle(): PenWidthByStyle {
  return {
    fine: PEN_STYLES[0].strokeWidth,
    ink: PEN_STYLES[1].strokeWidth,
    marker: PEN_STYLES[2].strokeWidth,
    brush: PEN_STYLES[3].strokeWidth,
  };
}

export function clampPenStrokeWidth(styleId: PenStyleId, width: number): number {
  const range = PEN_WIDTH_RANGE_BY_STYLE[styleId];
  const clamped = Math.min(range.max, Math.max(range.min, width));
  const steps = Math.round((clamped - range.min) / range.step);
  return Math.round((range.min + steps * range.step) * 100) / 100;
}

/** @deprecated Prefer createDefaultPenWidthByStyle */
export const PEN_STROKE_WIDTH_PRESETS = PEN_STYLES.map((s) => s.strokeWidth);

/** Min pointer travel (wall px) before appending a freehand sample */
export const PEN_SAMPLE_DISTANCE = 2.5;

export function getPenStyle(id: PenStyleId | string | undefined | null): PenStyleDef {
  return PEN_STYLES.find((s) => s.id === id) ?? PEN_STYLES[1];
}

/** Scale soft-edge blur with the chosen stroke width. */
export function resolvePenShadowBlur(style: PenStyleDef, strokeWidth: number): number {
  if (!style.shadowBlur) return 0;
  return style.shadowBlur * (strokeWidth / style.strokeWidth);
}

/** Infer style from legacy strokes that only stored strokeWidth */
export function inferPenStyleId(strokeWidth: number, opacity?: number): PenStyleId {
  if (opacity != null && opacity < 0.6 && strokeWidth >= 10) return "marker";
  if (strokeWidth >= 16) return "brush";
  if (strokeWidth >= 7) return "marker";
  if (strokeWidth <= 2.25) return "fine";
  return "ink";
}

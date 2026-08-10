/** 형광펜 — 직선 하이라이트 전용 */

export const HIGHLIGHTER_STROKE_WIDTH = 16;
export const HIGHLIGHTER_OPACITY = 0.42;
export const HIGHLIGHTER_MIN_LENGTH = 28;
/** Safety ceiling only — UI no longer offers fixed lengths; drag sets the length. */
export const HIGHLIGHTER_MAX_LENGTH = 8000;

/** @deprecated Length presets removed — tape length follows the drag gesture. */
export const HIGHLIGHTER_LENGTH_PRESETS = [80, 160, 260] as const;
export type HighlighterLengthPreset = (typeof HIGHLIGHTER_LENGTH_PRESETS)[number];

/** Tape stroke width (마스킹 테이프 두께) */
export const TAPE_STROKE_WIDTH_DEFAULT = 16;
export const TAPE_STROKE_WIDTH_MIN = 6;
export const TAPE_STROKE_WIDTH_MAX = 48;
export const TAPE_STROKE_WIDTH_STEP = 1;

/** Tape fill intensity (진하기) — 0–1 alpha */
export const TAPE_OPACITY_DEFAULT = HIGHLIGHTER_OPACITY;
export const TAPE_OPACITY_MIN = 0.15;
export const TAPE_OPACITY_MAX = 0.95;
export const TAPE_OPACITY_STEP = 0.01;

export function clampTapeStrokeWidth(width: number): number {
  if (!Number.isFinite(width)) return TAPE_STROKE_WIDTH_DEFAULT;
  return Math.min(
    TAPE_STROKE_WIDTH_MAX,
    Math.max(TAPE_STROKE_WIDTH_MIN, Math.round(width)),
  );
}

export function clampTapeOpacity(opacity: number): number {
  if (!Number.isFinite(opacity)) return TAPE_OPACITY_DEFAULT;
  return Math.min(
    TAPE_OPACITY_MAX,
    Math.max(TAPE_OPACITY_MIN, Math.round(opacity * 100) / 100),
  );
}

/** 형광펜 색상 — 파스텔·형광 톤 */
export const HIGHLIGHTER_COLORS = [
  "#fff59d",
  "#ffcc80",
  "#f48fb1",
  "#80deea",
  "#c5e1a5",
  "#e1bee7",
] as const;

export interface LineEndpoints {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function lineLength(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

/**
 * Accept a tape stroke at the gesture length (no max cap).
 * Returns null if shorter than the minimum tap threshold.
 */
export function finalizeTapeEndpoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  minLength = HIGHLIGHTER_MIN_LENGTH,
): LineEndpoints | null {
  if (lineLength(x1, y1, x2, y2) < minLength) return null;
  return { x1, y1, x2, y2 };
}

/** 드래그 끝점을 최소·최대 길이 안으로 클램프. 너무 짧으면 null */
export function clampLineEndpoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  maxLength: number,
  minLength = HIGHLIGHTER_MIN_LENGTH,
): LineEndpoints | null {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);

  if (len < minLength) return null;

  if (len > maxLength) {
    const scale = maxLength / len;
    return {
      x1,
      y1,
      x2: x1 + dx * scale,
      y2: y1 + dy * scale,
    };
  }

  return { x1, y1, x2, y2 };
}

export function endpointsToPoints(endpoints: LineEndpoints): number[] {
  return [endpoints.x1, endpoints.y1, endpoints.x2, endpoints.y2];
}

export interface HighlighterRectLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

/** 직선 형광펜을 양 끝이 직각인 회전 Rect로 변환 */
export function linePointsToHighlighterRect(
  points: number[],
  height = HIGHLIGHTER_STROKE_WIDTH,
): HighlighterRectLayout | null {
  if (points.length < 4) return null;

  const x1 = points[0];
  const y1 = points[1];
  const x2 = points[2];
  const y2 = points[3];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const width = Math.hypot(dx, dy);

  if (width < 1) return null;

  return {
    x: x1,
    y: y1,
    width,
    height,
    rotation: (Math.atan2(dy, dx) * 180) / Math.PI,
  };
}

/** 직선 형광펜 (정확히 2점) 여부 */
export function isStraightHighlighterPath(points: number[]): boolean {
  return points.length === 4;
}

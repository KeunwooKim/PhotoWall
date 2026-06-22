/** 형광펜 — 직선 하이라이트 전용 */

export const HIGHLIGHTER_STROKE_WIDTH = 16;
export const HIGHLIGHTER_OPACITY = 0.42;
export const HIGHLIGHTER_MIN_LENGTH = 28;
export const HIGHLIGHTER_MAX_LENGTH = 280;

/** 툴바에서 선택하는 최대 길이 프리셋 (px) */
export const HIGHLIGHTER_LENGTH_PRESETS = [80, 160, 260] as const;
export type HighlighterLengthPreset = (typeof HIGHLIGHTER_LENGTH_PRESETS)[number];

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

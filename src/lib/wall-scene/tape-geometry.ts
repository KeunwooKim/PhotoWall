import type { TapeEndStyle, TapePatternId } from "@/lib/wall-scene/tape-style";
import { lineLength } from "@/lib/wall-scene/highlighter";

export interface TapeAxis {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  length: number;
  ax: number;
  ay: number;
  px: number;
  py: number;
  half: number;
}

export function resolveTapeAxis(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  height: number,
): TapeAxis | null {
  const length = lineLength(x1, y1, x2, y2);
  if (length < 1 || height < 1) return null;
  const ax = (x2 - x1) / length;
  const ay = (y2 - y1) / length;
  return {
    x1,
    y1,
    x2,
    y2,
    length,
    ax,
    ay,
    px: -ay,
    py: ax,
    half: height / 2,
  };
}

function pushPoint(out: number[], x: number, y: number) {
  const n = out.length;
  if (n >= 2 && Math.abs(out[n - 2] - x) < 0.05 && Math.abs(out[n - 1] - y) < 0.05) {
    return;
  }
  out.push(x, y);
}

function appendArc(
  out: number[],
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  segments = 10,
) {
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = startAngle + (endAngle - startAngle) * t;
    pushPoint(out, cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
  }
}

/** Zigzag along an end edge (perp from -half..+half), teeth point along `ox,oy`. */
function appendPinking(
  out: number[],
  cx: number,
  cy: number,
  px: number,
  py: number,
  half: number,
  ox: number,
  oy: number,
  toothDepth: number,
  toothWidth: number,
) {
  const span = half * 2;
  const teeth = Math.max(3, Math.round(span / Math.max(4, toothWidth)));
  for (let i = 0; i <= teeth; i++) {
    const t = -half + (span * i) / teeth;
    const isTip = i % 2 === 1;
    const x = cx + px * t + (isTip ? ox * toothDepth : 0);
    const y = cy + py * t + (isTip ? oy * toothDepth : 0);
    pushPoint(out, x, y);
  }
}

/**
 * World-space closed polygon for a masking-tape strip.
 * Winding: start-left → end-left → end cap → end-right → start-right → start cap.
 */
export function buildTapePolygon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  height: number,
  endStyle: TapeEndStyle = "round",
): number[] | null {
  const axis = resolveTapeAxis(x1, y1, x2, y2, height);
  if (!axis) return null;
  const { ax, ay, px, py, half, length } = axis;
  const out: number[] = [];

  const startLeftX = x1 - px * half;
  const startLeftY = y1 - py * half;
  const startRightX = x1 + px * half;
  const startRightY = y1 + py * half;
  const endLeftX = x2 - px * half;
  const endLeftY = y2 - py * half;
  const endRightX = x2 + px * half;
  const endRightY = y2 + py * half;

  if (endStyle === "square") {
    pushPoint(out, startLeftX, startLeftY);
    pushPoint(out, endLeftX, endLeftY);
    pushPoint(out, endRightX, endRightY);
    pushPoint(out, startRightX, startRightY);
    return out;
  }

  if (endStyle === "pinking") {
    const toothDepth = Math.min(half * 0.85, 10);
    const toothWidth = Math.max(5, height * 0.42);
    // Shorten body so teeth sit roughly on the original ends.
    const inset = toothDepth * 0.35;
    const sx = x1 + ax * inset;
    const sy = y1 + ay * inset;
    const ex = x2 - ax * inset;
    const ey = y2 - ay * inset;
    if (lineLength(sx, sy, ex, ey) < 4) {
      // Too short — fall back to square.
      return buildTapePolygon(x1, y1, x2, y2, height, "square");
    }

    const sLX = sx - px * half;
    const sLY = sy - py * half;
    const eLX = ex - px * half;
    const eLY = ey - py * half;
    const eRX = ex + px * half;
    const eRY = ey + py * half;

    pushPoint(out, sLX, sLY);
    pushPoint(out, eLX, eLY);
    appendPinking(out, ex, ey, px, py, half, ax, ay, toothDepth, toothWidth);
    pushPoint(out, eRX, eRY);
    // bottom long edge back toward start
    const sRX = sx + px * half;
    const sRY = sy + py * half;
    pushPoint(out, sRX, sRY);
    // start cap: from +perp to -perp with teeth pointing backward
    appendPinking(out, sx, sy, -px, -py, half, -ax, -ay, toothDepth, toothWidth);
    return out;
  }

  // round — capsule
  const angle = Math.atan2(ay, ax);
  pushPoint(out, startLeftX, startLeftY);
  pushPoint(out, endLeftX, endLeftY);
  appendArc(out, x2, y2, half, angle - Math.PI / 2, angle + Math.PI / 2);
  pushPoint(out, endRightX, endRightY);
  pushPoint(out, startRightX, startRightY);
  appendArc(out, x1, y1, half, angle + Math.PI / 2, angle + (3 * Math.PI) / 2);
  void length;
  return out;
}

export interface TapePatternDot {
  x: number;
  y: number;
  r: number;
}

export interface TapePatternStroke {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  width: number;
}

export interface TapePatternDrawList {
  strokes: TapePatternStroke[];
  dots: TapePatternDot[];
}

/** Decorative strokes/dots in world space, clipped visually by the tape fill order. */
export function buildTapePatternDrawList(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  height: number,
  pattern: TapePatternId,
): TapePatternDrawList {
  const empty: TapePatternDrawList = { strokes: [], dots: [] };
  if (pattern === "solid") return empty;
  const axis = resolveTapeAxis(x1, y1, x2, y2, height);
  if (!axis) return empty;
  const { ax, ay, px, py, half, length } = axis;
  const strokes: TapePatternStroke[] = [];
  const dots: TapePatternDot[] = [];

  if (pattern === "stripe") {
    const step = Math.max(6, height * 0.55);
    for (let d = step; d < length - 1; d += step) {
      const cx = x1 + ax * d;
      const cy = y1 + ay * d;
      strokes.push({
        x1: cx - px * half * 0.92,
        y1: cy - py * half * 0.92,
        x2: cx + px * half * 0.92,
        y2: cy + py * half * 0.92,
        width: Math.max(1.5, height * 0.12),
      });
    }
    return { strokes, dots };
  }

  if (pattern === "diagonal") {
    const step = Math.max(7, height * 0.5);
    const inset = half * 0.15;
    for (let d = -half; d <= length + half; d += step) {
      const sx = x1 + ax * d - px * (half - inset);
      const sy = y1 + ay * d - py * (half - inset);
      const ex = x1 + ax * (d + half * 1.1) + px * (half - inset);
      const ey = y1 + ay * (d + half * 1.1) + py * (half - inset);
      strokes.push({
        x1: sx,
        y1: sy,
        x2: ex,
        y2: ey,
        width: Math.max(1.25, height * 0.1),
      });
    }
    return { strokes, dots };
  }

  if (pattern === "grid") {
    const stepL = Math.max(8, height * 0.7);
    const stepW = Math.max(6, height * 0.45);
    for (let d = stepL; d < length - 1; d += stepL) {
      const cx = x1 + ax * d;
      const cy = y1 + ay * d;
      strokes.push({
        x1: cx - px * half * 0.9,
        y1: cy - py * half * 0.9,
        x2: cx + px * half * 0.9,
        y2: cy + py * half * 0.9,
        width: Math.max(1, height * 0.08),
      });
    }
    for (let w = -half + stepW; w < half - 1; w += stepW) {
      strokes.push({
        x1: x1 + px * w + ax * 2,
        y1: y1 + py * w + ay * 2,
        x2: x2 + px * w - ax * 2,
        y2: y2 + py * w - ay * 2,
        width: Math.max(1, height * 0.08),
      });
    }
    return { strokes, dots };
  }

  if (pattern === "dot") {
    const stepL = Math.max(9, height * 0.75);
    const rows = height >= 14 ? [-0.32, 0.32] : [0];
    const r = Math.max(1.4, height * 0.14);
    let row = 0;
    for (let d = stepL * 0.6; d < length - stepL * 0.4; d += stepL) {
      for (const rowT of rows) {
        const offset = (row % 2) * stepL * 0.35;
        const cx = x1 + ax * (d + offset) + px * half * rowT;
        const cy = y1 + ay * (d + offset) + py * half * rowT;
        dots.push({ x: cx, y: cy, r });
      }
      row += 1;
    }
    return { strokes, dots };
  }

  return empty;
}

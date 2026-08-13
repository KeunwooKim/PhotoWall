import { getFramePatternCanvas, type PhotoFrameDefinition } from "@/lib/photo-frames";
import { fourCutChromeBands } from "./layout";
import type { FourCutSkinDefinition } from "./types";

const canvasCache = new Map<string, HTMLCanvasElement>();

function patternTile(theme: FourCutSkinDefinition): HTMLCanvasElement | null {
  if (!theme.pattern) return null;
  const frame: PhotoFrameDefinition = {
    id: theme.id,
    name: theme.name,
    kind: "pattern",
    inset: { top: 0, right: 0, bottom: 0, left: 0 },
    pattern: theme.pattern,
    patternColor: theme.patternColor,
    matteFill: theme.fill,
  };
  return getFramePatternCanvas(frame);
}

function fillBackground(
  ctx: CanvasRenderingContext2D,
  theme: FourCutSkinDefinition,
  width: number,
  height: number,
): void {
  const tile = patternTile(theme);
  if (tile) {
    const pattern = ctx.createPattern(tile, "repeat");
    if (pattern) {
      ctx.fillStyle = pattern;
      ctx.fillRect(0, 0, width, height);
      return;
    }
  }
  ctx.fillStyle = theme.fill;
  ctx.fillRect(0, 0, width, height);
}

function paintHeaderFooter(
  ctx: CanvasRenderingContext2D,
  theme: FourCutSkinDefinition,
  width: number,
  height: number,
  headerH: number,
  footerY: number,
  footerH: number,
): void {
  ctx.fillStyle = theme.headerFill;
  ctx.fillRect(0, 0, width, headerH);
  ctx.fillStyle = theme.footerFill;
  ctx.fillRect(0, footerY, width, footerH);

  ctx.strokeStyle = theme.ink;
  ctx.globalAlpha = theme.kind === "film" ? 0.45 : 0.28;
  ctx.lineWidth = Math.max(1, height * 0.004);
  ctx.beginPath();
  ctx.moveTo(width * 0.2, footerY + footerH * 0.48);
  ctx.lineTo(width * 0.8, footerY + footerH * 0.48);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (theme.kind === "film") return;

  ctx.fillStyle = theme.ink;
  ctx.globalAlpha = 0.4;
  const barH = Math.max(1, headerH * 0.07);
  ctx.fillRect(width * 0.22, headerH * 0.42, width * 0.56, barH);
  ctx.globalAlpha = 1;
}

function paintSprockets(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  headerH: number,
  footerY: number,
  side: number,
): void {
  const holeW = Math.max(2, side * 0.42);
  const holeH = holeW * 0.68;
  const gap = holeH * 0.7;
  const leftX = (side - holeW) / 2;
  const rightX = width - side + (side - holeW) / 2;
  ctx.fillStyle = "#cfc9bc";
  const startY = headerH + holeH * 0.15;
  const endY = footerY - holeH * 0.15;
  for (let y = startY; y + holeH <= endY + 0.5; y += holeH + gap) {
    ctx.fillRect(leftX, y, holeW, holeH);
    ctx.fillRect(rightX, y, holeW, holeH);
  }
}

function paintPaperTexture(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  ink: string,
): void {
  ctx.save();
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1;
  for (let i = 0; i < 7; i++) {
    const y = height * (0.18 + i * 0.1);
    ctx.beginPath();
    ctx.moveTo(width * 0.08, y);
    ctx.bezierCurveTo(width * 0.35, y + 3, width * 0.65, y - 3, width * 0.92, y);
    ctx.stroke();
  }
  ctx.restore();
}

export function paintFourCutTheme(
  ctx: CanvasRenderingContext2D,
  theme: FourCutSkinDefinition,
  width: number,
  height: number,
): void {
  const bands = fourCutChromeBands(theme.layout);
  const headerH = bands.header * height;
  const footerH = bands.footer * height;
  const footerY = height - footerH;
  const side = bands.side * width;

  fillBackground(ctx, theme, width, height);
  if (theme.kind === "paper") {
    paintPaperTexture(ctx, width, height, theme.ink);
  }
  paintHeaderFooter(ctx, theme, width, height, headerH, footerY, footerH);
  if (theme.kind === "film") {
    paintSprockets(ctx, width, height, headerH, footerY, side);
  }
}

export function fourCutHoleStrokeStyle(
  theme: FourCutSkinDefinition,
  minEdge: number,
): { color: string; width: number; alpha: number } {
  return {
    color: theme.kind === "film" ? "#111111" : theme.ink,
    width: Math.max(1, minEdge * 0.008),
    alpha: theme.kind === "film" ? 0.2 : 0.32,
  };
}

/** Browser-only chrome canvas (no photo holes). Cached by theme + integer size. */
export function getFourCutThemeCanvas(
  theme: FourCutSkinDefinition,
  width: number,
  height: number,
): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const w = Math.max(1, Math.round(width));
  const h = Math.max(1, Math.round(height));
  const key = `${theme.id}:${w}x${h}`;
  const cached = canvasCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  paintFourCutTheme(ctx, theme, w, h);
  canvasCache.set(key, canvas);
  return canvas;
}

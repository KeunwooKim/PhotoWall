import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoDeco } from "./catalog";
import type { PhotoDecoDefinition } from "./types";

export interface PhotoOuterBox {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
}

/** How far ribbons/charms hang outside the photo, as a fraction of min side. */
export const PHOTO_DECO_HANG = 0.14;

const EMPTY: PhotoOuterBox = { offsetX: 0, offsetY: 0, width: 0, height: 0 };

export function getPhotoDecoOuterSize(photo: WallScenePhoto): PhotoOuterBox {
  if (!getPhotoDeco(photo.decoId)) {
    return { offsetX: 0, offsetY: 0, width: photo.width, height: photo.height };
  }
  const hang = Math.min(photo.width, photo.height) * PHOTO_DECO_HANG;
  return {
    offsetX: -hang,
    offsetY: -hang,
    width: photo.width + hang * 2,
    height: photo.height + hang * 2,
  };
}

export function emptyPhotoOuter(): PhotoOuterBox {
  return EMPTY;
}

interface ThemeColors {
  ribbon: string;
  ribbon2: string;
  heart: string;
  star: string;
  pearl: string;
  charm: string;
}

const THEMES: Record<PhotoDecoDefinition["theme"], ThemeColors> = {
  blue: {
    ribbon: "#7fd4e8",
    ribbon2: "#3aa0c8",
    heart: "#9ad8ee",
    star: "#d9eef7",
    pearl: "#f4fbff",
    charm: "#c5d4de",
  },
  purple: {
    ribbon: "#d2b4f0",
    ribbon2: "#9b7ad4",
    heart: "#e4c4f7",
    star: "#f3e9ff",
    pearl: "#fbf7ff",
    charm: "#d0c4de",
  },
  pink: {
    ribbon: "#f5a0c0",
    ribbon2: "#ee6d9a",
    heart: "#ff7aa8",
    star: "#ffe3ee",
    pearl: "#fff7fb",
    charm: "#f0c8d4",
  },
};

function wavePoints(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  amp: number,
  waves: number,
  phase: number,
): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  const n = 18;
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const w = Math.sin(t * waves * Math.PI * 2 + phase) * amp;
    pts.push({ x: x0 + dx * t + nx * w, y: y0 + dy * t + ny * w });
  }
  return pts;
}

function strokeRibbon(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  width: number,
  color: string,
  alpha: number,
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  ctx.restore();
}

function fillHeart(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, 6);
  ctx.bezierCurveTo(-14, -6, -10, -16, 0, -10);
  ctx.bezierCurveTo(10, -16, 14, -6, 0, 6);
  ctx.fill();
  ctx.restore();
}

function fillStar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string, rot: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = (i * Math.PI) / 5 - Math.PI / 2;
    const r = i % 2 === 0 ? size / 2 : size / 5;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function fillPearl(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

const decoCanvasCache = new Map<string, HTMLCanvasElement>();

/** Photo-local canvas covering the deco hang box. Browser-only. */
export function getPhotoDecoCanvas(photo: WallScenePhoto): HTMLCanvasElement | null {
  if (typeof document === "undefined") return null;
  const deco = getPhotoDeco(photo.decoId);
  if (!deco) return null;
  const outer = getPhotoDecoOuterSize(photo);
  const key = `${deco.id}:${Math.round(photo.width)}x${Math.round(photo.height)}`;
  const cached = decoCanvasCache.get(key);
  if (cached) return cached;

  const maxEdge = 640;
  const scale = Math.min(1, maxEdge / Math.max(outer.width, outer.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(32, Math.round(outer.width * scale));
  canvas.height = Math.max(32, Math.round(outer.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.scale(scale, scale);
  ctx.translate(-outer.offsetX, -outer.offsetY);

  const w = photo.width;
  const h = photo.height;
  const hang = Math.min(w, h) * PHOTO_DECO_HANG;
  const colors = THEMES[deco.theme];
  const ribbonW = hang * 0.72;

  strokeRibbon(ctx, wavePoints(-hang * 0.2, -hang * 0.15, w + hang * 0.2, -hang * 0.1, hang * 0.28, 2.2, 0.2), ribbonW, colors.ribbon, 0.82);
  strokeRibbon(ctx, wavePoints(-hang * 0.15, h + hang * 0.12, w + hang * 0.2, h + hang * 0.08, hang * 0.26, 2.4, 1.1), ribbonW * 0.9, colors.ribbon2, 0.78);
  strokeRibbon(ctx, wavePoints(-hang * 0.12, -hang * 0.05, -hang * 0.08, h + hang * 0.1, hang * 0.22, 2.6, 0.6), ribbonW * 0.85, colors.ribbon, 0.75);
  strokeRibbon(ctx, wavePoints(w + hang * 0.1, -hang * 0.08, w + hang * 0.12, h + hang * 0.12, hang * 0.24, 2.5, 1.7), ribbonW * 0.85, colors.ribbon2, 0.75);

  const heart = hang * 1.15;
  fillHeart(ctx, -hang * 0.05, -hang * 0.02, heart, colors.heart, -0.4);
  fillHeart(ctx, w + hang * 0.02, h + hang * 0.02, heart * 1.1, colors.heart, 0.35);
  fillHeart(ctx, -hang * 0.02, h + hang * 0.04, heart * 0.85, colors.ribbon2, -0.2);
  fillHeart(ctx, w * 0.72, -hang * 0.08, heart * 0.7, colors.heart, 0.5);

  const star = hang * 0.7;
  fillStar(ctx, w * 0.22, -hang * 0.04, star, colors.star, 0.2);
  fillStar(ctx, w * 0.88, h * 0.18, star * 0.85, colors.star, 0.5);
  fillStar(ctx, w * 0.08, h * 0.55, star * 0.7, colors.pearl, 0.1);
  fillStar(ctx, w * 0.55, h + hang * 0.06, star * 0.8, colors.star, -0.3);

  for (let i = 0; i < 10; i++) {
    const t = (i + 0.4) / 10;
    fillPearl(ctx, w * t, -hang * 0.02 + Math.sin(i * 1.7) * hang * 0.12, hang * 0.12, colors.pearl);
    fillPearl(ctx, w * (1 - t), h + hang * 0.04 + Math.cos(i) * hang * 0.1, hang * 0.1, colors.pearl);
  }

  const charmX = [w * 0.18, w * 0.42, w * 0.64];
  for (const x of charmX) {
    ctx.strokeStyle = colors.charm;
    ctx.lineWidth = Math.max(1.2, hang * 0.08);
    ctx.beginPath();
    ctx.moveTo(x, -hang * 0.05);
    ctx.lineTo(x, hang * 0.55);
    ctx.stroke();
    fillHeart(ctx, x, hang * 0.7, hang * 0.55, colors.charm, 0);
    fillStar(ctx, x, hang * 1.15, hang * 0.42, colors.star, 0.2);
  }

  decoCanvasCache.set(key, canvas);
  if (decoCanvasCache.size > 24) {
    const first = decoCanvasCache.keys().next().value;
    if (first) decoCanvasCache.delete(first);
  }
  return canvas;
}

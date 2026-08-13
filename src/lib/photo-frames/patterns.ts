import type { PhotoFrameDefinition, PhotoFramePatternId } from "./types";

const TILE = 128;
const canvasCache = new Map<string, HTMLCanvasElement>();

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function paintGingham(ctx: CanvasRenderingContext2D, size: number, a: string, b: string): void {
  ctx.fillStyle = "#fffaf4";
  ctx.fillRect(0, 0, size, size);
  const step = size / 8;
  ctx.fillStyle = a;
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 8; i += 2) {
    ctx.fillRect(i * step, 0, step, size);
    ctx.fillRect(0, i * step, size, step);
  }
  ctx.globalAlpha = 0.28;
  ctx.fillStyle = b;
  for (let i = 1; i < 8; i += 2) {
    ctx.fillRect(i * step, 0, step, size);
    ctx.fillRect(0, i * step, size, step);
  }
  ctx.globalAlpha = 1;
}

function paintDots(ctx: CanvasRenderingContext2D, size: number, color: string): void {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, size, size);
  const colors = [color, "#f5c6d0", "#7eb8e8", "#f2d36b", "#c5a3e0"];
  const r = size / 16;
  let i = 0;
  for (let y = r * 1.4; y < size; y += r * 3.2) {
    for (let x = r * 1.4; x < size; x += r * 3.2) {
      ctx.beginPath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.arc(x + ((i % 2) * r) / 2, y, r * 0.85, 0, Math.PI * 2);
      ctx.fill();
      i++;
    }
  }
}

function paintStripes(ctx: CanvasRenderingContext2D, size: number, a: string, b: string): void {
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = a;
  ctx.lineWidth = size / 10;
  for (let x = -size; x < size * 2; x += size / 5) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + size, size);
    ctx.stroke();
  }
}

function paintCow(ctx: CanvasRenderingContext2D, size: number, ink: string, paper: string, rng: () => number): void {
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = ink;
  for (let i = 0; i < 9; i++) {
    const w = size * (0.18 + rng() * 0.28);
    const h = size * (0.14 + rng() * 0.24);
    const x = rng() * size;
    const y = rng() * size;
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, rng() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintLeopard(ctx: CanvasRenderingContext2D, size: number, spot: string, paper: string, rng: () => number): void {
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 18; i++) {
    const x = rng() * size;
    const y = rng() * size;
    const rx = size * (0.06 + rng() * 0.08);
    const ry = rx * (0.7 + rng() * 0.5);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rng() * Math.PI);
    ctx.strokeStyle = spot;
    ctx.lineWidth = Math.max(2, rx * 0.28);
    ctx.beginPath();
    ctx.ellipse(0, 0, rx, ry, 0, 0.4, Math.PI * 1.7);
    ctx.stroke();
    ctx.fillStyle = `${spot}55`;
    ctx.beginPath();
    ctx.ellipse(0, 0, rx * 0.45, ry * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function paintZebra(ctx: CanvasRenderingContext2D, size: number, ink: string, paper: string): void {
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = ink;
  ctx.lineWidth = size / 11;
  ctx.lineCap = "round";
  for (let i = -2; i < 12; i++) {
    const y = (i * size) / 7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(size * 0.3, y + size * 0.08, size * 0.7, y - size * 0.08, size, y + size * 0.04);
    ctx.stroke();
  }
}

function paintTiger(ctx: CanvasRenderingContext2D, size: number, ink: string, paper: string): void {
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = ink;
  ctx.lineWidth = size / 14;
  ctx.lineCap = "round";
  for (let i = 0; i < 8; i++) {
    const x = (i + 0.3) * (size / 7);
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.quadraticCurveTo(x + size * 0.08, size * 0.5, x - size * 0.04, size);
    ctx.stroke();
  }
}

function paintSpeckle(ctx: CanvasRenderingContext2D, size: number, color: string, rng: () => number): void {
  ctx.fillStyle = "#fffdf8";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 220; i++) {
    ctx.fillStyle = i % 5 === 0 ? "#1a1a1a" : color;
    ctx.globalAlpha = 0.35 + rng() * 0.55;
    const s = 0.8 + rng() * 2.4;
    ctx.fillRect(rng() * size, rng() * size, s, s * (0.6 + rng()));
  }
  ctx.globalAlpha = 1;
}

function paintRainbow(ctx: CanvasRenderingContext2D, size: number): void {
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, "#f7a1b8");
  g.addColorStop(0.2, "#f7d48a");
  g.addColorStop(0.4, "#b8e986");
  g.addColorStop(0.6, "#8fd4f2");
  g.addColorStop(0.8, "#b7a6f0");
  g.addColorStop(1, "#f3a0d4");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

function paintPattern(
  ctx: CanvasRenderingContext2D,
  pattern: PhotoFramePatternId,
  colors: [string, string],
  seed: number,
): void {
  const rng = mulberry32(seed);
  switch (pattern) {
    case "gingham":
      paintGingham(ctx, TILE, colors[0], colors[1]);
      break;
    case "dots":
      paintDots(ctx, TILE, colors[0]);
      break;
    case "stripes":
      paintStripes(ctx, TILE, colors[0], colors[1]);
      break;
    case "cow":
      paintCow(ctx, TILE, colors[0], colors[1], rng);
      break;
    case "leopard":
      paintLeopard(ctx, TILE, colors[0], colors[1], rng);
      break;
    case "zebra":
      paintZebra(ctx, TILE, colors[0], colors[1]);
      break;
    case "tiger":
      paintTiger(ctx, TILE, colors[0], colors[1]);
      break;
    case "speckle":
      paintSpeckle(ctx, TILE, colors[0], rng);
      break;
    case "rainbow":
      paintRainbow(ctx, TILE);
      break;
  }
}

/** Repeating tile for pattern frames. Browser-only. */
export function getFramePatternCanvas(frame: PhotoFrameDefinition): HTMLCanvasElement | null {
  if (typeof document === "undefined" || !frame.pattern) return null;
  const key = `${frame.id}:${frame.pattern}:${frame.patternColor ?? ""}:${frame.matteFill ?? ""}`;
  const cached = canvasCache.get(key);
  if (cached) return cached;
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const a = frame.patternColor ?? "#333333";
  const b = frame.matteFill ?? "#fff8f0";
  paintPattern(ctx, frame.pattern, [a, b], hashSeed(frame.id));
  canvasCache.set(key, canvas);
  return canvas;
}

export function patternSwatchCss(frame: PhotoFrameDefinition): string {
  const a = frame.patternColor ?? "#888";
  const b = frame.matteFill ?? "#fff";
  switch (frame.pattern) {
    case "gingham":
      return `repeating-linear-gradient(0deg, ${a}55 0 6px, ${b} 6px 12px), repeating-linear-gradient(90deg, ${a}55 0 6px, ${b} 6px 12px)`;
    case "dots":
      return `radial-gradient(${a} 1.4px, transparent 1.6px) 0 0 / 8px 8px, ${b}`;
    case "stripes":
      return `repeating-linear-gradient(45deg, ${a} 0 5px, ${b} 5px 10px)`;
    case "zebra":
      return `repeating-linear-gradient(-12deg, ${a} 0 4px, ${b} 4px 9px)`;
    case "tiger":
      return `repeating-linear-gradient(96deg, ${a} 0 4px, ${b} 4px 12px)`;
    case "rainbow":
      return "linear-gradient(135deg, #f7a1b8, #f7d48a, #b8e986, #8fd4f2, #b7a6f0)";
    case "speckle":
      return `radial-gradient(${a} 0.8px, transparent 1px) 0 0 / 5px 5px, ${b}`;
    case "cow":
    case "leopard":
      return `radial-gradient(circle at 30% 40%, ${a} 0 18%, transparent 19%), radial-gradient(circle at 70% 65%, ${a} 0 14%, transparent 15%), ${b}`;
    default:
      return b;
  }
}

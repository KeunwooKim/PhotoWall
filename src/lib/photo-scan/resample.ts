/**
 * Canvas-based upscale using browser high-quality image smoothing
 * (typically bicubic / high-quality filter depending on engine).
 */

export type ResampleOptions = {
  /** Upscale factor (e.g. 1.5 or 2). Default 1.5 */
  scale?: number;
  /** Cap longest side after upscale. Default 2400 */
  maxSide?: number;
};

/**
 * Resample canvas to a larger size. Returns the same canvas when scale ≈ 1
 * or when already at/above maxSide.
 */
export function resampleCanvas(
  canvas: HTMLCanvasElement,
  options: ResampleOptions = {},
): HTMLCanvasElement {
  const scale = options.scale ?? 1.5;
  const maxSide = options.maxSide ?? 2400;
  if (scale <= 1.01) return canvas;

  const srcW = canvas.width;
  const srcH = canvas.height;
  const longest = Math.max(srcW, srcH);
  if (longest <= 0) return canvas;

  // Don't grow past maxSide; also skip if already large enough
  const targetLongest = Math.min(maxSide, Math.round(longest * scale));
  if (targetLongest <= longest + 1) return canvas;

  const factor = targetLongest / longest;
  const outW = Math.max(1, Math.round(srcW * factor));
  const outH = Math.max(1, Math.round(srcH * factor));

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const ctx = out.getContext("2d");
  if (!ctx) return canvas;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(canvas, 0, 0, outW, outH);
  return out;
}

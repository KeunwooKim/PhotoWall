import { maxDisplayTextureEdge } from "@/lib/pixi-device";
import { loadOptimizedHtmlImage } from "@/lib/storage/load-html-image";

/**
 * Decode an image URL into a canvas sized for display (LOD).
 * Keeps GPU texture memory bounded on iOS Safari.
 */
export async function loadDisplayBitmap(
  src: string,
  maxEdge: number = maxDisplayTextureEdge(),
): Promise<{
  canvas: HTMLCanvasElement;
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
}> {
  const img = await loadOptimizedHtmlImage(src);

  const naturalWidth = img.naturalWidth || img.width;
  const naturalHeight = img.naturalHeight || img.height;
  const longest = Math.max(naturalWidth, naturalHeight, 1);
  const scale = Math.min(1, maxEdge / longest);
  const displayWidth = Math.max(1, Math.round(naturalWidth * scale));
  const displayHeight = Math.max(1, Math.round(naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = displayWidth;
  canvas.height = displayHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2d context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

  return { canvas, naturalWidth, naturalHeight, displayWidth, displayHeight };
}

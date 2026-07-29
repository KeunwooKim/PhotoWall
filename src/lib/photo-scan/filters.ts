import type { ScanEnhanceMode } from "./types";

/** Gray-world white balance — removes warm indoor cast. */
export function applyGrayWorldWhiteBalance(imageData: ImageData): void {
  const { data } = imageData;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let count = 0;

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    sumR += data[i];
    sumG += data[i + 1];
    sumB += data[i + 2];
    count++;
  }
  if (count === 0) return;

  const avgR = sumR / count;
  const avgG = sumG / count;
  const avgB = sumB / count;
  const gray = (avgR + avgG + avgB) / 3;
  const scaleR = gray / Math.max(avgR, 1e-3);
  const scaleG = gray / Math.max(avgG, 1e-3);
  const scaleB = gray / Math.max(avgB, 1e-3);

  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    data[i] = Math.min(255, data[i] * scaleR);
    data[i + 1] = Math.min(255, data[i + 1] * scaleG);
    data[i + 2] = Math.min(255, data[i + 2] * scaleB);
  }
}

/** Mild contrast stretch after white balance (keeps photo content). */
export function applyContrastBoost(imageData: ImageData, amount = 1.12): void {
  const { data } = imageData;
  const mid = 128;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    data[i] = Math.min(255, Math.max(0, (data[i] - mid) * amount + mid));
    data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - mid) * amount + mid));
    data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - mid) * amount + mid));
  }
}

/**
 * Adaptive threshold on luminance — document/scanner look.
 * Blends toward binary so photo prints don't fully destroy color.
 */
export function applySoftAdaptiveThreshold(imageData: ImageData, blend = 0.35): void {
  const { data, width, height } = imageData;
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  const block = Math.max(8, Math.floor(Math.min(width, height) / 16) | 1);
  const half = Math.floor(block / 2);
  const C = 8;

  // Integral image for fast local mean
  const integral = new Float32Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowSum = 0;
    for (let x = 1; x <= width; x++) {
      rowSum += gray[(y - 1) * width + (x - 1)];
      integral[y * (width + 1) + x] = integral[(y - 1) * (width + 1) + x] + rowSum;
    }
  }

  const rectSum = (x0: number, y0: number, x1: number, y1: number) => {
    const A = integral[y0 * (width + 1) + x0];
    const B = integral[y0 * (width + 1) + x1];
    const C_ = integral[y1 * (width + 1) + x0];
    const D = integral[y1 * (width + 1) + x1];
    return D - B - C_ + A;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const y0 = Math.max(0, y - half);
      const x1 = Math.min(width, x + half + 1);
      const y1 = Math.min(height, y + half + 1);
      const area = (x1 - x0) * (y1 - y0);
      const mean = rectSum(x0, y0, x1, y1) / Math.max(area, 1);
      const p = y * width + x;
      const v = gray[p] > mean - C ? 255 : Math.max(0, gray[p] * 0.85);
      const i = p * 4;
      data[i] = data[i] * (1 - blend) + v * blend;
      data[i + 1] = data[i + 1] * (1 - blend) + v * blend;
      data[i + 2] = data[i + 2] * (1 - blend) + v * blend;
    }
  }
}

/** Apply post-warp scan enhancement in place on a canvas. */
export function enhanceScannedCanvas(
  canvas: HTMLCanvasElement,
  mode: ScanEnhanceMode = "photo",
): void {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return;
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyGrayWorldWhiteBalance(imageData);
  applyContrastBoost(imageData, mode === "scanner" ? 1.18 : 1.1);
  if (mode === "scanner") {
    applySoftAdaptiveThreshold(imageData, 0.45);
  }
  ctx.putImageData(imageData, 0, 0);
}

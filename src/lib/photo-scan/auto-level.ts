/**
 * Lightweight post-warp deskew via projection-profile variance.
 * No OpenCV — works on a downscaled grayscale edge map.
 */

const ANALYZE_MAX = 320;
const ANGLE_MIN = -6;
const ANGLE_MAX = 6;
const ANGLE_STEP = 0.5;

function toGrayEdges(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): Float32Array {
  const gray = new Float32Array(width * height);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 8) {
      gray[p] = 0;
      continue;
    }
    gray[p] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // Sobel magnitude (skip border)
  const edges = new Float32Array(width * height);
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x;
      const gx =
        -gray[i - width - 1] +
        gray[i - width + 1] -
        2 * gray[i - 1] +
        2 * gray[i + 1] -
        gray[i + width - 1] +
        gray[i + width + 1];
      const gy =
        -gray[i - width - 1] -
        2 * gray[i - width] -
        gray[i - width + 1] +
        gray[i + width - 1] +
        2 * gray[i + width] +
        gray[i + width + 1];
      edges[i] = Math.hypot(gx, gy);
    }
  }
  return edges;
}

/** Score: variance of horizontal projection after shearing by angle (degrees). */
function projectionVariance(edges: Float32Array, width: number, height: number, angleDeg: number): number {
  const rad = (angleDeg * Math.PI) / 180;
  const tan = Math.tan(rad);
  const proj = new Float32Array(height);
  const counts = new Float32Array(height);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const v = edges[y * width + x];
      if (v < 12) continue;
      const yy = y - tan * (x - width / 2);
      const yi = Math.round(yy);
      if (yi < 0 || yi >= height) continue;
      proj[yi] += v;
      counts[yi] += 1;
    }
  }

  let sum = 0;
  let n = 0;
  for (let i = 0; i < height; i++) {
    if (counts[i] < 1) continue;
    sum += proj[i];
    n++;
  }
  if (n < 8) return 0;
  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < height; i++) {
    if (counts[i] < 1) continue;
    const d = proj[i] - mean;
    varSum += d * d;
  }
  return varSum / n;
}

/**
 * Estimate residual skew in degrees after perspective warp.
 * Returns 0 when signal is weak or already level.
 */
export function estimateSkewDegrees(canvas: HTMLCanvasElement): number {
  const scale = Math.min(1, ANALYZE_MAX / Math.max(canvas.width, canvas.height));
  const w = Math.max(32, Math.round(canvas.width * scale));
  const h = Math.max(32, Math.round(canvas.height * scale));

  const tmp = document.createElement("canvas");
  tmp.width = w;
  tmp.height = h;
  const ctx = tmp.getContext("2d", { willReadFrequently: true });
  if (!ctx) return 0;
  ctx.drawImage(canvas, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const edges = toGrayEdges(data, w, h);

  let bestAngle = 0;
  let bestScore = -Infinity;
  for (let a = ANGLE_MIN; a <= ANGLE_MAX + 1e-6; a += ANGLE_STEP) {
    const score = projectionVariance(edges, w, h, a);
    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
    }
  }

  // Ignore tiny corrections / flat scores
  if (Math.abs(bestAngle) < 0.35) return 0;
  return bestAngle;
}

/** Rotate canvas by degrees (CCW positive) and center-crop to original size. */
export function rotateAndCropCanvas(
  canvas: HTMLCanvasElement,
  angleDeg: number,
): HTMLCanvasElement {
  if (Math.abs(angleDeg) < 1e-3) return canvas;

  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const w = canvas.width;
  const h = canvas.height;
  const absCos = Math.abs(cos);
  const absSin = Math.abs(sin);
  const nw = Math.ceil(w * absCos + h * absSin);
  const nh = Math.ceil(w * absSin + h * absCos);

  const rotated = document.createElement("canvas");
  rotated.width = nw;
  rotated.height = nh;
  const ctx = rotated.getContext("2d");
  if (!ctx) return canvas;

  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, nw, nh);
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(rad);
  ctx.drawImage(canvas, -w / 2, -h / 2);

  // Center-crop back to original dimensions — safe for small deskew angles
  // and avoids eating dark photo content with alpha/black heuristics.
  const cropped = document.createElement("canvas");
  cropped.width = w;
  cropped.height = h;
  const cctx = cropped.getContext("2d");
  if (!cctx) return rotated;
  const sx = Math.max(0, Math.round((nw - w) / 2));
  const sy = Math.max(0, Math.round((nh - h) / 2));
  cctx.drawImage(rotated, sx, sy, w, h, 0, 0, w, h);
  return cropped;
}

export type AutoLevelResult = {
  canvas: HTMLCanvasElement;
  angleDegrees: number;
};

/** Detect residual skew and straighten. No-op when already level. */
export function autoLevelCanvas(canvas: HTMLCanvasElement): AutoLevelResult {
  const angleDegrees = estimateSkewDegrees(canvas);
  if (Math.abs(angleDegrees) < 0.35) {
    return { canvas, angleDegrees: 0 };
  }
  // Negate: if projection wants +θ shear, rotate opposite to level
  const leveled = rotateAndCropCanvas(canvas, -angleDegrees);
  return { canvas: leveled, angleDegrees };
}

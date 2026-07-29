import type { Point2, QuadPoints } from "./types";

/** Solve Ax = b for square A via Gaussian elimination with partial pivoting. */
function solveLinearSystem(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);

  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];

    const div = m[col][col];
    for (let j = col; j <= n; j++) m[col][j] /= div;

    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = m[row][col];
      for (let j = col; j <= n; j++) m[row][j] -= factor * m[col][j];
    }
  }

  return m.map((row) => row[n]);
}

/**
 * Homography H (3×3 row-major) mapping src → dst.
 * H is applied as [x' y' w']^T = H [x y 1]^T, then x'/=w', y'/=w'.
 */
export function computeHomography(src: QuadPoints, dst: QuadPoints): number[] | null {
  const a: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    a.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    a.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }

  const h = solveLinearSystem(a, b);
  if (!h) return null;
  return [...h, 1];
}

function invertHomography(h: number[]): number[] | null {
  const [a, b, c, d, e, f, g, i, j] = h;
  const det =
    a * (e * j - f * i) - b * (d * j - f * g) + c * (d * i - e * g);
  if (Math.abs(det) < 1e-12) return null;
  const invDet = 1 / det;
  return [
    (e * j - f * i) * invDet,
    (c * i - b * j) * invDet,
    (b * f - c * e) * invDet,
    (f * g - d * j) * invDet,
    (a * j - c * g) * invDet,
    (c * d - a * f) * invDet,
    (d * i - e * g) * invDet,
    (b * g - a * i) * invDet,
    (a * e - b * d) * invDet,
  ];
}

function applyHomography(h: number[], x: number, y: number): Point2 {
  const w = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / w,
    y: (h[3] * x + h[4] * y + h[5]) / w,
  };
}

function sampleBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  x: number,
  y: number,
): [number, number, number, number] {
  if (x < 0 || y < 0 || x >= width - 1 || y >= height - 1) {
    return [0, 0, 0, 0];
  }
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = x0 + 1;
  const y1 = y0 + 1;
  const fx = x - x0;
  const fy = y - y0;

  const i00 = (y0 * width + x0) * 4;
  const i10 = (y0 * width + x1) * 4;
  const i01 = (y1 * width + x0) * 4;
  const i11 = (y1 * width + x1) * 4;

  const out: [number, number, number, number] = [0, 0, 0, 0];
  for (let c = 0; c < 4; c++) {
    const v00 = data[i00 + c];
    const v10 = data[i10 + c];
    const v01 = data[i01 + c];
    const v11 = data[i11 + c];
    out[c] =
      v00 * (1 - fx) * (1 - fy) +
      v10 * fx * (1 - fy) +
      v01 * (1 - fx) * fy +
      v11 * fx * fy;
  }
  return out;
}

function quadSideLengths(quad: QuadPoints): { top: number; right: number; bottom: number; left: number } {
  const dist = (a: Point2, b: Point2) => Math.hypot(a.x - b.x, a.y - b.y);
  return {
    top: dist(quad[0], quad[1]),
    right: dist(quad[1], quad[2]),
    bottom: dist(quad[3], quad[2]),
    left: dist(quad[0], quad[3]),
  };
}

/** Output size from average opposite sides, clamped. */
export function outputSizeFromQuad(quad: QuadPoints, maxSide = 2000): { width: number; height: number } {
  const { top, right, bottom, left } = quadSideLengths(quad);
  let width = Math.round((top + bottom) / 2);
  let height = Math.round((left + right) / 2);
  width = Math.max(32, width);
  height = Math.max(32, height);
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(32, Math.round(width * scale)),
    height: Math.max(32, Math.round(height * scale)),
  };
}

/**
 * Warp image so `quad` becomes a rectangle.
 * Returns a canvas with the flattened result.
 */
export function warpPerspective(
  source: HTMLCanvasElement | HTMLImageElement | ImageBitmap,
  quad: QuadPoints,
  maxSide = 2000,
): HTMLCanvasElement {
  const srcW =
    "naturalWidth" in source && source.naturalWidth
      ? source.naturalWidth
      : source.width;
  const srcH =
    "naturalHeight" in source && source.naturalHeight
      ? source.naturalHeight
      : source.height;

  const srcCanvas = document.createElement("canvas");
  srcCanvas.width = srcW;
  srcCanvas.height = srcH;
  const srcCtx = srcCanvas.getContext("2d", { willReadFrequently: true });
  if (!srcCtx) throw new Error("canvas unsupported");
  srcCtx.drawImage(source, 0, 0);
  const srcData = srcCtx.getImageData(0, 0, srcW, srcH).data;

  const { width: outW, height: outH } = outputSizeFromQuad(quad, maxSide);
  const dst: QuadPoints = [
    { x: 0, y: 0 },
    { x: outW - 1, y: 0 },
    { x: outW - 1, y: outH - 1 },
    { x: 0, y: outH - 1 },
  ];

  const hFwd = computeHomography(quad, dst);
  if (!hFwd) throw new Error("homography failed");
  const hInv = invertHomography(hFwd);
  if (!hInv) throw new Error("homography invert failed");

  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const outCtx = out.getContext("2d");
  if (!outCtx) throw new Error("canvas unsupported");
  const imageData = outCtx.createImageData(outW, outH);
  const dstData = imageData.data;

  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const src = applyHomography(hInv, x, y);
      const [r, g, b, a] = sampleBilinear(srcData, srcW, srcH, src.x, src.y);
      const i = (y * outW + x) * 4;
      dstData[i] = r;
      dstData[i + 1] = g;
      dstData[i + 2] = b;
      dstData[i + 3] = a < 8 ? 0 : 255;
    }
  }

  outCtx.putImageData(imageData, 0, 0);
  return out;
}

export function canvasToJpegDataUrl(canvas: HTMLCanvasElement, quality = 0.92): string {
  return canvas.toDataURL("image/jpeg", quality);
}

export function canvasToJpegFile(
  canvas: HTMLCanvasElement,
  quality = 0.82,
  name = `scan-${Date.now()}.jpg`,
): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("jpeg encode failed"));
          return;
        }
        resolve(new File([blob], name, { type: "image/jpeg" }));
      },
      "image/jpeg",
      quality,
    );
  });
}

/** Default inset quad covering most of the frame. */
export function defaultInsetQuad(width: number, height: number, inset = 0.08): QuadPoints {
  const ix = width * inset;
  const iy = height * inset;
  return [
    { x: ix, y: iy },
    { x: width - ix, y: iy },
    { x: width - ix, y: height - iy },
    { x: ix, y: height - iy },
  ];
}

export function orderQuadCorners(points: Point2[]): QuadPoints {
  if (points.length !== 4) {
    throw new Error("need 4 points");
  }
  const sorted = [...points].sort((a, b) => a.y - b.y || a.x - b.x);
  const top = sorted.slice(0, 2).sort((a, b) => a.x - b.x);
  const bottom = sorted.slice(2, 4).sort((a, b) => a.x - b.x);
  return [top[0], top[1], bottom[1], bottom[0]];
}

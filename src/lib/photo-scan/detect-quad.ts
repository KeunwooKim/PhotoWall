/* eslint-disable @typescript-eslint/no-explicit-any */

import { orderQuadCorners } from "./perspective";
import type { QuadPoints } from "./types";
import { loadOpenCv } from "./load-opencv";

export type DetectDebugInfo = {
  ms: number;
  readMethod: "imread" | "matFromImageData" | "failed";
  frameW: number;
  frameH: number;
  contourCount: number;
  candidateCount: number;
  edgeRatio: number;
  quadFound: boolean;
  error: string | null;
};

function contourArea(pts: { x: number; y: number }[]): number {
  let area = 0;
  for (let i = 0; i < pts.length; i++) {
    const j = (i + 1) % pts.length;
    area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
  }
  return Math.abs(area) / 2;
}

function readContourPoints(approx: {
  rows: number;
  intPtr: (row: number, col: number) => Int32Array | Float32Array;
}): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < approx.rows; i++) {
    const p = approx.intPtr(i, 0);
    pts.push({ x: p[0], y: p[1] });
  }
  return pts;
}

function readCanvasToMat(cv: any, canvas: HTMLCanvasElement): { mat: any; method: DetectDebugInfo["readMethod"] } {
  try {
    return { mat: cv.imread(canvas), method: "imread" };
  } catch {
    // iOS Safari often fails cv.imread on camera canvas — use ImageData path.
  }

  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas 2d unavailable");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return { mat: cv.matFromImageData(imageData), method: "matFromImageData" };
}

function countEdgePixels(edges: any): number {
  let count = 0;
  const data = edges.data;
  for (let i = 0; i < data.length; i++) {
    if (data[i] > 0) count++;
  }
  return count;
}

export type DetectRunResult = {
  quad: QuadPoints | null;
  debug: DetectDebugInfo;
};

/**
 * Detect the largest rectangular-ish document/photo quad in a canvas frame.
 */
export async function detectDocumentQuadWithDebug(
  canvas: HTMLCanvasElement,
  edgePreview?: HTMLCanvasElement | null,
): Promise<DetectRunResult> {
  const started = performance.now();
  const baseDebug: DetectDebugInfo = {
    ms: 0,
    readMethod: "failed",
    frameW: canvas.width,
    frameH: canvas.height,
    contourCount: 0,
    candidateCount: 0,
    edgeRatio: 0,
    quadFound: false,
    error: null,
  };

  try {
    const cv = await loadOpenCv();
    const { mat: src, method } = readCanvasToMat(cv, canvas);
    baseDebug.readMethod = method;

    const gray = new cv.Mat();
    const blur = new cv.Mat();
    const edges = new cv.Mat();
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
      cv.Canny(blur, edges, 50, 150);
      cv.dilate(edges, edges, kernel);

      if (edgePreview) {
        const previewCtx = edgePreview.getContext("2d");
        if (previewCtx) {
          edgePreview.width = 96;
          edgePreview.height = Math.round(96 * (canvas.height / Math.max(canvas.width, 1)));
          cv.imshow(edgePreview, edges);
        }
      }

      const edgePixels = countEdgePixels(edges);
      baseDebug.edgeRatio = edgePixels / Math.max(edges.rows * edges.cols, 1);

      cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
      baseDebug.contourCount = contours.size();

      const frameArea = canvas.width * canvas.height;
      let best: QuadPoints | null = null;
      let bestScore = 0;
      let candidates = 0;

      for (let i = 0; i < contours.size(); i++) {
        const contour = contours.get(i);
        const peri = cv.arcLength(contour, true);
        if (peri < 60) {
          contour.delete();
          continue;
        }

        for (const epsilonRatio of [0.02, 0.03, 0.04, 0.05]) {
          const approx = new cv.Mat();
          cv.approxPolyDP(contour, approx, epsilonRatio * peri, true);

          if (approx.rows === 4 && cv.isContourConvex(approx)) {
            const pts = readContourPoints(approx);
            const area = contourArea(pts);
            if (area > frameArea * 0.05 && area < frameArea * 0.95) {
              candidates++;
              const ordered = orderQuadCorners(pts);
              const sides = [
                Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y),
                Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y),
                Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y),
                Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y),
              ];
              const maxSide = Math.max(...sides);
              const minSide = Math.min(...sides);
              const score = area * (minSide / Math.max(maxSide, 1));
              if (score > bestScore) {
                bestScore = score;
                best = ordered;
              }
            }
          }
          approx.delete();
        }
        contour.delete();
      }

      baseDebug.candidateCount = candidates;
      baseDebug.quadFound = best != null;
      baseDebug.ms = Math.round(performance.now() - started);
      return { quad: best, debug: baseDebug };
    } finally {
      src.delete();
      gray.delete();
      blur.delete();
      edges.delete();
      contours.delete();
      hierarchy.delete();
      kernel.delete();
    }
  } catch (err) {
    baseDebug.error = err instanceof Error ? err.message : "detect failed";
    baseDebug.ms = Math.round(performance.now() - started);
    return { quad: null, debug: baseDebug };
  }
}

export async function detectDocumentQuad(canvas: HTMLCanvasElement): Promise<QuadPoints | null> {
  const { quad } = await detectDocumentQuadWithDebug(canvas);
  return quad;
}

/** How similar two quads are (0–1, higher = closer). */
export function quadSimilarity(a: QuadPoints, b: QuadPoints): number {
  const maxDim = Math.max(
    ...a.flatMap((p) => [p.x, p.y]),
    ...b.flatMap((p) => [p.x, p.y]),
    1,
  );
  let sum = 0;
  for (let i = 0; i < 4; i++) {
    sum += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
  }
  const avg = sum / 4;
  return Math.max(0, 1 - avg / (maxDim * 0.1));
}

export function drawQuadPath(
  ctx: CanvasRenderingContext2D,
  quad: QuadPoints,
  offsetX: number,
  offsetY: number,
  scale: number,
) {
  ctx.beginPath();
  ctx.moveTo(offsetX + quad[0].x * scale, offsetY + quad[0].y * scale);
  for (let i = 1; i < 4; i++) {
    ctx.lineTo(offsetX + quad[i].x * scale, offsetY + quad[i].y * scale);
  }
  ctx.closePath();
}

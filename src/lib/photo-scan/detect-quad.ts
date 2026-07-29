import { orderQuadCorners } from "./perspective";
import type { QuadPoints } from "./types";
import { loadOpenCv } from "./load-opencv";

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

/**
 * Detect the largest rectangular-ish document/photo quad in a canvas frame.
 * Returns null when nothing confident is found.
 */
export async function detectDocumentQuad(
  canvas: HTMLCanvasElement,
): Promise<QuadPoints | null> {
  const cv = await loadOpenCv();
  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(3, 3));

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 60, 180);
    cv.dilate(edges, edges, kernel);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const frameArea = canvas.width * canvas.height;
    let best: QuadPoints | null = null;
    let bestScore = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      if (peri < 80) {
        contour.delete();
        continue;
      }

      for (const epsilonRatio of [0.02, 0.03, 0.04]) {
        const approx = new cv.Mat();
        cv.approxPolyDP(contour, approx, epsilonRatio * peri, true);

        if (approx.rows === 4 && cv.isContourConvex(approx)) {
          const pts = readContourPoints(approx);
          const area = contourArea(pts);
          if (area > frameArea * 0.06 && area < frameArea * 0.92) {
            const ordered = orderQuadCorners(pts);
            const { top, right, bottom, left } = {
              top: Math.hypot(ordered[1].x - ordered[0].x, ordered[1].y - ordered[0].y),
              right: Math.hypot(ordered[2].x - ordered[1].x, ordered[2].y - ordered[1].y),
              bottom: Math.hypot(ordered[2].x - ordered[3].x, ordered[2].y - ordered[3].y),
              left: Math.hypot(ordered[3].x - ordered[0].x, ordered[3].y - ordered[0].y),
            };
            const maxSide = Math.max(top, right, bottom, left);
            const minSide = Math.min(top, right, bottom, left);
            const rectangularity = minSide / Math.max(maxSide, 1);
            const score = area * rectangularity;
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

    return best;
  } finally {
    src.delete();
    gray.delete();
    blur.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
    kernel.delete();
  }
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

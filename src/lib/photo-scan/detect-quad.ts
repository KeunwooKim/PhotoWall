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

  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 50, 150);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    const frameArea = canvas.width * canvas.height;
    let best: QuadPoints | null = null;
    let bestArea = 0;

    for (let i = 0; i < contours.size(); i++) {
      const contour = contours.get(i);
      const peri = cv.arcLength(contour, true);
      const approx = new cv.Mat();
      cv.approxPolyDP(contour, approx, 0.02 * peri, true);

      if (approx.rows === 4 && cv.isContourConvex(approx)) {
        const pts: { x: number; y: number }[] = [];
        for (let r = 0; r < 4; r++) {
          pts.push({
            x: approx.data32S[r * 2],
            y: approx.data32S[r * 2 + 1],
          });
        }
        const area = contourArea(pts);
        if (area > frameArea * 0.08 && area < frameArea * 0.95 && area > bestArea) {
          bestArea = area;
          best = orderQuadCorners(pts);
        }
      }
      approx.delete();
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
  return Math.max(0, 1 - avg / (maxDim * 0.08));
}

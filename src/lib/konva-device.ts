import type Konva from "konva";
import KonvaLib from "konva";

let configured = false;

export function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Longest canvas backing-store edge (after pixelRatio). */
const IOS_MAX_CANVAS_EDGE = 1024;
const DESKTOP_MAX_CANVAS_EDGE = 2048;

/**
 * Wall stage is already CSS-scaled to fit the viewport. Retina Konva buffers
 * multiply canvas memory and crash iOS Safari on /wall/edit.
 */
export function configureKonvaForWallEditor(): void {
  if (configured || typeof window === "undefined") return;
  configured = true;
  KonvaLib.pixelRatio = 1;
  if (isIosLikeDevice()) {
    KonvaLib.dragDistance = 5;
  }
}

/** Cap backing-store pixels while keeping stage coordinates = wall coordinates. */
export function canvasPixelRatioForWall(wallWidth: number, wallHeight: number): number {
  const maxEdge = isIosLikeDevice() ? IOS_MAX_CANVAS_EDGE : DESKTOP_MAX_CANVAS_EDGE;
  const longest = Math.max(wallWidth, wallHeight, 1);
  return Math.min(1, maxEdge / longest);
}

/**
 * Keep backing-store pixels under a device budget as the wall grows.
 * Prefer applying to the live Stage instance (avoids multi-Konva singleton issues).
 */
export function syncKonvaPixelRatioForWall(
  wallWidth: number,
  wallHeight: number,
  stage?: Konva.Stage | null,
): void {
  if (typeof window === "undefined") return;
  configureKonvaForWallEditor();

  const ratio = canvasPixelRatioForWall(wallWidth, wallHeight);
  KonvaLib.pixelRatio = ratio;

  const stages = stage ? [stage] : KonvaLib.stages;
  for (const s of stages) {
    for (const layer of s.getLayers()) {
      try {
        layer.getCanvas().setPixelRatio(ratio);
        layer.getHitCanvas().setPixelRatio(ratio);
        layer.batchDraw();
      } catch {
        // Layer may not be ready yet.
      }
    }
  }
}

/** Safe logical wall size — canvas memory is capped via canvasPixelRatioForWall. */
export function memorySafeWallMax(): { width: number; height: number } {
  return { width: 2400, height: 4000 };
}

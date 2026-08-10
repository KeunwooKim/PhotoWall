import type Konva from "konva";
import KonvaLib from "konva";
import { isIosLikeDevice } from "@/lib/wall-device";

export { isIosLikeDevice, memorySafeWallMax } from "@/lib/wall-device";

let configured = false;

/**
 * Longest canvas backing-store edge (after pixelRatio).
 * Higher = sharper photos; too high → iOS Safari Jetsam ("문제 반복").
 * Wall max is capped (~2217×1700), so a higher budget is safer than before.
 */
const IOS_MAX_CANVAS_EDGE = 2400;
const DESKTOP_MAX_CANVAS_EDGE = 4096;

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
  const ios = isIosLikeDevice();
  const maxEdge = ios ? IOS_MAX_CANVAS_EDGE : DESKTOP_MAX_CANVAS_EDGE;
  const longest = Math.max(wallWidth, wallHeight, 1);
  const budgetRatio = maxEdge / longest;
  // Prefer retina when the wall still fits the memory budget.
  // iOS soft-cap at 1.5 — full DPR×max-wall used to Jetsam Safari.
  const dprCap = ios
    ? Math.min(1.5, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1)
    : Math.min(2, typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);
  return Math.min(dprCap, budgetRatio);
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


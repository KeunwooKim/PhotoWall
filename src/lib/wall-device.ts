import { WALL_MAX_HEIGHT, WALL_MAX_WIDTH } from "@/lib/wall-bounds";

/** Pixi logical wall ceiling (viewport-sized GPU buffer; not wall-sized Canvas2D). */
export const PIXI_WALL_MAX_WIDTH = 8000;
export const PIXI_WALL_MAX_HEIGHT = 8000;

export function isIosLikeDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) return true;
  return false;
}

/** Safe logical wall size — canvas memory is capped via renderer-specific LOD. */
export function memorySafeWallMax(): { width: number; height: number } {
  const renderer = (process.env.NEXT_PUBLIC_WALL_RENDERER ?? "pixi").trim().toLowerCase();
  if (renderer !== "konva") {
    return { width: PIXI_WALL_MAX_WIDTH, height: PIXI_WALL_MAX_HEIGHT };
  }
  return { width: WALL_MAX_WIDTH, height: WALL_MAX_HEIGHT };
}

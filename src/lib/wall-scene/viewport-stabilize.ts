import type { WallBounds } from "@/lib/wall-bounds";

type WallLayoutMeta = {
  wallBounds: WallBounds;
  wallpaperOffset?: { x: number; y: number };
};

/**
 * Pan delta that keeps on-screen world points locked when the wall AABB
 * changes under a center-anchored stage.
 */
export function panDeltaForWallLayoutChange(
  prev: WallLayoutMeta,
  next: WallLayoutMeta,
  viewportScale: number,
): { dx: number; dy: number } {
  const prevCx = prev.wallBounds.x + prev.wallBounds.width / 2;
  const prevCy = prev.wallBounds.y + prev.wallBounds.height / 2;
  const nextCx = next.wallBounds.x + next.wallBounds.width / 2;
  const nextCy = next.wallBounds.y + next.wallBounds.height / 2;
  const dx = (nextCx - prevCx) * viewportScale;
  const dy = (nextCy - prevCy) * viewportScale;
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) {
    return { dx: 0, dy: 0 };
  }
  return { dx, dy };
}

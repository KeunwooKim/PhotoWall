import type { WallBounds } from "@/lib/wall-bounds";

type WallLayoutMeta = {
  wallBounds: WallBounds;
  wallpaperOffset?: { x: number; y: number };
};

/**
 * Pan delta that keeps the on-screen view locked when wall size / content shift
 * changes under a center-anchored stage (same math as local omni-expand).
 */
export function panDeltaForWallLayoutChange(
  prev: WallLayoutMeta,
  next: WallLayoutMeta,
  viewportScale: number,
): { dx: number; dy: number } {
  const prevWp = prev.wallpaperOffset ?? { x: 0, y: 0 };
  const nextWp = next.wallpaperOffset ?? { x: 0, y: 0 };
  const shiftX = nextWp.x - prevWp.x;
  const shiftY = nextWp.y - prevWp.y;
  const dW = next.wallBounds.width - prev.wallBounds.width;
  const dH = next.wallBounds.height - prev.wallBounds.height;

  if (dW === 0 && dH === 0 && shiftX === 0 && shiftY === 0) {
    return { dx: 0, dy: 0 };
  }

  return {
    dx: (dW / 2 - shiftX) * viewportScale,
    dy: (dH / 2 - shiftY) * viewportScale,
  };
}

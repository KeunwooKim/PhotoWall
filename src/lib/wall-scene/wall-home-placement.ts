import { DEFAULT_WALL_BOUNDS } from "@/lib/wall-bounds";
import { useWallSceneStore } from "@/stores/wall-scene-store";

type Point = { x: number; y: number };

/**
 * Live viewport → wall-world center. Stages register this so new assets land
 * where the user is looking (screen center), not a fixed home corner.
 */
let viewportWorldCenterGetter: (() => Point | null) | null = null;

export function setViewportWorldCenterGetter(getter: (() => Point | null) | null): void {
  viewportWorldCenterGetter = getter;
}

/**
 * Top-left of the stable default-size home frame in world coordinates.
 * Fixed at DEFAULT_WALL_BOUNDS origin under center-origin model.
 */
export function getWallHomeOrigin(): { x: number; y: number } {
  return { x: DEFAULT_WALL_BOUNDS.x, y: DEFAULT_WALL_BOUNDS.y };
}

/**
 * Placement area for new objects: the original default wall rectangle
 * centered on world origin.
 */
export function getWallHomePlacementBounds(wallWidth: number, wallHeight: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  void wallWidth;
  void wallHeight;
  return {
    x: DEFAULT_WALL_BOUNDS.x,
    y: DEFAULT_WALL_BOUNDS.y,
    width: DEFAULT_WALL_BOUNDS.width,
    height: DEFAULT_WALL_BOUNDS.height,
  };
}

function clampToWall(point: Point, wallWidth: number, wallHeight: number): Point {
  const wall = useWallSceneStore.getState().document.meta.wallBounds;
  const left = wall.x;
  const top = wall.y;
  const right = wall.x + Math.max(wall.width, wallWidth);
  const bottom = wall.y + Math.max(wall.height, wallHeight);
  return {
    x: Math.min(right - 8, Math.max(left + 8, point.x)),
    y: Math.min(bottom - 8, Math.max(top + 8, point.y)),
  };
}

function withJitter(point: Point, amount = 40): Point {
  return {
    x: point.x + (Math.random() - 0.5) * amount,
    y: point.y + (Math.random() - 0.5) * amount,
  };
}

/**
 * Default spawn for stickers/photos: current viewport (screen) center in wall
 * coords, with light jitter. Falls back to home-region center (world 0,0).
 */
export function randomHomePlacementPosition(
  wallWidth: number,
  wallHeight: number,
): Point {
  const view = viewportWorldCenterGetter?.() ?? null;
  if (view && Number.isFinite(view.x) && Number.isFinite(view.y)) {
    return withJitter(clampToWall(view, wallWidth, wallHeight));
  }

  return withJitter(clampToWall({ x: 0, y: 0 }, wallWidth, wallHeight));
}

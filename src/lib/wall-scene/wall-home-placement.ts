import { DEFAULT_WALL_BOUNDS } from "@/lib/wall-bounds";
import { useWallSceneStore } from "@/stores/wall-scene-store";

/**
 * Top-left of the stable default-size home frame in wall coordinates.
 * New objects and “home” layout use this — not raw (0,0) after west/north shifts.
 */
export function getWallHomeOrigin(): { x: number; y: number } {
  return useWallSceneStore.getState().document.meta.homeOrigin ?? { x: 0, y: 0 };
}

/**
 * Placement area for new objects: the original default wall rectangle
 * anchored at homeOrigin (stable across expands).
 */
export function getWallHomePlacementBounds(wallWidth: number, wallHeight: number): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const origin = getWallHomeOrigin();
  return {
    x: origin.x,
    y: origin.y,
    width: Math.min(Math.max(1, wallWidth - origin.x), DEFAULT_WALL_BOUNDS.width),
    height: Math.min(Math.max(1, wallHeight - origin.y), DEFAULT_WALL_BOUNDS.height),
  };
}

/** Random point inside the home region (upper-left cluster used by add-* helpers). */
export function randomHomePlacementPosition(
  wallWidth: number,
  wallHeight: number,
): { x: number; y: number } {
  const home = getWallHomePlacementBounds(wallWidth, wallHeight);
  return {
    x: home.x + home.width * 0.2 + Math.random() * (home.width * 0.25),
    y: home.y + home.height * 0.15 + Math.random() * (home.height * 0.25),
  };
}

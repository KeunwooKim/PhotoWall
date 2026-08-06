import type { WallBounds } from "@/lib/wall-bounds";
import { getSceneObjectExtents } from "@/lib/wall-bounds";
import type { WallSceneObject } from "@/types/wall-scene-v2";

/** Minimum overlap (px) kept inside the wall so objects stay selectable. */
export const WALL_VISIBLE_MARGIN = 40;

export function isObjectOutsideWall(
  object: WallSceneObject,
  wall: WallBounds,
  margin = WALL_VISIBLE_MARGIN,
): boolean {
  const ext = getSceneObjectExtents(object);
  const keepX = Math.min(margin, Math.max(1, ext.maxX - ext.minX));
  const keepY = Math.min(margin, Math.max(1, ext.maxY - ext.minY));
  return (
    ext.maxX < keepX ||
    ext.minX > wall.width - keepX ||
    ext.maxY < keepY ||
    ext.minY > wall.height - keepY
  );
}

/**
 * Shift x/y so at least `margin` px of the object AABB stays inside the wall.
 * Returns null when already ok.
 */
export function clampObjectPositionToWall(
  object: WallSceneObject,
  wall: WallBounds,
  margin = WALL_VISIBLE_MARGIN,
): { x: number; y: number } | null {
  const ext = getSceneObjectExtents(object);
  const w = Math.max(1, ext.maxX - ext.minX);
  const h = Math.max(1, ext.maxY - ext.minY);
  const keepX = Math.min(margin, w);
  const keepY = Math.min(margin, h);

  let dx = 0;
  let dy = 0;

  if (ext.maxX < keepX) dx = keepX - ext.maxX;
  else if (ext.minX > wall.width - keepX) dx = wall.width - keepX - ext.minX;

  if (ext.maxY < keepY) dy = keepY - ext.maxY;
  else if (ext.minY > wall.height - keepY) dy = wall.height - keepY - ext.minY;

  if (dx === 0 && dy === 0) return null;
  return { x: object.x + dx, y: object.y + dy };
}

/**
 * Keep the full AABB inside the wall when possible.
 * Oversized objects are centered on that axis.
 * Returns null when already ok.
 */
export function hardClampObjectPositionToWall(
  object: WallSceneObject,
  wall: WallBounds,
): { x: number; y: number } | null {
  const ext = getSceneObjectExtents(object);
  const w = Math.max(1, ext.maxX - ext.minX);
  const h = Math.max(1, ext.maxY - ext.minY);
  const cx = (ext.minX + ext.maxX) / 2;
  const cy = (ext.minY + ext.maxY) / 2;

  let dx = 0;
  let dy = 0;

  if (w >= wall.width) dx = wall.width / 2 - cx;
  else if (ext.minX < 0) dx = -ext.minX;
  else if (ext.maxX > wall.width) dx = wall.width - ext.maxX;

  if (h >= wall.height) dy = wall.height / 2 - cy;
  else if (ext.minY < 0) dy = -ext.minY;
  else if (ext.maxY > wall.height) dy = wall.height - ext.maxY;

  if (dx === 0 && dy === 0) return null;
  return { x: object.x + dx, y: object.y + dy };
}

/** Move object so its AABB center lands on the wall center (recovery). */
export function bringObjectOntoWall(
  object: WallSceneObject,
  wall: WallBounds,
): { x: number; y: number } {
  const ext = getSceneObjectExtents(object);
  const cx = (ext.minX + ext.maxX) / 2;
  const cy = (ext.minY + ext.maxY) / 2;
  return {
    x: object.x + (wall.width / 2 - cx),
    y: object.y + (wall.height / 2 - cy),
  };
}

export function countObjectsOutsideWall(
  objects: WallSceneObject[],
  wall: WallBounds,
): number {
  return objects.reduce((n, obj) => n + (isObjectOutsideWall(obj, wall) ? 1 : 0), 0);
}

/**
 * Positions to bring wall-outside objects back to the wall center.
 * With a selection: only selected outside objects.
 * With no selection: every outside object.
 */
export function planBringOntoWall(
  objects: WallSceneObject[],
  wall: WallBounds,
  selectedIds: string[] = [],
): { id: string; x: number; y: number }[] {
  const pool =
    selectedIds.length > 0
      ? objects.filter((o) => selectedIds.includes(o.id))
      : objects;

  return pool
    .filter((o) => isObjectOutsideWall(o, wall))
    .map((o) => ({ id: o.id, ...bringObjectOntoWall(o, wall) }));
}

import {
  MIN_WALL_BOUNDS,
  WALL_EXPAND_MARGIN,
  WALL_EXPAND_STEP,
  clampWallBoundsAnchored,
  getSceneObjectsBounds,
  wallBottom,
  wallExpandEdgeLimits,
  wallLeft,
  wallRight,
  wallTop,
  type ObjectBounds,
  type WallBounds,
} from "@/lib/wall-bounds";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export type OmniWallGrow = {
  bounds: WallBounds;
  /** @deprecated Center-origin walls never shift objects. Always 0. */
  shiftX: number;
  /** @deprecated Center-origin walls never shift objects. Always 0. */
  shiftY: number;
};

/** Shift object position (path points stay local to x/y). Kept for callers/tests. */
export function shiftSceneObject(
  object: WallSceneObject,
  dx: number,
  dy: number,
): WallSceneObject {
  if (dx === 0 && dy === 0) return object;
  return { ...object, x: object.x + dx, y: object.y + dy } as WallSceneObject;
}

export function shiftSceneObjects(
  objects: WallSceneObject[],
  dx: number,
  dy: number,
): WallSceneObject[] {
  if (dx === 0 && dy === 0) return objects;
  return objects.map((object) => shiftSceneObject(object, dx, dy));
}

/**
 * Grow wall by `step` on the east and south only (home frame stays put).
 */
export function computeCenteredWallExpand(
  current: WallBounds,
  max: Pick<WallBounds, "width" | "height">,
  step = WALL_EXPAND_STEP,
): OmniWallGrow | null {
  const next = clampWallBoundsAnchored(
    {
      x: current.x,
      y: current.y,
      width: current.width + step,
      height: current.height + step,
    },
    max,
  );
  if (next.width === current.width && next.height === current.height) return null;
  return { bounds: next, shiftX: 0, shiftY: 0 };
}

/**
 * Shrink wall toward default home frame, trimming overflow on all sides
 * without moving objects (AABB edges move inward toward content / home).
 */
export function computeCenteredWallShrink(
  current: WallBounds,
  _objectBounds: ObjectBounds | null,
  max: Pick<WallBounds, "width" | "height">,
  step = WALL_EXPAND_STEP,
  homeOrigin: { x: number; y: number } = { x: 0, y: 0 },
): OmniWallGrow | null {
  void homeOrigin;
  const home = MIN_WALL_BOUNDS;
  // Pull each edge toward the minimum home frame by up to `step`.
  const nextLeft = Math.min(wallLeft(current) + step, home.x);
  const nextTop = Math.min(wallTop(current) + step, home.y);
  const nextRight = Math.max(wallRight(current) - step, wallRight(home));
  const nextBottom = Math.max(wallBottom(current) - step, wallBottom(home));

  const next = clampWallBoundsAnchored(
    {
      x: nextLeft,
      y: nextTop,
      width: nextRight - nextLeft,
      height: nextBottom - nextTop,
    },
    max,
  );

  if (
    next.x === current.x &&
    next.y === current.y &&
    next.width === current.width &&
    next.height === current.height
  ) {
    return null;
  }
  return { bounds: next, shiftX: 0, shiftY: 0 };
}

/**
 * Fit wall AABB around content in all directions (grow and shrink).
 * Objects are never shifted — only wall edges move.
 */
export function computeOmniWallFitFromContent(
  objectBounds: ObjectBounds | null,
  current: WallBounds,
  max: Pick<WallBounds, "width" | "height">,
  margin = WALL_EXPAND_MARGIN,
): OmniWallGrow | null {
  if (!objectBounds) {
    const next = { ...MIN_WALL_BOUNDS };
    if (
      next.x === current.x &&
      next.y === current.y &&
      next.width === current.width &&
      next.height === current.height
    ) {
      return null;
    }
    return { bounds: next, shiftX: 0, shiftY: 0 };
  }

  const spanW = Math.max(0, objectBounds.maxX - objectBounds.minX);
  const spanH = Math.max(0, objectBounds.maxY - objectBounds.minY);
  let width = spanW + margin * 2;
  let height = spanH + margin * 2;
  width = Math.max(MIN_WALL_BOUNDS.width, width);
  height = Math.max(MIN_WALL_BOUNDS.height, height);

  let x = objectBounds.minX - margin;
  let y = objectBounds.minY - margin;
  if (spanW + margin * 2 < width) {
    x = (objectBounds.minX + objectBounds.maxX) / 2 - width / 2;
  }
  if (spanH + margin * 2 < height) {
    y = (objectBounds.minY + objectBounds.maxY) / 2 - height / 2;
  }

  const next = clampWallBoundsAnchored({ x, y, width, height }, max);
  if (
    next.x === current.x &&
    next.y === current.y &&
    next.width === current.width &&
    next.height === current.height
  ) {
    return null;
  }
  return { bounds: next, shiftX: 0, shiftY: 0 };
}

/**
 * Live drag follow: grow wall AABB when content presses edges.
 * No object shifts — west/north growth moves `bounds.x` / `bounds.y`.
 *
 * Shrink during drag is intentionally off by default (pass allowReclaim only
 * for tests / legacy). Empty-side reclaim runs once on drop when wallShrinkEnabled.
 * `allowReclaim` when true enables same-edge reclaim mid-drag (legacy).
 */
export function computeOmniWallFollowFromContent(
  objectBounds: ObjectBounds | null,
  current: WallBounds,
  max: Pick<WallBounds, "width" | "height">,
  margin = WALL_EXPAND_MARGIN,
  reclaimBudget: { x: number; y: number } = { x: 0, y: 0 },
  homeOrigin: { x: number; y: number } = { x: 0, y: 0 },
  allowReclaim = true,
): OmniWallGrow | null {
  void reclaimBudget;
  void homeOrigin;
  if (!objectBounds) return null;

  const left = wallLeft(current);
  const top = wallTop(current);
  const right = wallRight(current);
  const bottom = wallBottom(current);
  const home = MIN_WALL_BOUNDS;
  const homeLeft = wallLeft(home);
  const homeTop = wallTop(home);
  const homeRight = wallRight(home);
  const homeBottom = wallBottom(home);
  const minW = home.width;
  const minH = home.height;

  const pressingEast = objectBounds.maxX > right - margin;
  const pressingWest = objectBounds.minX < left + margin;
  const pressingSouth = objectBounds.maxY > bottom - margin;
  const pressingNorth = objectBounds.minY < top + margin;

  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  if (pressingWest) nextLeft = objectBounds.minX - margin;
  if (pressingEast) nextRight = objectBounds.maxX + margin;
  if (pressingNorth) nextTop = objectBounds.minY - margin;
  if (pressingSouth) nextBottom = objectBounds.maxY + margin;

  // Per-side caps from home — east max does not consume west budget (and vice versa).
  const limits = wallExpandEdgeLimits(max);
  nextLeft = Math.max(nextLeft, limits.minLeft);
  nextRight = Math.min(nextRight, limits.maxRight);
  nextTop = Math.max(nextTop, limits.minTop);
  nextBottom = Math.min(nextBottom, limits.maxBottom);

  // Same-edge reclaim toward home ∪ content. Only while content is still on
  // that half — crossing to expand the opposite side must not drag this edge.
  if (allowReclaim) {
    const midX = (left + right) / 2;
    const midY = (top + bottom) / 2;
    const targetLeft = Math.min(homeLeft, objectBounds.minX - margin);
    const targetRight = Math.max(homeRight, objectBounds.maxX + margin);
    const targetTop = Math.min(homeTop, objectBounds.minY - margin);
    const targetBottom = Math.max(homeBottom, objectBounds.maxY + margin);

    const nearEast = objectBounds.maxX >= midX;
    const nearWest = objectBounds.minX <= midX;
    const nearSouth = objectBounds.maxY >= midY;
    const nearNorth = objectBounds.minY <= midY;

    if (!pressingWest && nearEast && targetRight < nextRight) {
      nextRight = Math.max(targetRight, nextLeft + minW);
    }
    if (!pressingEast && nearWest && targetLeft > nextLeft) {
      nextLeft = Math.min(targetLeft, nextRight - minW);
    }
    if (!pressingNorth && nearSouth && targetBottom < nextBottom) {
      nextBottom = Math.max(targetBottom, nextTop + minH);
    }
    if (!pressingSouth && nearNorth && targetTop > nextTop) {
      nextTop = Math.min(targetTop, nextBottom - minH);
    }
  }

  // Minimum size — pad the non-pressed side (never recenter both edges).
  if (nextRight - nextLeft < minW) {
    if (pressingWest && !pressingEast) nextRight = Math.min(nextLeft + minW, limits.maxRight);
    else if (pressingEast && !pressingWest) nextLeft = Math.max(nextRight - minW, limits.minLeft);
    else nextRight = Math.min(nextLeft + minW, limits.maxRight);
  }
  if (nextBottom - nextTop < minH) {
    if (pressingNorth && !pressingSouth) nextBottom = Math.min(nextTop + minH, limits.maxBottom);
    else if (pressingSouth && !pressingNorth) nextTop = Math.max(nextBottom - minH, limits.minTop);
    else nextBottom = Math.min(nextTop + minH, limits.maxBottom);
  }

  // Safety: total AABB still within max (directional limits already enforce this).
  if (nextRight - nextLeft > max.width) {
    if (pressingWest && !pressingEast) nextLeft = nextRight - max.width;
    else nextRight = nextLeft + max.width;
  }
  if (nextBottom - nextTop > max.height) {
    if (pressingNorth && !pressingSouth) nextTop = nextBottom - max.height;
    else nextBottom = nextTop + max.height;
  }

  const bounds = clampWallBoundsAnchored(
    {
      x: nextLeft,
      y: nextTop,
      width: nextRight - nextLeft,
      height: nextBottom - nextTop,
    },
    max,
  );

  if (
    bounds.x === current.x &&
    bounds.y === current.y &&
    bounds.width === current.width &&
    bounds.height === current.height
  ) {
    return null;
  }

  return { bounds, shiftX: 0, shiftY: 0 };
}

/**
 * After drag-end: reclaim idle edges toward home ∪ content.
 * No half-gating — empty expanded sides shrink even if content sits on the
 * opposite half. Safe only when not mid-drag (avoids wall "following" expand).
 */
export function computeOmniWallReclaimEmptySides(
  objectBounds: ObjectBounds | null,
  current: WallBounds,
  max: Pick<WallBounds, "width" | "height">,
  margin = WALL_EXPAND_MARGIN,
): OmniWallGrow | null {
  if (!objectBounds) {
    const next = clampWallBoundsAnchored({ ...MIN_WALL_BOUNDS }, max);
    if (
      next.x === current.x &&
      next.y === current.y &&
      next.width === current.width &&
      next.height === current.height
    ) {
      return null;
    }
    return { bounds: next, shiftX: 0, shiftY: 0 };
  }

  const left = wallLeft(current);
  const top = wallTop(current);
  const right = wallRight(current);
  const bottom = wallBottom(current);
  const home = MIN_WALL_BOUNDS;
  const minW = home.width;
  const minH = home.height;
  const limits = wallExpandEdgeLimits(max);

  const pressingEast = objectBounds.maxX > right - margin;
  const pressingWest = objectBounds.minX < left + margin;
  const pressingSouth = objectBounds.maxY > bottom - margin;
  const pressingNorth = objectBounds.minY < top + margin;

  let nextLeft = left;
  let nextTop = top;
  let nextRight = right;
  let nextBottom = bottom;

  const targetLeft = Math.min(wallLeft(home), objectBounds.minX - margin);
  const targetRight = Math.max(wallRight(home), objectBounds.maxX + margin);
  const targetTop = Math.min(wallTop(home), objectBounds.minY - margin);
  const targetBottom = Math.max(wallBottom(home), objectBounds.maxY + margin);

  if (!pressingWest && targetLeft > nextLeft) {
    nextLeft = Math.min(targetLeft, nextRight - minW);
  }
  if (!pressingEast && targetRight < nextRight) {
    nextRight = Math.max(targetRight, nextLeft + minW);
  }
  if (!pressingNorth && targetTop > nextTop) {
    nextTop = Math.min(targetTop, nextBottom - minH);
  }
  if (!pressingSouth && targetBottom < nextBottom) {
    nextBottom = Math.max(targetBottom, nextTop + minH);
  }

  nextLeft = Math.max(nextLeft, limits.minLeft);
  nextRight = Math.min(nextRight, limits.maxRight);
  nextTop = Math.max(nextTop, limits.minTop);
  nextBottom = Math.min(nextBottom, limits.maxBottom);

  if (nextRight - nextLeft < minW) nextRight = Math.min(nextLeft + minW, limits.maxRight);
  if (nextBottom - nextTop < minH) nextBottom = Math.min(nextTop + minH, limits.maxBottom);

  const bounds = clampWallBoundsAnchored(
    {
      x: nextLeft,
      y: nextTop,
      width: nextRight - nextLeft,
      height: nextBottom - nextTop,
    },
    max,
  );

  if (
    bounds.x === current.x &&
    bounds.y === current.y &&
    bounds.width === current.width &&
    bounds.height === current.height
  ) {
    return null;
  }

  return { bounds, shiftX: 0, shiftY: 0 };
}

/**
 * Fit wall around live object bounds in all directions (grow-only).
 * West/north growth moves bounds.x/y — no object shift.
 */
export function computeOmniWallGrowFromContent(
  objectBounds: ObjectBounds | null,
  current: WallBounds,
  max: Pick<WallBounds, "width" | "height">,
  margin = WALL_EXPAND_MARGIN,
): OmniWallGrow | null {
  if (!objectBounds) return null;

  const nextLeft = Math.min(wallLeft(current), objectBounds.minX - margin);
  const nextTop = Math.min(wallTop(current), objectBounds.minY - margin);
  const nextRight = Math.max(wallRight(current), objectBounds.maxX + margin);
  const nextBottom = Math.max(wallBottom(current), objectBounds.maxY + margin);

  const bounds = clampWallBoundsAnchored(
    {
      x: nextLeft,
      y: nextTop,
      width: nextRight - nextLeft,
      height: nextBottom - nextTop,
    },
    max,
  );

  if (
    bounds.x === current.x &&
    bounds.y === current.y &&
    bounds.width === current.width &&
    bounds.height === current.height
  ) {
    return null;
  }

  return { bounds, shiftX: 0, shiftY: 0 };
}

export function contentNeedsOmniGrow(
  objectBounds: ObjectBounds | null,
  wall: WallBounds,
  margin = WALL_EXPAND_MARGIN,
): boolean {
  if (!objectBounds) return false;
  return (
    objectBounds.minX < wallLeft(wall) + margin ||
    objectBounds.minY < wallTop(wall) + margin ||
    objectBounds.maxX > wallRight(wall) - margin ||
    objectBounds.maxY > wallBottom(wall) - margin
  );
}

export function getObjectsBoundsFromList(objects: WallSceneObject[]): ObjectBounds | null {
  return getSceneObjectsBounds(objects);
}

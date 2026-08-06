import {
  DEFAULT_WALL_BOUNDS,
  WALL_EXPAND_MARGIN,
  WALL_EXPAND_STEP,
  clampWallBounds,
  getSceneObjectsBounds,
  type ObjectBounds,
  type WallBounds,
} from "@/lib/wall-bounds";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export type OmniWallGrow = {
  bounds: WallBounds;
  /** Add to every object x so new space appears on the west. */
  shiftX: number;
  /** Add to every object y so new space appears on the north. */
  shiftY: number;
};

/** Shift object position (path points stay local to x/y). */
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
 * Grow wall by `step` on the east and south only.
 * Keeps the default-size home frame anchored at the top-left (no content shift).
 */
export function computeCenteredWallExpand(
  current: WallBounds,
  max: WallBounds,
  step = WALL_EXPAND_STEP,
): OmniWallGrow | null {
  const next = clampWallBounds(
    {
      width: current.width + step,
      height: current.height + step,
    },
    max,
  );
  if (next.width === current.width && next.height === current.height) return null;
  return { bounds: next, shiftX: 0, shiftY: 0 };
}

/**
 * Shrink wall toward default.
 * Trims east/south, and reclaims west/north only when homeOrigin has budget
 * (from prior left/up expands) so the default home frame stays anchored.
 */
export function computeCenteredWallShrink(
  current: WallBounds,
  _objectBounds: ObjectBounds | null,
  max: WallBounds,
  step = WALL_EXPAND_STEP,
  homeOrigin: { x: number; y: number } = { x: 0, y: 0 },
): OmniWallGrow | null {
  const next = clampWallBounds(
    {
      width: current.width - step,
      height: current.height - step,
    },
    max,
  );
  if (next.width === current.width && next.height === current.height) return null;

  const dw = current.width - next.width;
  const dh = current.height - next.height;
  const shiftX = -Math.min(Math.max(0, homeOrigin.x), dw);
  const shiftY = -Math.min(Math.max(0, homeOrigin.y), dh);

  return { bounds: next, shiftX, shiftY };
}

/**
 * Fit wall around content in all directions (grow and shrink).
 * West/north changes use shiftX/shiftY so origin stays top-left.
 */
export function computeOmniWallFitFromContent(
  objectBounds: ObjectBounds | null,
  current: WallBounds,
  max: WallBounds,
  margin = WALL_EXPAND_MARGIN,
): OmniWallGrow | null {
  if (!objectBounds) {
    const next = clampWallBounds({ ...DEFAULT_WALL_BOUNDS }, max);
    if (next.width === current.width && next.height === current.height) return null;
    return {
      bounds: next,
      shiftX: -Math.floor((current.width - next.width) / 2),
      shiftY: -Math.floor((current.height - next.height) / 2),
    };
  }

  const spanW = Math.max(0, objectBounds.maxX - objectBounds.minX);
  const spanH = Math.max(0, objectBounds.maxY - objectBounds.minY);
  const next = clampWallBounds(
    { width: spanW + margin * 2, height: spanH + margin * 2 },
    max,
  );

  let desiredMinX = margin;
  let desiredMinY = margin;
  if (spanW + margin * 2 > next.width) {
    desiredMinX = Math.max(0, (next.width - spanW) / 2);
  }
  if (spanH + margin * 2 > next.height) {
    desiredMinY = Math.max(0, (next.height - spanH) / 2);
  }

  const shiftX = desiredMinX - objectBounds.minX;
  const shiftY = desiredMinY - objectBounds.minY;

  if (
    next.width === current.width &&
    next.height === current.height &&
    shiftX === 0 &&
    shiftY === 0
  ) {
    return null;
  }

  return { bounds: next, shiftX, shiftY };
}

/**
 * Live drag follow: grow when overflowing; shrink east/south when leaving those edges.
 * West/north shrink only when `reclaimBudget` allows (prior west/north expands via homeOrigin).
 */
export function computeOmniWallFollowFromContent(
  objectBounds: ObjectBounds | null,
  current: WallBounds,
  max: WallBounds,
  margin = WALL_EXPAND_MARGIN,
  reclaimBudget: { x: number; y: number } = { x: 0, y: 0 },
): OmniWallGrow | null {
  if (!objectBounds) return null;

  const pressingEast = objectBounds.maxX > current.width - margin;
  const pressingWest = objectBounds.minX < margin;
  const pressingSouth = objectBounds.maxY > current.height - margin;
  const pressingNorth = objectBounds.minY < margin;

  let shiftX = 0;
  let shiftY = 0;

  if (pressingWest) {
    shiftX = margin - objectBounds.minX;
  } else if (
    reclaimBudget.x > 0 &&
    objectBounds.minX > margin &&
    !pressingEast
  ) {
    // Undo prior west expand — only up to the home budget so the home frame stays put.
    shiftX = Math.max(margin - objectBounds.minX, -reclaimBudget.x);
  }

  if (pressingNorth) {
    shiftY = margin - objectBounds.minY;
  } else if (
    reclaimBudget.y > 0 &&
    objectBounds.minY > margin &&
    !pressingSouth
  ) {
    shiftY = Math.max(margin - objectBounds.minY, -reclaimBudget.y);
  }

  const roomW = Math.max(0, max.width - current.width);
  const roomH = Math.max(0, max.height - current.height);
  if (shiftX > 0) shiftX = Math.min(shiftX, roomW);
  if (shiftY > 0) shiftY = Math.min(shiftY, roomH);

  const maxX = objectBounds.maxX + shiftX;
  const maxY = objectBounds.maxY + shiftY;

  let nextW = Math.max(current.width + Math.max(0, shiftX), maxX + margin);
  let nextH = Math.max(current.height + Math.max(0, shiftY), maxY + margin);

  if (shiftX < 0) {
    nextW = Math.max(DEFAULT_WALL_BOUNDS.width, current.width + shiftX);
    nextW = Math.max(nextW, maxX + margin);
  }
  if (shiftY < 0) {
    nextH = Math.max(DEFAULT_WALL_BOUNDS.height, current.height + shiftY);
    nextH = Math.max(nextH, maxY + margin);
  }

  // East/south reclaim (no content shift).
  if (!pressingEast && !pressingWest && shiftX === 0 && maxX + margin < current.width) {
    nextW = Math.max(DEFAULT_WALL_BOUNDS.width, maxX + margin);
  }
  if (!pressingSouth && !pressingNorth && shiftY === 0 && maxY + margin < current.height) {
    nextH = Math.max(DEFAULT_WALL_BOUNDS.height, maxY + margin);
  }

  nextW = Math.min(max.width, Math.max(DEFAULT_WALL_BOUNDS.width, nextW));
  nextH = Math.min(max.height, Math.max(DEFAULT_WALL_BOUNDS.height, nextH));

  const bounds = clampWallBounds({ width: nextW, height: nextH }, max);
  if (
    bounds.width === current.width &&
    bounds.height === current.height &&
    shiftX === 0 &&
    shiftY === 0
  ) {
    return null;
  }

  return { bounds, shiftX, shiftY };
}

/**
 * Fit wall around live object bounds in all directions (grow-only).
 * West/north growth is expressed as shiftX/shiftY + larger bounds.
 */
export function computeOmniWallGrowFromContent(
  objectBounds: ObjectBounds | null,
  current: WallBounds,
  max: WallBounds,
  margin = WALL_EXPAND_MARGIN,
): OmniWallGrow | null {
  if (!objectBounds) return null;

  let shiftX = 0;
  let shiftY = 0;
  if (objectBounds.minX < margin) shiftX = margin - objectBounds.minX;
  if (objectBounds.minY < margin) shiftY = margin - objectBounds.minY;

  const roomW = Math.max(0, max.width - current.width);
  const roomH = Math.max(0, max.height - current.height);
  shiftX = Math.min(shiftX, roomW);
  shiftY = Math.min(shiftY, roomH);

  const maxX = objectBounds.maxX + shiftX;
  const maxY = objectBounds.maxY + shiftY;

  let nextW = Math.max(current.width + shiftX, maxX + margin);
  let nextH = Math.max(current.height + shiftY, maxY + margin);
  nextW = Math.min(max.width, Math.max(current.width + shiftX, nextW));
  nextH = Math.min(max.height, Math.max(current.height + shiftY, nextH));

  const bounds = clampWallBounds({ width: nextW, height: nextH }, max);
  if (
    bounds.width === current.width &&
    bounds.height === current.height &&
    shiftX === 0 &&
    shiftY === 0
  ) {
    return null;
  }

  return { bounds, shiftX, shiftY };
}

export function contentNeedsOmniGrow(
  objectBounds: ObjectBounds | null,
  wall: WallBounds,
  margin = WALL_EXPAND_MARGIN,
): boolean {
  if (!objectBounds) return false;
  return (
    objectBounds.minX < margin ||
    objectBounds.minY < margin ||
    objectBounds.maxX > wall.width - margin ||
    objectBounds.maxY > wall.height - margin
  );
}

export function getObjectsBoundsFromList(objects: WallSceneObject[]): ObjectBounds | null {
  return getSceneObjectsBounds(objects);
}

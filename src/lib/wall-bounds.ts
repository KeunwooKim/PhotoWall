import type { WallSceneObject } from "@/types/wall-scene-v2";
import { estimateTextBlockHeight } from "@/lib/wall-scene/text-content";
import { getPhotoVisualOuterSize } from "@/lib/photo-frames/layout";

/**
 * Wall AABB in world coordinates.
 * World origin (0,0) is the center of the default home frame.
 * West/north expand moves `x`/`y` (more negative) and grows width/height —
 * objects keep stable world positions (no content shift).
 */
export interface WallBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Legacy size-only bounds (pre–center-origin). */
export type LegacyWallBounds = { width: number; height: number; x?: number; y?: number };

export interface ObjectBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Single wallpaper tile / legacy home cell size (px). */
export const WALL_HOME_TILE_WIDTH = 780;
export const WALL_HOME_TILE_HEIGHT = 1200;

/** Default / minimum wall layout: 2 columns × 3 rows of home tiles. */
export const DEFAULT_WALL_TILE_COLS = 2;
export const DEFAULT_WALL_TILE_ROWS = 3;

/** Default + minimum wall (2×3). New walls start here; shrink cannot go smaller. */
export const DEFAULT_WALL_BOUNDS: WallBounds = {
  x: -(WALL_HOME_TILE_WIDTH * DEFAULT_WALL_TILE_COLS) / 2,
  y: -(WALL_HOME_TILE_HEIGHT * DEFAULT_WALL_TILE_ROWS) / 2,
  width: WALL_HOME_TILE_WIDTH * DEFAULT_WALL_TILE_COLS,
  height: WALL_HOME_TILE_HEIGHT * DEFAULT_WALL_TILE_ROWS,
};

/** Alias — shrink / clamps use the same 2×3 floor as the start size. */
export const MIN_WALL_BOUNDS: WallBounds = DEFAULT_WALL_BOUNDS;

export const WALL_EXPAND_MARGIN = 96;
export const WALL_EXPAND_STEP = 160;
/** Same as WALL_EXPAND_MARGIN — live/commit/sanitize share one padding so drop does not jump. */
export const WALL_DRAG_EXPAND_MARGIN = WALL_EXPAND_MARGIN;
/** Hard ceiling for logical wall size (Konva buffer stays capped separately).
 *  Pixi default path uses memorySafeWallMax() (8000×8000); these remain the
 *  Konva / clampWallBounds fallback ceiling. */
export const WALL_MAX_WIDTH = 2217;
export const WALL_MAX_HEIGHT = 1700;

export function wallLeft(b: Pick<WallBounds, "x" | "width">): number {
  return b.x;
}
export function wallTop(b: Pick<WallBounds, "y" | "height">): number {
  return b.y;
}
export function wallRight(b: Pick<WallBounds, "x" | "width">): number {
  return b.x + b.width;
}
export function wallBottom(b: Pick<WallBounds, "y" | "height">): number {
  return b.y + b.height;
}
export function wallCenter(b: WallBounds): { x: number; y: number } {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Expand a wall AABB so it at least covers the 2×3 home frame.
 * Existing smaller walls grow; already-larger walls keep their extra area.
 */
export function ensureMinWallCoverage(wall: WallBounds): WallBounds {
  const left = Math.min(wallLeft(wall), wallLeft(MIN_WALL_BOUNDS));
  const top = Math.min(wallTop(wall), wallTop(MIN_WALL_BOUNDS));
  const right = Math.max(wallRight(wall), wallRight(MIN_WALL_BOUNDS));
  const bottom = Math.max(wallBottom(wall), wallBottom(MIN_WALL_BOUNDS));
  if (
    left === wall.x &&
    top === wall.y &&
    right === wallRight(wall) &&
    bottom === wallBottom(wall)
  ) {
    return wall;
  }
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/** Outward growth budget per side from the home frame (px). */
export type WallExpandExtents = {
  west: number;
  east: number;
  north: number;
  south: number;
};

/**
 * Split the max AABB evenly around home so west+east (and north+south) can
 * each reach their max without one side consuming the whole budget.
 * Example Pixi 8000×8000: west/east 3610, north/south 3400.
 */
export function wallExpandExtentsFromHome(
  max: Pick<WallBounds, "width" | "height">,
): WallExpandExtents {
  const home = MIN_WALL_BOUNDS;
  return {
    west: Math.max(0, (max.width - home.width) / 2),
    east: Math.max(0, (max.width - home.width) / 2),
    north: Math.max(0, (max.height - home.height) / 2),
    south: Math.max(0, (max.height - home.height) / 2),
  };
}

/** Absolute world-edge clamps for omni expand (inclusive). */
export function wallExpandEdgeLimits(max: Pick<WallBounds, "width" | "height">): {
  minLeft: number;
  maxRight: number;
  minTop: number;
  maxBottom: number;
} {
  const home = MIN_WALL_BOUNDS;
  const e = wallExpandExtentsFromHome(max);
  return {
    minLeft: home.x - e.west,
    maxRight: wallRight(home) + e.east,
    minTop: home.y - e.north,
    maxBottom: wallBottom(home) + e.south,
  };
}

/** Clamp AABB edges into per-side expand limits (then min size). */
export function clampWallBoundsToExpandLimits(
  bounds: WallBounds,
  max: Pick<WallBounds, "width" | "height">,
): WallBounds {
  const limits = wallExpandEdgeLimits(max);
  const minW = MIN_WALL_BOUNDS.width;
  const minH = MIN_WALL_BOUNDS.height;

  const left = Math.min(Math.max(bounds.x, limits.minLeft), limits.maxRight - minW);
  let right = Math.max(Math.min(wallRight(bounds), limits.maxRight), left + minW);
  const top = Math.min(Math.max(bounds.y, limits.minTop), limits.maxBottom - minH);
  let bottom = Math.max(Math.min(wallBottom(bounds), limits.maxBottom), top + minH);

  if (right - left > max.width) right = left + max.width;
  if (bottom - top > max.height) bottom = top + max.height;

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * Tile/CSS offset that keeps the wallpaper pattern locked in world space
 * while the wall AABB (x/y) moves during west/north expand.
 * `decorative` is an optional user/theme offset on top of the world lock.
 */
export function wallpaperDisplayOffset(
  wall: Pick<WallBounds, "x" | "y">,
  decorative: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  return {
    x: -wall.x + decorative.x,
    y: -wall.y + decorative.y,
  };
}

/** Normalize legacy `{width,height}` or partial bounds into a full AABB. */
export function asWallBounds(bounds: LegacyWallBounds | WallBounds): WallBounds {
  return {
    x: bounds.x ?? 0,
    y: bounds.y ?? 0,
    width: bounds.width,
    height: bounds.height,
  };
}

export function clampWallBounds(
  bounds: LegacyWallBounds | WallBounds,
  max: Pick<WallBounds, "width" | "height"> = {
    width: WALL_MAX_WIDTH,
    height: WALL_MAX_HEIGHT,
  },
): WallBounds {
  const b = asWallBounds(bounds);
  const width = Math.min(max.width, Math.max(MIN_WALL_BOUNDS.width, b.width));
  const height = Math.min(max.height, Math.max(MIN_WALL_BOUNDS.height, b.height));
  // Preserve center when size is clamped.
  const cx = b.x + b.width / 2;
  const cy = b.y + b.height / 2;
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  };
}

/**
 * Clamp size only — keep the edges that did not move.
 * Also enforces per-side expand limits from home (west/east/north/south).
 */
export function clampWallBoundsAnchored(
  bounds: WallBounds,
  max: Pick<WallBounds, "width" | "height"> = {
    width: WALL_MAX_WIDTH,
    height: WALL_MAX_HEIGHT,
  },
): WallBounds {
  let { x, y, width, height } = bounds;
  const maxW = max.width;
  const maxH = max.height;
  const minW = MIN_WALL_BOUNDS.width;
  const minH = MIN_WALL_BOUNDS.height;

  if (width > maxW) {
    // Prefer keeping right/bottom (trim west/north overflow).
    x += width - maxW;
    width = maxW;
  } else if (width < minW) {
    const grow = minW - width;
    x -= grow / 2;
    width = minW;
  }

  if (height > maxH) {
    y += height - maxH;
    height = maxH;
  } else if (height < minH) {
    const grow = minH - height;
    y -= grow / 2;
    height = minH;
  }

  return clampWallBoundsToExpandLimits({ x, y, width, height }, max);
}

export function computeFitScale(
  workspaceWidth: number,
  workspaceHeight: number,
  wallWidth: number,
  wallHeight: number,
  padding = 40,
): number {
  if (workspaceWidth <= 0 || workspaceHeight <= 0) return 1;
  const scaleX = (workspaceWidth - padding) / wallWidth;
  const scaleY = (workspaceHeight - padding) / wallHeight;
  return Math.min(1, scaleX, scaleY);
}

function snapWallDimension(defaultSize: number, minRequired: number, maxSize: number): number {
  if (minRequired <= defaultSize) return defaultSize;
  const extra = minRequired - defaultSize;
  const steps = Math.ceil(extra / WALL_EXPAND_STEP);
  return Math.min(maxSize, defaultSize + steps * WALL_EXPAND_STEP);
}

/** Ideal wall size from content — empty canvas returns default centered bounds. */
export function computeWallBoundsFromContent(
  objectBounds: ObjectBounds | null,
  max: Pick<WallBounds, "width" | "height"> = {
    width: WALL_MAX_WIDTH,
    height: WALL_MAX_HEIGHT,
  },
): WallBounds {
  if (!objectBounds) return { ...DEFAULT_WALL_BOUNDS };

  const spanW = Math.max(0, objectBounds.maxX - objectBounds.minX);
  const spanH = Math.max(0, objectBounds.maxY - objectBounds.minY);
  const width = snapWallDimension(
    MIN_WALL_BOUNDS.width,
    spanW + WALL_EXPAND_MARGIN * 2,
    max.width,
  );
  const height = snapWallDimension(
    MIN_WALL_BOUNDS.height,
    spanH + WALL_EXPAND_MARGIN * 2,
    max.height,
  );
  const cx = (objectBounds.minX + objectBounds.maxX) / 2;
  const cy = (objectBounds.minY + objectBounds.maxY) / 2;
  return clampWallBoundsAnchored(
    { x: cx - width / 2, y: cy - height / 2, width, height },
    max,
  );
}

/**
 * Grow wall AABB to fit content on all sides (no object shift).
 * Exact pixel size (no step snap) so live drag expand does not jump on commit.
 */
export function reconcileWallBounds(
  current: WallBounds,
  objectBounds: ObjectBounds | null,
  max: Pick<WallBounds, "width" | "height"> = {
    width: WALL_MAX_WIDTH,
    height: WALL_MAX_HEIGHT,
  },
): WallBounds | null {
  if (!objectBounds) return null;

  const margin = WALL_EXPAND_MARGIN;
  const x = Math.min(current.x, objectBounds.minX - margin);
  const y = Math.min(current.y, objectBounds.minY - margin);
  const right = Math.max(wallRight(current), objectBounds.maxX + margin);
  const bottom = Math.max(wallBottom(current), objectBounds.maxY + margin);

  const width = right - x;
  const height = bottom - y;

  const next = clampWallBoundsAnchored({ x, y, width, height }, max);
  if (
    next.x === current.x &&
    next.y === current.y &&
    next.width === current.width &&
    next.height === current.height
  ) {
    return null;
  }
  return next;
}

function mergeExtents(
  acc: ObjectBounds | null,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): ObjectBounds {
  if (!acc) return { minX, minY, maxX, maxY };
  return {
    minX: Math.min(acc.minX, minX),
    minY: Math.min(acc.minY, minY),
    maxX: Math.max(acc.maxX, maxX),
    maxY: Math.max(acc.maxY, maxY),
  };
}

function rotatedRectExtents(
  x: number,
  y: number,
  width: number,
  height: number,
  rotationDeg: number,
): { minX: number; minY: number; maxX: number; maxY: number } {
  if (!rotationDeg) {
    return { minX: x, minY: y, maxX: x + width, maxY: y + height };
  }

  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const corners = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ] as const;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const [cx, cy] of corners) {
    const px = x + cx * cos - cy * sin;
    const py = y + cx * sin + cy * cos;
    minX = Math.min(minX, px);
    minY = Math.min(minY, py);
    maxX = Math.max(maxX, px);
    maxY = Math.max(maxY, py);
  }

  return { minX, minY, maxX, maxY };
}

export function getSceneObjectExtents(obj: WallSceneObject): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;

  if (obj.type === "photo") {
    const outer = getPhotoVisualOuterSize(obj);
    return rotatedRectExtents(
      obj.x + outer.offsetX * scaleX,
      obj.y + outer.offsetY * scaleY,
      outer.width * scaleX,
      outer.height * scaleY,
      obj.rotation,
    );
  }

  if (obj.type === "svg" || obj.type === "tape" || obj.type === "sticker") {
    return rotatedRectExtents(
      obj.x,
      obj.y,
      obj.width * scaleX,
      obj.height * scaleY,
      obj.rotation,
    );
  }

  if (obj.type === "emoji") {
    const size = obj.fontSize * Math.max(scaleX, scaleY);
    return rotatedRectExtents(obj.x, obj.y, size, size, obj.rotation);
  }

  if (obj.type === "text") {
    return rotatedRectExtents(
      obj.x,
      obj.y,
      obj.width * scaleX,
      estimateTextBlockHeight(obj) * scaleY,
      obj.rotation,
    );
  }

  if (obj.type === "path" && obj.points.length >= 2) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < obj.points.length; i += 2) {
      const px = obj.points[i] + obj.x;
      const py = obj.points[i + 1] + obj.y;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }

    return { minX, minY, maxX, maxY };
  }

  return { minX: obj.x, minY: obj.y, maxX: obj.x + 1, maxY: obj.y + 1 };
}

export function boundsIntersect(
  a: { minX: number; minY: number; maxX: number; maxY: number },
  b: { minX: number; minY: number; maxX: number; maxY: number },
): boolean {
  return !(a.maxX < b.minX || a.minX > b.maxX || a.maxY < b.minY || a.minY > b.maxY);
}

/** Axis-aligned bounds of all v2 scene objects (Konva shared wall). */
export function getSceneObjectsBounds(objects: WallSceneObject[]): ObjectBounds | null {
  if (objects.length === 0) return null;

  let bounds: ObjectBounds | null = null;
  for (const obj of objects) {
    const ext = getSceneObjectExtents(obj);
    bounds = mergeExtents(bounds, ext.minX, ext.minY, ext.maxX, ext.maxY);
  }

  return bounds;
}

/** True when bounds were saved in the pre–center-origin format (size only). */
export function needsLegacyWallMigration(
  bounds: LegacyWallBounds | WallBounds | null | undefined,
): boolean {
  if (!bounds) return true;
  return typeof bounds.x !== "number" || typeof bounds.y !== "number";
}

/**
 * Migrate a legacy top-left wall (origin at 0,0 + optional homeOrigin shift)
 * into center-origin world space. Home-frame center becomes (0,0).
 */
export function migrateLegacyWallToCenterOrigin(input: {
  wallBounds: LegacyWallBounds | WallBounds;
  homeOrigin?: { x: number; y: number } | null;
  objects: WallSceneObject[];
}): { wallBounds: WallBounds; objects: WallSceneObject[]; translated: boolean } {
  if (!needsLegacyWallMigration(input.wallBounds)) {
    return {
      wallBounds: asWallBounds(input.wallBounds),
      objects: input.objects,
      translated: false,
    };
  }

  const raw = input.wallBounds;
  const home = input.homeOrigin ?? { x: 0, y: 0 };
  // Legacy home cell was 1 wallpaper tile (780×1200), even though MIN is now 2×3.
  const cx = home.x + WALL_HOME_TILE_WIDTH / 2;
  const cy = home.y + WALL_HOME_TILE_HEIGHT / 2;
  const wallBounds: WallBounds = {
    x: 0 - cx,
    y: 0 - cy,
    width: raw.width,
    height: raw.height,
  };
  const objects = input.objects.map(
    (object) =>
      ({
        ...object,
        x: object.x - cx,
        y: object.y - cy,
      }) as WallSceneObject,
  );
  return { wallBounds, objects, translated: true };
}

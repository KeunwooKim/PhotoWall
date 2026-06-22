import type { WallSceneObject } from "@/types/wall-scene-v2";

export interface WallBounds {
  width: number;
  height: number;
}

export interface ObjectBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export const DEFAULT_WALL_BOUNDS: WallBounds = {
  width: 390,
  height: 600,
};

export const WALL_EXPAND_MARGIN = 48;
export const WALL_EXPAND_STEP = 80;
export const WALL_MAX_WIDTH = 1200;
export const WALL_MAX_HEIGHT = 2000;

export function clampWallBounds(bounds: WallBounds): WallBounds {
  return {
    width: Math.min(WALL_MAX_WIDTH, Math.max(DEFAULT_WALL_BOUNDS.width, bounds.width)),
    height: Math.min(WALL_MAX_HEIGHT, Math.max(DEFAULT_WALL_BOUNDS.height, bounds.height)),
  };
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

/** Ideal wall size from content — empty canvas returns default bounds. */
export function computeWallBoundsFromContent(objectBounds: ObjectBounds | null): WallBounds {
  if (!objectBounds) return { ...DEFAULT_WALL_BOUNDS };

  return clampWallBounds({
    width: snapWallDimension(
      DEFAULT_WALL_BOUNDS.width,
      objectBounds.maxX + WALL_EXPAND_MARGIN,
      WALL_MAX_WIDTH,
    ),
    height: snapWallDimension(
      DEFAULT_WALL_BOUNDS.height,
      objectBounds.maxY + WALL_EXPAND_MARGIN,
      WALL_MAX_HEIGHT,
    ),
  });
}

/** Expand or shrink wall to fit content (no-op when already correct). */
export function reconcileWallBounds(
  current: WallBounds,
  objectBounds: ObjectBounds | null,
): WallBounds | null {
  const next = computeWallBoundsFromContent(objectBounds);
  if (next.width === current.width && next.height === current.height) return null;
  return next;
}

type FabricObjectLike = {
  getBoundingRect: () => { left: number; top: number; width: number; height: number };
};

type FabricCanvasLike = {
  getObjects: () => FabricObjectLike[];
};

export function getObjectsBounds(canvas: FabricCanvasLike): ObjectBounds | null {
  const objects = canvas.getObjects();
  if (objects.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const obj of objects) {
    const rect = obj.getBoundingRect();
    minX = Math.min(minX, rect.left);
    minY = Math.min(minY, rect.top);
    maxX = Math.max(maxX, rect.left + rect.width);
    maxY = Math.max(maxY, rect.top + rect.height);
  }

  return { minX, minY, maxX, maxY };
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

function sceneObjectExtents(obj: WallSceneObject): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  const scaleX = obj.scaleX ?? 1;
  const scaleY = obj.scaleY ?? 1;

  if (obj.type === "photo" || obj.type === "svg" || obj.type === "tape" || obj.type === "sticker") {
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

/** Axis-aligned bounds of all v2 scene objects (Konva shared wall). */
export function getSceneObjectsBounds(objects: WallSceneObject[]): ObjectBounds | null {
  if (objects.length === 0) return null;

  let bounds: ObjectBounds | null = null;
  for (const obj of objects) {
    const ext = sceneObjectExtents(obj);
    bounds = mergeExtents(bounds, ext.minX, ext.minY, ext.maxX, ext.maxY);
  }

  return bounds;
}

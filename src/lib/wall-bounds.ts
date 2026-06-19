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

/** Expand wall right/bottom when content nears the edge. */
export function computeExpandedBounds(
  current: WallBounds,
  objectBounds: ObjectBounds,
): WallBounds | null {
  let width = current.width;
  let height = current.height;
  let changed = false;

  while (objectBounds.maxX + WALL_EXPAND_MARGIN > width && width < WALL_MAX_WIDTH) {
    width = Math.min(WALL_MAX_WIDTH, width + WALL_EXPAND_STEP);
    changed = true;
  }

  while (objectBounds.maxY + WALL_EXPAND_MARGIN > height && height < WALL_MAX_HEIGHT) {
    height = Math.min(WALL_MAX_HEIGHT, height + WALL_EXPAND_STEP);
    changed = true;
  }

  if (!changed) return null;
  return clampWallBounds({ width, height });
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

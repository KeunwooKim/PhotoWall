import type { WallBounds } from "@/lib/wall-bounds";
import { getSceneObjectExtents } from "@/lib/wall-bounds";
import {
  clampCropInBounds,
  largestAspectCropInBounds,
} from "@/lib/wall-scene/photo-crop";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export const INSTAGRAM_EXPORT_PRESETS = [
  { id: "1:1", label: "1:1", ratio: 1, outW: 1080, outH: 1080 },
  { id: "4:5", label: "4:5", ratio: 4 / 5, outW: 1080, outH: 1350 },
  { id: "9:16", label: "9:16", ratio: 9 / 16, outW: 1080, outH: 1920 },
] as const;

export type InstagramExportPresetId = (typeof INSTAGRAM_EXPORT_PRESETS)[number]["id"];

export type WallExportRect = { x: number; y: number; width: number; height: number };

export const MIN_EXPORT_FRAME = 48;

const DENSITY_GRID = 24;

function objectDensityWeight(object: WallSceneObject): number {
  switch (object.type) {
    case "photo":
      return 3;
    case "sticker":
      return 2;
    case "text":
    case "emoji":
      return 1.5;
    case "tape":
    case "path":
      return 0.5;
    default:
      return 0;
  }
}

export function getInstagramExportPreset(id: InstagramExportPresetId) {
  return INSTAGRAM_EXPORT_PRESETS.find((p) => p.id === id) ?? INSTAGRAM_EXPORT_PRESETS[0];
}

/** Fit the largest aspect-locked rect inside bounds, optionally centered on a point. */
export function snapRectToAspect(
  aspect: number,
  wallBounds: WallBounds,
  center?: { x: number; y: number },
): WallExportRect {
  const fitted = largestAspectCropInBounds(wallBounds.width, wallBounds.height, aspect);
  const x = wallBounds.x + fitted.x;
  const y = wallBounds.y + fitted.y;
  if (!center) {
    return { x, y, width: fitted.width, height: fitted.height };
  }
  const cx = center.x - fitted.width / 2;
  const cy = center.y - fitted.height / 2;
  return clampCropInBounds(
    { x: cx, y: cy, width: fitted.width, height: fitted.height },
    wallBounds,
    MIN_EXPORT_FRAME,
  );
}

/** Snap a drag marquee to the chosen aspect ratio, keeping its center. */
export function snapRectFromMarquee(
  marquee: WallExportRect,
  aspect: number,
  wallBounds: WallBounds,
): WallExportRect {
  const cx = marquee.x + marquee.width / 2;
  const cy = marquee.y + marquee.height / 2;
  const maxW = Math.min(marquee.width, wallBounds.width);
  const maxH = Math.min(marquee.height, wallBounds.height);
  const fitted = largestAspectCropInBounds(Math.max(MIN_EXPORT_FRAME, maxW), Math.max(MIN_EXPORT_FRAME, maxH), aspect);
  return clampCropInBounds(
    {
      x: cx - fitted.width / 2,
      y: cy - fitted.height / 2,
      width: fitted.width,
      height: fitted.height,
    },
    wallBounds,
    MIN_EXPORT_FRAME,
  );
}

/** Re-fit an existing frame when the user switches aspect preset. */
export function refitFrameToAspect(
  frame: WallExportRect,
  aspect: number,
  wallBounds: WallBounds,
): WallExportRect {
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const fitted = largestAspectCropInBounds(frame.width, frame.height, aspect);
  return clampCropInBounds(
    {
      x: cx - fitted.width / 2,
      y: cy - fitted.height / 2,
      width: fitted.width,
      height: fitted.height,
    },
    wallBounds,
    MIN_EXPORT_FRAME,
  );
}

function accumulateDensityGrid(
  objects: WallSceneObject[],
  wallBounds: WallBounds,
): Float32Array {
  const grid = new Float32Array(DENSITY_GRID * DENSITY_GRID);
  const cellW = wallBounds.width / DENSITY_GRID;
  const cellH = wallBounds.height / DENSITY_GRID;
  if (cellW <= 0 || cellH <= 0) return grid;

  for (const object of objects) {
    const w = objectDensityWeight(object);
    if (w <= 0) continue;
    const ext = getSceneObjectExtents(object);
    const c0 = Math.max(0, Math.floor((ext.minX - wallBounds.x) / cellW));
    const c1 = Math.min(DENSITY_GRID - 1, Math.floor((ext.maxX - wallBounds.x) / cellW));
    const r0 = Math.max(0, Math.floor((ext.minY - wallBounds.y) / cellH));
    const r1 = Math.min(DENSITY_GRID - 1, Math.floor((ext.maxY - wallBounds.y) / cellH));
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        grid[r * DENSITY_GRID + c] += w;
      }
    }
  }
  return grid;
}

/**
 * Find the densest square region on a grid; returns a 1:1 frame with padding.
 * Caller can refit to other aspects via refitFrameToAspect.
 */
export function findDensestSquareFrame(
  objects: WallSceneObject[],
  wallBounds: WallBounds,
  windowCells = 8,
): WallExportRect {
  if (objects.length === 0) {
    return snapRectToAspect(1, wallBounds);
  }

  const grid = accumulateDensityGrid(objects, wallBounds);
  const win = Math.max(4, Math.min(windowCells, DENSITY_GRID));
  let bestScore = -1;
  let bestR = 0;
  let bestC = 0;

  for (let r = 0; r <= DENSITY_GRID - win; r++) {
    for (let c = 0; c <= DENSITY_GRID - win; c++) {
      let sum = 0;
      for (let dr = 0; dr < win; dr++) {
        for (let dc = 0; dc < win; dc++) {
          sum += grid[(r + dr) * DENSITY_GRID + (c + dc)];
        }
      }
      if (sum > bestScore) {
        bestScore = sum;
        bestR = r;
        bestC = c;
      }
    }
  }

  const cellW = wallBounds.width / DENSITY_GRID;
  const cellH = wallBounds.height / DENSITY_GRID;
  const raw: WallExportRect = {
    x: wallBounds.x + bestC * cellW,
    y: wallBounds.y + bestR * cellH,
    width: win * cellW,
    height: win * cellH,
  };

  const padX = raw.width * 0.1;
  const padY = raw.height * 0.1;
  const padded = clampCropInBounds(
    {
      x: raw.x - padX,
      y: raw.y - padY,
      width: raw.width + padX * 2,
      height: raw.height + padY * 2,
    },
    wallBounds,
    MIN_EXPORT_FRAME,
  );

  const side = Math.min(padded.width, padded.height);
  const cx = padded.x + padded.width / 2;
  const cy = padded.y + padded.height / 2;
  return clampCropInBounds(
    { x: cx - side / 2, y: cy - side / 2, width: side, height: side },
    wallBounds,
    MIN_EXPORT_FRAME,
  );
}

export function normalizeMarquee(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): WallExportRect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  };
}

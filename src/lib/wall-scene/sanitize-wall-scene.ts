import {
  DEFAULT_WALL_BOUNDS,
  asWallBounds,
  clampWallBoundsAnchored,
  ensureMinWallCoverage,
  getSceneObjectsBounds,
  migrateLegacyWallToCenterOrigin,
  needsLegacyWallMigration,
  reconcileWallBounds,
  type WallBounds,
} from "@/lib/wall-bounds";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import { computeOmniWallGrowFromContent } from "@/lib/wall-scene/wall-omni-expand";
import { memorySafeWallMax } from "@/lib/wall-device";
import { clampWallTextContent } from "@/lib/wall-scene/text-content";
import { sanitizePhotoDecorFields } from "@/lib/photo-frames/sanitize";
import { sanitizeFourCutFields } from "@/lib/four-cut/sanitize";
import type { WallSceneDocument, WallSceneObject } from "@/types/wall-scene-v2";

function finiteOr(value: number, fallback: number): number {
  return Number.isFinite(value) ? value : fallback;
}

function sanitizeObjectNumbers(object: WallSceneObject): WallSceneObject {
  const scaleX = finiteOr(object.scaleX, 1);
  const scaleY = finiteOr(object.scaleY, 1);
  const next = {
    ...object,
    x: finiteOr(object.x, 0),
    y: finiteOr(object.y, 0),
    rotation: finiteOr(object.rotation, 0),
    scaleX: scaleX === 0 ? 1 : scaleX,
    scaleY: scaleY === 0 ? 1 : scaleY,
    opacity:
      object.opacity == null ? object.opacity : finiteOr(object.opacity, 1),
  } as WallSceneObject;

  if ("width" in next && typeof next.width === "number") {
    next.width = Math.max(1, finiteOr(next.width, 100));
  }
  if ("height" in next && typeof next.height === "number") {
    next.height = Math.max(1, finiteOr(next.height, 100));
  }
  if ("fontSize" in next && typeof next.fontSize === "number") {
    next.fontSize = Math.max(1, finiteOr(next.fontSize, 24));
  }
  if (next.type === "text" && typeof next.text === "string") {
    next.text = clampWallTextContent(next.text);
  }

  return sanitizeFourCutFields(sanitizePhotoDecorFields(next));
}

function scaleObjectToWall(
  object: WallSceneObject,
  scaleX: number,
  scaleY: number,
): WallSceneObject {
  const next = {
    ...object,
    x: object.x * scaleX,
    y: object.y * scaleY,
  } as WallSceneObject;

  if ("width" in next && typeof next.width === "number") {
    next.width = Math.max(1, next.width * scaleX);
  }
  if ("height" in next && typeof next.height === "number") {
    next.height = Math.max(1, next.height * scaleY);
  }
  if ("fontSize" in next && typeof next.fontSize === "number") {
    next.fontSize = Math.max(1, next.fontSize * Math.min(scaleX, scaleY));
  }
  if (next.type === "path" && Array.isArray(next.points)) {
    next.points = next.points.map((value, index) =>
      index % 2 === 0 ? value * scaleX : value * scaleY,
    );
  }

  return next;
}

function clampObjectIntoWall(object: WallSceneObject, wall: WallBounds): WallSceneObject {
  const cleaned = sanitizeObjectNumbers(object);
  const shifted = hardClampObjectPositionToWall(cleaned, wall);
  if (!shifted) return cleaned;
  return { ...cleaned, ...shifted };
}

function sameTransform(a: WallSceneObject, b: WallSceneObject): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.rotation === b.rotation &&
    a.scaleX === b.scaleX &&
    a.scaleY === b.scaleY &&
    a.opacity === b.opacity
  );
}

/**
 * Repair scenes that grew huge / drifted off-canvas after dragging objects
 * far outside the wall. Safe to run on every load and before persist.
 * Returns the same reference when nothing changes.
 */
export function sanitizeWallScene(document: WallSceneDocument): WallSceneDocument {
  const safeMax = memorySafeWallMax();

  // One-shot migrate: legacy top-left (0,0) → center-origin world.
  const rawBounds = document.meta.wallBounds ?? DEFAULT_WALL_BOUNDS;
  const migrated = needsLegacyWallMigration(rawBounds)
    ? migrateLegacyWallToCenterOrigin({
        wallBounds: rawBounds,
        homeOrigin: document.meta.homeOrigin,
        objects: document.objects,
      })
    : {
        wallBounds: asWallBounds(rawBounds),
        objects: document.objects,
        translated: false,
      };

  let objects = migrated.objects.map((object) => sanitizeObjectNumbers(object));
  const sourceWall = asWallBounds(migrated.wallBounds);
  // Grow legacy/small walls up to the 2×3 home (keep any already-larger area).
  let wall = clampWallBoundsAnchored(ensureMinWallCoverage(sourceWall), safeMax);
  const sizeLocked = !!document.meta.wallSizeLocked;

  if (sourceWall.width > wall.width || sourceWall.height > wall.height) {
    const scaleX = wall.width / Math.max(1, sourceWall.width);
    const scaleY = wall.height / Math.max(1, sourceWall.height);
    objects = objects.map((object) => scaleObjectToWall(object, scaleX, scaleY));
  }

  const wallpaperOffset = document.meta.wallpaperOffset;

  if (sizeLocked) {
    objects = objects.map((object) => clampObjectIntoWall(object, wall));
  } else {
    const omni = computeOmniWallGrowFromContent(
      getSceneObjectsBounds(objects),
      wall,
      safeMax,
    );
    if (omni) {
      wall = omni.bounds;
    }

    objects = objects.map((object) => clampObjectIntoWall(object, wall));

    const reconciled =
      reconcileWallBounds(wall, getSceneObjectsBounds(objects), safeMax) ?? wall;
    wall = clampWallBoundsAnchored(ensureMinWallCoverage(reconciled), safeMax);
  }

  const objectsChanged =
    migrated.translated ||
    objects.length !== document.objects.length ||
    objects.some((object, index) => {
      const prev = document.objects[index];
      return prev !== object && (prev.id !== object.id || !sameTransform(prev, object));
    });
  const prevWall = asWallBounds(document.meta.wallBounds ?? DEFAULT_WALL_BOUNDS);
  const wallChanged =
    wall.x !== prevWall.x ||
    wall.y !== prevWall.y ||
    wall.width !== prevWall.width ||
    wall.height !== prevWall.height;

  if (!objectsChanged && !wallChanged) return document;

  return {
    ...document,
    meta: {
      ...document.meta,
      wallBounds: wall,
      wallpaperOffset,
      // Drop legacy homeOrigin after center-origin migration.
      homeOrigin: undefined,
    },
    objects,
  };
}

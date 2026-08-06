import {
  DEFAULT_WALL_BOUNDS,
  clampWallBounds,
  getSceneObjectsBounds,
  reconcileWallBounds,
  type WallBounds,
} from "@/lib/wall-bounds";
import { hardClampObjectPositionToWall } from "@/lib/wall-scene/clamp-object-to-wall";
import {
  computeOmniWallGrowFromContent,
  shiftSceneObjects,
} from "@/lib/wall-scene/wall-omni-expand";
import { memorySafeWallMax } from "@/lib/konva-device";
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

  return next;
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
  const sourceWall = document.meta.wallBounds ?? DEFAULT_WALL_BOUNDS;
  let objects = document.objects.map((object) => sanitizeObjectNumbers(object));
  let wall = clampWallBounds(sourceWall, safeMax);
  const sizeLocked = !!document.meta.wallSizeLocked;

  // If we had to shrink a previously oversized wall, scale content proportionally
  // so collages don't all pile into a corner.
  if (sourceWall.width > wall.width || sourceWall.height > wall.height) {
    const scaleX = wall.width / Math.max(1, sourceWall.width);
    const scaleY = wall.height / Math.max(1, sourceWall.height);
    objects = objects.map((object) => scaleObjectToWall(object, scaleX, scaleY));
  }

  let wallpaperOffset = document.meta.wallpaperOffset;
  let homeOrigin = document.meta.homeOrigin;

  if (sizeLocked) {
    // Lock: never change wall size — clamp content into the current wall.
    objects = objects.map((object) => clampObjectIntoWall(object, wall));
  } else {
    // Prefer growing west/north (shift + enlarge) over clamping content inward.
    const omni = computeOmniWallGrowFromContent(
      getSceneObjectsBounds(objects),
      wall,
      safeMax,
    );
    if (omni) {
      objects = shiftSceneObjects(objects, omni.shiftX, omni.shiftY);
      wall = omni.bounds;
      if (omni.shiftX !== 0 || omni.shiftY !== 0) {
        const prevWp = wallpaperOffset ?? { x: 0, y: 0 };
        const prevHome = homeOrigin ?? { x: 0, y: 0 };
        wallpaperOffset = { x: prevWp.x + omni.shiftX, y: prevWp.y + omni.shiftY };
        homeOrigin = { x: prevHome.x + omni.shiftX, y: prevHome.y + omni.shiftY };
      }
    }

    objects = objects.map((object) => clampObjectIntoWall(object, wall));

    const reconciled =
      reconcileWallBounds(wall, getSceneObjectsBounds(objects), safeMax) ?? wall;
    wall = clampWallBounds(reconciled, safeMax);
  }

  const nextWall = wall;

  // Bake home back to (0,0) once the wall is default-sized again.
  if (
    !sizeLocked &&
    nextWall.width <= DEFAULT_WALL_BOUNDS.width &&
    nextWall.height <= DEFAULT_WALL_BOUNDS.height &&
    ((homeOrigin?.x ?? 0) !== 0 || (homeOrigin?.y ?? 0) !== 0)
  ) {
    const dx = -(homeOrigin?.x ?? 0);
    const dy = -(homeOrigin?.y ?? 0);
    objects = shiftSceneObjects(objects, dx, dy);
    const prevWp = wallpaperOffset ?? { x: 0, y: 0 };
    wallpaperOffset = { x: prevWp.x + dx, y: prevWp.y + dy };
    homeOrigin = { x: 0, y: 0 };
  }

  const objectsChanged =
    objects.length !== document.objects.length ||
    objects.some((object, index) => {
      const prev = document.objects[index];
      return prev !== object && (prev.id !== object.id || !sameTransform(prev, object));
    });
  const wallChanged =
    nextWall.width !== document.meta.wallBounds.width ||
    nextWall.height !== document.meta.wallBounds.height;
  const offsetChanged =
    (wallpaperOffset?.x ?? 0) !== (document.meta.wallpaperOffset?.x ?? 0) ||
    (wallpaperOffset?.y ?? 0) !== (document.meta.wallpaperOffset?.y ?? 0);
  const homeChanged =
    (homeOrigin?.x ?? 0) !== (document.meta.homeOrigin?.x ?? 0) ||
    (homeOrigin?.y ?? 0) !== (document.meta.homeOrigin?.y ?? 0);

  if (!objectsChanged && !wallChanged && !offsetChanged && !homeChanged) return document;

  return {
    ...document,
    meta: {
      ...document.meta,
      wallBounds: nextWall,
      wallpaperOffset,
      homeOrigin,
    },
    objects,
  };
}

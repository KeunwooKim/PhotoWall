import { getSceneObjectExtents } from "@/lib/wall-bounds";
import type { WallBounds } from "@/lib/wall-bounds";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export type HorizontalAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";

export interface PositionPatch {
  id: string;
  x: number;
  y: number;
}

function unionExtents(objects: WallSceneObject[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const object of objects) {
    const ext = getSceneObjectExtents(object);
    minX = Math.min(minX, ext.minX);
    minY = Math.min(minY, ext.minY);
    maxX = Math.max(maxX, ext.maxX);
    maxY = Math.max(maxY, ext.maxY);
  }

  return { minX, minY, maxX, maxY };
}

function translatePatches(
  objects: WallSceneObject[],
  deltaX: number,
  deltaY: number,
): PositionPatch[] {
  if (deltaX === 0 && deltaY === 0) return [];

  return objects.map((object) => ({
    id: object.id,
    x: object.x + deltaX,
    y: object.y + deltaY,
  }));
}

/** Align selected objects relative to the selection bounding box (needs 2+). */
export function computeSelectionAlignmentPatches(
  objects: WallSceneObject[],
  selectedIds: string[],
  horizontal?: HorizontalAlign,
  vertical?: VerticalAlign,
): PositionPatch[] {
  const selected = objects.filter((object) => selectedIds.includes(object.id));
  if (selected.length < 2) return [];
  if (!horizontal && !vertical) return [];

  const union = unionExtents(selected);
  const patches: PositionPatch[] = [];

  for (const object of selected) {
    const ext = getSceneObjectExtents(object);
    let deltaX = 0;
    let deltaY = 0;

    if (horizontal === "left") {
      deltaX = union.minX - ext.minX;
    } else if (horizontal === "center") {
      const target = (union.minX + union.maxX) / 2;
      const current = (ext.minX + ext.maxX) / 2;
      deltaX = target - current;
    } else if (horizontal === "right") {
      deltaX = union.maxX - ext.maxX;
    }

    if (vertical === "top") {
      deltaY = union.minY - ext.minY;
    } else if (vertical === "middle") {
      const target = (union.minY + union.maxY) / 2;
      const current = (ext.minY + ext.maxY) / 2;
      deltaY = target - current;
    } else if (vertical === "bottom") {
      deltaY = union.maxY - ext.maxY;
    }

    if (deltaX !== 0 || deltaY !== 0) {
      patches.push({
        id: object.id,
        x: object.x + deltaX,
        y: object.y + deltaY,
      });
    }
  }

  return patches;
}

/** Move selection so its bounding box center matches the wall center. */
export function computeWallCenterPatches(
  objects: WallSceneObject[],
  selectedIds: string[],
  wallBounds: WallBounds,
): PositionPatch[] {
  const selected = objects.filter((object) => selectedIds.includes(object.id));
  if (selected.length === 0) return [];

  const union = unionExtents(selected);
  const targetCenterX = wallBounds.width / 2;
  const targetCenterY = wallBounds.height / 2;
  const currentCenterX = (union.minX + union.maxX) / 2;
  const currentCenterY = (union.minY + union.maxY) / 2;

  return translatePatches(
    selected,
    targetCenterX - currentCenterX,
    targetCenterY - currentCenterY,
  );
}

/** Nudge selected objects by a pixel delta. */
export function computeNudgePatches(
  objects: WallSceneObject[],
  selectedIds: string[],
  deltaX: number,
  deltaY: number,
): PositionPatch[] {
  const selected = objects.filter((object) => selectedIds.includes(object.id));
  if (selected.length === 0 || (deltaX === 0 && deltaY === 0)) return [];
  return translatePatches(selected, deltaX, deltaY);
}

export type DistributeAxis = "horizontal" | "vertical";

/** Evenly space object centers along an axis (needs 3+). */
export function computeDistributionPatches(
  objects: WallSceneObject[],
  selectedIds: string[],
  axis: DistributeAxis,
): PositionPatch[] {
  const selected = objects.filter((object) => selectedIds.includes(object.id));
  if (selected.length < 3) return [];

  const ranked = selected.map((object) => ({
    object,
    ext: getSceneObjectExtents(object),
  }));

  if (axis === "horizontal") {
    ranked.sort(
      (a, b) => (a.ext.minX + a.ext.maxX) / 2 - (b.ext.minX + b.ext.maxX) / 2,
    );
  } else {
    ranked.sort(
      (a, b) => (a.ext.minY + a.ext.maxY) / 2 - (b.ext.minY + b.ext.maxY) / 2,
    );
  }

  const first = ranked[0];
  const last = ranked[ranked.length - 1];
  const patches: PositionPatch[] = [];

  if (axis === "horizontal") {
    const startCenter = (first.ext.minX + first.ext.maxX) / 2;
    const endCenter = (last.ext.minX + last.ext.maxX) / 2;

    for (let i = 1; i < ranked.length - 1; i++) {
      const { object, ext } = ranked[i];
      const currentCenter = (ext.minX + ext.maxX) / 2;
      const targetCenter =
        startCenter + ((endCenter - startCenter) * i) / (ranked.length - 1);
      const deltaX = targetCenter - currentCenter;
      if (deltaX !== 0) {
        patches.push({ id: object.id, x: object.x + deltaX, y: object.y });
      }
    }
    return patches;
  }

  const startCenter = (first.ext.minY + first.ext.maxY) / 2;
  const endCenter = (last.ext.minY + last.ext.maxY) / 2;

  for (let i = 1; i < ranked.length - 1; i++) {
    const { object, ext } = ranked[i];
    const currentCenter = (ext.minY + ext.maxY) / 2;
    const targetCenter =
      startCenter + ((endCenter - startCenter) * i) / (ranked.length - 1);
    const deltaY = targetCenter - currentCenter;
    if (deltaY !== 0) {
      patches.push({ id: object.id, x: object.x, y: object.y + deltaY });
    }
  }

  return patches;
}

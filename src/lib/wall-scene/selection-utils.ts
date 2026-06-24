import { boundsIntersect, getSceneObjectExtents } from "@/lib/wall-bounds";
import { getSelectableObjectIds, isCanvasSelectableObject } from "@/lib/wall-scene/selectable-objects";
import type { WallSceneObject } from "@/types/wall-scene-v2";

export function primarySelectedId(selectedIds: string[]): string | null {
  return selectedIds.length > 0 ? selectedIds[selectedIds.length - 1] : null;
}

export function normalizeSelectedIds(
  ids: string[],
  objects: WallSceneObject[],
): string[] {
  const valid = new Set(objects.map((object) => object.id));
  const unique: string[] = [];
  for (const id of ids) {
    if (!valid.has(id) || unique.includes(id)) continue;
    unique.push(id);
  }
  return unique;
}

export function objectsInMarquee(
  objects: WallSceneObject[],
  marquee: { minX: number; minY: number; maxX: number; maxY: number },
): string[] {
  return objects
    .filter((object) => {
      if (!isCanvasSelectableObject(object)) return false;
      return boundsIntersect(getSceneObjectExtents(object), marquee);
    })
    .map((object) => object.id);
}

export function allSelectableIds(objects: WallSceneObject[]): string[] {
  return getSelectableObjectIds(objects);
}

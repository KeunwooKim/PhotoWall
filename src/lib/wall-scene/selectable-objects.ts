import type { WallSceneObject } from "@/types/wall-scene-v2";
import { isStraightHighlighterPath } from "@/lib/wall-scene/highlighter";

const SELECTABLE_TYPES = new Set<WallSceneObject["type"]>([
  "photo",
  "sticker",
  "emoji",
  "tape",
  "path",
]);

/** Objects the user can select (marquee, select-all, delete). */
export function isSelectableObject(object: WallSceneObject): boolean {
  return SELECTABLE_TYPES.has(object.type);
}

export function isCanvasSelectableObject(object: WallSceneObject): boolean {
  return isSelectableObject(object);
}

export function isTransformableObject(object: WallSceneObject): boolean {
  return object.type !== "path";
}

/** 형광펜 직선 — 이동만 가능, 크기 조절 불가 */
export function isMovableHighlighterObject(object: WallSceneObject): boolean {
  return object.type === "path" && isStraightHighlighterPath(object.points);
}

export function getSelectableObjectIds(objects: WallSceneObject[]): string[] {
  return objects.filter(isSelectableObject).map((object) => object.id);
}

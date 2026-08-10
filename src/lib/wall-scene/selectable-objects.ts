import type { WallSceneObject } from "@/types/wall-scene-v2";
import { isStraightHighlighterPath } from "@/lib/wall-scene/highlighter";

const SELECTABLE_TYPES = new Set<WallSceneObject["type"]>([
  "photo",
  "sticker",
  "emoji",
  "text",
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

/**
 * Resize / rotate transformer (photo, sticker, emoji, text).
 * Tape + pen paths are move-only — see isMoveOnlyObject.
 */
export function isTransformableObject(object: WallSceneObject): boolean {
  return (
    object.type === "photo" ||
    object.type === "sticker" ||
    object.type === "emoji" ||
    object.type === "text"
  );
}

/** Straight masking-tape stroke — move only, no resize */
export function isMovableHighlighterObject(object: WallSceneObject): boolean {
  return object.type === "path" && isStraightHighlighterPath(object.points);
}

/** Tape (legacy rect or path stroke) — selection frame + drag, no resize handles. */
export function isMoveOnlyObject(object: WallSceneObject): boolean {
  if (object.type === "tape") return true;
  if (object.type !== "path") return false;
  return (
    object.tool === "tape" ||
    (object.tool !== "pen" && isStraightHighlighterPath(object.points))
  );
}

export function getSelectableObjectIds(objects: WallSceneObject[]): string[] {
  return objects.filter(isSelectableObject).map((object) => object.id);
}

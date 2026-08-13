import { flipPhotoDecorations } from "@/lib/photo-frames/layout";
import { isTransformableObject } from "@/lib/wall-scene/selectable-objects";
import { estimateTextBlockHeight } from "@/lib/wall-scene/text-content";
import type { PhotoDecoration, WallSceneObject } from "@/types/wall-scene-v2";

export interface FlipPatch {
  id: string;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  decorations?: PhotoDecoration[];
}

export type FlipAxis = "horizontal" | "vertical";

function flipDimensions(object: WallSceneObject): { width: number; height: number } | null {
  const scaleX = object.scaleX ?? 1;
  const scaleY = object.scaleY ?? 1;

  if (
    object.type === "photo" ||
    object.type === "svg" ||
    object.type === "sticker" ||
    object.type === "tape"
  ) {
    return {
      width: object.width * scaleX,
      height: object.height * scaleY,
    };
  }

  if (object.type === "emoji") {
    return {
      width: object.fontSize * scaleX,
      height: object.fontSize * scaleY,
    };
  }

  if (object.type === "text") {
    return {
      width: object.width * scaleX,
      height: estimateTextBlockHeight(object) * scaleY,
    };
  }

  return null;
}

/** Flip selected objects around their visual center (scaleX/scaleY sign flip). */
export function computeFlipPatches(
  objects: WallSceneObject[],
  selectedIds: string[],
  axis: FlipAxis,
): FlipPatch[] {
  const patches: FlipPatch[] = [];

  for (const id of selectedIds) {
    const object = objects.find((item) => item.id === id);
    if (!object || !isTransformableObject(object)) continue;

    const dims = flipDimensions(object);
    if (!dims) continue;

    const flippedDecos =
      object.type === "photo" ? flipPhotoDecorations(object.decorations, axis) : undefined;

    if (axis === "horizontal") {
      const nextScaleX = -(object.scaleX ?? 1);
      patches.push({
        id: object.id,
        scaleX: nextScaleX,
        x: object.x + dims.width,
        ...(flippedDecos ? { decorations: flippedDecos } : {}),
      });
      continue;
    }

    const nextScaleY = -(object.scaleY ?? 1);
    patches.push({
      id: object.id,
      scaleY: nextScaleY,
      y: object.y + dims.height,
      ...(flippedDecos ? { decorations: flippedDecos } : {}),
    });
  }

  return patches;
}

import type { WallSceneObject } from "@/types/wall-scene-v2";
import { getSceneObjectExtents } from "@/lib/wall-bounds";
import { estimateTextBlockHeight } from "@/lib/wall-scene/text-content";

export function getObjectDisplayDimensions(
  object: WallSceneObject,
): { width: number; height: number } | null {
  const scaleX = object.scaleX ?? 1;
  const scaleY = object.scaleY ?? 1;

  if (
    object.type === "photo" ||
    object.type === "sticker" ||
    object.type === "svg" ||
    object.type === "tape"
  ) {
    return {
      width: Math.round(object.width * scaleX),
      height: Math.round(object.height * scaleY),
    };
  }

  if (object.type === "text") {
    return {
      width: Math.round(object.width * scaleX),
      height: Math.round(estimateTextBlockHeight(object) * scaleY),
    };
  }

  if (object.type === "emoji") {
    const size = object.fontSize * Math.max(scaleX, scaleY);
    return { width: Math.round(size), height: Math.round(size) };
  }

  if (object.type === "path") {
    const ext = getSceneObjectExtents(object);
    return {
      width: Math.round(ext.maxX - ext.minX),
      height: Math.round(ext.maxY - ext.minY),
    };
  }

  return null;
}

export function objectSupportsSizeEdit(object: WallSceneObject): boolean {
  return (
    object.type === "photo" ||
    object.type === "sticker" ||
    object.type === "tape" ||
    object.type === "text"
  );
}

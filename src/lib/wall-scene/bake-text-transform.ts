import type { WallSceneText } from "@/types/wall-scene-v2";

export const TEXT_BOX_MIN_WIDTH = 40;
export const TEXT_BOX_MIN_FONT_SIZE = 10;

/** How to convert live scale back into text layout props. */
export type TextTransformBakeMode = "uniform" | "width" | "height" | "axes";

/**
 * Bake transform scale into text `width` / `fontSize` and reset scale magnitudes to 1.
 * - width: horizontal edge — wrap width only
 * - height: vertical edge — font size only
 * - uniform: corner — both by the same factor
 * - axes: free (Konva) — width from scaleX, fontSize from scaleY
 */
export function bakeTextTransformScale(
  object: WallSceneText,
  scaleX: number,
  scaleY: number,
  mode: TextTransformBakeMode,
): Pick<WallSceneText, "width" | "fontSize" | "scaleX" | "scaleY"> {
  const signX = Math.sign(scaleX) || 1;
  const signY = Math.sign(scaleY) || 1;
  const absX = Math.abs(scaleX) || 1;
  const absY = Math.abs(scaleY) || 1;

  if (mode === "width") {
    return {
      width: Math.max(TEXT_BOX_MIN_WIDTH, Math.round(object.width * absX)),
      fontSize: object.fontSize,
      scaleX: signX,
      scaleY,
    };
  }

  if (mode === "height") {
    return {
      width: object.width,
      fontSize: Math.max(TEXT_BOX_MIN_FONT_SIZE, Math.round(object.fontSize * absY)),
      scaleX,
      scaleY: signY,
    };
  }

  if (mode === "uniform") {
    const factor = absX;
    return {
      width: Math.max(TEXT_BOX_MIN_WIDTH, Math.round(object.width * factor)),
      fontSize: Math.max(TEXT_BOX_MIN_FONT_SIZE, Math.round(object.fontSize * factor)),
      scaleX: signX,
      scaleY: signY,
    };
  }

  return {
    width: Math.max(TEXT_BOX_MIN_WIDTH, Math.round(object.width * absX)),
    fontSize: Math.max(TEXT_BOX_MIN_FONT_SIZE, Math.round(object.fontSize * absY)),
    scaleX: signX,
    scaleY: signY,
  };
}

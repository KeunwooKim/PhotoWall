/** Selection / peer chrome thickness in CSS pixels (camera-independent). */
export const SELECTION_STROKE_SCREEN_PX = 2.75;
export const SELECTION_HANDLE_SCREEN_PX = 12;

/** Convert screen-pixel stroke to wall/world units for the current camera scale. */
export function selectionStrokeWallPx(viewScale: number): number {
  return SELECTION_STROKE_SCREEN_PX / Math.max(viewScale, 0.05);
}

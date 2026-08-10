/** Initial on-wall size when placing a photo (upload / QR / scan). */
export const PHOTO_PLACE_MAX_WIDTH = 400;
/** Cap as a fraction of current wall width so huge walls don't get tiny stamps. */
export const PHOTO_PLACE_WALL_FRACTION = 0.7;

export function photoPlacementSize(
  naturalWidth: number,
  naturalHeight: number,
  wallWidth: number,
): { width: number; height: number } {
  const maxWidth = Math.min(
    PHOTO_PLACE_MAX_WIDTH,
    Math.max(1, wallWidth * PHOTO_PLACE_WALL_FRACTION),
  );
  const scale = Math.min(1, maxWidth / Math.max(1, naturalWidth));
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

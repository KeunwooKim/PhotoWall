import type { PhotoCropRect, WallScenePhoto } from "@/types/wall-scene-v2";

export const CROP_ASPECT_PRESETS = [
  { id: "free", label: "자유", ratio: null },
  { id: "1:1", label: "1:1", ratio: 1 },
  { id: "3:4", label: "3:4", ratio: 3 / 4 },
  { id: "4:3", label: "4:3", ratio: 4 / 3 },
] as const;

export type CropAspectPresetId = (typeof CROP_ASPECT_PRESETS)[number]["id"];

export function fullSourceCrop(naturalWidth: number, naturalHeight: number): PhotoCropRect {
  return { x: 0, y: 0, width: naturalWidth, height: naturalHeight };
}

export function effectiveSourceCrop(
  photo: WallScenePhoto,
  naturalWidth: number,
  naturalHeight: number,
): PhotoCropRect {
  if (photo.crop) {
    return clampCropToSource(photo.crop, naturalWidth, naturalHeight);
  }
  return fullSourceCrop(naturalWidth, naturalHeight);
}

export function clampCropToSource(
  crop: PhotoCropRect,
  naturalWidth: number,
  naturalHeight: number,
): PhotoCropRect {
  const x = Math.max(0, Math.min(crop.x, naturalWidth - 1));
  const y = Math.max(0, Math.min(crop.y, naturalHeight - 1));
  const width = Math.max(1, Math.min(crop.width, naturalWidth - x));
  const height = Math.max(1, Math.min(crop.height, naturalHeight - y));
  return { x, y, width, height };
}

/** Map a crop rectangle in display space (photo.width × photo.height) to source pixels. */
export function displayCropToSource(
  display: { x: number; y: number; width: number; height: number },
  photo: WallScenePhoto,
  naturalWidth: number,
  naturalHeight: number,
): PhotoCropRect {
  const visible = effectiveSourceCrop(photo, naturalWidth, naturalHeight);
  const crop: PhotoCropRect = {
    x: visible.x + (display.x / photo.width) * visible.width,
    y: visible.y + (display.y / photo.height) * visible.height,
    width: (display.width / photo.width) * visible.width,
    height: (display.height / photo.height) * visible.height,
  };
  return clampCropToSource(crop, naturalWidth, naturalHeight);
}

export function defaultDisplayCrop(photo: WallScenePhoto): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return { x: 0, y: 0, width: photo.width, height: photo.height };
}

/** Crop overlay in display space — full photo bounds. */
export function initialCropDisplay(photo: WallScenePhoto): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return defaultDisplayCrop(photo);
}

/** Display size after crop so the image is not stretched into the old frame. */
export function displaySizeAfterSourceCrop(
  photo: WallScenePhoto,
  sourceCrop: PhotoCropRect,
  naturalWidth: number,
  naturalHeight: number,
  minSize = 24,
): { width: number; height: number } {
  const visible = effectiveSourceCrop(photo, naturalWidth, naturalHeight);
  const scaleX = photo.width / visible.width;
  const scaleY = photo.height / visible.height;
  return {
    width: Math.max(minSize, sourceCrop.width * scaleX),
    height: Math.max(minSize, sourceCrop.height * scaleY),
  };
}

export function clampDisplayCrop(
  box: { x: number; y: number; width: number; height: number },
  photo: WallScenePhoto,
  minSize = 24,
): { x: number; y: number; width: number; height: number } {
  return clampCropInBounds(
    box,
    { x: 0, y: 0, width: photo.width, height: photo.height },
    minSize,
  );
}

export function clampCropInBounds(
  box: { x: number; y: number; width: number; height: number },
  bounds: { x: number; y: number; width: number; height: number },
  minSize = 24,
): { x: number; y: number; width: number; height: number } {
  let { x, y, width, height } = box;
  width = Math.max(minSize, Math.min(width, bounds.width));
  height = Math.max(minSize, Math.min(height, bounds.height));
  x = Math.max(bounds.x, Math.min(x, bounds.x + bounds.width - width));
  y = Math.max(bounds.y, Math.min(y, bounds.y + bounds.height - height));
  width = Math.min(width, bounds.x + bounds.width - x);
  height = Math.min(height, bounds.y + bounds.height - y);
  return { x, y, width, height };
}

export interface CropRecoveryLayout {
  scaleX: number;
  scaleY: number;
  offsetX: number;
  offsetY: number;
  fullWidth: number;
  fullHeight: number;
  frameWidth: number;
  frameHeight: number;
  /** Original image extends beyond the current frame — recovery UI is available. */
  hasRecovery: boolean;
}

/** Map full source image into crop-edit space so cropped-away regions can be restored. */
export function cropRecoveryLayout(
  photo: WallScenePhoto,
  naturalWidth: number,
  naturalHeight: number,
): CropRecoveryLayout {
  const visible = effectiveSourceCrop(photo, naturalWidth, naturalHeight);
  const scaleX = photo.width / visible.width;
  const scaleY = photo.height / visible.height;
  const offsetX = -visible.x * scaleX;
  const offsetY = -visible.y * scaleY;
  const fullWidth = naturalWidth * scaleX;
  const fullHeight = naturalHeight * scaleY;
  const hasRecovery =
    visible.x > 0 ||
    visible.y > 0 ||
    visible.width < naturalWidth - 0.5 ||
    visible.height < naturalHeight - 0.5;

  return {
    scaleX,
    scaleY,
    offsetX,
    offsetY,
    fullWidth,
    fullHeight,
    frameWidth: photo.width,
    frameHeight: photo.height,
    hasRecovery,
  };
}

export function recoveryCropBounds(layout: CropRecoveryLayout): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return {
    x: layout.offsetX,
    y: layout.offsetY,
    width: layout.fullWidth,
    height: layout.fullHeight,
  };
}

export function largestAspectCropInRecovery(
  layout: CropRecoveryLayout,
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  const box = largestAspectCropInBounds(layout.fullWidth, layout.fullHeight, aspect);
  return {
    x: layout.offsetX + box.x,
    y: layout.offsetY + box.y,
    width: box.width,
    height: box.height,
  };
}

/** Photo position after crop — transform local display offset by rotation/scale. */
export function photoPositionAfterDisplayCrop(
  photo: WallScenePhoto,
  display: { x: number; y: number },
  sessionStart: { x: number; y: number } = { x: 0, y: 0 },
): { x: number; y: number } {
  const localX =
    Math.abs(display.x - sessionStart.x) < 0.5 ? 0 : display.x - sessionStart.x;
  const localY =
    Math.abs(display.y - sessionStart.y) < 0.5 ? 0 : display.y - sessionStart.y;
  if (localX === 0 && localY === 0) {
    return { x: photo.x, y: photo.y };
  }

  const sx = photo.scaleX ?? 1;
  const sy = photo.scaleY ?? 1;
  const rad = (photo.rotation * Math.PI) / 180;
  const scaledX = localX * sx;
  const scaledY = localY * sy;

  return {
    x: photo.x + scaledX * Math.cos(rad) - scaledY * Math.sin(rad),
    y: photo.y + scaledX * Math.sin(rad) + scaledY * Math.cos(rad),
  };
}

/** Largest crop rect with the given aspect ratio inside display bounds. */
export function largestAspectCropInPhoto(
  photo: WallScenePhoto,
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  return largestAspectCropInBounds(photo.width, photo.height, aspect);
}

export function largestAspectCropInBounds(
  maxWidth: number,
  maxHeight: number,
  aspect: number,
): { x: number; y: number; width: number; height: number } {
  let width = maxWidth;
  let height = width / aspect;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspect;
  }
  return {
    x: (maxWidth - width) / 2,
    y: (maxHeight - height) / 2,
    width,
    height,
  };
}

/** Fit aspect ratio to the full photo bounds (not the current crop selection). */
export function applyAspectRatio(
  _box: { x: number; y: number; width: number; height: number },
  aspect: number,
  maxWidth: number,
  maxHeight: number,
): { x: number; y: number; width: number; height: number } {
  return largestAspectCropInBounds(maxWidth, maxHeight, aspect);
}

export function hasPhotoCrop(photo: WallScenePhoto): boolean {
  return photo.crop != null;
}

export function resetPhotoCrop(photo: WallScenePhoto): Partial<WallScenePhoto> {
  return { crop: undefined };
}

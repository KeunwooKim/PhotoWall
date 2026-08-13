import type { PhotoCropRect, WallSceneFourCut, WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";
import { getFourCutSkin } from "./catalog";

function isCropRect(value: unknown): value is PhotoCropRect {
  if (!value || typeof value !== "object") return false;
  const rect = value as PhotoCropRect;
  return (
    Number.isFinite(rect.x) &&
    Number.isFinite(rect.y) &&
    Number.isFinite(rect.width) &&
    Number.isFinite(rect.height) &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function sanitizeWindows(value: unknown): WallSceneFourCut["windows"] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;
  if (!value.every(isCropRect)) return null;
  return value as WallSceneFourCut["windows"];
}

export function sanitizeFourCutFields(object: WallSceneObject): WallSceneObject {
  if (object.type !== "photo") return object;
  const photo = object as WallScenePhoto;
  if (photo.fourCut == null) return object;

  const raw = photo.fourCut as WallSceneFourCut;
  const layout = raw.layout === "grid2x2" || raw.layout === "stack4" ? raw.layout : null;
  const windows = sanitizeWindows(raw.windows);
  if (!layout || !windows) {
    const next: WallScenePhoto = { ...photo };
    delete next.fourCut;
    return next;
  }

  let skinId = typeof raw.skinId === "string" ? raw.skinId.trim() : raw.skinId;
  if (skinId) {
    const skin = getFourCutSkin(skinId);
    if (!skin || skin.layout !== layout) skinId = null;
  } else if (skinId !== null) {
    skinId = undefined;
  }

  const nextFourCut: WallSceneFourCut = { layout, windows };
  if (skinId !== undefined) nextFourCut.skinId = skinId;
  if (raw.base && isCropRect(raw.base)) {
    nextFourCut.base = {
      x: raw.base.x,
      y: raw.base.y,
      width: raw.base.width,
      height: raw.base.height,
    };
  }

  const prev = photo.fourCut;
  if (
    prev.layout === nextFourCut.layout &&
    prev.skinId === nextFourCut.skinId &&
    prev.windows === nextFourCut.windows &&
    prev.base?.x === nextFourCut.base?.x &&
    prev.base?.y === nextFourCut.base?.y &&
    prev.base?.width === nextFourCut.base?.width &&
    prev.base?.height === nextFourCut.base?.height
  ) {
    return object;
  }

  return { ...photo, fourCut: nextFourCut };
}

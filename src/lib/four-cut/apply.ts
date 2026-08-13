import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { getFourCutSkin } from "./catalog";
import type { ApplyFourCutSkinResult } from "./types";

function photoById(photoId: string): WallScenePhoto | null {
  const object = useWallSceneStore.getState().document.objects.find((item) => item.id === photoId);
  if (!object || object.type !== "photo") return null;
  return object;
}

function commitPhoto(next: WallScenePhoto): void {
  const store = useWallSceneStore.getState();
  store.recordHistory();
  store.upsertObject(next);
  store.bumpRevision();
}

function resizeToAspect(photo: WallScenePhoto, aspect: number): { x: number; y: number; width: number; height: number } {
  const area = Math.max(1, photo.width * photo.height);
  const height = Math.sqrt(area / Math.max(0.05, aspect));
  const width = height * aspect;
  const cx = photo.x + photo.width / 2;
  const cy = photo.y + photo.height / 2;
  return {
    x: cx - width / 2,
    y: cy - height / 2,
    width,
    height,
  };
}

export function applyFourCutSkin(
  photoId: string,
  skinId: string | null,
): ApplyFourCutSkinResult {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";
  if (!photo.fourCut) return "not-four-cut";

  if (!skinId) {
    const next: WallScenePhoto = {
      ...photo,
      fourCut: { ...photo.fourCut, skinId: null },
    };
    commitPhoto(next);
    return "ok";
  }

  const skin = getFourCutSkin(skinId);
  if (!skin) return "unknown-skin";
  if (skin.layout !== photo.fourCut.layout) return "layout-mismatch";

  const box = resizeToAspect(photo, skin.aspect);
  const next: WallScenePhoto = {
    ...photo,
    ...box,
    fourCut: { ...photo.fourCut, skinId: skin.id },
  };
  delete next.frameId;
  commitPhoto(next);
  return "ok";
}

export function clearFourCutSkin(photoId: string): ApplyFourCutSkinResult {
  return applyFourCutSkin(photoId, null);
}

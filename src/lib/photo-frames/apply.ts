import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoFrame } from "./catalog";

export type ApplyPhotoDecorResult = "ok" | "not-photo" | "unknown-frame";

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

export function applyPhotoFrame(photoId: string, frameId: string | null): ApplyPhotoDecorResult {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";
  if (frameId && !getPhotoFrame(frameId)) return "unknown-frame";
  const next: WallScenePhoto = { ...photo };
  if (frameId) next.frameId = frameId;
  else delete next.frameId;
  if (frameId && next.fourCut?.skinId) {
    if (next.fourCut.base) {
      next.x = next.fourCut.base.x;
      next.y = next.fourCut.base.y;
      next.width = next.fourCut.base.width;
      next.height = next.fourCut.base.height;
    }
    next.fourCut = { layout: next.fourCut.layout, windows: next.fourCut.windows };
  }
  commitPhoto(next);
  return "ok";
}

export function clearPhotoFrame(photoId: string): ApplyPhotoDecorResult {
  return applyPhotoFrame(photoId, null);
}

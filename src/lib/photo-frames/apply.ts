import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoDeco } from "@/lib/photo-decos/catalog";
import { getPhotoFrame } from "./catalog";

export type ApplyPhotoDecorResult = "ok" | "not-photo" | "unknown-frame" | "unknown-deco";

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
  commitPhoto(next);
  return "ok";
}

export function applyPhotoDeco(photoId: string, decoId: string | null): ApplyPhotoDecorResult {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";
  if (decoId && !getPhotoDeco(decoId)) return "unknown-deco";
  const next: WallScenePhoto = { ...photo };
  if (decoId) next.decoId = decoId;
  else delete next.decoId;
  delete (next as { decorations?: unknown }).decorations;
  commitPhoto(next);
  return "ok";
}

export function clearPhotoFrame(photoId: string): ApplyPhotoDecorResult {
  return applyPhotoFrame(photoId, null);
}

export function clearPhotoDeco(photoId: string): ApplyPhotoDecorResult {
  return applyPhotoDeco(photoId, null);
}

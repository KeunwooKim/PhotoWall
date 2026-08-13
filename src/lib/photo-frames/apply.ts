import { ensureStickersForIds } from "@/lib/stickers";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PhotoDecoSlot, PhotoDecoration, WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoFrame } from "./catalog";
import { nextPhotoDecoSlot } from "./layout";

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
  commitPhoto(next);
  return "ok";
}

export function applyPhotoDecoration(
  photoId: string,
  stickerId: string,
  slot?: PhotoDecoSlot,
): ApplyPhotoDecorResult {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";
  void ensureStickersForIds([stickerId]);
  const resolvedSlot = nextPhotoDecoSlot(photo.decorations, slot);
  const deco: PhotoDecoration = { stickerId, slot: resolvedSlot };
  const rest = (photo.decorations ?? []).filter((item) => item.slot !== resolvedSlot);
  const next: WallScenePhoto = { ...photo, decorations: [...rest, deco] };
  commitPhoto(next);
  return "ok";
}

export function clearPhotoDecorations(photoId: string): ApplyPhotoDecorResult {
  const photo = photoById(photoId);
  if (!photo) return "not-photo";
  if (!photo.decorations?.length) return "ok";
  const next: WallScenePhoto = { ...photo };
  delete next.decorations;
  commitPhoto(next);
  return "ok";
}

export function clearPhotoFrame(photoId: string): ApplyPhotoDecorResult {
  return applyPhotoFrame(photoId, null);
}

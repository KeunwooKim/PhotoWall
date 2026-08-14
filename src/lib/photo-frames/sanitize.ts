import type { WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoFrame } from "./catalog";

function sanitizeFrameId(value: string | undefined): { next?: string; changed: boolean } {
  if (value == null) return { changed: false };
  if (typeof value !== "string" || !value.trim()) return { next: undefined, changed: true };
  const trimmed = value.trim();
  if (!getPhotoFrame(trimmed)) return { next: undefined, changed: true };
  return { next: trimmed, changed: trimmed !== value };
}

/** Drops unknown frame ids and leftover deco/corner fields. */
export function sanitizePhotoDecorFields(object: WallSceneObject): WallSceneObject {
  if (object.type !== "photo") return object;
  const photo = object as WallScenePhoto & { decoId?: unknown; decorations?: unknown };
  const frame = sanitizeFrameId(photo.fourCut ? undefined : photo.frameId);
  const dropLegacy = photo.decoId != null || photo.decorations != null;
  const dropFourCutFrame = Boolean(photo.fourCut && photo.frameId);
  if (!frame.changed && !dropLegacy && !dropFourCutFrame) return object;
  const next: WallScenePhoto = { ...photo };
  if (frame.next) next.frameId = frame.next;
  else delete next.frameId;
  delete (next as { decoId?: unknown }).decoId;
  delete (next as { decorations?: unknown }).decorations;
  return next;
}

import type { WallSceneObject, WallScenePhoto } from "@/types/wall-scene-v2";
import { getPhotoDeco } from "@/lib/photo-decos/catalog";
import { getPhotoFrame } from "./catalog";

function sanitizeId(
  value: string | undefined,
  exists: (id: string) => boolean,
): { next?: string; changed: boolean } {
  if (value == null) return { changed: false };
  if (typeof value !== "string" || !value.trim()) return { next: undefined, changed: true };
  const trimmed = value.trim();
  if (!exists(trimmed)) return { next: undefined, changed: true };
  return { next: trimmed, changed: trimmed !== value };
}

/** Drops unknown catalog ids. Legacy corner `decorations` are stripped. */
export function sanitizePhotoDecorFields(object: WallSceneObject): WallSceneObject {
  if (object.type !== "photo") return object;
  const photo = object as WallScenePhoto;
  const frame = sanitizeId(photo.frameId, (id) => !!getPhotoFrame(id));
  const deco = sanitizeId(photo.decoId, (id) => !!getPhotoDeco(id));
  const dropLegacy = "decorations" in photo;
  if (!frame.changed && !deco.changed && !dropLegacy) return object;
  const next: WallScenePhoto = { ...photo };
  if (frame.next) next.frameId = frame.next;
  else delete next.frameId;
  if (deco.next) next.decoId = deco.next;
  else delete next.decoId;
  delete (next as { decorations?: unknown }).decorations;
  return next;
}

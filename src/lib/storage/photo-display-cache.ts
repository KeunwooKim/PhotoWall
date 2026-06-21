import { isWallPhotoRef } from "@/lib/storage/wall-photos";

/** In-memory display URLs for wall-photo refs (blob/signed). Not persisted. */
const displayUrlByRef = new Map<string, string>();

export function getCachedPhotoDisplayUrl(ref: string): string | null {
  if (!isWallPhotoRef(ref)) return null;
  return displayUrlByRef.get(ref) ?? null;
}

export function cachePhotoDisplayUrl(ref: string, url: string): void {
  if (!isWallPhotoRef(ref) || !url || isWallPhotoRef(url)) return;
  displayUrlByRef.set(ref, url);
}

export function collectWallPhotoRefsFromScene(objects: { type: string; src?: string }[]): string[] {
  const refs = new Set<string>();
  for (const obj of objects) {
    if (obj.type === "photo" && typeof obj.src === "string" && isWallPhotoRef(obj.src)) {
      refs.add(obj.src);
    }
  }
  return [...refs];
}

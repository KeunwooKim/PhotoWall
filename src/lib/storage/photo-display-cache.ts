import { isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";

/** In-memory display URLs for wall-photo / guest-photo refs (blob/signed). Not persisted. */
const displayUrlByRef = new Map<string, string>();

function isPhotoRef(src: string): boolean {
  return isWallPhotoRef(src) || isGuestPhotoRef(src);
}

export function getCachedPhotoDisplayUrl(ref: string): string | null {
  if (!isPhotoRef(ref)) return null;
  return displayUrlByRef.get(ref) ?? null;
}

export function cachePhotoDisplayUrl(ref: string, url: string): void {
  if (!isPhotoRef(ref) || !url || isPhotoRef(url)) return;
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

export function collectGuestPhotoRefsFromScene(objects: { type: string; src?: string }[]): string[] {
  const refs = new Set<string>();
  for (const obj of objects) {
    if (obj.type === "photo" && typeof obj.src === "string" && isGuestPhotoRef(obj.src)) {
      refs.add(obj.src);
    }
  }
  return [...refs];
}

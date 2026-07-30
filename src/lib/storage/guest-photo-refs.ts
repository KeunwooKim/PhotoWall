/** Guest photo refs — blobs live in IndexedDB, not localStorage. */
export const GUEST_PHOTO_REF_PREFIX = "guest-photo://";

export function toGuestPhotoRef(id: string): string {
  return `${GUEST_PHOTO_REF_PREFIX}${id}`;
}

export function isGuestPhotoRef(src: string): boolean {
  return src.startsWith(GUEST_PHOTO_REF_PREFIX);
}

export function guestPhotoRefToId(ref: string): string | null {
  if (!isGuestPhotoRef(ref)) return null;
  const id = ref.slice(GUEST_PHOTO_REF_PREFIX.length).trim();
  return id.length > 0 ? id : null;
}

export function isDataImageUrl(src: string): boolean {
  return src.startsWith("data:image/");
}

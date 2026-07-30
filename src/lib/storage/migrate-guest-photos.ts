import type { WallSceneDocument, WallSceneObject } from "@/types/wall-scene-v2";
import { isDataImageUrl, isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import {
  dataUrlToBlob,
  deleteGuestPhoto,
  getGuestPhotoBlob,
  pruneOrphanGuestPhotos,
  putGuestPhoto,
} from "@/lib/storage/guest-photos";
import { uploadWallPhoto } from "@/lib/storage/upload-photo";
import { collectGuestPhotoRefsFromScene } from "@/lib/storage/photo-display-cache";
import type { UserPlan } from "@/lib/wall-quotas";

export function documentHasUploadableLocalPhotos(doc: WallSceneDocument): boolean {
  return doc.objects.some(
    (o) =>
      o.type === "photo" &&
      typeof o.src === "string" &&
      (isGuestPhotoRef(o.src) || isDataImageUrl(o.src)),
  );
}

function mapPhotoSrc(
  objects: WallSceneObject[],
  mapSrc: (src: string) => string | Promise<string>,
): Promise<WallSceneObject[]> {
  return Promise.all(
    objects.map(async (obj) => {
      if (obj.type !== "photo" || typeof obj.src !== "string") return obj;
      const next = await mapSrc(obj.src);
      return next === obj.src ? obj : { ...obj, src: next };
    }),
  );
}

/** Rewrite guest-photo:// (and leftover data URLs) to wall-photo:// via Storage upload. */
export async function migrateGuestPhotosInDocument(
  doc: WallSceneDocument,
  userId: string,
  plan: UserPlan = "free",
): Promise<{ document: WallSceneDocument; migrated: number; failed: number }> {
  let migrated = 0;
  let failed = 0;
  const uploadedGuestRefs: string[] = [];

  const objects = await mapPhotoSrc(doc.objects, async (src) => {
    if (isGuestPhotoRef(src)) {
      const blob = await getGuestPhotoBlob(src);
      if (!blob) {
        failed += 1;
        return src;
      }
      try {
        const ref = await uploadWallPhoto(blob, userId, plan, "guest.jpg");
        uploadedGuestRefs.push(src);
        migrated += 1;
        return ref;
      } catch {
        failed += 1;
        return src;
      }
    }

    if (isDataImageUrl(src)) {
      const blob = dataUrlToBlob(src);
      if (!blob) {
        failed += 1;
        return src;
      }
      try {
        const ref = await uploadWallPhoto(blob, userId, plan, "legacy.jpg");
        migrated += 1;
        return ref;
      } catch {
        failed += 1;
        return src;
      }
    }

    return src;
  });

  await Promise.all(uploadedGuestRefs.map((ref) => deleteGuestPhoto(ref)));

  return {
    document: { ...doc, objects },
    migrated,
    failed,
  };
}

/** Move embedded data:image photos into IndexedDB guest refs (legacy local walls). */
export async function migrateDataUrlsToGuestPhotos(
  doc: WallSceneDocument,
): Promise<{ document: WallSceneDocument; migrated: number }> {
  let migrated = 0;

  const objects = await mapPhotoSrc(doc.objects, async (src) => {
    if (!isDataImageUrl(src)) return src;
    const blob = dataUrlToBlob(src);
    if (!blob) return src;
    try {
      const ref = await putGuestPhoto(blob);
      migrated += 1;
      return ref;
    } catch {
      return src;
    }
  });

  if (migrated > 0) {
    const keep = collectGuestPhotoRefsFromScene(objects);
    await pruneOrphanGuestPhotos(keep).catch(() => {});
  }

  return {
    document: { ...doc, objects },
    migrated,
  };
}

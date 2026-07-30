import { cachePhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { resolvePhotoUrl } from "@/lib/storage/upload-photo";
import { isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";
import { canvasToJpegFile } from "@/lib/photo-scan/perspective";
import {
  applyColorAdjustToCanvas,
  imageToCanvas,
  isNeutralColorAdjust,
  type ColorAdjustParams,
} from "@/lib/photo-edit/color-adjust";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import type { UserPlan } from "@/lib/wall-quotas";

/**
 * Bake color adjustments into a new JPEG, upload/replace photo `src`.
 * Keeps natural dimensions so existing `crop` stays valid.
 */
export async function applyColorAdjustToWallPhoto(
  photo: WallScenePhoto,
  params: ColorAdjustParams,
  options: {
    displaySrc: string;
    userId?: string;
    plan?: UserPlan;
  },
): Promise<WallScenePhoto> {
  if (isNeutralColorAdjust(params)) {
    return photo;
  }

  const img = await loadHtmlImage(options.displaySrc);
  const canvas = imageToCanvas(img);
  applyColorAdjustToCanvas(canvas, params);

  let file = await canvasToJpegFile(canvas, 0.88, `color-${Date.now()}.jpg`);
  if (file.size > 6 * 1024 * 1024) {
    file = await canvasToJpegFile(canvas, 0.72, `color-${Date.now()}.jpg`);
  }

  const plan = options.plan ?? "free";
  const ref = await resolvePhotoUrl(file, options.userId, plan);

  if (isWallPhotoRef(ref) || isGuestPhotoRef(ref)) {
    cachePhotoDisplayUrl(ref, URL.createObjectURL(file));
  }

  const next: WallScenePhoto = {
    ...photo,
    src: ref,
  };

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(next);
  useWallSceneStore.getState().bumpRevision();
  return next;
}

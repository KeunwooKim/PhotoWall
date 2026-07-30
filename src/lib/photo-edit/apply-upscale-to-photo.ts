import { cachePhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { resolvePhotoUrl } from "@/lib/storage/upload-photo";
import { isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";
import { imageToCanvas } from "@/lib/photo-edit/color-adjust";
import { canvasToJpegFile } from "@/lib/photo-scan/perspective";
import { resampleCanvas } from "@/lib/photo-scan/resample";
import { clampCropToSource } from "@/lib/wall-scene/photo-crop";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { PhotoCropRect, WallScenePhoto } from "@/types/wall-scene-v2";
import type { UserPlan } from "@/lib/wall-quotas";

function scaleCropRect(crop: PhotoCropRect, scaleX: number, scaleY: number): PhotoCropRect {
  return {
    x: crop.x * scaleX,
    y: crop.y * scaleY,
    width: crop.width * scaleX,
    height: crop.height * scaleY,
  };
}

export type UpscaleWallPhotoResult =
  | { status: "applied"; photo: WallScenePhoto }
  | { status: "skipped"; reason: "already-max" }
  | { status: "error"; message: string };

/**
 * Upscale an already-placed wall photo (canvas high-quality resample),
 * remap crop to the new natural size, upload, and replace `src`.
 */
export async function applyUpscaleToWallPhoto(
  photo: WallScenePhoto,
  options: {
    displaySrc: string;
    userId?: string;
    plan?: UserPlan;
    scale?: number;
    maxSide?: number;
  },
): Promise<UpscaleWallPhotoResult> {
  try {
    const img = await loadHtmlImage(options.displaySrc);
    const source = imageToCanvas(img);
    const srcW = source.width;
    const srcH = source.height;

    const upscaled = resampleCanvas(source, {
      scale: options.scale ?? 1.5,
      maxSide: options.maxSide ?? 2400,
    });

    if (upscaled.width <= srcW + 1 && upscaled.height <= srcH + 1) {
      return { status: "skipped", reason: "already-max" };
    }

    const scaleX = upscaled.width / srcW;
    const scaleY = upscaled.height / srcH;

    let file = await canvasToJpegFile(upscaled, 0.88, `upscale-${Date.now()}.jpg`);
    if (file.size > 6 * 1024 * 1024) {
      file = await canvasToJpegFile(upscaled, 0.72, `upscale-${Date.now()}.jpg`);
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

    if (photo.crop) {
      next.crop = clampCropToSource(
        scaleCropRect(photo.crop, scaleX, scaleY),
        upscaled.width,
        upscaled.height,
      );
    }

    useWallSceneStore.getState().recordHistory();
    useWallSceneStore.getState().upsertObject(next);
    useWallSceneStore.getState().bumpRevision();
    return { status: "applied", photo: next };
  } catch (err) {
    return {
      status: "error",
      message: err instanceof Error ? err.message : "업스케일에 실패했어요",
    };
  }
}

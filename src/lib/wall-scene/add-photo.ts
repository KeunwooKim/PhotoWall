import { cachePhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { resolvePhotoUrl } from "@/lib/storage/upload-photo";
import { resolveWallPhotoSrc } from "@/lib/storage/resolve-wall-photos";
import { isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";
import { randomHomePlacementPosition } from "@/lib/wall-scene/wall-home-placement";
import { photoPlacementSize } from "@/lib/wall-scene/photo-placement";
import { detectFourCutFromImage } from "@/lib/four-cut/detect";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import type { UserPlan } from "@/lib/wall-quotas";

async function loadImageSize(src: string): Promise<{
  width: number;
  height: number;
  image: HTMLImageElement;
}> {
  const img = await loadHtmlImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight, image: img };
}

export type AddPhotoToWallResult = { fourCut: boolean };

export async function addPhotoToWallScene(
  file: File,
  options: {
    userId?: string;
    wallId: string;
    wallWidth: number;
    wallHeight: number;
    position?: { x: number; y: number };
    plan?: UserPlan;
  },
): Promise<AddPhotoToWallResult> {
  const plan = options.plan ?? "free";
  const ref = await resolvePhotoUrl(file, options.userId, plan);

  if (isWallPhotoRef(ref) || isGuestPhotoRef(ref)) {
    cachePhotoDisplayUrl(ref, URL.createObjectURL(file));
  }

  const displaySrc =
    isWallPhotoRef(ref) || isGuestPhotoRef(ref)
      ? await resolveWallPhotoSrc(ref, options.wallId)
      : ref;

  const { width: naturalW, height: naturalH, image } = await loadImageSize(displaySrc);
  const { width, height } = photoPlacementSize(naturalW, naturalH, options.wallWidth);

  const fallback = randomHomePlacementPosition(options.wallWidth, options.wallHeight);
  const x = options.position?.x ?? fallback.x;
  const y = options.position?.y ?? fallback.y;

  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, o) => Math.max(max, o.zIndex), 0);

  let fourCut = false;
  const photo: WallScenePhoto = {
    id: crypto.randomUUID(),
    type: "photo",
    x: x - width / 2,
    y: y - height / 2,
    rotation: options.position ? 0 : -8 + Math.random() * 16,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    src: ref,
    width,
    height,
  };

  try {
    const detected = detectFourCutFromImage(image);
    if (detected) {
      photo.fourCut = detected;
      fourCut = true;
    }
  } catch {
    // Keep as a normal photo.
  }

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(photo);
  useWallSceneStore.getState().setSelectedIds([photo.id]);
  useWallSceneStore.getState().bumpRevision();
  return { fourCut };
}

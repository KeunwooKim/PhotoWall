import { cachePhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { isGuestPhotoRef } from "@/lib/storage/guest-photo-refs";
import { dataUrlToBlob, putGuestPhoto } from "@/lib/storage/guest-photos";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { randomHomePlacementPosition } from "@/lib/wall-scene/wall-home-placement";
import { photoPlacementSize } from "@/lib/wall-scene/photo-placement";
import { detectFourCutFromImage } from "@/lib/four-cut/detect";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";
import type { AddPhotoToWallResult } from "@/lib/wall-scene/add-photo";

export async function addPhotoDataUrlToWallScene(
  dataUrl: string,
  options: {
    wallWidth: number;
    wallHeight: number;
    position?: { x: number; y: number };
  },
): Promise<AddPhotoToWallResult> {
  const blob = dataUrlToBlob(dataUrl);
  let src = dataUrl;
  let displaySrc = dataUrl;

  if (blob) {
    try {
      src = await putGuestPhoto(blob);
      displaySrc = URL.createObjectURL(blob);
      cachePhotoDisplayUrl(src, displaySrc);
    } catch {
      src = dataUrl;
      displaySrc = dataUrl;
    }
  }

  const image = await loadHtmlImage(displaySrc);
  const naturalW = image.naturalWidth;
  const naturalH = image.naturalHeight;

  const { width, height } = photoPlacementSize(naturalW, naturalH, options.wallWidth);

  const fallback = randomHomePlacementPosition(options.wallWidth, options.wallHeight);
  const x = options.position?.x ?? fallback.x;
  const y = options.position?.y ?? fallback.y;

  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, object) => Math.max(max, object.zIndex), 0);

  const photo: WallScenePhoto = {
    id: crypto.randomUUID(),
    type: "photo",
    x: x - width / 2,
    y: y - height / 2,
    rotation: options.position ? 0 : -8 + Math.random() * 16,
    scaleX: 1,
    scaleY: 1,
    zIndex: maxZ + 1,
    src: isGuestPhotoRef(src) ? src : dataUrl,
    width,
    height,
  };

  try {
    const detected = detectFourCutFromImage(image);
    if (detected) photo.fourCut = detected;
  } catch {
    // Keep as a normal photo.
  }

  useWallSceneStore.getState().recordHistory();
  useWallSceneStore.getState().upsertObject(photo);
  useWallSceneStore.getState().setSelectedIds([photo.id]);
  useWallSceneStore.getState().bumpRevision();
  return { fourCut: !!photo.fourCut };
}

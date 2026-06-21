import { cachePhotoDisplayUrl } from "@/lib/storage/photo-display-cache";
import { loadHtmlImage } from "@/lib/storage/load-html-image";
import { resolvePhotoUrl } from "@/lib/storage/upload-photo";
import { resolveWallPhotoSrc } from "@/lib/storage/resolve-wall-photos";
import { isWallPhotoRef } from "@/lib/storage/wall-photos";
import { useWallSceneStore } from "@/stores/wall-scene-store";
import type { WallScenePhoto } from "@/types/wall-scene-v2";

async function loadImageSize(src: string): Promise<{ width: number; height: number }> {
  const img = await loadHtmlImage(src);
  return { width: img.naturalWidth, height: img.naturalHeight };
}

export async function addPhotoToWallScene(
  file: File,
  options: {
    userId?: string;
    wallId: string;
    wallWidth: number;
    wallHeight: number;
    position?: { x: number; y: number };
  },
): Promise<void> {
  const ref = await resolvePhotoUrl(file, options.userId);

  if (isWallPhotoRef(ref)) {
    cachePhotoDisplayUrl(ref, URL.createObjectURL(file));
  }

  const displaySrc = isWallPhotoRef(ref)
    ? await resolveWallPhotoSrc(ref, options.wallId)
    : ref;

  const { width: naturalW, height: naturalH } = await loadImageSize(displaySrc);
  const maxWidth = Math.min(220, options.wallWidth * 0.35);
  const scale = Math.min(1, maxWidth / naturalW);
  const width = naturalW * scale;
  const height = naturalH * scale;

  const x =
    options.position?.x ??
    options.wallWidth * 0.2 + Math.random() * (options.wallWidth * 0.2);
  const y =
    options.position?.y ??
    options.wallHeight * 0.15 + Math.random() * (options.wallHeight * 0.2);

  const objects = useWallSceneStore.getState().document.objects;
  const maxZ = objects.reduce((max, o) => Math.max(max, o.zIndex), 0);

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

  useWallSceneStore.getState().upsertObject(photo);
  useWallSceneStore.getState().setSelectedId(photo.id);
  useWallSceneStore.getState().bumpRevision();
}
